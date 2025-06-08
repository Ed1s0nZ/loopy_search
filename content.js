// 全局变量
let aiSearchButton = null;
let aiSearchResult = null;
let selectedText = '';
let rawResult = ''; // 存储原始结果文本
let isMarkdownMode = true; // 默认使用Markdown模式
let currentSearchId = null; // 当前搜索的ID
let showFloatingButton = false; // 默认不显示浮动按钮

// 初始化时读取用户设置
chrome.storage.sync.get({
  useMarkdown: true
}, function(items) {
  isMarkdownMode = items.useMarkdown;
});

// 创建AI搜索按钮
function createAISearchButton() {
  if (aiSearchButton) {
    document.body.removeChild(aiSearchButton);
  }

  aiSearchButton = document.createElement('div');
  aiSearchButton.className = 'ai-search-button';
  aiSearchButton.title = '使用AI解释所选文本';
  
  const buttonImage = document.createElement('img');
  buttonImage.src = chrome.runtime.getURL('images/icon48.png');
  aiSearchButton.appendChild(buttonImage);
  
  // 添加波纹效果
  aiSearchButton.addEventListener('mousedown', function(e) {
    this.style.transform = 'scale(0.95)';
  });
  
  aiSearchButton.addEventListener('mouseup', function(e) {
    this.style.transform = 'scale(1.1)';
  });
  
  aiSearchButton.addEventListener('mouseleave', function(e) {
    this.style.transform = '';
  });
  
  aiSearchButton.addEventListener('click', handleAISearchButtonClick);
  document.body.appendChild(aiSearchButton);
  return aiSearchButton;
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

// 创建AI搜索结果窗口
function createAISearchResultWindow() {
  if (aiSearchResult) {
    document.body.removeChild(aiSearchResult);
  }

  aiSearchResult = document.createElement('div');
  aiSearchResult.className = 'ai-search-result';
  
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
  
  const content = document.createElement('div');
  content.className = 'ai-search-result-content';
  
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
  
  // 添加翻译按钮
  const translateButton = document.createElement('button');
  translateButton.className = 'ai-search-result-action-button translate-btn';
  translateButton.textContent = '翻译';
  translateButton.addEventListener('click', function() {
    if (selectedText) {
      translateButton.textContent = '翻译中...';
      translateButton.disabled = true;
      
      // 构建翻译请求
      const translatePrompt = `请将以下文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
      
      // 获取API设置
      chrome.storage.sync.get({
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        actualModel: 'gpt-3.5-turbo'
      }, function(items) {
        // 发送翻译请求
        fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, translatePrompt)
          .then(response => {
            showAISearchResultWindow(response);
            translateButton.textContent = '翻译';
            translateButton.disabled = false;
          })
          .catch(error => {
            showErrorState('翻译失败', error.message);
            translateButton.textContent = '翻译';
            translateButton.disabled = false;
          });
      });
    }
  });
  
  actions.appendChild(translateButton);
  
  footer.appendChild(actions);
  
  aiSearchResult.appendChild(header);
  aiSearchResult.appendChild(content);
  aiSearchResult.appendChild(footer);
  
  // 添加拖动功能
  let isDragging = false;
  let offsetX, offsetY;
  
  header.addEventListener('mousedown', function(e) {
    isDragging = true;
    offsetX = e.clientX - aiSearchResult.getBoundingClientRect().left;
    offsetY = e.clientY - aiSearchResult.getBoundingClientRect().top;
    aiSearchResult.style.transition = 'none';
  });
  
  document.addEventListener('mousemove', function(e) {
    if (isDragging && aiSearchResult) {
      aiSearchResult.style.transform = 'none';
      aiSearchResult.style.top = (e.clientY - offsetY) + 'px';
      aiSearchResult.style.left = (e.clientX - offsetX) + 'px';
    }
  });
  
  document.addEventListener('mouseup', function() {
    isDragging = false;
    if (aiSearchResult) {
      aiSearchResult.style.transition = '';
    }
  });
  
  document.body.appendChild(aiSearchResult);
  return aiSearchResult;
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
  if (!result) {
    console.error('结果为空');
    return;
  }

  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) {
    console.error('找不到内容容器');
    return;
  }

  try {
    if (isMarkdownMode) {
      // 使用简单的Markdown解析
      const htmlContent = simpleMarkdown(result);
      
      // 创建一个包装容器
      const markdownContainer = document.createElement('div');
      markdownContainer.className = 'markdown-body';
      markdownContainer.innerHTML = htmlContent;
      
      // 清空内容区域并添加新内容
      content.innerHTML = '';
      content.appendChild(markdownContainer);
    } else {
      content.textContent = result;
    }
  } catch (error) {
    console.error('渲染内容时出错:', error);
    content.textContent = result; // 如果解析失败，退回到纯文本
  }
}

// 显示AI搜索结果
function showAISearchResultWindow(result) {
  rawResult = result; // 保存原始结果
  const resultWindow = createAISearchResultWindow();
  updateResultContent(result);
}

// 隐藏AI搜索结果窗口
function hideAISearchResultWindow() {
  if (aiSearchResult && aiSearchResult.parentNode) {
    aiSearchResult.parentNode.removeChild(aiSearchResult);
    aiSearchResult = null;
  }
}

// 显示加载状态
function showLoadingState() {
  const resultWindow = createAISearchResultWindow();
  const content = resultWindow.querySelector('.ai-search-result-content');
  
  content.innerHTML = '';
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-search-result-loading';
  
  const spinner = document.createElement('div');
  spinner.className = 'ai-search-result-loading-spinner';
  loadingDiv.appendChild(spinner);
  
  const loadingText = document.createElement('div');
  loadingText.className = 'ai-search-result-loading-text';
  loadingText.textContent = '正在思考中...';
  loadingDiv.appendChild(loadingText);
  
  content.appendChild(loadingDiv);
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

// 发送API请求获取AI响应，支持重试
async function fetchAIResponse(apiUrl, apiKey, model, prompt, retryCount = 0, maxRetries = 2) {
  try {
    console.log('开始API请求:', { url: apiUrl, model: model, retryCount });
    
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

    console.log('API响应数据:', response.data);
    
    // 提取回复内容
    if (response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message?.content;
      if (!content) {
        throw new Error('API响应中没有找到内容');
      }
      return content;
    } else {
      console.error('API响应格式异常:', response.data);
      throw new Error('API响应格式异常，未找到有效内容');
    }
  } catch (error) {
    console.error('API请求异常:', error);
    
    // 检查是否是网络错误或 API 密钥错误
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes('api key') || errorMessage.includes('apikey')) {
      throw new Error('API密钥无效，请在设置中检查并更新API密钥');
    } else if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
      // 检查网络状态
      try {
        const networkStatus = await checkNetworkStatus();
        if (!networkStatus.status.isOnline && retryCount < maxRetries) {
          console.log('网络离线，等待恢复后重试...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return fetchAIResponse(apiUrl, apiKey, model, prompt, retryCount + 1, maxRetries);
        }
      } catch (e) {
        console.error('检查网络状态失败:', e);
      }
      throw new Error('网络连接失败，请检查网络设置');
    }
    
    // 保存会话状态，以便恢复
    saveSessionState({
      apiUrl: apiUrl,
      model: model,
      prompt: prompt,
      text: selectedText,
      timestamp: Date.now()
    });
    
    // 重新抛出错误，使用更友好的错误信息
    throw new Error(`请求失败: ${error.message}`);
  }
}

// 保存会话状态
function saveSessionState(sessionData) {
  chrome.storage.local.set({ lastSession: sessionData }, function() {
    console.log('会话状态已保存:', sessionData);
  });
}

// 恢复上次会话
function restoreLastSession() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('lastSession', function(data) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (data.lastSession) {
        resolve(data.lastSession);
      } else {
        reject(new Error('没有找到上次的会话'));
      }
    });
  });
}

// 添加会话恢复按钮到错误界面
function addSessionRecoveryButton(errorContainer) {
  chrome.storage.local.get('lastSession', function(data) {
    if (data.lastSession) {
      const lastSession = data.lastSession;
      const timeDiff = Date.now() - lastSession.timestamp;
      
      // 只有在30分钟内的会话才显示恢复按钮
      if (timeDiff < 30 * 60 * 1000) {
        const recoveryButton = document.createElement('button');
        recoveryButton.className = 'ai-search-result-recovery-button';
        recoveryButton.textContent = '恢复上次会话';
        recoveryButton.addEventListener('click', function() {
          // 显示加载状态
          showLoadingState();
          
          // 使用保存的参数重新发送请求
          fetchAIResponse(lastSession.apiUrl, null, lastSession.model, lastSession.prompt)
            .then(response => {
              // 显示结果
              showAISearchResultWindow(response);
              
              // 清除会话数据
              chrome.storage.local.remove('lastSession');
            })
            .catch(error => {
              console.error('恢复会话失败:', error);
              showErrorState('恢复会话失败', error.message);
            });
        });
        
        errorContainer.appendChild(recoveryButton);
      }
    }
  });
}

// 显示错误状态
function showErrorState(errorTitle, errorMessage) {
  if (!aiSearchResult) {
    createAISearchResultWindow();
  }
  
  const content = aiSearchResult.querySelector('.ai-search-result-content');
  if (!content) return;
  
  // 清空内容
  content.innerHTML = '';
  
  // 创建错误容器
  const errorContainer = document.createElement('div');
  errorContainer.className = 'ai-search-result-error';
  
  // 添加错误图标
  const errorIcon = document.createElement('div');
  errorIcon.className = 'ai-search-result-error-icon';
  errorIcon.innerHTML = '⚠️';
  errorContainer.appendChild(errorIcon);
  
  // 添加错误标题
  const titleElement = document.createElement('h3');
  titleElement.textContent = errorTitle;
  errorContainer.appendChild(titleElement);
  
  // 添加错误信息
  const messageElement = document.createElement('p');
  messageElement.textContent = errorMessage;
  errorContainer.appendChild(messageElement);
  
  // 创建按钮容器
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'ai-search-result-buttons';
  
  // 添加重试按钮
  const retryButton = document.createElement('button');
  retryButton.className = 'ai-search-result-retry-button';
  retryButton.textContent = '重试';
  retryButton.addEventListener('click', function() {
    if (selectedText) {
      searchWithAI(selectedText);
    }
  });
  buttonsContainer.appendChild(retryButton);
  
  // 添加按钮容器到错误容器
  errorContainer.appendChild(buttonsContainer);
  
  // 添加诊断信息
  const diagnosticsContainer = document.createElement('div');
  diagnosticsContainer.className = 'ai-search-result-diagnostics';
  
  // 添加API服务状态
  const item = document.createElement('div');
  item.className = 'ai-search-result-diagnostic-item';
  
  const status = document.createElement('span');
  status.className = 'ai-search-result-diagnostic-status error';
  status.textContent = '✗';
  
  const text = document.createElement('span');
  text.className = 'ai-search-result-diagnostic-text';
  text.textContent = '您的API服务: 不可访问';
  
  item.appendChild(status);
  item.appendChild(text);
  diagnosticsContainer.appendChild(item);
  
  // 添加在线状态
  const onlineStatus = document.createElement('div');
  onlineStatus.className = 'ai-search-result-online-status';
  onlineStatus.textContent = `在线状态: ${navigator.onLine ? '在线' : '离线'}`;
  diagnosticsContainer.appendChild(onlineStatus);
  
  // 添加诊断容器到错误容器
  errorContainer.appendChild(diagnosticsContainer);
  
  // 添加到内容区域
  content.appendChild(errorContainer);
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
function searchWithAI(text) {
  // 显示加载状态
  showLoadingState();
  
  // 获取API设置
  chrome.storage.sync.get({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    actualModel: 'gpt-3.5-turbo',
    prompt: '请解释以下内容:'
  }, function(items) {
    // 检查API设置是否完整
    if (!items.apiUrl || !items.apiKey) {
      showErrorState('API配置不完整', '请先在扩展设置中配置API地址和密钥');
      return;
    }
    
    // 构建完整的提示词
    const fullPrompt = `${items.prompt}\n\n${text}`;
    
    // 发送API请求
    fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, fullPrompt)
      .then(response => {
        // 保存搜索历史
        chrome.runtime.sendMessage({
          action: 'saveSearchHistory',
          data: {
            query: text,
            response: response
          }
        }, function(res) {
          if (res && res.id) {
            currentSearchId = res.id;
          }
        });
        
        // 显示结果
        showAISearchResultWindow(response);
      })
      .catch(error => {
        console.error('API请求错误:', error);
        showErrorState('API请求失败', `详细错误信息: ${error.message || '未知错误'}`);
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
    
    // 获取API设置
    chrome.storage.sync.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      actualModel: 'gpt-3.5-turbo'
    }, function(items) {
      // 发送翻译请求
      fetchAIResponse(items.apiUrl, items.apiKey, items.actualModel, translatePrompt)
        .then(response => {
          showAISearchResultWindow(response);
        })
        .catch(error => {
          showErrorState('翻译失败', error.message);
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
          showAISearchResultWindow(response);
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

// 处理来自后台的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    if (request.action === "searchWithAI") {
      if (request.text) {
        // 如果提供了文本，直接使用
        selectedText = request.text;
        searchWithAI(selectedText);
      } else if (request.useSelectedText) {
        // 否则使用当前选中的文本
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
          selectedText = selection.toString().trim();
          searchWithAI(selectedText);
        }
      }
      sendResponse({ success: true });
    } else if (request.action === "translateSelectedText") {
      // 处理翻译请求
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        selectedText = selection.toString().trim();
        
        // 检测语言
        const detectedLang = detectLanguage(selectedText);
        
        // 构建翻译提示词
        let translatePrompt;
        if (detectedLang === 'zh') {
          translatePrompt = `请将以下中文文本翻译成英文，只返回翻译结果，不要解释：\n\n${selectedText}`;
        } else {
          translatePrompt = `请将以下${getLanguageName(detectedLang)}文本翻译成中文，只返回翻译结果，不要解释：\n\n${selectedText}`;
        }
        
        // 获取API设置并发送请求
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
    }
  } catch (error) {
    console.error("消息处理错误:", error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // 保持消息通道开放
});

// 添加错误恢复机制
window.addEventListener('error', function(event) {
  console.error("捕获到错误:", event.error);
  
  // 如果错误发生在AI搜索过程中，显示友好的错误提示
  if (event.error && event.error.message && event.error.message.includes("AI")) {
    showErrorState("发生意外错误", "插件运行时遇到问题。请刷新页面后重试。");
  }
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
});

// 打开设置页面
function openSettings() {
  chrome.runtime.sendMessage({ action: 'openSettings' }, function(response) {
    if (chrome.runtime.lastError) {
      console.error('打开设置失败:', chrome.runtime.lastError);
    }
  });
} 