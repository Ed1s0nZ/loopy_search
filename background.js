// 全局变量
let historyRetentionDays = 7; // 默认保留7天
let maxHistoryItems = 1000; // 最大历史记录数量
let lastError = null; // 存储最后一次错误信息
let lastSelectedText = ''; // 存储最后一次选中的文本
let networkStatus = { // 网络状态监控
  lastCheck: null,
  isOnline: true,
  lastError: null
};

// 应用代理设置
function applyProxySettings(settings) {
  // 如果未启用代理，设置为直接连接
  if (!settings || !settings.proxyEnabled) {
    chrome.proxy.settings.set({
      value: { mode: 'direct' },
      scope: 'regular'
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('禁用代理失败:', chrome.runtime.lastError);
      } else {
        console.log('已禁用代理，设置为直接连接');
      }
    });
    return;
  }

  // 构建代理配置
  let config = {};

  try {
    switch (settings.proxyMode) {
      case 'direct':
        config = { mode: 'direct' };
        break;
        
      case 'auto_detect':
        config = { mode: 'auto_detect' };
        break;
        
      case 'pac_script':
        config = {
          mode: 'pac_script',
          pacScript: {
            url: settings.pacScriptUrl,
            mandatory: true
          }
        };
        break;
        
      case 'fixed_servers':
        // 处理绕过列表
        const bypassList = settings.bypassList
          .split(/[,\n]/)
          .map(item => item.trim())
          .filter(item => item);
        
        // 构建代理服务器配置
        let singleProxy = {
          scheme: settings.proxyScheme,
          host: settings.proxyHost,
          port: parseInt(settings.proxyPort, 10)
        };
        
        // 如果需要认证，添加认证信息
        if (settings.proxyAuthRequired && settings.proxyUsername && settings.proxyPassword) {
          // 注意：只有SOCKS4/5代理支持在配置中直接设置认证信息
          if (settings.proxyScheme === 'socks4' || settings.proxyScheme === 'socks5') {
            singleProxy.username = settings.proxyUsername;
            singleProxy.password = settings.proxyPassword;
          } else {
            console.log('注意: HTTP/HTTPS代理的认证需要在浏览器弹出的认证窗口中手动输入');
          }
        }
        
        config = {
          mode: 'fixed_servers',
          rules: {
            singleProxy: singleProxy,
            bypassList: bypassList
          }
        };
        break;
        
      case 'system':
        config = { mode: 'system' };
        break;
    }

    // 应用代理设置
    chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('代理设置应用失败:', chrome.runtime.lastError);
      } else {
        console.log('代理设置已应用:', config);
      }
    });
    
    // 输出当前活跃的代理设置，用于调试
    chrome.proxy.settings.get({}, function(details) {
      console.log('当前活跃的代理设置:', details);
    });
  } catch (error) {
    console.error('应用代理设置时发生错误:', error);
  }
}

// 更新上下文菜单
function updateContextMenus() {
  // 先移除所有现有的菜单项
  chrome.contextMenus.removeAll(() => {
    // 创建主菜单项
    chrome.contextMenus.create({
      id: "aiSearchParent",
      title: "AI划词搜索",
      contexts: ["selection"]
    });

    // 获取所有提示词模板和默认提示词前缀
    chrome.storage.local.get({ 
      promptTemplates: [],
      prompt: '请解释以下内容:'
    }, function(data) {
      const templates = data.promptTemplates;
      
      // 创建默认提示词前缀菜单项
      chrome.contextMenus.create({
        id: "defaultPrompt",
        title: "默认提示词前缀",
        parentId: "aiSearchParent",
        contexts: ["selection"]
      });
      
      // 添加分隔线
      chrome.contextMenus.create({
        id: "separator",
        type: "separator",
        parentId: "aiSearchParent",
        contexts: ["selection"]
      });
      
      // 按分类对模板进行分组
      const groupedTemplates = {};
      templates.forEach(template => {
        const category = template.category || '通用';
        if (!groupedTemplates[category]) {
          groupedTemplates[category] = [];
        }
        groupedTemplates[category].push(template);
      });

      // 为每个分类创建子菜单
      Object.entries(groupedTemplates).forEach(([category, categoryTemplates]) => {
        // 创建分类子菜单
        const categoryId = `category_${category}`;
        chrome.contextMenus.create({
          id: categoryId,
          title: category,
          parentId: "aiSearchParent",
          contexts: ["selection"]
        });

        // 为分类下的每个提示词创建菜单项
        categoryTemplates.forEach(template => {
          chrome.contextMenus.create({
            id: `prompt_${template.title}`,
            title: template.title,
            parentId: categoryId,
            contexts: ["selection"]
          });
        });
      });
    });
  });
}

