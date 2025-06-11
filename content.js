// 全局变量
let aiSearchResult = null;
let aiSearchButton = null;
let selectedText = '';
let rawResult = ''; // 存储原始结果文本
let isMarkdownMode = true; // 默认使用Markdown模式
let currentSearchId = null; // 当前搜索的ID
let showFloatingButton = false; // 默认不显示浮动按钮

// 生成唯一ID
function generateId() {
  return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 初始化时读取用户设置
chrome.storage.sync.get({
  useMarkdown: true
}, function(items) {
  isMarkdownMode = items.useMarkdown;
});

// 创建AI搜索按钮
function createAISearchButton() {
  // 如果按钮已存在，先移除旧的按钮
  if (aiSearchButton) {
    if (aiSearchButton.parentNode) {
      aiSearchButton.parentNode.removeChild(aiSearchButton);
    }
    aiSearchButton = null;
  }

  // 创建新按钮
  const button = document.createElement('div');
  button.className = 'ai-search-button';
  button.title = '使用AI解释所选文本';
  
  const buttonImage = document.createElement('img');
  buttonImage.src = chrome.runtime.getURL('images/icon48.png');
  button.appendChild(buttonImage);
  
  // 添加波纹效果
  button.addEventListener('mousedown', function(e) {
    this.style.transform = 'scale(0.95)';
  });
  
  button.addEventListener('mouseup', function(e) {
    this.style.transform = 'scale(1.1)';
  });
  
  button.addEventListener('mouseleave', function(e) {
    this.style.transform = '';
  });
  
  button.addEventListener('click', handleAISearchButtonClick);
  document.body.appendChild(button);
  
  // 更新全局变量
  aiSearchButton = button;
  
  return button;
}

// 检测文本语言
function detectLanguage(text) {
  // 简单语言检测，检查是否包含中文字符
  const chineseRegex = /[\u4e00-\u9fa5]/;
  const hasChinese = chineseRegex.test(text);
  
  // 检查是否包含日文字符
  const japaneseRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  const hasJapanese = japaneseRegex.test(text) && !hasChinese;
  
  // 检查是否包含韩文字符
  const koreanRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/;
  const hasKorean = koreanRegex.test(text);
  
  // 如果没有检测到以上语言，假设是英文或其他西方语言
  if (hasChinese) {
    return 'zh';
  } else if (hasJapanese) {
    return 'ja';
  } else if (hasKorean) {
    return 'ko';
  } else {
    return 'en';
  }
}

// 获取语言名称
function getLanguageName(langCode) {
  const languages = {
    'zh': '中文',
    'en': '英文',
    'ja': '日文',
    'ko': '韩文'
  };
  
  return languages[langCode] || '未知语言';
}

// 处理AI搜索按钮点击事件
function handleAISearchButtonClick() {
  if (selectedText) {
    // 检测语言
    const detectedLang = detectLanguage(selectedText);
    
    // 如果不是中文，显示翻译选项
    if (detectedLang !== 'zh') {
      showTranslationOptions(detectedLang);
    } else {
      searchWithAI(selectedText);
    }
  }
  hideAISearchButton();
}

// 显示AI搜索按钮
function showAISearchButton(x, y) {
  // 如果设置为不显示浮动按钮，则不显示
  if (!showFloatingButton) return;
  
  const button = createAISearchButton();
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
}

// 隐藏AI搜索按钮
function hideAISearchButton() {
  if (aiSearchButton && aiSearchButton.parentNode) {
    aiSearchButton.parentNode.removeChild(aiSearchButton);
    aiSearchButton = null;
  }
}

// 添加继续提问区域的样式
function addContinueAskStyles() {
  // 检查是否已经添加过样式
  if (document.querySelector('#ai-continue-ask-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'ai-continue-ask-styles';
  style.textContent = `
    .ai-continue-ask-area {
      padding: 10px 15px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #f8f9fa;
    }
    
    .ai-continue-ask-input {
      flex: 1;
      min-height: 36px;
      max-height: 120px;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-size: 14px;
      line-height: 1.5;
      background: white;
    }
    
    .ai-continue-ask-input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    }
    
    .ai-continue-ask-button {
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
      height: 36px;
      white-space: nowrap;
    }
    
    .ai-continue-ask-button:hover {
      background-color: #1557b0;
    }
    
    .ai-continue-ask-button:active {
      transform: scale(0.98);
    }
  `;
  document.head.appendChild(style);
}

// 创建AI搜索结果窗口
function createAISearchResultWindow() {
  // 确保样式已添加
  addContinueAskStyles();
  addMemoStyles();

  if (aiSearchResult) {
    // 保存当前位置
    const rect = aiSearchResult.getBoundingClientRect();
    const oldTop = rect.top + window.scrollY;
    const oldLeft = rect.left + window.scrollX;
    
    document.body.removeChild(aiSearchResult);
    aiSearchResult = null;
    
    // 创建新窗口时使用保存的位置
    const newWindow = document.createElement('div');
    newWindow.className = 'ai-search-result';
    newWindow.style.top = oldTop + 'px';
    newWindow.style.left = oldLeft + 'px';
    aiSearchResult = newWindow;
  } else {
    aiSearchResult = document.createElement('div');
    aiSearchResult.className = 'ai-search-result';
    // 初始位置设置在视窗中间
    aiSearchResult.style.top = '50%';
    aiSearchResult.style.left = '50%';
    aiSearchResult.style.transform = 'translate(-50%, -50%)';
  }
  
  // 创建基础结构
  const header = document.createElement('div');
  header.className = 'ai-search-result-header';
  
  const title = document.createElement('span');
  title.textContent = 'AI解释';
  header.appendChild(title);
  
  const closeButton = document.createElement('span');
  closeButton.className = 'ai-search-result-close';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', hideAISearchResultWindow);
  header.appendChild(closeButton);
  
  // 添加拖动功能
  let isDragging = false;
  let startX;
  let startY;
  let startTop;
  let startLeft;

  header.addEventListener('mousedown', function(e) {
    if (e.target === closeButton) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = aiSearchResult.getBoundingClientRect();
    
    // 如果有transform，先移除并设置实际位置
    if (aiSearchResult.style.transform) {
      aiSearchResult.style.transform = 'none';
      aiSearchResult.style.top = rect.top + 'px';
      aiSearchResult.style.left = rect.left + 'px';
    }
    
    startTop = rect.top;
    startLeft = rect.left;
    
    // 防止拖动时选中文本
    e.preventDefault();
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    // 计算新位置
    const newTop = startTop + deltaY;
    const newLeft = startLeft + deltaX;
    
    // 确保窗口不会被拖出视窗
    const maxTop = window.innerHeight - aiSearchResult.offsetHeight;
    const maxLeft = window.innerWidth - aiSearchResult.offsetWidth;
    
    aiSearchResult.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
    aiSearchResult.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
    // 恢复文本选择功能
    document.body.style.userSelect = '';
  });
  
  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'ai-search-result-content';
  
  // 创建继续提问区域
  const continueAskArea = document.createElement('div');
  continueAskArea.className = 'ai-continue-ask-area';
  
  const continueAskInput = document.createElement('textarea');
  continueAskInput.className = 'ai-continue-ask-input';
  continueAskInput.placeholder = '继续提问...';
  
  // 添加回车发送功能
  continueAskInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newQuestion = this.value.trim();
      if (newQuestion) {
        const contextPrompt = `基于之前的对话内容：\n${rawResult}\n\n新的问题：${newQuestion}`;
        this.value = '';
        searchWithAI(contextPrompt);
      }
    }
  });
  
  const continueAskButton = document.createElement('button');
  continueAskButton.className = 'ai-continue-ask-button';
  continueAskButton.textContent = '发送';
  continueAskButton.addEventListener('click', function() {
    const newQuestion = continueAskInput.value.trim();
    if (newQuestion) {
      const contextPrompt = `基于之前的对话内容：\n${rawResult}\n\n新的问题：${newQuestion}`;
      continueAskInput.value = '';
      searchWithAI(contextPrompt);
    }
  });
  
  continueAskArea.appendChild(continueAskInput);
  continueAskArea.appendChild(continueAskButton);
  
  // 创建底部功能栏
  const footer = document.createElement('div');
  footer.className = 'ai-search-result-footer';
  
  const poweredBy = document.createElement('div');
  poweredBy.textContent = 'AI划词搜索';
  footer.appendChild(poweredBy);
  
  const actions = document.createElement('div');
  actions.className = 'ai-search-result-actions';
  
  // 添加格式切换
  const formatToggle = document.createElement('div');
  formatToggle.className = 'ai-search-result-format-toggle';
  
  const markdownLabel = document.createElement('label');
  const markdownInput = document.createElement('input');
  markdownInput.type = 'radio';
  markdownInput.name = 'format';
  markdownInput.checked = isMarkdownMode;
  markdownInput.addEventListener('change', function() {
    if (this.checked) {
      isMarkdownMode = true;
      updateResultContent(rawResult);
    }
  });
  markdownLabel.appendChild(markdownInput);
  markdownLabel.appendChild(document.createTextNode('Markdown'));
  
  const plainTextLabel = document.createElement('label');
  const plainTextInput = document.createElement('input');
  plainTextInput.type = 'radio';
  plainTextInput.name = 'format';
  plainTextInput.checked = !isMarkdownMode;
  plainTextInput.addEventListener('change', function() {
    if (this.checked) {
      isMarkdownMode = false;
      updateResultContent(rawResult);
    }
  });
  plainTextLabel.appendChild(plainTextInput);
  plainTextLabel.appendChild(document.createTextNode('纯文本'));
  
  formatToggle.appendChild(markdownLabel);
  formatToggle.appendChild(plainTextLabel);
  actions.appendChild(formatToggle);
  
  // 点赞/踩按钮
  const ratingGroup = document.createElement('div');
  ratingGroup.className = 'ai-search-result-rating-group';
  
  const likeButton = document.createElement('button');
  likeButton.className = 'ai-search-result-action-button like-btn';
  likeButton.innerHTML = '👍 有用';
  likeButton.addEventListener('click', function() {
    rateResult(1);
    likeButton.classList.add('active');
    dislikeButton.classList.remove('active');
  });
  
  const dislikeButton = document.createElement('button');
  dislikeButton.className = 'ai-search-result-action-button dislike-btn';
  dislikeButton.innerHTML = '👎 没用';
  dislikeButton.addEventListener('click', function() {
    rateResult(-1);
    dislikeButton.classList.add('active');
    likeButton.classList.remove('active');
  });
  
  ratingGroup.appendChild(likeButton);
  ratingGroup.appendChild(dislikeButton);
  actions.appendChild(ratingGroup);
  
  // 复制按钮
  const copyButton = document.createElement('button');
  copyButton.className = 'ai-search-result-action-button';
  copyButton.textContent = '复制结果';
  copyButton.addEventListener('click', function() {
    navigator.clipboard.writeText(rawResult).then(function() {
      copyButton.textContent = '已复制';
      setTimeout(function() {
        copyButton.textContent = '复制结果';
      }, 2000);
    });
  });
  
  actions.appendChild(copyButton);
  footer.appendChild(actions);
  
  // 添加所有元素到窗口
  aiSearchResult.appendChild(header);
  aiSearchResult.appendChild(content);
  aiSearchResult.appendChild(continueAskArea);
  aiSearchResult.appendChild(footer);
  
  document.body.appendChild(aiSearchResult);
  
  // 显示结果窗口
  aiSearchResult.style.display = 'block';
  
  return content;
}

