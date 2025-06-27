// 全局变量
let aiSearchResult = null;
let aiSearchButton = null;
let selectedText = '';
let rawResult = ''; // 存储原始结果文本
let isMarkdownMode = true; // 默认使用Markdown模式
let currentSearchId = null; // 当前搜索的ID
let showFloatingButton = false; // 默认不显示浮动按钮
let conversationHistory = []; // 存储对话历史

// 生成唯一ID
function generateId() {
  return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 初始化时读取用户设置
chrome.storage.local.get({
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
    // 确保选中的文本保留换行符
    selectedText = selectedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
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
      align-items: center;
      background: #f8f9fa;
    }
    
    .ai-continue-ask-input {
      flex: 1;
      height: 36px;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: none;
      font-size: 14px;
      line-height: 20px;
      background: white;
      overflow: hidden;
      box-sizing: border-box;
      -webkit-resize: none;  /* Safari 和 Chrome */
      -moz-resize: none;    /* Firefox */
      appearance: none;     /* 移除默认外观 */
    }
    
    .ai-continue-ask-input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    }
    
    .ai-continue-ask-button {
      width: 80px;
      padding: 8px 0;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
      height: 36px;
      white-space: nowrap;
      text-align: center;
      box-sizing: border-box;
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
  addResizeStyles();

  // 如果已存在旧窗口，先保存其位置并安全移除
  let oldTop, oldLeft;
  if (aiSearchResult) {
    try {
      const rect = aiSearchResult.getBoundingClientRect();
      oldTop = rect.top + window.scrollY;
      oldLeft = rect.left + window.scrollX;
      
      // 检查节点是否真的在文档中
      if (document.body.contains(aiSearchResult)) {
        document.body.removeChild(aiSearchResult);
      }
    } catch (e) {
      console.error('移除旧窗口时出错:', e);
    }
    aiSearchResult = null;
  }

  // 创建新窗口
  const newWindow = document.createElement('div');
  newWindow.className = 'ai-search-result';
  
  // 使用保存的位置或默认位置
  if (oldTop !== undefined && oldLeft !== undefined) {
    newWindow.style.top = oldTop + 'px';
    newWindow.style.left = oldLeft + 'px';
  } else {
    newWindow.style.top = '50%';
    newWindow.style.left = '50%';
    newWindow.style.transform = 'translate(-50%, -50%)';
  }
  
  aiSearchResult = newWindow;
  
  // 添加调整大小的把手
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'ai-search-result-resize-handle';
  
  // 实现调整大小的功能
  let isResizing = false;
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener('mousedown', function(e) {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = aiSearchResult.offsetWidth;
    startHeight = aiSearchResult.offsetHeight;
    
    // 防止拖动时选中文本
    e.preventDefault();
    document.body.style.userSelect = 'none';
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    // 计算新的宽度和高度，设置最小值
    const newWidth = Math.max(300, startWidth + deltaX);
    const newHeight = Math.max(200, startHeight + deltaY);
    
    // 更新窗口大小
    aiSearchResult.style.width = newWidth + 'px';
    aiSearchResult.style.height = newHeight + 'px';
  });
  
  document.addEventListener('mouseup', function() {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
    }
  });
  
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
        // 保留用户输入中的换行符
        const formattedQuestion = newQuestion.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const contextPrompt = `基于之前的对话内容：\n${rawResult}\n\n新的问题：${formattedQuestion}`;
        this.value = '';
        // 显示加载状态
        showLoadingState('正在思考中...');
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
      // 保留用户输入中的换行符
      const formattedQuestion = newQuestion.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const contextPrompt = `基于之前的对话内容：\n${rawResult}\n\n新的问题：${formattedQuestion}`;
      continueAskInput.value = '';
      // 显示加载状态
      showLoadingState('正在思考中...');
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
  aiSearchResult.appendChild(resizeHandle);
  
  document.body.appendChild(aiSearchResult);
  
  // 显示结果窗口
  aiSearchResult.style.display = 'block';
  
  return content;
}