// 创建右键菜单
chrome.runtime.onInstalled.addListener(function() {
  updateContextMenus();
  
  // 设置键盘快捷键说明
  chrome.commands.getAll(function(commands) {
    console.log('可用的快捷键命令:', commands);
  });
  
  // 设置历史记录清理定时任务
  chrome.alarms.create('historyCleanup', {
    periodInMinutes: 60 // 每小时运行一次
  });
  console.debug('已创建历史记录清理定时任务（每小时执行）');

  // 添加插件卸载前的清理
  chrome.runtime.onSuspend.addListener(function() {
    console.debug('插件即将卸载，执行最后一次清理');
    cleanupHistory();
  });

  // 设置网络状态检查定时任务
  chrome.alarms.create('networkCheck', {
    periodInMinutes: 5 // 每5分钟检查一次
  });
  
  // 加载历史记录保留天数设置
  chrome.storage.local.get({ historyRetention: 7 }, function(data) {
    historyRetentionDays = data.historyRetention;
  });
  
  // 加载并应用代理设置
  chrome.storage.local.get({
    proxyEnabled: false,
    proxyMode: 'direct',
    pacScriptUrl: '',
    proxyScheme: 'http',
    proxyHost: '',
    proxyPort: 8080,
    proxyAuthRequired: false,
    proxyUsername: '',
    proxyPassword: '',
    bypassList: 'localhost, 127.0.0.1, <local>'
  }, function(data) {
    applyProxySettings(data);
  });
  
  // 打开设置页面
  chrome.tabs.create({
    url: 'popup.html'
  });
  
  // 另外在扩展启动时也执行一次清理
  console.debug('扩展启动，执行首次清理');
  cleanupHistory();
});

// 监听存储变化，当历史记录变化时进行清理
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.searchHistory) {
    console.debug('历史记录发生变化，执行清理');
    cleanupHistory();
  }
});

// 监听存储变化，更新菜单
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local') {
    if (changes.promptTemplates || changes.customCategories) {
      updateContextMenus();
    }
    // 监听历史记录保留天数的变化
    if (changes.historyRetention) {
      historyRetentionDays = changes.historyRetention.newValue;
      console.debug('历史记录保留天数已更新:', historyRetentionDays);
      // 立即执行一次清理
      cleanupHistory();
    }
    
    // 监听最大对话历史数量的变化
    if (changes.maxChatHistory) {
      console.debug('最大对话历史数量已更新:', changes.maxChatHistory.newValue);
      // 立即执行一次清理
      cleanupHistory();
    }
    
    // 监听代理设置变化
    const proxySettings = [
      'proxyEnabled', 'proxyMode', 'pacScriptUrl', 'proxyScheme',
      'proxyHost', 'proxyPort', 'proxyAuthRequired',
      'proxyUsername', 'proxyPassword', 'bypassList'
    ];
    
    let proxyChanged = false;
    for (const key of proxySettings) {
      if (changes[key]) {
        proxyChanged = true;
        break;
      }
    }
    
    if (proxyChanged) {
      console.log('代理设置已更改，重新应用代理配置');
      chrome.storage.local.get({
        proxyEnabled: false,
        proxyMode: 'direct',
        pacScriptUrl: '',
        proxyScheme: 'http',
        proxyHost: '',
        proxyPort: 8080,
        proxyAuthRequired: false,
        proxyUsername: '',
        proxyPassword: '',
        bypassList: 'localhost, 127.0.0.1, <local>'
      }, function(data) {
        applyProxySettings(data);
      });
    }
  }
});