// 简单的Markdown解析函数
function simpleMarkdown(text) {
  // 预处理文本
  text = text
    .replace(/^[\u200B\u200C\u200D\u200E\u200F\uFEFF]/g, '') // 移除零宽字符
    .replace(/\\n/g, '\n') // 处理转义的换行符
    .replace(/\n\s*\n/g, '\n\n') // 规范化空行
    .trim();

  // 基本的Markdown语法转换
  return text
    // 处理标题
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    
    // 处理强调
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // 处理代码块
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // 处理列表
    .replace(/^\s*[-*]\s+(.+)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    
    // 处理链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    
    // 处理段落
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, function(match) {
      if (!/^<[h|ul|li|pre]/.test(match)) {
        return match.trim() ? '<p>' + match + '</p>' : '';
      }
      return match;
    });
}

// 更新结果内容
async function updateResultContent(result) {
  // 如果当前是错误状态，不更新内容
  if (aiSearchResult && aiSearchResult.dataset.errorState === 'true') {
    return;
  }

  if (!result) {
    console.debug('结果为空，显示错误提示');
    showErrorState('内容为空', '抱歉，未能获取到有效的响应内容');
    return;
  }

  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) {
    console.debug('找不到内容容器，显示错误提示');
    showErrorState('显示错误', '内容显示区域加载失败');
    return;
  }

  try {
    if (isMarkdownMode) {
      // 使用简单的Markdown解析
      const htmlContent = simpleMarkdown(result);
      
      // 创建一个包装容器
      const markdownContainer = document.createElement('div');
      markdownContainer.className = 'markdown-body';
      markdownContainer.innerHTML = htmlContent || '内容为空';
      
      // 清空内容区域并添加新内容
      content.innerHTML = '';
      content.appendChild(markdownContainer);
    } else {
      content.textContent = result || '内容为空';
    }

    // 验证内容是否成功显示
    if (!content.textContent && !content.innerHTML) {
      throw new Error('内容渲染失败');
    }
  } catch (error) {
    console.debug('渲染内容时出错:', error);
    showErrorState('显示错误', `内容显示失败: ${error.message}`);
  }
}

