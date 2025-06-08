document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const customModelContainer = document.getElementById('customModelContainer');
  const customModelInput = document.getElementById('customModel');
  const promptInput = document.getElementById('prompt');
  const useMarkdownCheckbox = document.getElementById('useMarkdown');
  const saveHistoryCheckbox = document.getElementById('saveHistory');
  const historyRetentionSelect = document.getElementById('historyRetention');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const historyPreviewList = document.getElementById('historyPreviewList');
  const viewAllHistoryBtn = document.getElementById('viewAllHistoryBtn');

  // 加载保存的设置
  chrome.storage.sync.get({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    customModel: '',
    prompt: '请解释以下内容:',
    useMarkdown: true,
    saveHistory: true,
    historyRetention: 7
  }, function(items) {
    apiUrlInput.value = items.apiUrl;
    apiKeyInput.value = items.apiKey;
    modelSelect.value = items.model;
    customModelInput.value = items.customModel;
    promptInput.value = items.prompt;
    useMarkdownCheckbox.checked = items.useMarkdown;
    saveHistoryCheckbox.checked = items.saveHistory;
    historyRetentionSelect.value = items.historyRetention.toString();
    
    // 如果选择的是自定义模型，显示自定义模型输入框
    if (items.model === 'custom') {
      customModelContainer.style.display = 'block';
    }
  });

  // 模型选择变化时的处理
  modelSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customModelContainer.style.display = 'block';
    } else {
      customModelContainer.style.display = 'none';
    }
  });

  // 密码显示/隐藏功能
  togglePasswordBtn.addEventListener('click', function() {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      togglePasswordBtn.textContent = '隐藏';
    } else {
      apiKeyInput.type = 'password';
      togglePasswordBtn.textContent = '显示';
    }
  });

  // 标签页切换
  navTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // 移除所有标签页的active类
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // 添加当前标签页的active类
      this.classList.add('active');
      const tabId = this.dataset.tab + 'Tab';
      document.getElementById(tabId).classList.add('active');
      
      // 如果切换到历史记录标签页，加载历史记录预览
      if (this.dataset.tab === 'history') {
        loadHistoryPreview();
      }
    });
  });

  // 查看全部历史按钮
  viewAllHistoryBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'history.html' });
  });

  // 保存设置
  saveBtn.addEventListener('click', function() {
    const model = modelSelect.value;
    const actualModel = model === 'custom' ? customModelInput.value : model;
    
    chrome.storage.sync.set({
      apiUrl: apiUrlInput.value,
      apiKey: apiKeyInput.value,
      model: model,
      customModel: customModelInput.value,
      prompt: promptInput.value,
      actualModel: actualModel,
      useMarkdown: useMarkdownCheckbox.checked,
      saveHistory: saveHistoryCheckbox.checked,
      historyRetention: parseInt(historyRetentionSelect.value)
    }, function() {
      // 显示保存成功的提示
      statusDiv.style.display = 'block';
      setTimeout(function() {
        statusDiv.style.display = 'none';
      }, 2000);
      
      // 如果修改了历史记录保留时间，更新清理任务
      updateHistoryCleanupAlarm(parseInt(historyRetentionSelect.value));
    });
  });

  // 加载历史记录预览
  function loadHistoryPreview() {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      
      if (history.length === 0) {
        historyPreviewList.innerHTML = '<div class="history-preview-empty">暂无历史记录</div>';
        return;
      }
      
      // 按时间倒序排列
      history.sort((a, b) => b.timestamp - a.timestamp);
      
      // 只显示最近的5条记录
      const recentHistory = history.slice(0, 5);
      
      historyPreviewList.innerHTML = '';
      
      recentHistory.forEach(item => {
        const date = new Date(item.timestamp);
        const formattedDate = `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
        
        // 截取查询内容作为标题
        const queryText = item.query.length > 50 ? item.query.substring(0, 50) + '...' : item.query;
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-preview-item';
        historyItem.innerHTML = `
          <div class="history-preview-query">${queryText}</div>
          <div class="history-preview-date">${formattedDate}</div>
        `;
        
        historyPreviewList.appendChild(historyItem);
      });
    });
  }

  // 更新历史记录清理任务
  function updateHistoryCleanupAlarm(days) {
    // 如果设置为永久保留，则取消定时清理任务
    if (days === 0) {
      chrome.alarms.clear('historyCleanup');
      return;
    }
    
    // 创建或更新定时清理任务，每天运行一次
    chrome.alarms.create('historyCleanup', {
      periodInMinutes: 24 * 60 // 每天运行一次
    });
    
    // 发送消息给background.js，更新清理天数
    chrome.runtime.sendMessage({
      action: 'updateHistoryRetention',
      days: days
    });
  }

  // 数字前补零
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }
}); 