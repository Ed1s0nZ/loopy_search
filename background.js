// 全局变量
let historyRetentionDays = 7; // 默认保留7天
let lastError = null; // 存储最后一次错误信息
let lastSelectedText = ''; // 存储最后一次选中的文本
let networkStatus = { // 网络状态监控
  lastCheck: null,
  isOnline: true,
  lastError: null
};

// 创建右键菜单
chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "aiSearch",
    title: "使用AI解释「%s」",
    contexts: ["selection"]
  });
  
  // 设置键盘快捷键说明
  chrome.commands.getAll(function(commands) {
    console.log('可用的快捷键命令:', commands);
  });
  
  // 设置历史记录清理定时任务
  chrome.alarms.create('historyCleanup', {
    periodInMinutes: 24 * 60 // 每天运行一次
  });
  
  // 设置网络状态检查定时任务
  chrome.alarms.create('networkCheck', {
    periodInMinutes: 5 // 每5分钟检查一次
  });
  
  // 加载历史记录保留天数设置
  chrome.storage.sync.get({ historyRetention: 7 }, function(data) {
    historyRetentionDays = data.historyRetention;
  });
  
  // 打开设置页面
  chrome.tabs.create({
    url: 'popup.html'
  });
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === "aiSearch" && info.selectionText) {
    // 记录选中的文本，以防传递失败
    lastSelectedText = info.selectionText;
    
    try {
      // 发送消息到内容脚本
      chrome.tabs.sendMessage(tab.id, {
        action: "searchWithAI",
        text: info.selectionText
      }, function(response) {
        // 检查是否有响应
        if (chrome.runtime.lastError) {
          console.error("发送消息错误:", chrome.runtime.lastError);
          
          // 如果内容脚本未响应，可能是尚未加载，尝试注入内容脚本
          // 先注入marked.min.js，然后再注入content.js
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['marked.min.js']
          }, function() {
            // 注入CSS
            chrome.scripting.insertCSS({
              target: { tabId: tab.id },
              files: ['content.css']
            }, function() {
              // 然后注入主脚本
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
              }, function() {
                // 再次尝试发送消息
                setTimeout(function() {
                  chrome.tabs.sendMessage(tab.id, {
                    action: "searchWithAI",
                    text: info.selectionText
                  });
                }, 500); // 等待脚本加载
              });
            });
          });
        }
      });
    } catch (error) {
      console.error("右键菜单处理错误:", error);
      lastError = error;
    }
  }
});

// 处理键盘快捷键
chrome.commands.onCommand.addListener(function(command) {
  if (command === "search_with_ai") {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "searchWithAI",
            useSelectedText: true
          }, function(response) {
            // 检查是否有响应
            if (chrome.runtime.lastError) {
              console.error("发送消息错误:", chrome.runtime.lastError);
            }
          });
        } catch (error) {
          console.error("快捷键处理错误:", error);
          lastError = error;
        }
      }
    });
  }
});

// 处理定时任务
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'historyCleanup') {
    cleanupHistory();
  } else if (alarm.name === 'networkCheck') {
    checkNetworkStatus();
  }
});

// 清理过期的历史记录
function cleanupHistory() {
  // 如果设置为永久保留，则不执行清理
  if (historyRetentionDays === 0) return;
  
  chrome.storage.local.get('searchHistory', function(data) {
    const history = data.searchHistory || [];
    
    if (history.length === 0) return;
    
    const now = Date.now();
    const cutoffTime = now - (historyRetentionDays * 24 * 60 * 60 * 1000);
    
    // 过滤掉过期的记录
    const updatedHistory = history.filter(item => item.timestamp > cutoffTime);
    
    // 如果有记录被删除，则更新存储
    if (updatedHistory.length < history.length) {
      chrome.storage.local.set({ searchHistory: updatedHistory });
      console.log(`已清理 ${history.length - updatedHistory.length} 条过期历史记录`);
    }
  });
}

// 检查网络状态
function checkNetworkStatus() {
  // 使用fetch请求一个小文件来检查网络连接
  fetch('https://www.google.com/favicon.ico', { 
    method: 'HEAD',
    mode: 'no-cors',
    cache: 'no-store'
  })
  .then(() => {
    networkStatus.lastCheck = Date.now();
    networkStatus.isOnline = true;
    networkStatus.lastError = null;
    console.log('网络状态检查: 在线');
  })
  .catch(error => {
    networkStatus.lastCheck = Date.now();
    networkStatus.isOnline = false;
    networkStatus.lastError = error.message;
    console.error('网络状态检查: 离线', error);
  });
}

// 处理消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    if (request.action === 'fetchAIResponse') {
      // 处理 API 请求
      fetch(request.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`
        },
        body: JSON.stringify(request.data)
      })
      .then(async response => {
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || `HTTP错误: ${response.status}`;
          } catch (e) {
            errorMessage = `HTTP错误: ${response.status}, ${errorText}`;
          }
          sendResponse({ success: false, error: errorMessage });
        } else {
          const data = await response.json();
          sendResponse({ success: true, data: data });
        }
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || '请求失败，请检查网络连接和API密钥是否正确'
        });
      });
      return true; // 表示我们会异步发送响应
    } else if (request.action === 'getIconUrl') {
      sendResponse({ url: chrome.runtime.getURL('images/icon48.png') });
    } else if (request.action === 'saveSearchHistory') {
      const id = saveSearchHistory(request.data);
      sendResponse({ id: id });
    } else if (request.action === 'updateHistoryRetention') {
      historyRetentionDays = request.days;
      sendResponse({ success: true });
    } else if (request.action === 'openSettings') {
      // 尝试打开设置页面
      try {
        chrome.runtime.openOptionsPage(function() {
          if (chrome.runtime.lastError) {
            // 如果 openOptionsPage 失败，尝试使用 tabs.create
            chrome.tabs.create({
              url: chrome.runtime.getURL('popup.html')
            }, function() {
              if (chrome.runtime.lastError) {
                console.error('打开设置页面失败:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            });
          } else {
            sendResponse({ success: true });
          }
        });
      } catch (error) {
        console.error('打开设置页面时出错:', error);
        // 使用备用方法
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        }, function() {
          sendResponse({ success: true });
        });
      }
      return true; // 表示我们会异步发送响应
    } else if (request.action === 'getLastError') {
      sendResponse({ error: lastError });
      lastError = null; // 清除错误
    } else if (request.action === 'getNetworkStatus') {
      checkNetworkStatus();
      sendResponse({ 
        status: networkStatus,
        extensionInfo: {
          version: chrome.runtime.getManifest().version,
          id: chrome.runtime.id
        }
      });
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({ 
      success: false, 
      error: error.message || '发生未知错误'
    });
  }
});

// 保存搜索历史
function saveSearchHistory(data) {
  const id = generateId();
  
  chrome.storage.sync.get({ saveHistory: true }, function(config) {
    // 如果用户禁用了历史记录，则不保存
    if (!config.saveHistory) return;
    
    chrome.storage.local.get('searchHistory', function(storage) {
      const history = storage.searchHistory || [];
      
      // 添加新记录
      const newRecord = {
        id: id,
        query: data.query,
        response: data.response,
        timestamp: Date.now(),
        rating: 0 // 0=无评分, 1=点赞, -1=踩
      };
      
      history.push(newRecord);
      
      // 保存更新后的历史记录
      chrome.storage.local.set({ searchHistory: history });
    });
  });
  
  return id;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
} 