// 处理右键菜单点击事件
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (!info.selectionText) return;

  // 记录选中的文本，但我们会在content script中重新获取完整文本
  lastSelectedText = info.selectionText;

  if (info.menuItemId === "defaultPrompt") {
    // 使用默认提示词
    chrome.storage.local.get({ prompt: '请解释以下内容:' }, function(data) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: "getSelectedText",
          template: {
            title: "默认提示词",
            content: data.prompt,
            category: "通用"
          }
        }, function(response) {
          if (chrome.runtime.lastError && chrome.runtime.lastError.message.includes('Could not establish connection')) {
            console.debug("内容脚本未加载，准备注入:", chrome.runtime.lastError);
            
            // 如果内容脚本未响应，注入所需脚本
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['marked.min.js']
            }, function() {
              chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['content.css']
              }, function() {
                chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content.js']
                }, function() {
                  setTimeout(function() {
                    chrome.tabs.sendMessage(tab.id, {
                      action: "getSelectedText",
                      template: {
                        title: "默认提示词",
                        content: data.prompt,
                        category: "通用"
                      }
                    });
                  }, 500);
                });
              });
            });
          }
        });
      } catch (error) {
        console.debug("右键菜单处理错误:", error);
        lastError = error;
      }
    });
  } else if (info.menuItemId.startsWith('prompt_')) {
    const promptTitle = info.menuItemId.replace('prompt_', '');
    
    // 获取对应的提示词模板
    chrome.storage.local.get({ promptTemplates: [] }, function(data) {
      const template = data.promptTemplates.find(t => t.title === promptTitle);
      if (template) {
        // 发送消息到内容脚本，包含提示词模板
        try {
          chrome.tabs.sendMessage(tab.id, {
            action: "getSelectedText",
            template: template
          }, function(response) {
            if (chrome.runtime.lastError && chrome.runtime.lastError.message.includes('Could not establish connection')) {
              console.debug("内容脚本未加载，准备注入:", chrome.runtime.lastError);
              
              // 如果内容脚本未响应，注入所需脚本
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['marked.min.js']
              }, function() {
                chrome.scripting.insertCSS({
                  target: { tabId: tab.id },
                  files: ['content.css']
                }, function() {
                  chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                  }, function() {
                    setTimeout(function() {
                      chrome.tabs.sendMessage(tab.id, {
                        action: "getSelectedText",
                        template: template
                      });
                    }, 500);
                  });
                });
              });
            }
          });
        } catch (error) {
          console.debug("右键菜单处理错误:", error);
          lastError = error;
        }
      }
    });
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
  console.debug('收到定时任务:', alarm.name);
  if (alarm.name === 'historyCleanup') {
    console.debug('执行历史记录清理任务');
    cleanupHistory();
  } else if (alarm.name === 'networkCheck') {
    checkNetworkStatus();
  }
});

