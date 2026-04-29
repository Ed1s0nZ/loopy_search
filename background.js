// ==================== 全局状态管理 ====================
const GlobalState = {
  historyRetentionDays: 7,
  maxHistoryItems: 1000,
  lastError: null,
  lastSelectedText: '',
  networkStatus: {
    lastCheck: null,
    isOnline: true,
    lastError: null
  },
  serviceWorkerStatus: {
    isActive: false,
    lastRestart: null,
    restartCount: 0
  },
  listeners: new Map()
};

// 状态订阅机制
function subscribeState(key, callback) {
  if (!GlobalState.listeners.has(key)) {
    GlobalState.listeners.set(key, new Set());
  }
  GlobalState.listeners.get(key).add(callback);
}

function updateState(key, value) {
  GlobalState[key] = value;
  if (GlobalState.listeners.has(key)) {
    GlobalState.listeners.get(key).forEach(cb => cb(value));
  }
}

// ==================== AI 请求稳定引擎 ====================
const AIRequestEngine = {
  config: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    requestTimeout: 120000,
    maxConcurrentRequests: 3
  },
  
  requestQueue: [],
  activeRequests: new Map(),
  requestStats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    retriedRequests: 0
  },
  
  // 指数退避延迟计算
  calculateDelay(retryCount) {
    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, retryCount),
      this.config.maxDelay
    );
    return delay + Math.random() * 100;
  },
  
  // 检查是否应该重试
  shouldRetry(error, retryCount) {
    if (retryCount >= this.config.maxRetries) return false;
    
    const retryableErrors = [
      'network error',
      'fetch failed',
      'timeout',
      'abort',
      'rate limit',
      'too many requests',
      '500',
      '502',
      '503',
      '504',
      'service unavailable',
      'bad gateway'
    ];
    
    const errorMsg = (error.message || '').toLowerCase();
    return retryableErrors.some(err => errorMsg.includes(err));
  },
  
  // 分类错误类型
  classifyError(error, response = null) {
    const errorMsg = (error.message || '').toLowerCase();
    
    if (error.name === 'AbortError') {
      return { type: 'timeout', message: '请求超时，请稍后重试', recoverable: true };
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('fetch failed')) {
      return { type: 'network', message: '网络连接失败，请检查网络设置', recoverable: true };
    }
    
    if (response) {
      switch (response.status) {
        case 401:
        case 403:
          return { type: 'auth', message: 'API密钥无效，请检查配置', recoverable: false };
        case 429:
          return { type: 'rate_limit', message: '请求过于频繁，请稍后重试', recoverable: true };
        case 400:
          return { type: 'bad_request', message: '请求参数错误，请检查输入', recoverable: false };
        case 500:
        case 502:
        case 503:
        case 504:
          return { type: 'server_error', message: '服务器暂时不可用，请稍后重试', recoverable: true };
      }
    }
    
    return { type: 'unknown', message: error.message || '未知错误', recoverable: true };
  },
  
  // 执行单个请求（带重试）
  async executeRequest(requestConfig, retryCount = 0) {
    const { url, options, apiKey } = requestConfig;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout);
    
    try {
      this.requestStats.totalRequests++;
      
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${apiKey}`
        }
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || `请求失败 (${response.status})`;
        } catch {
          errorMessage = `请求失败 (${response.status}): ${errorText.substring(0, 200)}`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      this.requestStats.successfulRequests++;
      
      return {
        success: true,
        data: {
          choices: data.choices?.map(choice => ({
            message: choice.message,
            finish_reason: choice.finish_reason
          }))
        }
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorInfo = this.classifyError(error);
      
      // 更新网络状态
      if (errorInfo.type === 'network' || errorInfo.type === 'timeout') {
        updateState('networkStatus', {
          ...GlobalState.networkStatus,
          isOnline: false,
          lastError: errorInfo.message,
          lastCheck: Date.now()
        });
      }
      
      // 检查是否应该重试
      if (errorInfo.recoverable && this.shouldRetry(error, retryCount)) {
        this.requestStats.retriedRequests++;
        const delay = this.calculateDelay(retryCount);
        
        console.log(`请求失败，将在 ${delay}ms 后重试 (第 ${retryCount + 1} 次)`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeRequest(requestConfig, retryCount + 1);
      }
      
      this.requestStats.failedRequests++;
      return {
        success: false,
        error: errorInfo.message,
        errorType: errorInfo.type,
        retryCount
      };
    }
  },
  
  // 添加请求到队列
  async addToQueue(requestConfig) {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        config: requestConfig,
        resolve,
        reject,
        status: 'pending'
      };
      
      this.requestQueue.push(queueItem);
      this.processQueue();
    });
  },
  
  // 处理请求队列
  processQueue() {
    while (
      this.activeRequests.size < this.config.maxConcurrentRequests &&
      this.requestQueue.length > 0
    ) {
      const queueItem = this.requestQueue.shift();
      if (queueItem) {
        this.executeQueueItem(queueItem);
      }
    }
  },
  
  // 执行队列中的请求
  async executeQueueItem(queueItem) {
    queueItem.status = 'active';
    this.activeRequests.set(queueItem.id, queueItem);
    
    try {
      const result = await this.executeRequest(queueItem.config);
      queueItem.resolve(result);
    } catch (error) {
      queueItem.reject(error);
    } finally {
      this.activeRequests.delete(queueItem.id);
      queueItem.status = 'completed';
      this.processQueue();
    }
  },
  
  // 取消所有请求
  cancelAllRequests() {
    this.requestQueue = [];
    this.activeRequests.forEach((item, id) => {
      item.reject(new Error('请求已取消'));
    });
    this.activeRequests.clear();
  },
  
  // 获取请求统计
  getStats() {
    return {
      ...this.requestStats,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests.size
    };
  }
};

// ==================== 消息通信系统 ====================
const MessageBus = {
  handlers: new Map(),
  
  // 注册消息处理器
  register(action, handler) {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }
    this.handlers.get(action).push(handler);
  },
  
  // 发送消息（带超时和重试）
  async send(tabId, message, options = {}) {
    const { timeout = 5000, maxRetries = 2, retryDelay = 1000 } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('消息发送超时'));
          }, timeout);
          
          chrome.tabs.sendMessage(tabId, message, response => {
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          console.error(`消息发送失败，已重试 ${maxRetries} 次:`, error);
          throw error;
        }
        
        // 检查是否需要注入内容脚本
        if (error.message && error.message.includes('Could not establish connection')) {
          console.log('内容脚本未加载，尝试注入...');
          try {
            await this.injectContentScripts(tabId);
          } catch (injectError) {
            console.error('注入内容脚本失败:', injectError);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  },
  
  // 注入内容脚本
  async injectContentScripts(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['marked.min.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('注入 marked.min.js 失败:', chrome.runtime.lastError);
        }
        
        chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content.css']
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('注入 content.css 失败:', chrome.runtime.lastError);
          }
          
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              setTimeout(resolve, 200);
            }
          });
        });
      });
    });
  },
  
  // 广播消息到所有标签页
  async broadcast(message) {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({}, resolve);
    });
    
    const results = [];
    for (const tab of tabs) {
      try {
        const result = await this.send(tab.id, message, { maxRetries: 0 });
        results.push({ tabId: tab.id, success: true, result });
      } catch (error) {
        results.push({ tabId: tab.id, success: false, error: error.message });
      }
    }
    
    return results;
  }
};

// ==================== Service Worker 健康监控 ====================
const ServiceWorkerHealth = {
  heartbeatInterval: 30000,
  heartbeatTimer: null,
  
  // 启动健康监控
  start() {
    console.log('Service Worker 健康监控已启动');
    updateState('serviceWorkerStatus', {
      ...GlobalState.serviceWorkerStatus,
      isActive: true,
      lastRestart: Date.now()
    });
    
    // 设置定时心跳检查
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatInterval);
    
    // 监听扩展消息作为健康检查
    this.setupHealthCheckListener();
  },
  
  // 心跳检查
  heartbeat() {
    console.log('Service Worker 心跳检查:', new Date().toLocaleString());
    
    // 检查关键状态
    const stats = AIRequestEngine.getStats();
    console.log('请求统计:', stats);
    console.log('网络状态:', GlobalState.networkStatus);
    
    // 如果网络状态未知，主动检查
    if (!GlobalState.networkStatus.lastCheck || 
        Date.now() - GlobalState.networkStatus.lastCheck > 60000) {
      checkNetworkStatus();
    }
  },
  
  // 设置健康检查监听器
  setupHealthCheckListener() {
    MessageBus.register('healthCheck', (request, sender, sendResponse) => {
      sendResponse({
        status: 'healthy',
        timestamp: Date.now(),
        stats: AIRequestEngine.getStats(),
        networkStatus: GlobalState.networkStatus
      });
      return true;
    });
  },
  
  // 停止监控
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },
  
  // 记录重启
  recordRestart() {
    const status = GlobalState.serviceWorkerStatus;
    updateState('serviceWorkerStatus', {
      ...status,
      lastRestart: Date.now(),
      restartCount: status.restartCount + 1,
      isActive: true
    });
  }
};

// ==================== 存储优化引擎 ====================
const StorageEngine = {
  cache: new Map(),
  cacheTimeout: 5000,
  writeQueue: [],
  isWriting: false,
  maxBatchSize: 50,
  
  // 带缓存的读取
  async get(keys, options = {}) {
    const { useCache = true } = options;
    const cacheKey = JSON.stringify(keys);
    
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.value;
      }
      this.cache.delete(cacheKey);
    }
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, result => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          if (useCache) {
            this.cache.set(cacheKey, {
              value: result,
              timestamp: Date.now()
            });
          }
          resolve(result);
        }
      });
    });
  },
  
  // 批量写入（带队列）
  async set(data, options = {}) {
    const { immediate = false } = options;
    
    if (immediate) {
      return this.performWrite(data);
    }
    
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ data, resolve, reject });
      this.processWriteQueue();
    });
  },
  
  // 处理写入队列
  async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;
    
    this.isWriting = true;
    
    try {
      // 合并批量写入
      const batch = [];
      while (batch.length < this.maxBatchSize && this.writeQueue.length > 0) {
        batch.push(this.writeQueue.shift());
      }
      
      // 合并所有数据
      const mergedData = {};
      batch.forEach(item => {
        Object.assign(mergedData, item.data);
      });
      
      // 执行写入
      await this.performWrite(mergedData);
      
      // 清除相关缓存
      Object.keys(mergedData).forEach(key => {
        for (const [cacheKey, cached] of this.cache) {
          if (cacheKey.includes(key)) {
            this.cache.delete(cacheKey);
          }
        }
      });
      
      // 解析所有 Promise
      batch.forEach(item => item.resolve());
      
    } catch (error) {
      // 拒绝所有 Promise
      this.writeQueue.forEach(item => item.reject(error));
      this.writeQueue = [];
    } finally {
      this.isWriting = false;
      if (this.writeQueue.length > 0) {
        setTimeout(() => this.processWriteQueue(), 100);
      }
    }
  },
  
  // 执行实际写入
  performWrite(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },
  
  // 清理缓存
  clearCache() {
    this.cache.clear();
  },
  
  // 获取存储使用情况
  async getStorageInfo() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, bytes => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve({
            bytesInUse: bytes,
            quota: chrome.storage.local.QUOTA_BYTES,
            percentage: (bytes / chrome.storage.local.QUOTA_BYTES * 100).toFixed(2)
          });
        }
      });
    });
  }
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

// 初始化扩展
function initializeExtension() {
  console.log('AI划词搜索扩展初始化中...');
  
  // 启动 Service Worker 健康监控
  ServiceWorkerHealth.start();
  ServiceWorkerHealth.recordRestart();
  
  // 更新上下文菜单
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

  // 设置网络状态检查定时任务
  chrome.alarms.create('networkCheck', {
    periodInMinutes: 5 // 每5分钟检查一次
  });
  
  // 加载历史记录保留天数设置
  chrome.storage.local.get({ historyRetention: 7 }, function(data) {
    updateState('historyRetentionDays', data.historyRetention);
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
  
  // 执行首次清理
  console.debug('扩展启动，执行首次清理');
  cleanupHistory();
}

// 扩展安装时触发
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('扩展安装/更新:', details.reason);
  initializeExtension();
  
  // 只有在新安装时才打开设置页面
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'popup.html'
    });
  }
});

// 浏览器启动时触发
chrome.runtime.onStartup.addListener(function() {
  console.log('浏览器启动，扩展重新激活');
  initializeExtension();
});

// 插件暂停前的清理
chrome.runtime.onSuspend.addListener(function() {
  console.debug('插件即将暂停，执行清理');
  ServiceWorkerHealth.stop();
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
      updateState('historyRetentionDays', changes.historyRetention.newValue);
      console.debug('历史记录保留天数已更新:', GlobalState.historyRetentionDays);
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
  updateState('lastSelectedText', info.selectionText);

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
        updateState('lastError', error);
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
          updateState('lastError', error);
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
          updateState('lastError', error);
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

// 清理过期的历史记录（异步版本）
async function cleanupHistory() {
  console.debug('开始清理历史记录, 保留天数:', GlobalState.historyRetentionDays);
  
  // 如果清理正在进行中，避免重复执行
  if (cleanupHistory.isRunning) {
    console.debug('清理任务正在进行中，跳过本次清理');
    return;
  }
  
  cleanupHistory.isRunning = true;
  
  try {
    // 使用存储引擎读取数据
    const data = await StorageEngine.get({
      searchHistory: [],
      maxChatHistory: 20,
      saveHistory: true
    });
    
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
    const cutoffTime = now - (GlobalState.historyRetentionDays * 24 * 60 * 60 * 1000);
    console.debug('当前时间:', new Date(now).toLocaleString());
    console.debug('清理截止时间:', new Date(cutoffTime).toLocaleString());
    console.debug('保留天数设置:', GlobalState.historyRetentionDays);
    
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
    if (updatedHistory.length > GlobalState.maxHistoryItems) {
      updatedHistory = updatedHistory.slice(0, GlobalState.maxHistoryItems);
    }
    
    // 如果有记录被删除，则更新存储
    if (updatedHistory.length < history.length) {
      console.debug(`清理完成: 从 ${history.length} 条记录减少到 ${updatedHistory.length} 条`);
      await StorageEngine.set({ searchHistory: updatedHistory });
      console.debug('已成功保存更新后的历史记录');
    } else {
      console.debug('没有找到需要清理的记录');
    }
    
  } catch (error) {
    console.error('清理历史记录时发生错误:', error);
  } finally {
    cleanupHistory.isRunning = false;
  }
}

// 初始化清理状态标志
cleanupHistory.isRunning = false;

// 检查网络状态
function checkNetworkStatus() {
  fetch('https://www.google.com/favicon.ico', { 
    method: 'HEAD',
    mode: 'no-cors',
    cache: 'no-store'
  })
  .then(() => {
    updateState('networkStatus', {
      ...GlobalState.networkStatus,
      lastCheck: Date.now(),
      isOnline: true,
      lastError: null
    });
    console.log('网络状态检查: 在线');
  })
  .catch(error => {
    updateState('networkStatus', {
      ...GlobalState.networkStatus,
      lastCheck: Date.now(),
      isOnline: false,
      lastError: error.message
    });
    console.error('网络状态检查: 离线', error);
  });
}

// 统一消息处理
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.debug('收到消息:', request.action);
  
  const handleRequest = async () => {
    try {
      switch (request.action) {
        // ==================== AI 请求处理 ====================
        case 'fetchAIResponse': {
          console.debug('收到 API 请求:', {
            url: request.apiUrl,
            model: request.data?.model
          });
          
          const requestConfig = {
            url: request.apiUrl,
            apiKey: request.apiKey,
            options: {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(request.data)
            }
          };
          
          // 使用 AI 请求引擎处理
          const result = await AIRequestEngine.addToQueue(requestConfig);
          
          // 更新网络状态
          if (result.success) {
            updateState('networkStatus', {
              ...GlobalState.networkStatus,
              isOnline: true,
              lastCheck: Date.now(),
              lastError: null
            });
          }
          
          sendResponse(result);
          break;
        }
        
        // ==================== 图标 URL ====================
        case 'getIconUrl':
          sendResponse({ url: chrome.runtime.getURL('images/icon48.png') });
          break;
        
        // ==================== 保存搜索历史 ====================
        case 'saveSearchHistory': {
          const id = await saveSearchHistory(request.data);
          sendResponse({ id: id });
          break;
        }
        
        // ==================== 更新历史记录保留天数 ====================
        case 'updateHistoryRetention':
          console.debug('收到更新历史记录保留天数请求:', request.days);
          updateState('historyRetentionDays', request.days);
          await cleanupHistory();
          sendResponse({ success: true });
          break;
        
        // ==================== 打开设置页面 ====================
        case 'openSettings':
          try {
            chrome.runtime.openOptionsPage(function() {
              if (chrome.runtime.lastError) {
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
          return;
        
        // ==================== 获取最后错误 ====================
        case 'getLastError':
          sendResponse({ error: GlobalState.lastError });
          updateState('lastError', null);
          break;
        
        // ==================== 获取网络状态 ====================
        case 'getNetworkStatus':
          sendResponse({ 
            status: GlobalState.networkStatus,
            serviceWorkerStatus: GlobalState.serviceWorkerStatus,
            requestStats: AIRequestEngine.getStats(),
            extensionInfo: {
              version: chrome.runtime.getManifest().version,
              id: chrome.runtime.id
            }
          });
          break;
        
        // ==================== 获取请求统计 ====================
        case 'getRequestStats':
          sendResponse({
            success: true,
            stats: AIRequestEngine.getStats()
          });
          break;
        
        // ==================== 取消所有请求 ====================
        case 'cancelAllRequests':
          AIRequestEngine.cancelAllRequests();
          sendResponse({ success: true });
          break;
        
        // ==================== 健康检查 ====================
        case 'healthCheck':
          sendResponse({
            status: 'healthy',
            timestamp: Date.now(),
            stats: AIRequestEngine.getStats(),
            networkStatus: GlobalState.networkStatus,
            serviceWorkerStatus: GlobalState.serviceWorkerStatus
          });
          break;
        
        // ==================== 存储信息 ====================
        case 'getStorageInfo':
          try {
            const info = await StorageEngine.getStorageInfo();
            sendResponse({ success: true, data: info });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;
        
        // ==================== 默认处理 ====================
        default:
          console.warn('未知的消息类型:', request.action);
          sendResponse({ success: false, error: '未知的消息类型' });
      }
    } catch (error) {
      console.error('消息处理错误:', error);
      sendResponse({ 
        success: false, 
        error: error.message || '内部错误，请稍后重试' 
      });
    }
  };
  
  handleRequest();
  return true; // 保持消息通道开放
});

// 保存搜索历史（异步版本）
async function saveSearchHistory(data) {
  const id = generateId();
  const timestamp = Date.now();
  
  console.debug('准备保存历史记录:', {
    id: id,
    timestamp: new Date(timestamp).toLocaleString(),
    queryLength: data.query.length
  });
  
  try {
    // 使用存储引擎读取配置
    const config = await StorageEngine.get({ 
      saveHistory: true,
      maxChatHistory: 20
    });
    
    // 如果用户禁用了历史记录，则不保存
    if (!config.saveHistory) {
      console.debug('历史记录功能已禁用，跳过保存');
      return id;
    }
    
    // 读取现有历史记录
    const storage = await StorageEngine.get({ searchHistory: [] });
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
    if (history.length > GlobalState.maxHistoryItems) {
      history = history.slice(0, GlobalState.maxHistoryItems);
    }
    
    // 清理超过保留天数的记录
    const cutoffTime = Date.now() - (GlobalState.historyRetentionDays * 24 * 60 * 60 * 1000);
    history = history.filter(item => item.timestamp >= cutoffTime);
    
    // 使用存储引擎保存
    await StorageEngine.set({ searchHistory: history });
    console.debug('历史记录保存成功，新的总数量:', history.length);
    
    return id;
    
  } catch (error) {
    console.error('保存历史记录失败:', error);
    return id;
  }
}

// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
} 