// 显示AI搜索结果
function showAISearchResultWindow(result) {
  try {
    if (!result) {
      throw new Error('响应内容为空');
    }
    
    rawResult = result; // 保存原始结果
    const resultWindow = createAISearchResultWindow();
    
    if (!resultWindow) {
      throw new Error('结果窗口创建失败');
    }
    
    updateResultContent(result);
  } catch (error) {
    console.error('显示结果时出错:', error);
    showErrorState('显示错误', error.message);
  }
}

// 隐藏AI搜索结果窗口
function hideAISearchResultWindow() {
  if (aiSearchResult) {
    // 清除错误状态标记
    delete aiSearchResult.dataset.errorState;
    
    if (aiSearchResult.parentNode) {
      aiSearchResult.parentNode.removeChild(aiSearchResult);
    }
    aiSearchResult = null;
  }
}

// 显示加载状态
function showLoadingState(message = '正在思考中...') {
  if (!aiSearchResult) {
    createAISearchResultWindow();
  }
  
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) return;
  
  // 保存当前内容区域的高度，以防止加载动画导致窗口抖动
  const currentHeight = content.offsetHeight;
  content.style.minHeight = `${currentHeight}px`;
  
  content.innerHTML = `
    <div class="ai-search-result-loading">
      <div class="ai-search-result-loading-spinner"></div>
      <div class="ai-search-result-loading-text">${message}</div>
    </div>
  `;
  
  // 显示结果窗口
  aiSearchResult.style.display = 'block';
}