// 清理过期的历史记录
function cleanupHistory() {
  console.debug('开始清理历史记录, 保留天数:', historyRetentionDays);
  
  // 如果清理正在进行中，避免重复执行
  if (cleanupHistory.isRunning) {
    console.debug('清理任务正在进行中，跳过本次清理');
    return;
  }
  
  cleanupHistory.isRunning = true;
  
  chrome.storage.local.get({
    searchHistory: [],
    maxChatHistory: 20, // 默认最大对话历史数量
    saveHistory: true // 检查是否启用了历史记录功能
  }, function(data) {
    // 如果历史记录功能被禁用，直接返回
    if (!data.saveHistory) {
      console.debug('历史记录功能已禁用，跳过清理');
      cleanupHistory.isRunning = false;
      return;
    }
    
    const history = data.searchHistory || [];
    console.debug('当前历史记录数量:', history.length);
    
    if (history.length === 0) {
      console.debug('没有历史记录需要清理');
      cleanupHistory.isRunning = false;
      return;
    }
    
    const now = Date.now();
    const cutoffTime = now - (historyRetentionDays * 24 * 60 * 60 * 1000);
    console.debug('当前时间:', new Date(now).toLocaleString());
    console.debug('清理截止时间:', new Date(cutoffTime).toLocaleString());
    console.debug('保留天数设置:', historyRetentionDays);
    
    try {
      // 过滤掉过期的记录
      let updatedHistory = history.filter(item => {
        if (!item || !item.timestamp) {
          console.warn('发现无效的历史记录项:', item);
          return false;
        }
        const keep = item.timestamp > cutoffTime;
        if (!keep) {
          console.debug('将删除过期记录:', {
            query: item.query?.substring(0, 50) + '...',
            timestamp: new Date(item.timestamp).toLocaleString()
          });
        }
        return keep;
      });
      
      // 按类型分组限制数量
      const chatHistory = updatedHistory.filter(item => item.type === 'chat');
      const selectHistory = updatedHistory.filter(item => item.type === 'select');
      const otherHistory = updatedHistory.filter(item => item.type !== 'chat' && item.type !== 'select');
      
      // 如果聊天历史超过限制，只保留最新的maxChatHistory条
      if (chatHistory.length > data.maxChatHistory) {
        console.debug(`聊天历史超过限制(${data.maxChatHistory})，将清理旧记录`);
        chatHistory.sort((a, b) => b.timestamp - a.timestamp);
        chatHistory.splice(data.maxChatHistory);
      }
      
      // 如果划词历史超过限制，只保留最新的maxChatHistory条
      if (selectHistory.length > data.maxChatHistory) {
        console.debug(`划词历史超过限制(${data.maxChatHistory})，将清理旧记录`);
        selectHistory.sort((a, b) => b.timestamp - a.timestamp);
        selectHistory.splice(data.maxChatHistory);
      }
      
      // 合并历史记录
      updatedHistory = [...chatHistory, ...selectHistory, ...otherHistory];
      
      // 如果超过最大数量限制，删除旧记录
      if (updatedHistory.length > maxHistoryItems) {
        updatedHistory = updatedHistory.slice(0, maxHistoryItems);
      }
      
      // 如果有记录被删除，则更新存储
      if (updatedHistory.length < history.length) {
        console.debug(`清理完成: 从 ${history.length} 条记录减少到 ${updatedHistory.length} 条`);
        chrome.storage.local.set({ searchHistory: updatedHistory }, function() {
          if (chrome.runtime.lastError) {
            console.error('保存更新后的历史记录失败:', chrome.runtime.lastError);
          } else {
            console.debug('已成功保存更新后的历史记录');
          }
          cleanupHistory.isRunning = false;
        });
      } else {
        console.debug('没有找到需要清理的记录');
        cleanupHistory.isRunning = false;
      }
    } catch (error) {
      console.error('清理历史记录时发生错误:', error);
      cleanupHistory.isRunning = false;
    }
  });
}