// 更新结果内容
async function updateResultContent(result) {
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
      // 使用 marked 解析 markdown，支持表格等GFM语法
      let htmlContent = '';
      if (window.marked) {
        // 确保换行符被正确处理
        result = result.replace(/\r\n/g, '\n'); // 统一换行符
        htmlContent = window.marked.parse(result);
        
        // 修复：处理Markdown渲染后的多余换行问题
        // 1. 移除段落之间可能存在的多余空行
        htmlContent = htmlContent.replace(/<p>\s*<\/p>/g, '');
        htmlContent = htmlContent.replace(/^\s*<p>/, '<p>');
        htmlContent = htmlContent.replace(/<\/p>\s*$/, '</p>');
        htmlContent = htmlContent.replace(/<\/p>\s*<p>/g, '</p><p>');
        // 2. 移除代码块和其他元素之间可能存在的多余空行
        htmlContent = htmlContent.replace(/<\/pre>\s*<p>/g, '</pre><p>');
        htmlContent = htmlContent.replace(/<\/p>\s*<pre>/g, '</p><pre>');
        // 3. 处理列表和段落之间的空行
        htmlContent = htmlContent.replace(/<\/ul>\s*<p>/g, '</ul><p>');
        htmlContent = htmlContent.replace(/<\/ol>\s*<p>/g, '</ol><p>');
        htmlContent = htmlContent.replace(/<\/p>\s*<ul>/g, '</p><ul>');
        htmlContent = htmlContent.replace(/<\/p>\s*<ol>/g, '</p><ol>');
        // 4. 处理表格和段落之间的空行
        htmlContent = htmlContent.replace(/<\/table>\s*<p>/g, '</table><p>');
        htmlContent = htmlContent.replace(/<\/p>\s*<table>/g, '</p><table>');
        
        // 5. 处理表格或代码块后的多余换行
        htmlContent = htmlContent.replace(/<\/table>\s*$/, '</table>');
        htmlContent = htmlContent.replace(/<\/pre>\s*$/, '</pre>');
      } else {
        htmlContent = result.replace(/\n/g, '<br>'); // 如果没有marked，使用<br>标签
      }
      // 创建一个包装容器
      const markdownContainer = document.createElement('div');
      markdownContainer.className = 'markdown-body';
      markdownContainer.innerHTML = htmlContent || '内容为空';
      // 清空内容区域并添加新内容
      content.innerHTML = '';
      content.appendChild(markdownContainer);
    } else {
      // 纯文本模式下保留换行
      content.style.whiteSpace = 'pre-wrap';
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

// 显示加载状态
function showLoadingState(message = '正在思考中...') {
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) return;
  
  content.innerHTML = `
    <div class="ai-search-result-loading">
      <div class="ai-search-result-loading-spinner"></div>
      <div class="ai-search-result-loading-text">${message}</div>
    </div>
  `;
  
  // 确保窗口可见
  aiSearchResult.style.display = 'block';
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
  chrome.storage.local.get({ apiUrl: 'https://api.openai.com/v1/chat/completions' }, function(items) {
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
async function fetchAIResponse(apiUrl, apiKey, model, messages) {
  try {
    console.log('开始API请求:', { 
      url: apiUrl, 
      model: model,
      messagesCount: Array.isArray(messages) ? messages.length : 1
    });
    
    // 通过 background.js 发送请求
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'fetchAIResponse',
        apiUrl: apiUrl,
        apiKey: apiKey,
        data: {
          model: model,
          messages: Array.isArray(messages) ? messages : [
            {
              role: 'user',
              content: messages
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
  
  try {
    // 确保aiSearchResult存在
    if (!aiSearchResult || !document.body.contains(aiSearchResult)) {
      createAISearchResultWindow();
    }
    
    // 获取内容区域
    const content = aiSearchResult.querySelector('.ai-search-result-content');
    if (!content) {
      console.error('找不到内容容器');
      return;
    }
    
    // 标记错误状态
    aiSearchResult.dataset.errorState = 'true';
    
    // 隐藏加载状态
    const loadingElement = content.querySelector('.ai-search-result-loading');
    if (loadingElement) {
      loadingElement.remove();
    }
    
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
    if (retryButton) {
      const retryHandler = function() {
        // 移除事件监听器
        retryButton.removeEventListener('click', retryHandler);
        
        // 清除错误状态
        delete aiSearchResult.dataset.errorState;
        
        // 如果存在已选中的文本,重新执行查询
        if (selectedText) {
          searchWithAI(selectedText);
        }
      };
      retryButton.addEventListener('click', retryHandler);
    }
    
    // 确保窗口可见
    if (aiSearchResult) {
      aiSearchResult.style.display = 'block';
    }
    
  } catch (error) {
    console.error('显示错误状态时出错:', error);
  }
}

// 清理资源函数
function cleanupResources() {
  try {
    // 清理 DOM 元素
    if (aiSearchResult && aiSearchResult.parentNode) {
      aiSearchResult.parentNode.removeChild(aiSearchResult);
    }
    
    // 重置全局变量
    aiSearchResult = null;
    selectedText = '';
    rawResult = '';
    currentSearchId = null;
    
    // 清理事件监听器
    const retryButton = document.querySelector('.ai-search-result-retry-button');
    if (retryButton) {
      retryButton.replaceWith(retryButton.cloneNode(true));
    }
    
  } catch (error) {
    console.error('清理资源时出错:', error);
  }
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
  // 立即显示窗口和加载状态
  if (!aiSearchResult) {
    createAISearchResultWindow();
    conversationHistory = []; // 新对话时重置历史
  }
  showLoadingState('正在思考中...');
  chrome.storage.local.get({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    customModel: '',
    prompt: '请解释以下内容:',
    actualModel: 'gpt-3.5-turbo',
    useMarkdown: true,
    saveHistory: true,
    maxChatHistory: 20 // 默认最大对话历史数量
  }, function(items) {
    chrome.storage.local.get({ apiKey: '' }, async function(localItems) {
      if (!localItems.apiKey) {
        showErrorState('API密钥未设置', '请先在扩展设置中配置API密钥');
        return;
      }
      try {
        // 构建提示词
        let finalPrompt;
        let messages = [];
        if (text.startsWith('基于之前的对话内容')) {
          // 继续提问时，使用完整的对话历史
          // 修复：确保换行符被正确保留
          const parts = text.replace('基于之前的对话内容：\n', '').split('\n\n新的问题：');
          const newQuestion = parts.length > 1 ? parts[1] : '';
          
          // 添加系统角色消息
          messages.push({
            role: 'system',
            content: '你是一个有帮助的AI助手，请基于之前的对话回答用户的问题。'
          });

          // 添加历史对话
          for (const history of conversationHistory) {
            messages.push({
              role: 'user',
              content: history.question
            });
            messages.push({
              role: 'assistant',
              content: history.answer
            });
          }

          // 添加新问题
          messages.push({
            role: 'user',
            content: newQuestion.replace(/\r\n/g, '\n').replace(/\r/g, '\n') // 确保换行符被正确处理
          });

          finalPrompt = newQuestion; // 用于保存历史
        } else {
          // 新对话
          // 确保文本中的换行符被正确处理
          const processedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          const promptText = template ? template.content + '\n' + processedText : items.prompt + '\n' + processedText;
          messages = [
            {
              role: 'user',
              content: promptText
            }
          ];
          finalPrompt = text;
        }

        console.log('准备发送API请求，消息数量:', messages.length);
        
        // 获取响应
        const response = await fetchAIResponse(
          items.apiUrl,
          localItems.apiKey,
          items.actualModel,
          messages
        );
        
        if (!response.success) {
          // 直接抛出API返回的错误信息
          throw new Error(response.error);
        }
        
        console.log('收到API响应:', { success: response.success });
        
        if (response.content) {
          // 保存到对话历史
          conversationHistory.push({
            question: finalPrompt,
            answer: response.content
          });
          
          // 限制对话历史数量
          if (conversationHistory.length > items.maxChatHistory) {
            // 只保留最近的maxChatHistory条记录
            conversationHistory = conversationHistory.slice(-items.maxChatHistory);
            console.log(`对话历史超过${items.maxChatHistory}条，已自动清理旧记录`);
          }

          // 保存原始结果
          rawResult = response.content;
          
          // 更新结果显示
          console.log('更新结果显示');
          updateResultContent(response.content);
          
          // 如果启用了历史记录保存
          if (items.saveHistory) {
            console.log('保存到历史记录');
            // 判断类型
            let type = 'select';
            if (window.location.pathname.includes('popup.html')) {
              type = 'chat';
            } else {
              type = 'select'; // 无论是否有template，全部归为select
            }
            if (text.startsWith('基于之前的对话内容')) {
              if (window.location.pathname.includes('popup.html')) {
                type = 'chat';
              } else {
                type = 'select';
              }
            }
            const historyData = {
              id: generateId(),
              query: finalPrompt,
              response: response.content,
              timestamp: Date.now(),
              type: type,
              rating: 0
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
        showErrorState('请求失败', error.message);
      }
    });
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
    chrome.storage.local.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      actualModel: 'gpt-3.5-turbo'
    }, function(items) {
      chrome.storage.local.get({ apiKey: '' }, function(localItems) {
        fetchAIResponse(items.apiUrl, localItems.apiKey, items.actualModel, translatePrompt)
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
    });
    document.body.removeChild(optionsPopup);
  });
  buttonGroup.appendChild(translateButton);
  
  // 解释并翻译按钮
  const bothButton = document.createElement('button');
  bothButton.textContent = '解释并翻译';
  bothButton.addEventListener('click', function() {
    const bothPrompt = `请先将以下${langName}文本翻译成中文，然后解释其含义：\n\n${selectedText}`;
    chrome.storage.local.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      actualModel: 'gpt-3.5-turbo'
    }, function(items) {
      chrome.storage.local.get({ apiKey: '' }, function(localItems) {
        fetchAIResponse(items.apiUrl, localItems.apiKey, items.actualModel, bothPrompt)
          .then(response => {
            showAISearchResultWindow(response.content);
          })
          .catch(error => {
            showErrorState('请求失败', error.message);
          });
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
      // 确保传入的文本也处理换行符
      selectedText = request.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      searchWithAI(selectedText, request.template);
    } else if (request.useSelectedText) {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        // 获取完整的选中文本，保留换行符
        selectedText = selection.toString();
        // 统一换行符为\n
        selectedText = selectedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        searchWithAI(selectedText, request.template);
      }
    }
  } else if (request.action === "getSelectedText") {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      // 获取完整的选中文本，保留换行符
      selectedText = selection.toString();
      // 统一换行符为\n
      selectedText = selectedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      // 使用获取到的完整文本调用searchWithAI
      searchWithAI(selectedText, request.template);
    }
  } else if (request.action === "translateSelectedText") {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      // 获取完整的选中文本，保留换行符
      selectedText = selection.toString();
      // 统一换行符为\n
      selectedText = selectedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const detectedLang = detectLanguage(selectedText);
      let translatePrompt;
      if (detectedLang === 'zh') {
        translatePrompt = `请将以下中文文本翻译成英文，只返回翻译结果，不要解释：\n\n${selectedText}`;
      } else {
        translatePrompt = `请将以下${getLanguageName(detectedLang)}文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
      }
      chrome.storage.local.get({
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
  // 记录错误到控制台
  console.debug("捕获到错误:", event.error);
  
  try {
    // 如果错误发生在AI搜索过程中，显示友好的错误提示
    if (event.error && event.error.message) {
      // 隐藏加载状态
      hideLoadingState();
      
      // 显示错误状态
      showErrorState('操作失败', '抱歉，处理过程中出现了错误。请稍后重试。');
      
      // 重置全局状态
      selectedText = '';
      rawResult = '';
      currentSearchId = null;
    }
  } catch (e) {
    console.error('错误处理失败:', e);
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
  
  // 初始化样式
  addMemoStyles();
  addContinueAskStyles();
  addResizeStyles();
  
  // 添加基础搜索结果样式
  const style = document.createElement('style');
  style.id = 'ai-search-result-base-styles';
  style.textContent = `
    .ai-search-result {
      position: fixed;
      z-index: 999999;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      min-width: 30vw;
      max-width: 45vw;
      width: 40vw;
      min-height: 25vh;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .ai-search-result-content {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      min-height: 20vh;
      max-height: calc(70vh - 12vh);
      word-break: break-all;
      white-space: pre-wrap;
      overflow-wrap: break-word;
    }

    .ai-search-result-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 20vh;
      padding: 2vh 2vw;
    }

    @media (max-width: 768px) {
      .ai-search-result {
        width: 85vw;
        max-width: 90vw;
        min-width: 80vw;
        max-height: 60vh;
        min-height: 30vh;
      }

      .ai-search-result-content {
        min-height: 25vh;
        max-height: calc(60vh - 12vh);
      }
    }

    /* 错误状态样式 */
    .ai-search-result-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
      min-height: 150px;
    }
    
    .ai-search-result-error-icon {
      font-size: 32px;
      margin-bottom: 10px;
    }
    
    .ai-search-result-error-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #dc3545;
    }
    
    .ai-search-result-error-message {
      font-size: 14px;
      color: #666;
      margin-bottom: 15px;
      line-height: 1.5;
    }
    
    .ai-search-result-retry-button {
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    .ai-search-result-retry-button:hover {
      background-color: #1557b0;
    }
    
    .ai-search-result[data-error-state="true"] .ai-continue-ask-area {
      display: none;
    }

    .ai-search-result-content pre {
      white-space: pre;
      word-break: break-all;
      overflow-x: auto;
      min-width: 100px;
      max-width: 100%;
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Fira Mono', 'Consolas', monospace;
      font-size: 13px;
      tab-size: 2;
      -moz-tab-size: 2;
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 8px 0;
    }

    .ai-search-result-content pre code {
      background: none;
      padding: 0;
      margin: 0;
      border-radius: 0;
      border: none;
      white-space: pre;
    }

    .ai-search-result-content code {
      display: inline-block;
      padding: 2px 4px;
      font-size: 13px;
      font-family: 'Fira Mono', 'Consolas', monospace;
      background-color: #f5f5f5;
      border-radius: 3px;
      white-space: pre;
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
  chrome.storage.local.get({ memos: [] }, function(data) {
    const memos = data.memos;
    memos.push({
      id: Date.now(),
      text: text,
      timestamp: new Date().toISOString()
    });
    chrome.storage.local.set({ memos: memos }, function() {
      console.log('备忘录已保存');
    });
  });
}

// 获取所有备忘录
function getMemos(callback) {
  chrome.storage.local.get({ memos: [] }, function(data) {
    callback(data.memos);
  });
}

// 删除备忘录
function deleteMemo(id) {
  chrome.storage.local.get({ memos: [] }, function(data) {
    const memos = data.memos.filter(memo => memo.id !== id);
    chrome.storage.local.set({ memos: memos }, function() {
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
      // 检查是否处于编辑模式
      const editId = saveButton.dataset.editId;
      if (editId) {
        // 更新现有备忘录
        updateMemo(parseInt(editId), text);
        // 重置编辑状态
        saveButton.textContent = '保存';
        delete saveButton.dataset.editId;
      } else {
        // 添加新备忘录
        saveMemo(text);
      }
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
  
  // 编辑备忘录
  function editMemo(id, text) {
    textarea.value = text;
    textarea.focus();
    saveButton.textContent = '更新';
    saveButton.dataset.editId = id;
    // 滚动到输入框位置
    textarea.scrollIntoView({ behavior: 'smooth' });
  }
  
  // 更新备忘录
  function updateMemo(id, text) {
    chrome.storage.local.get({ memos: [] }, function(data) {
      const memos = data.memos;
      const index = memos.findIndex(memo => memo.id === id);
      if (index !== -1) {
        memos[index].text = text;
        memos[index].timestamp = new Date().toISOString(); // 更新时间戳
        chrome.storage.local.set({ memos: memos }, function() {
          console.log('备忘录已更新');
        });
      }
    });
  }
  
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
        
        const editButton = document.createElement('button');
        editButton.className = 'ai-memo-edit-button';
        editButton.textContent = '编辑';
        editButton.addEventListener('click', function() {
          editMemo(memo.id, memo.text);
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'ai-memo-delete-button';
        deleteButton.textContent = '删除';
        deleteButton.addEventListener('click', function() {
          deleteMemo(memo.id);
          refreshMemoList();
        });
        
        memoItem.appendChild(memoText);
        memoItem.appendChild(memoTime);
        memoItem.appendChild(editButton);
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
    
    .ai-memo-edit-button {
      position: absolute;
      top: 8px;
      right: 56px;
      padding: 4px 8px;
      background-color: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }
    
    .ai-memo-item:hover .ai-memo-edit-button {
      opacity: 1;
    }
    
    .ai-memo-edit-button:hover {
      background-color: #218838;
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

// 添加调整大小的样式
function addResizeStyles() {
  // 检查是否已经添加过样式
  if (document.querySelector('#ai-resize-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'ai-resize-styles';
  style.textContent = `
    .ai-search-result {
      position: fixed;
      z-index: 999999;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      min-width: 400px;
      max-width: 90vw;
      min-height: 200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      resize: both;
    }

    .ai-search-result-content {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      min-height: 100px;
      margin-bottom: 106px;
      white-space: pre-wrap;
      word-wrap: break-word;
      word-break: break-word;
    }

    .markdown-body {
      white-space: normal;
    }

    .markdown-body pre {
      white-space: pre-wrap;
    }

    .markdown-body code {
      white-space: pre-wrap;
    }

    .ai-continue-ask-area {
      position: absolute;
      bottom: 50px;
      left: 0;
      right: 0;
      padding: 10px 15px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #f8f9fa;
      height: 56px;
      box-sizing: border-box;
      z-index: 1002;
      pointer-events: auto;
    }

    .ai-continue-ask-input {
      flex: 1;
      height: 36px;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: none;
      font-size: 14px;
      line-height: 20px;
      background: white;
      overflow: hidden;
      box-sizing: border-box;
      pointer-events: auto;
    }

    .ai-continue-ask-button {
      padding: 8px 16px;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      height: 36px;
      white-space: nowrap;
      flex-shrink: 0;
      pointer-events: auto;
    }

    .ai-continue-ask-button:hover {
      background-color: #1557b0;
    }

    .ai-search-result-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      border-top: 1px solid #eee;
      background: #f8f9fa;
      height: 50px;
      box-sizing: border-box;
      z-index: 1000;
      pointer-events: auto;
    }

    .ai-search-result-footer > div:first-child {
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 14px;
      color: #666;
      margin-right: 12px;
    }

    .ai-search-result-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      overflow-x: auto;
      max-width: calc(100% - 100px);
      pointer-events: auto;
    }

    .ai-search-result-format-toggle {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
      margin-right: 12px;
      pointer-events: auto;
    }

    .ai-search-result-format-toggle label {
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      pointer-events: auto;
    }

    .ai-search-result-rating-group {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      pointer-events: auto;
    }

    .ai-search-result-action-button {
      white-space: nowrap;
      flex-shrink: 0;
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      color: #333;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
      min-width: fit-content;
      pointer-events: auto;
    }

    .ai-search-result-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: se-resize;
      z-index: 1001;
    }

    .ai-search-result-resize-handle::before {
      content: '';
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 12px;
      height: 12px;
      border-right: 2px solid #666;
      border-bottom: 2px solid #666;
      opacity: 0.6;
    }

    .ai-search-result-resize-handle:hover::before {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);
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
    
    // 重置其他全局状态
    rawResult = '';
    currentSearchId = null;
  }
}

// 显示AI搜索结果
function showAISearchResultWindow(result) {
  try {
    if (!result) {
      throw new Error('响应内容为空');
    }
    
    let width, height;
    
    // 如果窗口已存在，保存当前尺寸
    if (aiSearchResult) {
      width = aiSearchResult.style.width;
      height = aiSearchResult.style.height;
    }
    
    rawResult = result; // 保存原始结果
    const resultWindow = createAISearchResultWindow();
    
    // 恢复之前的尺寸
    if (width && height) {
      aiSearchResult.style.width = width;
      aiSearchResult.style.height = height;
    }
    
    if (!resultWindow) {
      throw new Error('结果窗口创建失败');
    }
    
    updateResultContent(result);
  } catch (error) {
    console.error('显示结果时出错:', error);
    showErrorState('显示错误', error.message);
  }
}

// 判断template是否有效（有title/content/category且为对象）
function isTemplateValid(template) {
  return !!(template && typeof template === 'object' && (template.title || template.content || template.category));
} 