// 隐藏加载状态
function hideLoadingState() {
  if (!aiSearchResult) return;
  
  const loadingElement = aiSearchResult.querySelector('.ai-search-result-loading');
  if (loadingElement) {
    loadingElement.remove();
  }
}

// 检查网络状态并显示详细信息
function checkNetworkStatus() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getNetworkStatus' }, function(response) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (response && response.status) {
        resolve(response);
      } else {
        reject(new Error('无法获取网络状态信息'));
      }
    });
  });
}

// 显示网络状态信息
function showNetworkStatus() {
  if (!aiSearchResult) {
    createAISearchResultWindow();
  }
  
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  content.innerHTML = '<div class="ai-search-result-loading">正在检查网络状态...</div>';
  
  checkNetworkStatus()
    .then(response => {
      content.innerHTML = '';
      
      const networkInfo = document.createElement('div');
      networkInfo.className = 'ai-search-result-network-info';
      
      const statusIcon = document.createElement('div');
      statusIcon.className = 'ai-search-result-network-icon';
      statusIcon.innerHTML = response.status.isOnline ? '✅' : '❌';
      networkInfo.appendChild(statusIcon);
      
      const statusTitle = document.createElement('div');
      statusTitle.className = 'ai-search-result-network-title';
      statusTitle.textContent = response.status.isOnline ? '网络连接正常' : '网络连接异常';
      networkInfo.appendChild(statusTitle);
      
      const statusDetails = document.createElement('div');
      statusDetails.className = 'ai-search-result-network-details';
      
      // 格式化上次检查时间
      const lastCheckTime = response.status.lastCheck ? 
        new Date(response.status.lastCheck).toLocaleString() : 
        '未检查';
      
      statusDetails.innerHTML = `
        <div>上次检查时间: ${lastCheckTime}</div>
        <div>扩展版本: ${response.extensionInfo.version}</div>
        <div>扩展ID: ${response.extensionInfo.id}</div>
        ${response.status.lastError ? `<div>最近错误: ${response.status.lastError}</div>` : ''}
      `;
      networkInfo.appendChild(statusDetails);
      
      // 添加诊断按钮
      const diagButton = document.createElement('button');
      diagButton.className = 'ai-search-result-network-diag-btn';
      diagButton.textContent = '运行网络诊断';
      diagButton.addEventListener('click', function() {
        runNetworkDiagnostics(networkInfo);
      });
      networkInfo.appendChild(diagButton);
      
      content.appendChild(networkInfo);
    })
    .catch(error => {
      showErrorState('网络状态检查失败', error.message);
    });
  
  showAISearchResultWindow();
}