// 初始化清理状态标志
cleanupHistory.isRunning = false;

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
      console.debug('收到 API 请求:', {
        url: request.apiUrl,
        model: request.data.model
      });

      // 设置请求超时
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 300000); // 5分钟超时

      // 处理 API 请求
      fetch(request.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${request.apiKey}`
        },
        body: JSON.stringify(request.data),
        signal: controller.signal
      })
      .then(async response => {
        clearTimeout(timeout);
        
        console.debug('收到 API 响应:', {
          status: response.status,
          ok: response.ok
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage;
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error?.message || errorJson.message || `请求失败 (${response.status})`;
          } catch (e) {
            errorMessage = `请求失败 (${response.status}): ${errorText}`;
          }
          console.debug('API 错误:', errorMessage);
          
          // 更新网络状态
          networkStatus.lastError = errorMessage;
          networkStatus.lastCheck = Date.now();
          
          sendResponse({ success: false, error: errorMessage });
        } else {
          const data = await response.json();
          console.debug('API 响应数据:', {
            hasChoices: !!data.choices,
            choicesLength: data.choices?.length
          });
          
          // 更新网络状态
          networkStatus.isOnline = true;
          networkStatus.lastCheck = Date.now();
          networkStatus.lastError = null;
          
          // 只保留必要的响应数据
          const cleanedData = {
            choices: data.choices?.map(choice => ({
              message: choice.message,
              finish_reason: choice.finish_reason
            }))
          };
          
          sendResponse({ success: true, data: cleanedData });
        }
      })
      .catch(error => {
        clearTimeout(timeout);
        
        console.debug('API 请求失败:', error);
        
        // 更新网络状态
        networkStatus.isOnline = false;
        networkStatus.lastCheck = Date.now();
        networkStatus.lastError = error.message;
        
        // 如果是超时错误
        if (error.name === 'AbortError') {
          sendResponse({ success: false, error: '请求超时，请稍后重试' });
        } else {
          sendResponse({ success: false, error: error.message });
        }
      });

      return true; // 保持消息通道开放
    } else if (request.action === 'getIconUrl') {
      sendResponse({ url: chrome.runtime.getURL('images/icon48.png') });
    } else if (request.action === 'saveSearchHistory') {
      const id = saveSearchHistory(request.data);
      sendResponse({ id: id });
    } else if (request.action === 'updateHistoryRetention') {
      console.debug('收到更新历史记录保留天数请求:', request.days);
      historyRetentionDays = request.days;
      // 立即执行一次清理
      cleanupHistory();
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
                console.debug('打开设置页面失败:', chrome.runtime.lastError);
                sendResponse({ success: false, error: '无法打开设置页面' });
              } else {
                sendResponse({ success: true });
              }
            });
          } else {
            sendResponse({ success: true });
          }
        });
      } catch (error) {
        console.debug('打开设置页面时出错:', error);
        sendResponse({ success: false, error: '无法打开设置页面' });
      }
      return true; // 表示我们会异步发送响应
    } else if (request.action === 'getLastError') {
      sendResponse({ error: lastError });
      lastError = null; // 清除错误
    } else if (request.action === 'getNetworkStatus') {
      sendResponse({ 
        status: networkStatus,
        extensionInfo: {
          version: chrome.runtime.getManifest().version,
          id: chrome.runtime.id
        }
      });
    }
  } catch (error) {
    console.debug('消息处理错误:', error);
    // 清理错误状态
    lastError = null;
    sendResponse({ success: false, error: '内部错误，请稍后重试' });
  }
  return true; // 保持消息通道开放
});

// 保存搜索历史
function saveSearchHistory(data) {
  const id = generateId();
  const timestamp = Date.now();
  
  console.debug('准备保存历史记录:', {
    id: id,
    timestamp: new Date(timestamp).toLocaleString(),
    queryLength: data.query.length
  });
  
  chrome.storage.local.get({ 
    saveHistory: true,
    maxChatHistory: 20 // 默认最大对话历史数量
  }, function(config) {
    // 如果用户禁用了历史记录，则不保存
    if (!config.saveHistory) {
      console.debug('历史记录功能已禁用，跳过保存');
      return;
    }
    
    chrome.storage.local.get('searchHistory', function(storage) {
      let history = storage.searchHistory || [];
      console.debug('当前历史记录数量:', history.length);
      
      // 添加新记录，保留type字段
      const newRecord = {
        id: id,
        query: data.query,
        response: data.response,
        timestamp: timestamp,
        rating: 0,
        type: data.type === 'search' ? 'select' : (data.type || 'other')
      };
      
      // 限制查询和响应的长度
      if (newRecord.query.length > 5000) {
        newRecord.query = newRecord.query.substring(0, 5000) + '...';
      }
      if (newRecord.response.length > 10000) {
        newRecord.response = newRecord.response.substring(0, 10000) + '...';
      }
      
      // 添加新记录到开头
      history.unshift(newRecord);
      
      // 按类型分组限制数量
      const chatHistory = history.filter(item => item.type === 'chat');
      const selectHistory = history.filter(item => item.type === 'select');
      const otherHistory = history.filter(item => item.type !== 'chat' && item.type !== 'select');
      
      // 如果聊天历史超过限制，只保留最新的maxChatHistory条
      if (chatHistory.length > config.maxChatHistory) {
        console.debug(`聊天历史超过限制(${config.maxChatHistory})，将清理旧记录`);
        chatHistory.splice(config.maxChatHistory);
      }
      
      // 如果划词历史超过限制，只保留最新的maxChatHistory条
      if (selectHistory.length > config.maxChatHistory) {
        console.debug(`划词历史超过限制(${config.maxChatHistory})，将清理旧记录`);
        selectHistory.splice(config.maxChatHistory);
      }
      
      // 合并历史记录
      history = [...chatHistory, ...selectHistory, ...otherHistory];
      
      // 如果超过最大数量限制，删除旧记录
      if (history.length > maxHistoryItems) {
        history = history.slice(0, maxHistoryItems);
      }
      
      // 清理超过保留天数的记录
      const cutoffTime = Date.now() - (historyRetentionDays * 24 * 60 * 60 * 1000);
      history = history.filter(item => item.timestamp >= cutoffTime);
      
      // 保存更新后的历史记录
      chrome.storage.local.set({ searchHistory: history }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存历史记录失败:', chrome.runtime.lastError);
        } else {
          console.debug('历史记录保存成功，新的总数量:', history.length);
        }
      });
    });
  });
  
  return id;
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
} 