// 运行网络诊断
function runNetworkDiagnostics(container) {
  const diagResults = document.createElement('div');
  diagResults.className = 'ai-search-result-network-diag-results';
  diagResults.innerHTML = '<div>正在运行诊断...</div>';
  container.appendChild(diagResults);
  
  // 测试多个端点
  const endpoints = [
    { name: 'Google', url: 'https://www.google.com/favicon.ico' },
    { name: 'OpenAI', url: 'https://api.openai.com/v1/models' }
  ];
  
  // 获取用户配置的API地址
  chrome.storage.sync.get({ apiUrl: 'https://api.openai.com/v1/chat/completions' }, function(items) {
    // 添加用户配置的API地址到测试列表
    if (items.apiUrl) {
      const apiDomain = new URL(items.apiUrl).origin;
      endpoints.push({ name: '您的API服务', url: `${apiDomain}/favicon.ico` });
    }
    
    diagResults.innerHTML = '';
    
    // 为每个端点创建一个状态行
    endpoints.forEach(endpoint => {
      const row = document.createElement('div');
      row.className = 'ai-search-result-network-diag-row';
      row.innerHTML = `
        <span>${endpoint.name}</span>
        <span class="ai-search-result-network-diag-status">测试中...</span>
      `;
      diagResults.appendChild(row);
      
      // 测试连接
      fetch(endpoint.url, { 
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        timeout: 5000
      })
      .then(() => {
        row.querySelector('.ai-search-result-network-diag-status').innerHTML = '✅ 可访问';
        row.querySelector('.ai-search-result-network-diag-status').className += ' success';
      })
      .catch(error => {
        row.querySelector('.ai-search-result-network-diag-status').innerHTML = `❌ 不可访问 (${error.message})`;
        row.querySelector('.ai-search-result-network-diag-status').className += ' error';
      });
    });
    
    // 添加浏览器信息
    const browserInfo = document.createElement('div');
    browserInfo.className = 'ai-search-result-network-diag-browser';
    browserInfo.innerHTML = `
      <div>浏览器: ${navigator.userAgent}</div>
      <div>在线状态: ${navigator.onLine ? '在线' : '离线'}</div>
    `;
    diagResults.appendChild(browserInfo);
  });
}

// 发送API请求获取AI响应
async function fetchAIResponse(apiUrl, apiKey, model, prompt) {
  try {
    console.log('开始API请求:', { 
      url: apiUrl, 
      model: model,
      promptLength: prompt.length 
    });
    
    // 通过 background.js 发送请求
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'fetchAIResponse',
        apiUrl: apiUrl,
        apiKey: apiKey,
        data: {
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7
        }
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!response || !response.success) {
          reject(new Error(response?.error || '请求失败'));
        } else {
          resolve(response);
        }
      });
    });

    // 提取回复内容
    if (response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message?.content;
      if (!content) {
        throw new Error('API响应中没有找到内容');
      }
      return { success: true, content: content };
    } else {
      throw new Error('API响应格式异常，未找到有效内容');
    }
  } catch (error) {
    console.error('API请求异常:', error);
    
    // 检查是否是并发限制错误
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('concurrent') || 
        errorMessage.includes('concurrency') || 
        errorMessage.includes('rate limit') ||
        errorMessage.includes('请求达到最大并发数')) {
      console.log('API并发限制，等待重试');
      // 不向用户显示错误，直接返回特殊标记
      return { success: false, isRateLimit: true };
    }
    
    // 检查是否是 API 密钥错误
    if (errorMessage.includes('api key') || errorMessage.includes('apikey')) {
      throw new Error('API密钥无效，请在设置中检查并更新API密钥');
    } else if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
      throw new Error('网络连接失败，请检查网络设置');
    }
    
    // 其他错误正常抛出
    throw new Error(`请求失败: ${error.message}`);
  }
}

// 显示错误状态
function showErrorState(title, message) {
  console.error(`错误: ${title} - ${message}`);
  
  // 确保aiSearchResult存在
  if (typeof aiSearchResult === 'undefined' || !aiSearchResult) {
    createAISearchResultWindow();
  }
  
  // 获取结果窗口
  if (!document.querySelector('.ai-search-result')) {
    console.error('无法创建结果窗口');
    return;
  }
  
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) return;
  
  // 标记错误状态
  aiSearchResult.dataset.errorState = 'true';
  
  content.innerHTML = `
    <div class="ai-search-result-error">
      <div class="ai-search-result-error-icon">❌</div>
      <div class="ai-search-result-error-title">${title}</div>
      <div class="ai-search-result-error-message">${message}</div>
      <button class="ai-search-result-retry-button">重试</button>
    </div>
  `;

  // 添加重试按钮的点击事件处理
  const retryButton = content.querySelector('.ai-search-result-retry-button');
  retryButton.addEventListener('click', function() {
    // 如果存在已选中的文本，重新执行翻译
    if (selectedText) {
      const detectedLang = detectLanguage(selectedText);
      if (detectedLang !== 'zh') {
        const translatePrompt = `请将以下${getLanguageName(detectedLang)}文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
        chrome.storage.sync.get({
          apiUrl: 'https://api.openai.com/v1/chat/completions',
          apiKey: '',
          actualModel: 'gpt-3.5-turbo'
        }, function(items) {
          // 显示加载状态
          showLoadingState();
          // 发送翻译请求
          fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, translatePrompt)
            .then(response => {
              if (response.success && response.content) {
                showAISearchResultWindow(response.content);
              } else {
                throw new Error(response.error || '翻译失败');
              }
            })
            .catch(error => {
              showErrorState('翻译失败', error.message);
            });
        });
      } else {
        // 如果是中文，直接使用AI搜索
        searchWithAI(selectedText);
      }
    }
  });
  
  // 显示结果窗口
  aiSearchResult.style.display = 'block';
}

// 评价结果
function rateResult(rating) {
  if (!currentSearchId) return;
  
  chrome.storage.local.get('searchHistory', function(data) {
    const history = data.searchHistory || [];
    const index = history.findIndex(item => item.id === currentSearchId);
    
    if (index !== -1) {
      // 如果已经有相同评分，则取消评分
      if (history[index].rating === rating) {
        history[index].rating = 0;
      } else {
        history[index].rating = rating;
      }
      
      chrome.storage.local.set({ searchHistory: history });
    }
  });
}

// 用AI搜索所选文本
function searchWithAI(text, template = null) {
  chrome.storage.sync.get({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    customModel: '',
    prompt: '请解释以下内容:',
    actualModel: 'gpt-3.5-turbo',
    useMarkdown: true,
    saveHistory: true
  }, async function(items) {
    if (!items.apiKey) {
      showErrorState('API密钥未设置', '请先在扩展设置中配置API密钥');
      return;
    }

    // 显示加载状态
    showLoadingState();
    
    try {
      // 构建提示词
      let finalPrompt;
      if (template) {
        finalPrompt = template.content + '\n' + text;
        console.log('使用模板提示词:', { 
          templateTitle: template.title,
          templateCategory: template.category
        });
      } else {
        finalPrompt = items.prompt + '\n' + text;
        console.log('使用默认提示词');
      }
      
      console.log('准备发送API请求');
      
      // 获取响应
      const response = await fetchAIResponse(
        items.apiUrl,
        items.apiKey,
        items.actualModel,
        finalPrompt
      );
      
      if (!response.success) {
        throw new Error(response.error || '未知错误');
      }
      
      console.log('收到API响应:', { success: response.success });
      
      if (response.content) {
        // 保存原始结果
        rawResult = response.content;
        
        // 更新结果显示
        console.log('更新结果显示');
        showAISearchResultWindow(response.content);
        
        // 如果启用了历史记录保存
        if (items.saveHistory) {
          console.log('保存到历史记录');
          const historyData = {
            query: text,
            response: response.content,
            template: template ? {
              title: template.title,
              category: template.category
            } : null
          };
          
          // 保存到历史记录
          chrome.runtime.sendMessage({
            action: 'saveSearchHistory',
            data: historyData
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.error('保存历史记录失败:', chrome.runtime.lastError);
            } else if (response && response.id) {
              console.log('历史记录保存成功，ID:', response.id);
              currentSearchId = response.id;
            }
          });
        }
      } else {
        throw new Error('API返回内容为空');
      }
    } catch (error) {
      console.error('AI搜索错误:', error);
      hideLoadingState();
      showErrorState('请求失败', error.message);
    }
  });
}

// 监听设置变化
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync') {
    // 更新Markdown设置
    if (changes.useMarkdown) {
      isMarkdownMode = changes.useMarkdown.newValue;
      if (rawResult) {
        updateResultContent(rawResult);
      }
    }
  }
});

// 显示翻译选项
function showTranslationOptions(detectedLang) {
  const langName = getLanguageName(detectedLang);
  
  // 创建选项弹窗
  const optionsPopup = document.createElement('div');
  optionsPopup.className = 'ai-translation-options';
  
  // 添加标题
  const title = document.createElement('div');
  title.className = 'ai-translation-options-title';
  title.textContent = `检测到${langName}内容`;
  optionsPopup.appendChild(title);
  
  // 添加按钮组
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'ai-translation-options-buttons';
  
  // 解释按钮
  const explainButton = document.createElement('button');
  explainButton.textContent = '解释原文';
  explainButton.addEventListener('click', function() {
    searchWithAI(selectedText);
    document.body.removeChild(optionsPopup);
  });
  buttonGroup.appendChild(explainButton);
  
  // 翻译按钮
  const translateButton = document.createElement('button');
  translateButton.textContent = '翻译成中文';
  translateButton.addEventListener('click', function() {
    const translatePrompt = `请将以下${langName}文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
    
    // 获取API设置
    chrome.storage.sync.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      actualModel: 'gpt-3.5-turbo'
    }, function(items) {
      // 发送翻译请求
      fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, translatePrompt)
        .then(response => {
          showAISearchResultWindow(response.content);
          translateButton.textContent = '翻译';
          translateButton.disabled = false;
        })
        .catch(error => {
          showErrorState('翻译失败', error.message);
          translateButton.textContent = '翻译';
          translateButton.disabled = false;
        });
    });
    
    document.body.removeChild(optionsPopup);
  });
  buttonGroup.appendChild(translateButton);
  
  // 解释并翻译按钮
  const bothButton = document.createElement('button');
  bothButton.textContent = '解释并翻译';
  bothButton.addEventListener('click', function() {
    const bothPrompt = `请先将以下${langName}文本翻译成中文，然后解释其含义：\n\n${selectedText}`;
    
    // 获取API设置
    chrome.storage.sync.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      actualModel: 'gpt-3.5-turbo'
    }, function(items) {
      // 发送请求
      fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, bothPrompt)
        .then(response => {
          showAISearchResultWindow(response.content);
        })
        .catch(error => {
          showErrorState('请求失败', error.message);
        });
    });
    
    document.body.removeChild(optionsPopup);
  });
  buttonGroup.appendChild(bothButton);
  
  optionsPopup.appendChild(buttonGroup);
  
  // 添加到页面
  document.body.appendChild(optionsPopup);
  
  // 定位弹窗
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    const top = rect.bottom + window.scrollY;
    const left = rect.left + window.scrollX;
    
    optionsPopup.style.top = `${top}px`;
    optionsPopup.style.left = `${left}px`;
  }
  
  // 点击外部关闭弹窗
  document.addEventListener('click', function closePopup(e) {
    if (!optionsPopup.contains(e.target)) {
      if (document.body.contains(optionsPopup)) {
        document.body.removeChild(optionsPopup);
      }
      document.removeEventListener('click', closePopup);
    }
  });
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "searchWithAI") {
    if (request.text) {
      selectedText = request.text;
      searchWithAI(request.text, request.template);
    } else if (request.useSelectedText) {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        selectedText = selection.toString().trim();
        searchWithAI(selectedText, request.template);
      }
    }
  } else if (request.action === "translateSelectedText") {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      selectedText = selection.toString().trim();
      const detectedLang = detectLanguage(selectedText);
      let translatePrompt;
      if (detectedLang === 'zh') {
        translatePrompt = `请将以下中文文本翻译成英文，只返回翻译结果，不要解释：\n\n${selectedText}`;
      } else {
        translatePrompt = `请将以下${getLanguageName(detectedLang)}文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
      }
      chrome.storage.sync.get({
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        actualModel: 'gpt-3.5-turbo'
      }, function(items) {
        fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, translatePrompt)
          .then(response => {
            showAISearchResultWindow(response);
          })
          .catch(error => {
            showErrorState('翻译失败', error.message);
          });
      });
    }
    sendResponse({ success: true });
  } else if (request.action === "showMemo") {
    // 显示备忘录窗口
    showMemoWindow();
    sendResponse({ success: true });
  } else if (request.action === "addMemo") {
    // 添加新备忘录
    if (request.text) {
      saveMemo(request.text);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "没有提供备忘录内容" });
    }
  } else if (request.action === "deleteMemo") {
    // 删除备忘录
    if (request.id) {
      deleteMemo(request.id);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "没有提供备忘录ID" });
    }
  }
});

// 添加错误恢复机制
window.addEventListener('error', function(event) {
  // 记录错误到控制台，但不显示在界面上
  console.debug("捕获到错误:", event.error);
  
  // 如果错误发生在AI搜索过程中，显示友好的错误提示
  if (event.error && event.error.message && event.error.message.includes("AI")) {
    hideLoadingState();
    showErrorState('AI搜索出错', '抱歉，AI搜索过程中出现了错误。请稍后重试。');
  }
  
  // 阻止错误继续传播
  event.preventDefault();
});

// 确保DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  console.log("内容脚本已加载");
  
  // 通知后台脚本内容脚本已加载
  try {
    chrome.runtime.sendMessage({ action: 'contentScriptLoaded' });
  } catch (error) {
    console.error("无法发送加载完成消息:", error);
  }
  
  addMemoStyles();
  addContinueAskStyles();
  
  // 添加继续提问区域的样式
  const style = document.createElement('style');
  style.textContent = `
    .ai-search-result {
      position: fixed;
      z-index: 999999;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      min-width: 300px;
      max-width: min(600px, 90vw);
      width: 50vw;
      min-height: 200px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .ai-search-result-content {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      min-height: 150px;
      max-height: calc(80vh - 120px);
    }

    .ai-search-result-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 150px;
      padding: 20px;
    }

    .ai-continue-ask-area {
      padding: 10px 15px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #f8f9fa;
    }
    
    .ai-continue-ask-input {
      flex: 1;
      min-height: 36px;
      max-height: 120px;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-size: 14px;
      line-height: 1.5;
      background: white;
    }
    
    .ai-continue-ask-input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    }
    
    .ai-continue-ask-button {
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
      height: 36px;
      white-space: nowrap;
    }
    
    .ai-continue-ask-button:hover {
      background-color: #1557b0;
    }
    
    .ai-continue-ask-button:active {
      transform: scale(0.98);
    }

    @media (max-width: 768px) {
      .ai-search-result {
        width: 90vw;
        max-height: 70vh;
      }
    }
  `;
  document.head.appendChild(style);
});

// 打开设置页面
function openSettings() {
  chrome.runtime.sendMessage({ action: 'openSettings' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('打开设置失败:', chrome.runtime.lastError);
    }
  });
}

// 保存备忘录
function saveMemo(text) {
  chrome.storage.sync.get({ memos: [] }, function(data) {
    const memos = data.memos;
    memos.push({
      id: Date.now(),
      text: text,
      timestamp: new Date().toISOString()
    });
    chrome.storage.sync.set({ memos: memos }, function() {
      console.log('备忘录已保存');
    });
  });
}

// 获取所有备忘录
function getMemos(callback) {
  chrome.storage.sync.get({ memos: [] }, function(data) {
    callback(data.memos);
  });
}

// 删除备忘录
function deleteMemo(id) {
  chrome.storage.sync.get({ memos: [] }, function(data) {
    const memos = data.memos.filter(memo => memo.id !== id);
    chrome.storage.sync.set({ memos: memos }, function() {
      console.log('备忘录已删除');
    });
  });
}

// 显示备忘录窗口
function showMemoWindow() {
  if (!aiSearchResult) {
    createAISearchResultWindow();
  }
  
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  content.innerHTML = '';
  
  // 创建备忘录容器
  const memoContainer = document.createElement('div');
  memoContainer.className = 'ai-memo-container';
  
  // 创建输入区域
  const inputContainer = document.createElement('div');
  inputContainer.className = 'ai-memo-input-container';
  
  const textarea = document.createElement('textarea');
  textarea.className = 'ai-memo-input';
  textarea.placeholder = '输入新的备忘录...';
  
  const saveButton = document.createElement('button');
  saveButton.className = 'ai-memo-save-button';
  saveButton.textContent = '保存';
  saveButton.addEventListener('click', function() {
    const text = textarea.value.trim();
    if (text) {
      saveMemo(text);
      textarea.value = '';
      refreshMemoList();
    }
  });
  
  inputContainer.appendChild(textarea);
  inputContainer.appendChild(saveButton);
  memoContainer.appendChild(inputContainer);
  
  // 创建备忘录列表
  const memoList = document.createElement('div');
  memoList.className = 'ai-memo-list';
  memoContainer.appendChild(memoList);
  
  // 刷新备忘录列表
  function refreshMemoList() {
    getMemos(function(memos) {
      memoList.innerHTML = '';
      if (memos.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'ai-memo-empty';
        emptyMessage.textContent = '暂无备忘录';
        memoList.appendChild(emptyMessage);
        return;
      }
      
      memos.sort((a, b) => b.id - a.id).forEach(memo => {
        const memoItem = document.createElement('div');
        memoItem.className = 'ai-memo-item';
        
        const memoText = document.createElement('div');
        memoText.className = 'ai-memo-text';
        memoText.textContent = memo.text;
        
        const memoTime = document.createElement('div');
        memoTime.className = 'ai-memo-time';
        memoTime.textContent = new Date(memo.timestamp).toLocaleString();
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ai-memo-delete-button';
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', function() {
          deleteMemo(memo.id);
          refreshMemoList();
        });
        
        memoItem.appendChild(memoText);
        memoItem.appendChild(memoTime);
        memoItem.appendChild(deleteButton);
        memoList.appendChild(memoItem);
      });
    });
  }
  
  refreshMemoList();
  content.appendChild(memoContainer);
}

// 添加备忘录样式
function addMemoStyles() {
  // 检查是否已经添加过样式
  if (document.querySelector('#ai-memo-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'ai-memo-styles';
  style.textContent = `
    .ai-memo-container {
      padding: 15px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .ai-memo-input-container {
      display: flex;
      gap: 10px;
    }
    
    .ai-memo-input {
      flex: 1;
      min-height: 60px;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
      font-size: 14px;
    }
    
    .ai-memo-save-button {
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .ai-memo-save-button:hover {
      background-color: #1557b0;
    }
    
    .ai-memo-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .ai-memo-item {
      padding: 12px;
      background-color: #f8f9fa;
      border-radius: 4px;
      position: relative;
    }
    
    .ai-memo-text {
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
    }
    
    .ai-memo-time {
      font-size: 12px;
      color: #666;
    }
    
    .ai-memo-delete-button {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .ai-memo-item:hover .ai-memo-delete-button {
      opacity: 1;
    }
    
    .ai-memo-delete-button:hover {
      background-color: #c82333;
    }
    
    .ai-memo-empty {
      text-align: center;
      color: #666;
      padding: 20px;
    }
  `;
  document.head.appendChild(style);
} 