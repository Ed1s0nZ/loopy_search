// 全局函数定义
function showToast(message, type = 'success', duration = 3000) {
  // 清除所有现有的 toast
  const existingContainer = document.querySelector('.toast-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // 创建新的 toast 容器
  const toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);

  // 创建新的 toast 元素
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  // 添加到容器
  toastContainer.appendChild(toast);
  
  // 触发显示动画
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // 设定时间后移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.remove();
    }, 300);
  }, duration);
}

// 添加必要的样式
const style = document.createElement('style');
style.textContent = `
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
  }
  
  .toast {
    background-color: #4CAF50;
    color: white;
    padding: 12px 24px;
    border-radius: 4px;
    margin-bottom: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;
    font-size: 14px;
    line-height: 1.4;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  
  .toast.show {
    opacity: 1;
    transform: translateY(0);
  }
  
  .toast-success {
    background-color: #4CAF50;
  }
  
  .toast-error {
    background-color: #f44336;
  }

  /* 代理设置相关样式 */

  /* 导航容器样式 */
  .nav-container {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    padding: 0;
  }

  .nav-tabs {
    display: flex;
    border-bottom: 1px solid #eee;
    overflow-x: auto;
    scrollbar-width: none;  /* Firefox */
    -ms-overflow-style: none;  /* IE and Edge */
    margin: 0 40px;  /* 为按钮留出空间 */
    padding: 0 10px;
    user-select: none;  /* 防止文字被选中 */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  .nav-tabs::-webkit-scrollbar {
    display: none;  /* Chrome, Safari, Opera */
  }

  .scroll-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #666;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.2s;
    z-index: 1;
    opacity: 0.6;
  }

  .scroll-button:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #1a73e8;
    opacity: 1;
  }

  .scroll-button:active {
    transform: translateY(-50%) scale(0.95);
  }

  .scroll-button.disabled {
    opacity: 0.2;
    cursor: not-allowed;
    pointer-events: none;
  }

  .scroll-left {
    left: 0px;
  }

  .scroll-right {
    right: 0px;
  }
`;

// 检查并移除可能存在的重复样式
const existingStyle = document.querySelector('style[data-toast-style]');
if (existingStyle) {
  existingStyle.remove();
}
style.setAttribute('data-toast-style', 'true');
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function() {
  // 全局函数定义
  function loadCategories() {
    chrome.storage.local.get({ 
      customCategories: ['通用']
    }, function(data) {
      const categories = data.customCategories;
      
      // 更新新建提示词模态框中的分类选择器
      const newPromptSelect = document.getElementById('promptCategory');
      if (newPromptSelect) {
        newPromptSelect.innerHTML = categories.map(category => 
          `<option value="${category}">${category}</option>`
        ).join('');
      }
      
      // 更新编辑提示词模态框中的分类选择器
      const editPromptSelect = document.getElementById('editPromptCategory');
      if (editPromptSelect) {
        const currentCategory = editPromptSelect.value;
        editPromptSelect.innerHTML = categories.map(category => 
          `<option value="${category}" ${category === currentCategory ? 'selected' : ''}>${category}</option>`
        ).join('');
      }
    });
  }

  function loadPromptList() {
    const promptsList = document.getElementById('promptsList');
    if (!promptsList) return;

    chrome.storage.local.get({ 
      promptTemplates: [],
      customCategories: ['通用']
    }, function(data) {
      const templates = data.promptTemplates;
      
      if (templates.length === 0) {
        promptsList.innerHTML = '<div class="empty-prompt">暂无提示词，点击"新建提示词"添加</div>';
        return;
      }

      // 按分类分组
      const groupedTemplates = {};
      templates.forEach(template => {
        const category = template.category || '通用';
        if (!groupedTemplates[category]) {
          groupedTemplates[category] = [];
        }
        groupedTemplates[category].push(template);
      });

      // 渲染分组列表
      promptsList.innerHTML = Object.entries(groupedTemplates)
        .map(([category, categoryTemplates]) => `
          <div class="prompt-category-section">
            <div class="prompt-category-header">
              <h3 class="prompt-category-title">
                ${category}
                <span class="prompt-category-count">${categoryTemplates.length}个提示词</span>
              </h3>
            </div>
            <div class="prompts-list">
              ${categoryTemplates.map(template => `
                <div class="prompt-item">
                  <div class="prompt-item-header">
                    <h3 class="prompt-title">${template.title}</h3>
                  </div>
                  <div class="prompt-content">${template.content}</div>
                  ${template.description ? `<div class="prompt-description">${template.description}</div>` : ''}
                  <div class="prompt-actions">
                    <button class="btn-edit" data-title="${template.title}">编辑</button>
                    <button class="btn-apply" data-title="${template.title}">应用</button>
                    <button class="btn-delete" data-title="${template.title}">删除</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('');

      // 绑定按钮事件
      bindPromptListEvents(templates);
    });
  }

  function bindPromptListEvents(templates) {
    const promptsList = document.getElementById('promptsList');
    if (!promptsList) return;

    // 绑定编辑按钮事件
    promptsList.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', function() {
        const title = this.dataset.title;
        const template = templates.find(t => t.title === title);
        if (template) {
          // 填充编辑表单
          document.getElementById('editPromptTitle').value = template.title;
          document.getElementById('editPromptContent').value = template.content;
          document.getElementById('editPromptDescription').value = template.description || '';
          
          // 加载分类选项并设置当前分类
          loadCategories();

          // 显示编辑模态框
          document.getElementById('editPromptModal').style.display = 'block';
          document.getElementById('editPromptTitle').focus();

          // 保存原始标题用于更新
          document.getElementById('editPromptModal').dataset.originalTitle = template.title;
        }
      });
    });

    // 绑定应用按钮事件
    promptsList.querySelectorAll('.btn-apply').forEach(btn => {
      btn.addEventListener('click', function() {
        const title = this.dataset.title;
        const template = templates.find(t => t.title === title);
        if (template) {
          chrome.storage.local.set({ prompt: template.content }, function() {
            const promptInput = document.getElementById('prompt');
            if (promptInput) {
              promptInput.value = template.content;
              showToast('该提示词已应用至\'默认提示词前缀\'');
            }
          });
        }
      });
    });

    // 绑定删除按钮事件
    promptsList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', function() {
        const title = this.dataset.title;
        if (confirm(`确定要删除提示词"${title}"吗？`)) {
          const updatedTemplates = templates.filter(t => t.title !== title);
          chrome.storage.local.set({ promptTemplates: updatedTemplates }, function() {
            loadPromptList();
            showToast('提示词已删除', 'success');
          });
        }
      });
    });
  }

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
  const maxChatHistoryInput = document.getElementById('maxChatHistory');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const historyPreviewList = document.getElementById('historyPreviewList');
  const viewAllHistoryBtn = document.getElementById('viewAllHistoryBtn');

  // 加载保存的设置
  chrome.storage.local.get({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    customModel: '',
    prompt: '请解释以下内容:',
    useMarkdown: true,
    saveHistory: true,
    historyRetention: 7,
    maxChatHistory: 20
  }, function(items) {
    chrome.storage.local.get({ apiKey: '' }, function(localItems) {
      apiUrlInput.value = items.apiUrl;
      apiKeyInput.value = localItems.apiKey;
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
  });

  // 模型选择变化时的处理
  modelSelect.addEventListener('change', function() {
    if (this.value === 'custom') {
      customModelContainer.style.display = 'block';
    } else {
      customModelContainer.style.display = 'none';
    }
  });

  // 密码显示/隐藏功能在 initializeSettings 中处理

  // 标签页切换
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).classList.add('active');

      // 如果切换到历史记录标签页，加载历史记录预览
      if (tabId === 'history') {
        loadHistoryPreview();
      }
      // 如果切换到提示词标签页，重新加载提示词列表
      if (tabId === 'prompts') {
        loadPromptList();
        loadCategories();
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
    
    // 获取最大对话历史数量
    const maxChatHistoryInput = document.getElementById('maxChatHistory');
    const maxChatHistory = maxChatHistoryInput ? 
      parseInt(maxChatHistoryInput.value) || 20 : 20;
    
    // 先保存apiKey到local
    chrome.storage.local.set({ apiKey: apiKeyInput.value }, function() {
      // 其他设置依然用local
      chrome.storage.local.set({
        apiUrl: apiUrlInput.value,
        model: model,
        customModel: customModelInput.value,
        prompt: promptInput.value,
        actualModel: actualModel,
        useMarkdown: useMarkdownCheckbox.checked,
        saveHistory: saveHistoryCheckbox.checked,
        historyRetention: parseInt(historyRetentionSelect.value),
        maxChatHistory: maxChatHistory
      }, function() {
        // 显示保存成功的提示
        statusDiv.style.display = 'block';
        // 如果修改了历史记录保留时间，立即执行一次清理
        chrome.runtime.sendMessage({
          action: 'updateHistoryRetention',
          days: parseInt(historyRetentionSelect.value)
        }, function() {
          console.debug('已更新历史记录保留天数，并触发清理');
        });
        // 1秒后隐藏保存成功提示
        setTimeout(function() {
          statusDiv.style.display = 'none';
        }, 1000);
      });
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

  // 初始化备忘录功能
  function initializeMemo() {
    const memoInput = document.querySelector('.memo-input');
    const memoSaveBtn = document.querySelector('.memo-save-btn');
    const memoList = document.querySelector('.memo-list');

    // 添加导出按钮到备忘录容器
    const exportBtn = document.createElement('button');
    exportBtn.className = 'memo-export-btn';
    exportBtn.innerHTML = '💾 导出所有备忘录';
    document.querySelector('.memo-tips').appendChild(exportBtn);

    // 导出备忘录到本地文件
    function exportMemos() {
      chrome.storage.local.get({ memos: [] }, function(data) {
        const memos = data.memos;
        if (memos.length === 0) {
          alert('暂无备忘录可导出');
          return;
        }

        // 生成导出内容
        let exportContent = '# AI划词搜索 - 备忘录导出\n\n';
        exportContent += `导出时间：${new Date().toLocaleString()}\n\n`;
        
        memos.sort((a, b) => b.id - a.id).forEach(memo => {
          exportContent += `## ${new Date(memo.timestamp).toLocaleString()}\n`;
          exportContent += `${memo.text}\n\n`;
        });

        // 创建并下载文件
        const blob = new Blob([exportContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `备忘录_${new Date().toLocaleDateString()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // 添加导出按钮的事件监听
    exportBtn.addEventListener('click', exportMemos);

    // 加载备忘录列表
    function loadMemos() {
      chrome.storage.local.get({ memos: [] }, function(data) {
        const memos = data.memos;
        if (memos.length === 0) {
          memoList.innerHTML = '<div class="memo-empty">暂无备忘录</div>';
          return;
        }

        memoList.innerHTML = '';
        memos.sort((a, b) => b.id - a.id).forEach(memo => {
          const memoItem = document.createElement('div');
          memoItem.className = 'memo-item';
          // 修改渲染方式，保留换行
          const memoText = document.createElement('div');
          memoText.className = 'memo-text';
          memoText.textContent = memo.text;
          memoText.style.whiteSpace = 'pre-line';
          const memoTime = document.createElement('div');
          memoTime.className = 'memo-time';
          memoTime.textContent = new Date(memo.timestamp).toLocaleString();
          
          // 添加复制按钮
          const copyBtn = document.createElement('button');
          copyBtn.className = 'memo-copy-btn';
          copyBtn.title = '复制';
          copyBtn.textContent = '复制';
          copyBtn.dataset.text = memo.text;
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'memo-delete-btn';
          deleteBtn.textContent = '删除';
          deleteBtn.dataset.id = memo.id;
          
          memoItem.appendChild(memoText);
          memoItem.appendChild(memoTime);
          memoItem.appendChild(copyBtn);
          memoItem.appendChild(deleteBtn);
          memoList.appendChild(memoItem);
        });

        // 添加删除事件监听
        document.querySelectorAll('.memo-delete-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            deleteMemo(id);
          });
        });
        
        // 添加复制事件监听
        document.querySelectorAll('.memo-copy-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const text = this.dataset.text;
            navigator.clipboard.writeText(text).then(() => {
              // 显示复制成功提示
              const toast = document.createElement('div');
              toast.textContent = '复制成功';
              toast.style.position = 'fixed';
              toast.style.bottom = '20px';
              toast.style.left = '50%';
              toast.style.transform = 'translateX(-50%)';
              toast.style.padding = '8px 16px';
              toast.style.background = 'rgba(0, 0, 0, 0.7)';
              toast.style.color = 'white';
              toast.style.borderRadius = '4px';
              toast.style.zIndex = '9999';
              document.body.appendChild(toast);
              
              // 2秒后移除提示
              setTimeout(() => {
                document.body.removeChild(toast);
              }, 2000);
            }).catch(err => {
              console.error('复制失败:', err);
            });
          });
        });
      });
    }

    // 保存新备忘录
    function saveMemo() {
      const text = memoInput.value.trim();
      if (!text) return;

      chrome.storage.local.get({ memos: [] }, function(data) {
        const memos = data.memos;
        memos.push({
          id: Date.now(),
          text: text,
          timestamp: new Date().toISOString()
        });
        chrome.storage.local.set({ memos: memos }, function() {
          memoInput.value = '';
          loadMemos();
        });
      });
    }

    // 删除备忘录
    function deleteMemo(id) {
      chrome.storage.local.get({ memos: [] }, function(data) {
        const memos = data.memos.filter(memo => memo.id !== id);
        chrome.storage.local.set({ memos: memos }, function() {
          loadMemos();
        });
      });
    }

    // 添加事件监听
    if (memoSaveBtn) {
      memoSaveBtn.addEventListener('click', saveMemo);
    }
    
    if (memoInput) {
      memoInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
          saveMemo();
        }
      });
    }

    // 初始加载备忘录列表
    loadMemos();

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .memo-export-btn {
        background-color: transparent;
        border: 1px solid #1a73e8;
        color: #1a73e8;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        margin-top: 10px;
        transition: all 0.3s;
      }
      
      .memo-export-btn:hover {
        background-color: #1a73e8;
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  // 初始化设置功能
  function initializeSettings() {
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
    const maxChatHistoryInput = document.getElementById('maxChatHistory');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');
    const togglePasswordBtn = document.getElementById('togglePassword');
    
    // 如果没有找到最大对话历史设置的输入框，则创建一个
    if (!maxChatHistoryInput && document.getElementById('settings')) {
      // 查找历史保留设置的位置
      const historyRetentionGroup = historyRetentionSelect ? historyRetentionSelect.closest('.form-group') : null;
      
      if (historyRetentionGroup) {
        // 创建新的设置组
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // 创建标签
        const label = document.createElement('label');
        label.setAttribute('for', 'maxChatHistory');
        label.textContent = '最大对话历史数量';
        
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'number';
        input.id = 'maxChatHistory';
        input.min = '1';
        input.max = '100';
        input.className = 'form-input';
        
        // 创建描述
        const description = document.createElement('div');
        description.className = 'setting-description';
        description.textContent = '设置保存的最大对话数量，超过此数量将自动删除最旧的对话';
        
        // 添加到表单组
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formGroup.appendChild(description);
        
        // 插入到历史保留设置之后
        historyRetentionGroup.parentNode.insertBefore(formGroup, historyRetentionGroup.nextSibling);
      }
    }
    
    // 加载设置
    chrome.storage.local.get({
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
      customModel: '',
      prompt: '请解释以下内容:',
      useMarkdown: true,
      saveHistory: true,
      historyRetention: 30,
      maxChatHistory: 20
    }, function(items) {
      if (apiUrlInput) apiUrlInput.value = items.apiUrl;
      if (modelSelect) modelSelect.value = items.model;
      if (customModelInput) customModelInput.value = items.customModel;
      if (promptInput) promptInput.value = items.prompt;
      if (useMarkdownCheckbox) useMarkdownCheckbox.checked = items.useMarkdown;
      if (saveHistoryCheckbox) saveHistoryCheckbox.checked = items.saveHistory;
      if (historyRetentionSelect) historyRetentionSelect.value = items.historyRetention;
      
      // 设置最大对话历史数量
      const maxChatHistoryInput = document.getElementById('maxChatHistory');
      if (maxChatHistoryInput) maxChatHistoryInput.value = items.maxChatHistory;
      
      // 显示/隐藏自定义模型输入框
      if (customModelContainer && modelSelect) {
        customModelContainer.style.display = modelSelect.value === 'custom' ? 'block' : 'none';
      }
    });

    // 获取API密钥
    chrome.storage.local.get({ apiKey: '' }, function(items) {
      if (apiKeyInput) apiKeyInput.value = items.apiKey;
    });
    
    // 切换模型时显示/隐藏自定义模型输入框
    if (modelSelect) {
      modelSelect.addEventListener('change', function() {
        if (customModelContainer) {
          customModelContainer.style.display = this.value === 'custom' ? 'block' : 'none';
        }
      });
    }
    
    // 切换密码可见性
    if (togglePasswordBtn && apiKeyInput) {
      togglePasswordBtn.addEventListener('click', function() {
        if (apiKeyInput.type === 'password') {
          apiKeyInput.type = 'text';
          this.textContent = '隐藏';
        } else {
          apiKeyInput.type = 'password';
          this.textContent = '显示';
        }
      });
    }
    
    // 保存设置
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        const model = modelSelect ? modelSelect.value : 'gpt-3.5-turbo';
        const actualModel = model === 'custom' && customModelInput ? customModelInput.value : model;
        
        // 获取最大对话历史数量
        const maxChatHistoryInput = document.getElementById('maxChatHistory');
        const maxChatHistory = maxChatHistoryInput ? 
          parseInt(maxChatHistoryInput.value) || 20 : 20;
        
        // 先保存apiKey到local
        chrome.storage.local.set({ apiKey: apiKeyInput ? apiKeyInput.value : '' }, function() {
          // 其他设置依然用local
          chrome.storage.local.set({
            apiUrl: apiUrlInput ? apiUrlInput.value : 'https://api.openai.com/v1/chat/completions',
            model: model,
            customModel: customModelInput ? customModelInput.value : '',
            prompt: promptInput ? promptInput.value : '请解释以下内容:',
            actualModel: actualModel,
            useMarkdown: useMarkdownCheckbox ? useMarkdownCheckbox.checked : true,
            saveHistory: saveHistoryCheckbox ? saveHistoryCheckbox.checked : true,
            historyRetention: historyRetentionSelect ? parseInt(historyRetentionSelect.value) : 30,
            maxChatHistory: maxChatHistory
          }, function() {
            // 显示保存成功的提示
            if (statusDiv) {
              statusDiv.style.display = 'block';
              // 1秒后隐藏保存成功提示
              setTimeout(function() {
                statusDiv.style.display = 'none';
              }, 1000);
            }
            
            // 如果修改了历史记录保留时间，立即执行一次清理
            if (historyRetentionSelect) {
              chrome.runtime.sendMessage({
                action: 'updateHistoryRetention',
                days: parseInt(historyRetentionSelect.value)
              }, function() {
                console.debug('已更新历史记录保留天数，并触发清理');
              });
            }
          });
        });
      });
    }
  }

  // 初始化历史记录功能
  function initializeHistory() {
    // ... 历史记录相关代码 ...
  }

  // 初始化默认提示词
  function initializeDefaultPrompts() {
    console.log('开始初始化默认提示词...');
    chrome.storage.local.get({ 
      promptTemplates: [],
      customCategories: ['通用'],
      defaultPromptsInitialized: false
    }, function(data) {
      console.log('当前状态:', {
        templatesCount: data.promptTemplates.length,
        categories: data.customCategories,
        isInitialized: data.defaultPromptsInitialized
      });

      // 如果已经初始化过，则不再重复初始化
      if (data.defaultPromptsInitialized) {
        console.log('已经初始化过默认提示词，跳过初始化');
        return;
      }

      // 默认分类
      const defaultCategories = [
        '通用',
        '翻译优化',
        '代码助手',
        '文案创作',
        '学术助手'
      ];

      // 合并现有分类和默认分类
      const mergedCategories = [...new Set([...data.customCategories, ...defaultCategories])];

      // 默认提示词模板
      const defaultTemplates = [
        {
          title: '智能解释',
          category: '通用',
          content: '请帮我解释以下内容，要求：\n1. 给出准确、易懂的解释\n2. 如果是专业术语，请解释其专业含义\n3. 如果有多个含义，请列出主要含义\n4. 可能的情况下，给出相关的例子\n5. 如果是英文词汇，请给出中文翻译\n\n需要解释的内容：',
          description: '智能理解并解释选中的文本内容',
          timestamp: new Date().toISOString()
        },
        {
          title: '中英互译-专业版',
          category: '翻译优化',
          content: '你是一位专业的翻译专家，请将下面的文本翻译成地道的中文/英语（中英互译）。要求：\n1. 保持原文的专业性和准确性\n2. 确保翻译后的表达自然流畅\n3. 对专业术语进行准确翻译\n4. 保留原文的语气和风格\n\n需要翻译的内容：',
          description: '适用于专业文档、技术文章的高质量翻译',
          timestamp: new Date().toISOString()
        },
        {
          title: '代码优化专家',
          category: '代码助手',
          content: '作为一位资深的代码优化专家，请帮我优化以下代码。要求：\n1. 提高代码的性能和效率\n2. 改善代码的可读性和可维护性\n3. 确保代码符合最佳实践\n4. 指出潜在的问题和改进建议\n\n需要优化的代码：',
          description: '优化代码性能和质量',
          timestamp: new Date().toISOString()
        },
        {
          title: '学术论文润色',
          category: '学术助手',
          content: '你是一位经验丰富的学术论文编辑，请帮我润色以下学术文本。要求：\n1. 提高文章的学术性和专业性\n2. 确保语言表达准确和规范\n3. 改善文章的逻辑性和连贯性\n4. 保持学术写作的正式风格\n\n需要润色的内容：',
          description: '提升学术文章的质量和专业性',
          timestamp: new Date().toISOString()
        },
        {
          title: '营销文案创作',
          category: '文案创作',
          content: '作为一位专业的营销文案撰写人，请帮我创作以下主题的营销文案。要求：\n1. 突出产品/服务的核心价值\n2. 使用吸引人的表达方式\n3. 注重情感共鸣\n4. 包含明确的行动召唤\n\n主题：',
          description: '创作富有吸引力的营销文案',
          timestamp: new Date().toISOString()
        },
        {
          title: '代码注释生成',
          category: '代码助手',
          content: '请作为一位代码文档专家，为以下代码生成清晰的注释。要求：\n1. 解释代码的主要功能和目的\n2. 说明关键参数和返回值\n3. 标注重要的逻辑节点\n4. 使用专业且简洁的语言\n\n需要注释的代码：',
          description: '生成专业的代码注释',
          timestamp: new Date().toISOString()
        },
        {
          title: '技术文档生成',
          category: '文案创作',
          content: '作为技术文档专家，请帮我编写以下功能/产品的技术文档。要求：\n1. 结构清晰，层次分明\n2. 使用专业且易懂的语言\n3. 包含必要的示例和说明\n4. 考虑不同层次用户的需求\n\n主题：',
          description: '创建专业的技术文档',
          timestamp: new Date().toISOString()
        },
        {
          title: '会议纪要优化',
          category: '通用',
          content: '请作为专业的文档编辑，帮我优化以下会议纪要。要求：\n1. 提炼关键信息和决策\n2. 使表达更加简洁清晰\n3. 突出重要的行动项\n4. 改善整体的逻辑性\n\n会议纪要内容：',
          description: '优化会议纪要的质量和实用性',
          timestamp: new Date().toISOString()
        },
        {
          title: '数据分析报告',
          category: '通用',
          content: '作为数据分析专家，请帮我编写以下数据的分析报告。要求：\n1. 提供清晰的数据解读\n2. 发现关键趋势和模式\n3. 给出有价值的洞察\n4. 提供可行的建议\n\n数据内容：',
          description: '生成专业的数据分析报告',
          timestamp: new Date().toISOString()
        }
      ];

      // 合并现有模板和默认模板，避免重复
      const existingTitles = new Set(data.promptTemplates.map(t => t.title));
      const newTemplates = defaultTemplates.filter(t => !existingTitles.has(t.title));
      const mergedTemplates = [...data.promptTemplates, ...newTemplates];

      // 保存更新后的数据
      chrome.storage.local.set({
        promptTemplates: mergedTemplates,
        customCategories: mergedCategories,
        defaultPromptsInitialized: true
      }, function() {
        console.log('默认提示词初始化完成', {
          templatesCount: mergedTemplates.length,
          categories: mergedCategories
        });
        loadPromptList();  // 重新加载提示词列表
        loadCategories();  // 重新加载分类
      });
    });
  }

  // 初始化提示词管理功能
  function initPromptManagement() {
    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
      /* 基础按钮样式 */
      .btn-primary {
        background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: all 0.3s ease;
      }

      .btn-primary:hover {
        background: linear-gradient(135deg, #3a61c9 0%, #7a46cc 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }

      .btn-outline {
        background: white;
        color: #1a73e8;
        border: 1px solid #1a73e8;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-outline:hover {
        background: #f0f7ff;
      }

      .btn-delete {
        background: white;
        color: #dc3545;
        border: 1px solid #dc3545;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-delete:hover {
        background: #fff5f5;
      }

      /* 分类管理模态框样式 */
      #categoryModal {
        z-index: 1100;
      }

      .category-section {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
      }

      .category-section input[type="text"] {
        flex: 1;
        margin: 0;
      }

      .category-section button {
        white-space: nowrap;
        padding: 10px 16px;
        margin: 0;
      }

      /* 编辑按钮样式 */
      .btn-edit {
        background: white;
        color: #1a73e8;
        border: 1px solid #1a73e8;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-edit:hover {
        background: #f0f7ff;
      }

      /* 应用按钮样式 */
      .btn-apply {
        background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%);
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .btn-apply:hover {
        background: linear-gradient(135deg, #3a61c9 0%, #7a46cc 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #eee;
      }

      /* 模态框样式 */
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        animation: fadeIn 0.2s;
      }

      .category-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        margin-bottom: 8px;
      }

      .category-name {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .category-count {
        font-size: 12px;
        color: #666;
      }

      .category-actions {
        display: flex;
        gap: 8px;
      }

      .category-list {
        max-height: 300px;
        overflow-y: auto;
        padding: 4px;
      }

      .category-delete-confirm {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 12px;
        margin-top: 8px;
        display: none;
      }

      .category-delete-confirm.show {
        display: block;
      }

      .confirm-message {
        margin-bottom: 12px;
        color: #dc3545;
      }

      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      /* 调整新建分类部分的样式 */
      .category-manager {
        margin-top: 20px;
      }

      #newCategoryName {
        height: 38px; /* 确保输入框高度与按钮一致 */
      }

      #addCategoryBtn {
        height: 38px;
        min-width: 80px;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .modal-content {
        background: #fff;
        margin: 40px auto;
        padding: 24px;
        border-radius: 12px;
        max-width: 520px;  /* 调整最大宽度 */
        width: 90%;
        position: relative;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s;
      }

      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .modal-header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #eee;
      }

      .modal-header h2 {
        margin: 0;
        font-size: 20px;
        color: #333;
        font-weight: 600;
      }

      .close-modal {
        position: absolute;
        right: 24px;
        top: 24px;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        background: none;
        border: none;
        padding: 0;
        transition: color 0.2s;
      }

      .close-modal:hover {
        color: #333;
      }

      .form-group {
        margin-bottom: 20px;
      }

      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #333;
      }

      .form-group input[type="text"],
      .form-group textarea,
      .form-group select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      .form-group input[type="text"]:focus,
      .form-group textarea:focus,
      .form-group select:focus {
        border-color: #1a73e8;
        outline: none;
      }

      .form-group textarea {
        min-height: 120px;
        resize: vertical;
      }

      .form-group .description {
        font-size: 12px;
        color: #666;
        margin-top: 6px;
      }

      .prompt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 8px;
        width: 100%;
        box-sizing: border-box;
      }

      /* 提示消息样式 */
      .toast-message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
      }

      .toast-message.show {
        opacity: 1;
      }

      .toast-message.error {
        background: rgba(220, 53, 69, 0.9);
      }

      .toast-message.success {
        background: rgba(40, 167, 69, 0.9);
      }

      .prompt-title {
        margin: 0;
        font-size: 16px;  /* 增加标题字体大小 */
        font-weight: 500;
        color: #333;
      }

      .prompt-content {
        margin: 8px 0;
        font-size: 15px;  /* 增加内容字体大小 */
        color: #444;
        line-height: 1.5;
      }

      .prompt-description {
        font-size: 14px;  /* 增加描述字体大小 */
        color: #666;
        margin-top: 4px;
      }

      .prompt-category-title {
        font-size: 18px;  /* 增加分类标题字体大小 */
        color: #333;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .prompt-category-count {
        font-size: 14px;  /* 增加分类计数字体大小 */
        color: #666;
        font-weight: normal;
      }

      /* 导航标签样式调整 */
      .nav-tab {
        padding: 12px 20px;  /* 增加内边距 */
        font-size: 16px;     /* 增加字体大小 */
        font-weight: 500;    /* 稍微加粗 */
        color: #666;
        cursor: pointer;
        border: none;
        background: none;
        transition: all 0.2s;
        position: relative;
      }

      .nav-tab:hover {
        color: #1a73e8;
      }

      .nav-tab.active {
        color: #1a73e8;
        font-weight: 600;    /* 选中时更粗 */
      }

      .nav-tab.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20px;
        right: 20px;
        height: 2px;
        background: #1a73e8;
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);

    // 获取提示词标签页内容区域
    const promptsTab = document.getElementById('prompts');
    if (!promptsTab) return;

    // 清空现有内容
    promptsTab.innerHTML = '';

    // 创建提示词列表容器
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'prompts-container';
    promptsContainer.innerHTML = `
      <div class="prompts-header">
        <h2>提示词管理</h2>
        <button id="newPromptBtn" class="btn-primary">
          <span>✨</span> 新建提示词
        </button>
      </div>
      <div id="promptsList" class="prompts-list"></div>
    `;

    // 创建新建提示词模态框
    const newPromptModal = document.createElement('div');
    newPromptModal.className = 'modal';
    newPromptModal.id = 'newPromptModal';
    newPromptModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>新建提示词</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="promptTitle">提示词标题</label>
            <input type="text" id="promptTitle" placeholder="输入提示词标题">
          </div>
          <div class="form-group">
            <label for="promptCategory">分类</label>
            <div class="category-section">
              <select id="promptCategory">
                <option value="通用">通用</option>
              </select>
              <button id="categoryManageBtn" class="btn-outline">
                <span>📑</span> 管理分类
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="promptContent">提示词内容</label>
            <textarea id="promptContent" placeholder="输入提示词内容..."></textarea>
          </div>
          <div class="form-group">
            <label for="promptDescription">描述（可选）</label>
            <input type="text" id="promptDescription" placeholder="简短描述">
            <div class="description">添加描述有助于更好地理解提示词的用途</div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancelPrompt" class="btn-outline">取消</button>
          <button id="savePrompt" class="btn-primary">保存</button>
        </div>
      </div>
    `;

    // 创建分类管理模态框
    const categoryManagerModal = document.createElement('div');
    categoryManagerModal.className = 'modal';
    categoryManagerModal.id = 'categoryModal';
    categoryManagerModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>分类管理</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <div class="category-section">
              <input type="text" id="newCategoryName" placeholder="输入分类名称">
              <button id="addCategoryBtn" class="btn-primary">添加</button>
            </div>
          </div>
          <div class="category-manager">
            <div class="category-list" id="categoryList"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="closeCategoryModal" class="btn-outline">关闭</button>
        </div>
      </div>
    `;

    // 创建编辑提示词模态框
    const editPromptModal = document.createElement('div');
    editPromptModal.className = 'modal';
    editPromptModal.id = 'editPromptModal';
    editPromptModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>编辑提示词</h2>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="editPromptTitle">提示词标题</label>
            <input type="text" id="editPromptTitle" placeholder="输入提示词标题">
          </div>
          <div class="form-group">
            <label for="editPromptCategory">分类</label>
            <div class="category-section">
              <select id="editPromptCategory">
                <option value="通用">通用</option>
              </select>
              <button id="editCategoryManageBtn" class="btn-outline">
                <span>📑</span> 管理分类
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="editPromptContent">提示词内容</label>
            <textarea id="editPromptContent" placeholder="输入提示词内容..."></textarea>
          </div>
          <div class="form-group">
            <label for="editPromptDescription">描述（可选）</label>
            <input type="text" id="editPromptDescription" placeholder="简短描述">
            <div class="description">添加描述有助于更好地理解提示词的用途</div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="cancelEditPrompt" class="btn-outline">取消</button>
          <button id="saveEditPrompt" class="btn-primary">保存</button>
        </div>
      </div>
    `;

    // 将元素添加到DOM
    promptsTab.appendChild(promptsContainer);
    document.body.appendChild(newPromptModal);
    document.body.appendChild(categoryManagerModal);
    document.body.appendChild(editPromptModal);

    // 加载分类列表
    function loadCategoryList() {
      chrome.storage.local.get({ 
        promptTemplates: [],
        customCategories: ['通用']
      }, function(data) {
        const templates = data.promptTemplates;
        const customCategories = data.customCategories;
        const categoryList = document.getElementById('categoryList');
        
        // 统计每个分类的使用次数
        const categoryUsage = {};
        templates.forEach(t => {
          categoryUsage[t.category] = (categoryUsage[t.category] || 0) + 1;
        });

        categoryList.innerHTML = customCategories.map(category => `
          <div class="category-item">
            <div class="category-name">
              <span>${category}</span>
              <span class="category-count">${categoryUsage[category] || 0}个提示词</span>
            </div>
            ${category !== '通用' ? `
              <div class="category-actions">
                <button class="btn-delete" data-category="${category}">删除</button>
              </div>
            ` : ''}
          </div>
        `).join('');

        // 绑定删除按钮事件
        categoryList.querySelectorAll('.btn-delete').forEach(btn => {
          btn.addEventListener('click', function() {
            const category = this.dataset.category;
            const count = categoryUsage[category] || 0;
            confirmDeleteCategory(category, count);
          });
        });
      });
    }

    // 确认删除分类
    function confirmDeleteCategory(category, count) {
      const categoryItem = document.querySelector(`[data-category="${category}"]`).closest('.category-item');
      
      // 移除可能存在的其他确认框
      document.querySelectorAll('.category-delete-confirm').forEach(el => el.remove());

      const confirmDiv = document.createElement('div');
      confirmDiv.className = 'category-delete-confirm';
      confirmDiv.innerHTML = `
        <div class="confirm-message">
          ${count > 0 
            ? `确定要删除分类"${category}"吗？该分类下的${count}个提示词将被移动到"通用"分类。` 
            : `确定要删除分类"${category}"吗？`}
        </div>
        <div class="confirm-actions">
          <button class="btn-outline cancel-delete">取消</button>
          <button class="btn-primary confirm-delete">确定删除</button>
        </div>
      `;

      categoryItem.after(confirmDiv);
      
      // 显示确认框
      setTimeout(() => confirmDiv.classList.add('show'), 0);

      // 绑定按钮事件
      confirmDiv.querySelector('.cancel-delete').onclick = () => {
        confirmDiv.classList.remove('show');
        setTimeout(() => confirmDiv.remove(), 300);
      };

      confirmDiv.querySelector('.confirm-delete').onclick = () => {
        deleteCategory(category);
        confirmDiv.classList.remove('show');
        setTimeout(() => confirmDiv.remove(), 300);
      };
    }

    // 删除分类
    function deleteCategory(category) {
      chrome.storage.local.get({ 
        promptTemplates: [],
        customCategories: ['通用']
      }, function(data) {
        let templates = data.promptTemplates;
        let categories = data.customCategories;

        // 将该分类下的提示词移动到"通用"分类
        templates = templates.map(t => ({
          ...t,
          category: t.category === category ? '通用' : t.category
        }));

        // 从分类列表中删除
        categories = categories.filter(c => c !== category);

        // 保存更改
        chrome.storage.local.set({ 
          promptTemplates: templates,
          customCategories: categories
        }, function() {
          loadCategoryList();
          loadCategories();
          showToast(`分类"${category}"已删除`, 'success');
        });
      });
    }

    // 初始化默认提示词 - 移到这里，确保所有必要的函数都已定义
    initializeDefaultPrompts();

    // 绑定新建提示词按钮事件
    const newPromptBtn = document.getElementById('newPromptBtn');
    
    if (newPromptBtn) {
      newPromptBtn.addEventListener('click', function() {
        loadCategories();
        newPromptModal.style.display = 'block';
        document.getElementById('promptTitle').focus();
      });
    }

    // 绑定分类管理按钮事件
    const categoryManageBtn = document.getElementById('categoryManageBtn');
    
    if (categoryManageBtn) {
      categoryManageBtn.addEventListener('click', function() {
        categoryManagerModal.style.display = 'block';
        loadCategoryList();
      });
    }

    // 绑定添加分类按钮事件
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', function() {
        const input = document.getElementById('newCategoryName');
        const newCategory = input.value.trim();
        
        if (!newCategory) {
          showToast('请输入分类名称', 'error');
          return;
        }

        chrome.storage.local.get({ customCategories: ['通用'] }, function(data) {
          const categories = data.customCategories;
          
          if (categories.includes(newCategory)) {
            showToast(`分类"${newCategory}"已存在`, 'error');
            input.value = '';
            input.focus();
            return;
          }

          categories.push(newCategory);
          chrome.storage.local.set({ customCategories: categories }, function() {
            input.value = '';
            loadCategoryList();
            loadCategories();
            showToast('分类添加成功', 'success');
          });
        });
      });
    }

    // 绑定关闭按钮事件
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
      });
    });

    // 绑定取消按钮事件
    document.getElementById('cancelPrompt').addEventListener('click', function() {
      newPromptModal.style.display = 'none';
      clearPromptForm();
    });

    // 绑定关闭分类管理模态框事件
    document.getElementById('closeCategoryModal').addEventListener('click', function() {
      categoryManagerModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', function(event) {
      if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        if (event.target === newPromptModal) {
          clearPromptForm();
        }
      }
    });

    // 清空提示词表单
    function clearPromptForm() {
      document.getElementById('promptTitle').value = '';
      document.getElementById('promptContent').value = '';
      document.getElementById('promptDescription').value = '';
      document.getElementById('promptCategory').value = '通用';
    }

    // 绑定保存按钮事件
    const savePromptBtn = document.getElementById('savePrompt');
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', function() {
        const title = document.getElementById('promptTitle').value.trim();
        const category = document.getElementById('promptCategory').value;
        const content = document.getElementById('promptContent').value.trim();
        const description = document.getElementById('promptDescription').value.trim();

        if (!title || !content) {
          showToast('请填写标题和内容', 'error');
          return;
        }

        chrome.storage.local.get({ promptTemplates: [] }, function(data) {
          const templates = data.promptTemplates;
          
          if (templates.some(t => t.title === title)) {
            showToast('已存在同名提示词，请使用其他标题', 'error');
            return;
          }

          const newTemplate = {
            title,
            category,
            content,
            description,
            timestamp: new Date().toISOString()
          };

          templates.push(newTemplate);

          chrome.storage.local.set({ promptTemplates: templates }, function() {
            newPromptModal.style.display = 'none';
            loadPromptList();
            showToast('提示词保存成功', 'success');
            clearPromptForm();
          });
        });
      });
    }

    // 绑定编辑提示词相关的按钮事件
    const editCategoryManageBtn = document.getElementById('editCategoryManageBtn');
    if (editCategoryManageBtn) {
      editCategoryManageBtn.addEventListener('click', function() {
        categoryManagerModal.style.display = 'block';
        loadCategoryList();
      });
    }

    // 绑定取消编辑按钮事件
    document.getElementById('cancelEditPrompt').addEventListener('click', function() {
      editPromptModal.style.display = 'none';
    });

    // 绑定保存编辑按钮事件
    const saveEditPromptBtn = document.getElementById('saveEditPrompt');
    if (saveEditPromptBtn) {
      saveEditPromptBtn.addEventListener('click', function() {
        const title = document.getElementById('editPromptTitle').value.trim();
        const category = document.getElementById('editPromptCategory').value;
        const content = document.getElementById('editPromptContent').value.trim();
        const description = document.getElementById('editPromptDescription').value.trim();
        const originalTitle = editPromptModal.dataset.originalTitle;

        if (!title || !content) {
          showToast('请填写标题和内容', 'error');
          return;
        }

        chrome.storage.local.get({ promptTemplates: [] }, function(data) {
          let templates = data.promptTemplates;
          
          // 如果标题被修改了，检查新标题是否已存在
          if (title !== originalTitle && templates.some(t => t.title === title)) {
            showToast('已存在同名提示词，请使用其他标题', 'error');
            return;
          }

          // 更新模板
          templates = templates.map(t => {
            if (t.title === originalTitle) {
              return {
                ...t,
                title,
                category,
                content,
                description,
                timestamp: new Date().toISOString()
              };
            }
            return t;
          });

          chrome.storage.local.set({ promptTemplates: templates }, function() {
            editPromptModal.style.display = 'none';
            loadPromptList();
            showToast('提示词更新成功', 'success');
          });
        });
      });
    }

    // 初始加载
    loadPromptList();
    loadCategories();
  }

  // 初始化标签页切换功能
  function initializeTabs() {
    // 创建导航容器
    const navContainer = document.createElement('div');
    navContainer.className = 'nav-container';

    // 获取现有的导航栏
    const navTabs = document.querySelector('.nav-tabs');
    if (!navTabs) return;

    // 从原位置移除导航栏
    navTabs.parentNode.removeChild(navTabs);

    // 创建左右滚动按钮
    const scrollLeftBtn = document.createElement('button');
    scrollLeftBtn.className = 'scroll-button scroll-left';
    scrollLeftBtn.innerHTML = '&lt;';
    scrollLeftBtn.setAttribute('aria-label', '向左滚动');

    const scrollRightBtn = document.createElement('button');
    scrollRightBtn.className = 'scroll-button scroll-right';
    scrollRightBtn.innerHTML = '&gt;';
    scrollRightBtn.setAttribute('aria-label', '向右滚动');

    // 将所有元素添加到导航容器
    navContainer.appendChild(scrollLeftBtn);
    navContainer.appendChild(navTabs);
    navContainer.appendChild(scrollRightBtn);

    // 获取所有标签页内容
    const allTabContents = document.querySelectorAll('.tab-content');
    
    // 将导航容器插入到第一个标签页内容之前
    if (allTabContents.length > 0) {
      allTabContents[0].parentNode.insertBefore(navContainer, allTabContents[0]);
    }

    // 添加鼠标滑动功能
    let isMouseDown = false;
    let startX;
    let scrollLeft;

    navTabs.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      navTabs.style.cursor = 'grabbing';
      startX = e.pageX - navTabs.offsetLeft;
      scrollLeft = navTabs.scrollLeft;
    });

    navTabs.addEventListener('mouseleave', () => {
      isMouseDown = false;
      navTabs.style.cursor = 'grab';
    });

    navTabs.addEventListener('mouseup', () => {
      isMouseDown = false;
      navTabs.style.cursor = 'grab';
    });

    navTabs.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      e.preventDefault();
      const x = e.pageX - navTabs.offsetLeft;
      const walk = (x - startX) * 1.5; // 滚动速度系数
      navTabs.scrollLeft = scrollLeft - walk;
      updateScrollButtons();
    });

    // 初始化鼠标样式
    navTabs.style.cursor = 'grab';

    // 滚动处理函数
    function updateScrollButtons() {
      const scrollLeft = navTabs.scrollLeft;
      const maxScroll = navTabs.scrollWidth - navTabs.clientWidth;
      
      scrollLeftBtn.classList.toggle('disabled', scrollLeft <= 0);
      scrollRightBtn.classList.toggle('disabled', scrollLeft >= maxScroll);
    }

    // 点击滚动按钮处理
    scrollLeftBtn.addEventListener('click', () => {
      navTabs.scrollBy({ left: -200, behavior: 'smooth' });
    });

    scrollRightBtn.addEventListener('click', () => {
      navTabs.scrollBy({ left: 200, behavior: 'smooth' });
    });

    // 监听滚动事件
    navTabs.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);

    // 初始化按钮状态
    updateScrollButtons();

    // 标签切换逻辑
    const tabs = document.querySelectorAll('.nav-tab');

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        allTabContents.forEach(content => content.classList.remove('active'));
        
        this.classList.add('active');
        const tabId = this.getAttribute('data-tab');
        const content = document.getElementById(tabId);
        if (content) {
          content.classList.add('active');
        }
        
        // 保存当前激活的标签页ID
        chrome.storage.local.set({ lastActiveTab: tabId }, function() {
          console.log('已保存当前标签页:', tabId);
        });
      });
    });

    // 加载上次激活的标签页
    chrome.storage.local.get({ lastActiveTab: null }, function(data) {
      if (data.lastActiveTab) {
        // 查找对应的标签
        const lastTab = document.querySelector(`.nav-tab[data-tab="${data.lastActiveTab}"]`);
        if (lastTab) {
          // 激活上次的标签页
          lastTab.click();
          console.log('已加载上次打开的标签页:', data.lastActiveTab);
          return;
        }
      }
      
      // 如果没有上次的标签页记录或者找不到对应标签，则激活第一个标签页
      const firstTab = document.querySelector('.nav-tab');
      if (firstTab) {
        firstTab.click();
      }
    });

    // 初始化聊天功能
    initializeChat();
  }

  // 初始化聊天功能
  // 初始化编码解码功能
  function initializeCodec() {
    const codecType = document.getElementById('codecType');
    const codecInput = document.getElementById('codecInput');
    const codecOutput = document.getElementById('codecOutput');
    const encodeBtn = document.getElementById('encodeBtn');
    const decodeBtn = document.getElementById('decodeBtn');
    const copyCodecOutputBtn = document.getElementById('copyCodecOutputBtn');
    
    if (!codecType || !codecInput || !codecOutput || !encodeBtn || !decodeBtn) {
      console.error('编码解码组件未找到');
      return;
    }
    
    // 编码按钮点击事件
    encodeBtn.addEventListener('click', function() {
      const type = codecType.value;
      const input = codecInput.value;
      
      if (!input) {
        showToast('请输入需要编码的内容', 'error');
        return;
      }
      
      try {
        let result = '';
        
        switch (type) {
          case 'unicode':
            result = input.split('').map(char => {
              const code = char.charCodeAt(0);
              return '\\u' + ('0000' + code.toString(16)).slice(-4);
            }).join('');
            break;
            
          case 'utf8':
            // UTF-8编码，将字符转换为UTF-8字节序列的十六进制表示
            const encoder = new TextEncoder();
            const utf8Bytes = encoder.encode(input);
            result = Array.from(utf8Bytes).map(b => 
              '%' + b.toString(16).padStart(2, '0').toUpperCase()
            ).join('');
            break;
            
          case 'base64':
            result = btoa(unescape(encodeURIComponent(input)));
            break;
            
          case 'url':
            result = encodeURI(input);
            break;
            
          case 'uricomponent':
            result = encodeURIComponent(input);
            break;
            
          case 'htmlentity':
            result = input.replace(/[\u00A0-\u9999<>\&]/g, function(i) {
              return '&#' + i.charCodeAt(0) + ';';
            });
            break;
            
          case 'hex':
            result = Array.from(input).map(c => 
              c.charCodeAt(0).toString(16).padStart(2, '0')
            ).join('');
            break;
            
          case 'binary':
            result = Array.from(input).map(c => 
              c.charCodeAt(0).toString(2).padStart(8, '0')
            ).join(' ');
            break;
            
          case 'ascii':
            result = Array.from(input).map(c => c.charCodeAt(0)).join(' ');
            break;
            
          case 'timestamp':
            try {
              const date = new Date(input);
              if (isNaN(date.getTime())) {
                throw new Error('无效的日期格式');
              }
              result = Math.floor(date.getTime() / 1000).toString();
            } catch (e) {
              throw new Error('无效的日期格式');
            }
            break;
            

            
          case 'base32':
            // Base32编码
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
            const base32Bytes = new TextEncoder().encode(input);
            let bits = 0;
            let value = 0;
            let output = '';
            
            for (let i = 0; i < base32Bytes.length; i++) {
              value = (value << 8) | base32Bytes[i];
              bits += 8;
              while (bits >= 5) {
                output += alphabet[(value >>> (bits - 5)) & 31];
                bits -= 5;
              }
            }
            
            if (bits > 0) {
              output += alphabet[(value << (5 - bits)) & 31];
            }
            
            // 添加填充
            while (output.length % 8 !== 0) {
              output += '=';
            }
            
            result = output;
            break;
        }
        
        codecOutput.value = result;
      } catch (error) {
        showToast('编码失败: ' + error.message, 'error');
      }
    });
    
    // 解码按钮点击事件
    decodeBtn.addEventListener('click', function() {
      const type = codecType.value;
      const input = codecInput.value;
      
      if (!input) {
        showToast('请输入需要解码的内容', 'error');
        return;
      }
      
      try {
        let result = '';
        
        switch (type) {
          case 'unicode':
            result = input.replace(/\\u[\dA-F]{4}/gi, function(match) {
              return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
            });
            break;
            
          case 'utf8':
            // UTF-8解码，将%XX格式的十六进制字节序列转换回字符串
            try {
              // 处理%XX格式
              if (input.includes('%')) {
                const bytes = [];
                let i = 0;
                while (i < input.length) {
                  if (input[i] === '%') {
                    bytes.push(parseInt(input.substr(i + 1, 2), 16));
                    i += 3;
                  } else {
                    bytes.push(input.charCodeAt(i));
                    i++;
                  }
                }
                result = new TextDecoder().decode(new Uint8Array(bytes));
              } else {
                // 尝试直接解码十六进制字符串
                const bytes = [];
                for (let i = 0; i < input.length; i += 2) {
                  if (i + 1 < input.length) {
                    bytes.push(parseInt(input.substr(i, 2), 16));
                  }
                }
                result = new TextDecoder().decode(new Uint8Array(bytes));
              }
            } catch (e) {
              throw new Error('无效的UTF-8编码: ' + e.message);
            }
            break;
            
          case 'base64':
            try {
              result = decodeURIComponent(escape(atob(input)));
            } catch (e) {
              throw new Error('无效的Base64编码: ' + e.message);
            }
            break;
            
          case 'url':
            result = decodeURI(input);
            break;
            
          case 'uricomponent':
            result = decodeURIComponent(input);
            break;
            
          case 'htmlentity':
            const textarea = document.createElement('textarea');
            textarea.innerHTML = input;
            result = textarea.value;
            break;
            
          case 'hex':
            try {
              result = input.replace(/\s+/g, '') // 移除所有空白字符
                .match(/.{1,2}/g)
                .map(byte => String.fromCharCode(parseInt(byte, 16)))
                .join('');
            } catch (e) {
              throw new Error('无效的十六进制编码: ' + e.message);
            }
            break;
            
          case 'binary':
            try {
              result = input.split(/\s+/)
                .map(bin => String.fromCharCode(parseInt(bin, 2)))
                .join('');
            } catch (e) {
              throw new Error('无效的二进制编码: ' + e.message);
            }
            break;
            
          case 'ascii':
            try {
              result = input.split(/\s+/)
                .map(code => String.fromCharCode(parseInt(code, 10)))
                .join('');
            } catch (e) {
              throw new Error('无效的ASCII编码: ' + e.message);
            }
            break;
            
          case 'timestamp':
            const timestamp = parseInt(input, 10);
            if (isNaN(timestamp)) {
              throw new Error('无效的时间戳');
            }
            const date = new Date(timestamp * 1000);
            result = date.toLocaleString();
            break;
            

            
          case 'base32':
            // Base32解码
            try {
              const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
              let cleanInput = input.toUpperCase().replace(/=+$/, '');
              let bits = 0;
              let value = 0;
              let output = [];
              
              for (let i = 0; i < cleanInput.length; i++) {
                const char = cleanInput[i];
                const charValue = alphabet.indexOf(char);
                if (charValue === -1) {
                  throw new Error('无效的Base32字符: ' + char);
                }
                
                value = (value << 5) | charValue;
                bits += 5;
                
                if (bits >= 8) {
                  output.push((value >>> (bits - 8)) & 255);
                  bits -= 8;
                }
              }
              
              result = new TextDecoder().decode(new Uint8Array(output));
            } catch (e) {
              throw new Error('无效的Base32编码: ' + e.message);
            }
            break;
        }
        
        codecOutput.value = result;
      } catch (error) {
        showToast('解码失败: ' + error.message, 'error');
      }
    });
    
    // 复制结果按钮点击事件
    if (copyCodecOutputBtn) {
      copyCodecOutputBtn.addEventListener('click', function() {
        const output = codecOutput.value;
        if (!output) {
          showToast('没有可复制的内容', 'error');
          return;
        }
        
        navigator.clipboard.writeText(output).then(function() {
          showToast('已复制到剪贴板', 'success');
        }).catch(function(err) {
          showToast('复制失败: ' + err, 'error');
        });
      });
    }
  }

  function initializeChat() {
    const chatInput = document.querySelector('.chat-input');
    const sendButton = document.querySelector('.send-button');
    const chatMessages = document.querySelector('.chat-messages');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const contextLength = document.querySelector('.context-length');
    
    if (!chatInput || !sendButton || !chatMessages) {
      console.error('聊天组件未找到');
      return;
    }
    
    let messages = [];
    let currentChatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    let chatList = [];
    
    // 加载所有对话列表
    loadChatList();
    
    // 加载上一次的对话
    loadLastChat();
    
    // 发送消息函数
    function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;
      
      // 生成当前时间戳
      const currentTime = Date.now();
      
      // 确保消息中的换行符被正确处理
      const processedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // 添加用户消息到界面
      addMessage(processedText, 'user', false, currentTime);
      
      // 清空输入框
      chatInput.value = '';
      
      // 清除草稿
      saveDraft('');
      
      // 重置输入框高度
      chatInput.style.height = '44px';
      
      // 禁用发送按钮
      sendButton.disabled = true;
      
      // 显示AI正在输入的指示器
      showTypingIndicator();
      
      // 添加用户消息到消息列表
      messages.push({ 
        role: 'user', 
        content: processedText,
        timestamp: currentTime
      });
      
      // 保存当前对话
      saveCurrentChat();
      
      // 更新当前对话长度
      updateContextLength();
      
      // 调用AI搜索功能
      chrome.storage.local.get({
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        customModel: '',
        actualModel: 'gpt-3.5-turbo'
      }, function(items) {
        if (!items.apiKey) {
          hideTypingIndicator();
          const errorTime = Date.now();
          addMessage('请先在设置中配置API密钥', 'assistant', true, errorTime);
          sendButton.disabled = false;
          return;
        }
        
        // 构建消息列表 - 确保包含完整的对话历史
        const apiMessages = [...messages];
        
        // 添加系统消息，强调需要考虑上下文
        apiMessages.unshift({
          role: 'system',
          content: '你是一个有用的AI助手，提供准确、有帮助的回答。请根据完整的对话历史回答用户的问题，保持上下文连贯性。'
        });
        
        console.log('发送API请求，包含完整对话历史，消息数量:', apiMessages.length);
        
        // 发送API请求
        chrome.runtime.sendMessage({
          action: 'fetchAIResponse',
          apiUrl: items.apiUrl,
          apiKey: items.apiKey,
          data: {
            model: items.actualModel,
            messages: apiMessages,
            temperature: 0.7
          }
        }, response => {
          hideTypingIndicator();
          sendButton.disabled = false;
          
          if (response && response.success) {
            const content = response.data.choices && response.data.choices[0] && 
                           response.data.choices[0].message ? 
                           response.data.choices[0].message.content : '';
            
            if (content) {
              // 生成AI回复的时间戳
              const responseTime = Date.now();
              
              // 添加AI回复到界面
              addMessage(content, 'assistant', false, responseTime);
              
              // 添加AI回复到消息列表
              messages.push({ 
                role: 'assistant', 
                content: content,
                timestamp: responseTime
              });
              
              // 保存当前对话
              saveCurrentChat();
              
              // 更新当前对话长度
              updateContextLength();
              
              // 保存到历史记录
              saveToHistory(text, content);
            } else {
              const errorTime = Date.now();
              addMessage('API返回内容为空', 'assistant', true, errorTime);
            }
          } else {
            const errorTime = Date.now();
            const errorMsg = response && response.error ? response.error : '请求失败';
            addMessage(`错误: ${errorMsg}`, 'assistant', true, errorTime);
          }
        });
      });
    }
    
    // 加载对话列表
    function loadChatList() {
      chrome.storage.local.get({ chatList: [] }, function(data) {
        if (chrome.runtime.lastError) {
          console.error('加载对话列表失败:', chrome.runtime.lastError);
          showToast('加载对话列表失败', 'error');
          chatList = [];
        } else {
          chatList = data.chatList || [];
          console.log('已加载对话列表，共', chatList.length, '个对话');
        }
        
        // 如果页面中有对话列表容器，就更新UI
        updateChatListUI();
      });
    }
    
    // 更新对话列表UI
    function updateChatListUI() {
      // 获取下拉菜单
      const dropdown = document.querySelector('.chat-dropdown');
      
      let localDropdown = dropdown;
      if (!localDropdown) {
        // 查找历史对话按钮
        const historyBtn = document.querySelector('.history-chat-btn');
        
        // 如果找不到按钮，可能是旧版本的HTML
        if (!historyBtn) {
          console.error('找不到历史对话按钮');
          return;
        }
        
        // 创建下拉菜单容器
        localDropdown = document.createElement('div');
        localDropdown.className = 'chat-dropdown';
        localDropdown.style.display = 'none';
        
        // 添加按钮点击事件
        historyBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          
          // 每次点击历史对话按钮时重新加载对话列表
          loadChatList();
          
          localDropdown.style.display = localDropdown.style.display === 'none' ? 'block' : 'none';
          
          // 点击其他地方关闭下拉菜单
          if (localDropdown.style.display === 'block') {
            const closeDropdown = function() {
              localDropdown.style.display = 'none';
              document.removeEventListener('click', closeDropdown);
            };
            setTimeout(() => {
              document.addEventListener('click', closeDropdown);
            }, 0);
          }
        });
        
        // 添加到页面
        const container = document.querySelector('.chat-container');
        if (container) {
          container.appendChild(localDropdown);
        }
        
        // 添加下拉菜单样式
        const style = document.createElement('style');
        style.textContent = `
          .chat-history-btn {
            background: transparent;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 13px;
            color: #666;
            cursor: pointer;
            margin-left: 10px;
            transition: all 0.2s;
          }
          
          .chat-history-btn:hover {
            background: #f5f5f5;
          }
          
          .chat-dropdown {
            position: absolute;
            top: 55px;
            right: 15px;
            width: 250px;
            max-height: 300px;
            overflow-y: auto;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
          }
          
          .chat-dropdown-item {
            padding: 10px 15px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .chat-dropdown-item:hover {
            background: #f5f5f5;
          }
          
          .chat-dropdown-item.active {
            background: #e8f0fe;
            border-left: 3px solid #1a73e8;
          }
          
          .chat-item-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
          }
          
          .chat-item-date {
            font-size: 11px;
            color: #999;
            margin-left: 8px;
          }
          
          .chat-item-delete {
            padding: 2px 6px;
            background: transparent;
            color: #dc3545;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            margin-left: 8px;
            opacity: 0;
            transition: opacity 0.2s;
          }
          
          .chat-dropdown-item:hover .chat-item-delete {
            opacity: 1;
          }
          
          .chat-dropdown-empty {
            padding: 15px;
            text-align: center;
            color: #999;
            font-size: 13px;
          }
        `;
        document.head.appendChild(style);
      }
      
      // 更新下拉菜单内容
      if (!localDropdown) {
        console.error('找不到历史对话下拉菜单');
        return;
      }
      
      localDropdown.innerHTML = '';
      
      if (chatList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'chat-dropdown-empty';
        emptyMsg.textContent = '暂无历史对话';
        localDropdown.appendChild(emptyMsg);
        return;
      }
      
      // 对列表按最后更新时间排序（最新的在前）
      chatList.sort((a, b) => b.lastUpdated - a.lastUpdated);
      
      // 填充下拉菜单
      chatList.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-dropdown-item';
        if (chat.id === currentChatId) {
          item.classList.add('active');
        }
        
        // 获取对话标题（使用第一条用户消息，或第一条消息）
        let title = '新对话';
        if (chat.messages && chat.messages.length > 0) {
          const userMessage = chat.messages.find(m => m.role === 'user');
          if (userMessage) {
            title = userMessage.content;
          } else {
            title = chat.messages[0].content;
          }
          
          // 清理标题文本（移除多余空白和换行符）
          title = title.replace(/\s+/g, ' ').trim();
          
          // 截断长标题，保证不会溢出
          if (title.length > 35) {
            title = title.substring(0, 35) + '...';
          }
        }
        
        // 格式化日期，显示详细时间
        const chatDate = new Date(chat.lastUpdated);
        const today = new Date();
        
        // 重置时间部分，只比较日期
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(todayDate.getDate() - 1);
        const chatDateOnly = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate());
        
        let dateText = '';
        
        // 如果是今天，只显示时间
        if (chatDateOnly.getTime() === todayDate.getTime()) {
          dateText = '今天 ' + chatDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } 
        // 如果是昨天，显示"昨天"和时间
        else if (chatDateOnly.getTime() === yesterdayDate.getTime()) {
          dateText = '昨天 ' + chatDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } 
        // 如果是今年，显示月日和时间
        else if (chatDate.getFullYear() === today.getFullYear()) {
          dateText = (chatDate.getMonth() + 1) + '月' + chatDate.getDate() + '日 ' + 
                    chatDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } 
        // 其他情况显示完整日期时间
        else {
          dateText = chatDate.getFullYear() + '/' + (chatDate.getMonth() + 1) + '/' + chatDate.getDate() + ' ' + 
                    chatDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'chat-item-title';
        titleSpan.textContent = title;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'chat-item-date';
        dateSpan.textContent = dateText;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除此对话';
        
        // 点击对话项切换对话
        item.addEventListener('click', function(e) {
          if (e.target !== deleteBtn) {
            loadChat(chat.id);
            dropdown.style.display = 'none';
          }
        });
        
        // 点击删除按钮直接删除对话，不显示确认框
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteChat(chat.id);
        });
        
        item.appendChild(titleSpan);
        item.appendChild(dateSpan);
        item.appendChild(deleteBtn);
        localDropdown.appendChild(item);
      });
    }
    
    // 加载指定ID的对话
    function loadChat(chatId) {
      try {
        const chat = chatList.find(c => c.id === chatId);
        if (!chat) {
          console.error('未找到ID为', chatId, '的对话');
          showToast('未找到指定对话', 'error');
          return;
        }
        
        // 加载对话ID
        currentChatId = chat.id;
        
        // 加载消息 - 确保深拷贝，避免引用问题
        messages = JSON.parse(JSON.stringify(chat.messages));
        
        // 清空聊天区域
        chatMessages.innerHTML = '';
        
        // 显示所有消息
        messages.forEach(msg => {
          // 传递消息的时间戳，如果存在
          addMessage(msg.content, msg.role, false, msg.timestamp);
        });
        
        // 更新对话长度
        updateContextLength();
        
        // 保存为最近对话
        saveAsLastChat(chat);
        
        // 更新UI
        updateChatListUI();
        
        console.log('已加载ID为', chatId, '的对话，消息数量:', messages.length, '内容:', messages);
      } catch (e) {
        console.error('加载对话时出错:', e);
        showToast('加载对话时出错', 'error');
      }
    }
    
    // 删除指定ID的对话
    function deleteChat(chatId) {
      // 从列表中移除
      const index = chatList.findIndex(c => c.id === chatId);
      if (index !== -1) {
        chatList.splice(index, 1);
        
        // 保存更新后的列表
        chrome.storage.local.set({ chatList: chatList }, function() {
          if (chrome.runtime.lastError) {
            console.error('删除对话失败:', chrome.runtime.lastError);
            showToast('删除对话失败，请重试', 'error');
            return;
          }
          
          console.log('已删除ID为', chatId, '的对话');
          showToast('对话已删除', 'success');
          
          // 如果删除的是当前对话，创建新对话
          if (chatId === currentChatId) {
            startNewChat();
          } else {
            // 否则仅更新UI
            updateChatListUI();
          }
        });
      }
    }
    
    // 保存为最近对话
    function saveAsLastChat(chat) {
      chrome.storage.local.set({ lastChat: chat }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存最近对话失败:', chrome.runtime.lastError);
          return;
        }
        console.log('已将ID为', chat.id, '的对话保存为最近对话');
      });
    }
    
    // 开始新对话
    function startNewChat() {
      // 清空消息列表
      messages = [];
      chatMessages.innerHTML = '';
      chatInput.value = '';
      
      // 清除草稿
      saveDraft('');
      
      // 生成新的对话ID
      currentChatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      // 清除本地存储的lastChat
      chrome.storage.local.remove('lastChat', function() {
        console.log('已清除上次对话，开始新对话');
        
        // 重新加载对话列表，确保UI更新
        loadChatList();
      });
      
      // 更新当前对话长度
      updateContextLength();
    }
    
    // 加载上一次的对话
    function loadLastChat() {
      chrome.storage.local.get({ lastChat: null }, function(data) {
        if (chrome.runtime.lastError) {
          console.error('加载上次对话失败:', chrome.runtime.lastError);
          showToast('加载上次对话失败', 'error');
          return;
        }
        
        if (data.lastChat && data.lastChat.messages && data.lastChat.messages.length > 0) {
          try {
            // 加载对话ID
            currentChatId = data.lastChat.id || currentChatId;
            
            // 加载消息
            messages = data.lastChat.messages;
            
            // 清空聊天区域
            chatMessages.innerHTML = '';
            
            // 显示所有消息
            messages.forEach(msg => {
              // 传递消息的时间戳，如果存在
              addMessage(msg.content, msg.role, false, msg.timestamp);
            });
            
            // 更新对话长度
            updateContextLength();
            
            // 更新UI
            updateChatListUI();
            
            console.log('已加载上次对话，消息数量:', messages.length);
          } catch (e) {
            console.error('处理上次对话时出错:', e);
            showToast('加载对话时出错，已重置对话', 'error');
            startNewChat();
          }
        } else {
          console.log('没有找到上次的对话或对话为空');
        }
      });
    }
    
    // 保存当前对话
    function saveCurrentChat() {
      if (messages.length === 0) return;
      
      const chatData = {
        id: currentChatId,
        messages: messages,
        lastUpdated: Date.now()
      };
      
      // 保存为最近对话
      chrome.storage.local.set({ lastChat: chatData }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存最近对话失败:', chrome.runtime.lastError);
          showToast('保存对话失败，请重试', 'error');
          return;
        }
        console.log('当前对话已保存为最近对话，消息数量:', messages.length);
      });
      
      // 检查此对话是否已在列表中
      const index = chatList.findIndex(c => c.id === currentChatId);
      if (index !== -1) {
        // 更新现有对话
        chatList[index] = chatData;
      } else {
        // 添加新对话
        chatList.push(chatData);
      }
      
      // 限制对话数量
      limitChatListSize();
      
      // 保存对话列表
      chrome.storage.local.set({ chatList: chatList }, function() {
        if (chrome.runtime.lastError) {
          console.error('保存对话列表失败:', chrome.runtime.lastError);
          showToast('保存对话列表失败，请重试', 'error');
          return;
        }
        console.log('对话列表已更新，当前共', chatList.length, '个对话');
        
        // 更新UI
        updateChatListUI();
      });
    }
    
    // 限制对话列表大小
    function limitChatListSize() {
      // 获取设置中的最大对话数量，默认为20
      chrome.storage.local.get({ maxChatHistory: 20 }, function(data) {
        const maxChats = data.maxChatHistory;
        
        // 如果当前对话数量超过限制
        if (chatList.length > maxChats) {
          // 按最后更新时间排序
          chatList.sort((a, b) => b.lastUpdated - a.lastUpdated);
          
          // 保留最新的maxChats条对话
          chatList = chatList.slice(0, maxChats);
          
          console.log(`对话数量已超过限制(${maxChats})，已自动清理旧对话`);
        }
      });
    }
    
    // 添加消息到界面
    function addMessage(content, role, isError = false, timestamp = null) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${role}`;
      
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      
      if (isError) {
        messageContent.classList.add('error');
      }
      
      // 处理消息内容 - 如果是AI回复，尝试渲染Markdown
      if (role === 'assistant' && !isError && window.marked) {
        try {
          // 移除内容开头和结尾的多余换行符
          const trimmedContent = content.trim();
          // 解析Markdown
          let parsedHTML = window.marked.parse(trimmedContent);
          
          // 移除可能导致多余空白的HTML元素
          parsedHTML = parsedHTML.replace(/<p>\s*<\/p>/g, '');
          parsedHTML = parsedHTML.replace(/^\s*<p>/, '<p>');
          parsedHTML = parsedHTML.replace(/<\/p>\s*$/, '</p>');
          
          // 修复：处理Markdown渲染后的多余换行问题
          // 1. 移除段落之间可能存在的多余空行
          parsedHTML = parsedHTML.replace(/<\/p>\s*<p>/g, '</p><p>');
          // 2. 移除代码块和其他元素之间可能存在的多余空行
          parsedHTML = parsedHTML.replace(/<\/pre>\s*<p>/g, '</pre><p>');
          parsedHTML = parsedHTML.replace(/<\/p>\s*<pre>/g, '</p><pre>');
          // 3. 处理列表和段落之间的空行
          parsedHTML = parsedHTML.replace(/<\/ul>\s*<p>/g, '</ul><p>');
          parsedHTML = parsedHTML.replace(/<\/ol>\s*<p>/g, '</ol><p>');
          parsedHTML = parsedHTML.replace(/<\/p>\s*<ul>/g, '</p><ul>');
          parsedHTML = parsedHTML.replace(/<\/p>\s*<ol>/g, '</p><ol>');
          // 4. 处理表格和段落之间的空行
          parsedHTML = parsedHTML.replace(/<\/table>\s*<p>/g, '</table><p>');
          parsedHTML = parsedHTML.replace(/<\/p>\s*<table>/g, '</p><table>');
          // 5. 处理表格或代码块结尾处的多余换行
          parsedHTML = parsedHTML.replace(/<\/table>\s*$/, '</table>');
          parsedHTML = parsedHTML.replace(/<\/pre>\s*$/, '</pre>');
          
          messageContent.innerHTML = parsedHTML;
        } catch (e) {
          console.error('Markdown解析错误:', e);
          messageContent.textContent = content.trim();
        }
      } else {
        // 用户消息需要保留换行符
        messageContent.style.whiteSpace = 'pre-wrap';
        messageContent.textContent = content;
      }
      
      // 添加时间
      const messageTime = document.createElement('div');
      messageTime.className = 'message-time';
      
      // 使用传入的时间戳或当前时间
      const messageDate = timestamp ? new Date(timestamp) : new Date();
      const today = new Date();
      
      // 重置时间部分，只比较日期
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(todayDate.getDate() - 1);
      const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
      
      let displayTime = '';
      
      // 如果是今天，只显示时间
      if (messageDateOnly.getTime() === todayDate.getTime()) {
        displayTime = '今天 ' + messageDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } 
      // 如果是昨天，显示"昨天"和时间
      else if (messageDateOnly.getTime() === yesterdayDate.getTime()) {
        displayTime = '昨天 ' + messageDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } 
      // 如果是今年，显示月日和时间
      else if (messageDate.getFullYear() === today.getFullYear()) {
        displayTime = (messageDate.getMonth() + 1) + '月' + messageDate.getDate() + '日 ' + 
                  messageDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } 
      // 其他情况显示完整日期时间
      else {
        displayTime = messageDate.getFullYear() + '/' + (messageDate.getMonth() + 1) + '/' + messageDate.getDate() + ' ' + 
                  messageDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      
      messageTime.textContent = displayTime;
      
      messageDiv.appendChild(messageContent);
      messageDiv.appendChild(messageTime);
      chatMessages.appendChild(messageDiv);
      
      // 滚动到最新消息
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 显示AI正在输入的指示器
    function showTypingIndicator() {
      const indicator = document.createElement('div');
      indicator.className = 'typing-indicator';
      
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
      }
      
      indicator.id = 'typingIndicator';
      chatMessages.appendChild(indicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 隐藏AI正在输入的指示器
    function hideTypingIndicator() {
      const indicator = document.getElementById('typingIndicator');
      if (indicator) {
        indicator.remove();
      }
    }
    
    // 更新当前对话长度
    function updateContextLength() {
      if (contextLength) {
        contextLength.textContent = `当前对话长度：${messages.length}`;
      }
    }
    
    // 保存到历史记录
    function saveToHistory(query, response) {
      chrome.storage.local.get({ saveHistory: true }, function(data) {
        if (data.saveHistory) {
          chrome.runtime.sendMessage({
            action: 'saveSearchHistory',
            data: {
              id: currentChatId,
              query: query,
              response: response,
              timestamp: Date.now(),
              type: 'chat',
              rating: 0
            }
          });
        }
      });
    }
    
    // 发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);
    
    // 输入框回车发送
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // 输入框自动调整高度
    chatInput.addEventListener('input', function() {
      // 重置高度以获取正确的scrollHeight
      this.style.height = '44px';
      
      // 设置新高度，但不超过最大高度
      const newHeight = Math.min(this.scrollHeight, 120);
      this.style.height = newHeight + 'px';
      
      // 启用/禁用发送按钮
      sendButton.disabled = !this.value.trim();
      
      // 保存输入框草稿
      saveDraft(this.value);
    });
    
    // 新对话按钮
    if (newChatBtn) {
      newChatBtn.addEventListener('click', startNewChat);
    }
    
    // 初始禁用发送按钮
    sendButton.disabled = true;
    
    // 加载输入框草稿
    loadDraft();
    
    // 保存输入框草稿
    function saveDraft(text) {
      chrome.storage.local.set({ chatInputDraft: text }, function() {
        console.log('输入框草稿已保存');
      });
    }
    
    // 加载输入框草稿
    function loadDraft() {
      chrome.storage.local.get({ chatInputDraft: '' }, function(data) {
        if (data.chatInputDraft) {
          chatInput.value = data.chatInputDraft;
          // 调整高度
          const newHeight = Math.min(chatInput.scrollHeight, 120);
          chatInput.style.height = newHeight + 'px';
          // 启用/禁用发送按钮
          sendButton.disabled = !chatInput.value.trim();
        }
      });
    }
  }

  // ====== 导航栏遮罩控制 ======
  const navTabsMask = document.querySelector('.nav-tabs');
  const rightMask = document.getElementById('rightMask');
  const leftMask = document.getElementById('leftMask');

  function updateNavMask() {
    if (!navTabsMask || !rightMask || !leftMask) return;
    const scrollLeft = navTabsMask.scrollLeft;
    const maxScroll = navTabsMask.scrollWidth - navTabsMask.clientWidth;
    // 右侧遮罩：只要右边还有内容就显示
    if (scrollLeft < maxScroll) {
      rightMask.style.opacity = 1;
      rightMask.style.display = 'block';
    } else {
      rightMask.style.opacity = 0;
      setTimeout(() => rightMask.style.display = 'none', 300);
    }
    // 左侧遮罩：只要左边还有内容就显示
    if (scrollLeft > 0) {
      leftMask.style.opacity = 1;
      leftMask.style.display = 'block';
    } else {
      leftMask.style.opacity = 0;
      setTimeout(() => leftMask.style.display = 'none', 300);
    }
  }

  function tryUpdateNavMask(retry = 5) {
    updateNavMask();
    if (retry > 0) {
      setTimeout(() => tryUpdateNavMask(retry - 1), 100);
    }
  }

  // 初始化代理设置
  function initializeProxy() {
    const proxyEnabled = document.getElementById('proxyEnabled');
    const proxyMode = document.getElementById('proxyMode');
    const pacScriptUrl = document.getElementById('pacScriptUrl');
    const proxyScheme = document.getElementById('proxyScheme');
    const proxyHost = document.getElementById('proxyHost');
    const proxyPort = document.getElementById('proxyPort');
    const proxyAuthRequired = document.getElementById('proxyAuthRequired');
    const proxyUsername = document.getElementById('proxyUsername');
    const proxyPassword = document.getElementById('proxyPassword');
    const toggleProxyPassword = document.getElementById('toggleProxyPassword');
    const bypassList = document.getElementById('bypassList');
    const saveProxyBtn = document.getElementById('saveProxyBtn');
    const testProxyBtn = document.getElementById('testProxyBtn');
    const helpProxyBtn = document.getElementById('helpProxyBtn');
    const proxyStatus = document.getElementById('proxyStatus');
    const pacScriptSettings = document.getElementById('pacScriptSettings');
    const fixedServersSettings = document.getElementById('fixedServersSettings');
    const proxyAuthSettings = document.getElementById('proxyAuthSettings');
    const proxyConfigList = document.getElementById('proxyConfigList');
    const loadProxyConfigBtn = document.getElementById('loadProxyConfigBtn');
    const deleteProxyConfigBtn = document.getElementById('deleteProxyConfigBtn');
    const saveProxyConfigBtn = document.getElementById('saveProxyConfigBtn');
    const proxyConfigName = document.getElementById('proxyConfigName');

    // 移除"始终可编辑"和"需要启用代理"标签
    document.querySelectorAll('.badge, .always-editable').forEach(badge => {
      badge.remove();
    });

    // 加载保存的代理设置
    loadProxySettings();
    
    // 加载保存的代理配置列表
    loadProxyConfigList();
    
    // 检查当前代理状态
    checkProxyStatus();

    // 根据代理模式显示对应的设置面板
    proxyMode.addEventListener('change', function() {
      showProxySettings(this.value);
    });

    // 代理认证设置显示/隐藏
    proxyAuthRequired.addEventListener('change', function() {
      proxyAuthSettings.style.display = this.checked ? 'block' : 'none';
      
      // 当认证被勾选/取消时，更新相应字段的禁用状态
      const isEnabled = proxyEnabled.checked;
      if (proxyUsername && proxyPassword) {
        proxyUsername.disabled = !(isEnabled && this.checked);
        proxyPassword.disabled = !(isEnabled && this.checked);
        if (toggleProxyPassword) {
          toggleProxyPassword.disabled = !(isEnabled && this.checked);
        }
      }
    });

    // 代理密码显示/隐藏
    if (toggleProxyPassword) {
      toggleProxyPassword.addEventListener('click', function() {
        if (proxyPassword.type === 'password') {
          proxyPassword.type = 'text';
          this.textContent = '隐藏';
        } else {
          proxyPassword.type = 'password';
          this.textContent = '显示';
        }
      });
    }

      // 代理启用/禁用状态变化
  proxyEnabled.addEventListener('change', function() {
    const enabled = this.checked;
    
    // 在固定服务器模式下，所有配置始终可编辑
    // 不再禁用任何字段
    
    // 禁用/启用认证字段 - 认证复选框始终可编辑
    if (proxyAuthRequired) {
      // 认证复选框始终可编辑
      proxyAuthRequired.disabled = false;
      
      // 用户名和密码字段始终可编辑
      if (proxyUsername && proxyPassword) {
        proxyUsername.disabled = false;
        proxyPassword.disabled = false;
        if (toggleProxyPassword) {
          toggleProxyPassword.disabled = false;
        }
      }
    }
    
    // 如果禁用代理，更新状态信息
    if (!enabled) {
      proxyStatus.textContent = '当前状态: 直接连接（无代理）';
      proxyStatus.style.color = '#666';
      proxyStatus.style.display = 'block';
      
      // 15秒后隐藏状态信息
      setTimeout(function() {
        proxyStatus.style.display = 'none';
      }, 15000); // 统一设置为15秒
    } else {
      // 如果启用代理，清除状态显示
      proxyStatus.style.display = 'none';
    }
  });

    // 保存代理设置
    saveProxyBtn.addEventListener('click', function() {
      saveProxySettings();
    });

    // 测试代理连接
    testProxyBtn.addEventListener('click', function() {
      testProxyConnection();
    });
    
    // 帮助按钮
    if (helpProxyBtn) {
      helpProxyBtn.addEventListener('click', function() {
        showProxyHelp();
      });
    }

    // 加载选中的代理配置
    loadProxyConfigBtn.addEventListener('click', function() {
      const configName = proxyConfigList.value;
      if (!configName) {
        showToast('请选择一个配置', 'error');
        return;
      }
      loadProxyConfig(configName);
    });

    // 删除选中的代理配置
    deleteProxyConfigBtn.addEventListener('click', function() {
      const configName = proxyConfigList.value;
      if (!configName) {
        showToast('请选择一个配置', 'error');
        return;
      }
      deleteProxyConfig(configName);
    });

    // 保存当前代理设置为新配置
    saveProxyConfigBtn.addEventListener('click', function() {
      const configName = proxyConfigName.value.trim();
      if (!configName) {
        showToast('请输入配置名称', 'error');
        return;
      }
      saveCurrentAsProxyConfig(configName);
    });
    
      // 在固定服务器模式下，所有配置始终可编辑
  
  // 特殊处理认证相关字段 - 认证复选框始终可编辑
  if (proxyAuthRequired) {
    // 认证复选框始终可编辑
    proxyAuthRequired.disabled = false;
    
    // 用户名和密码字段始终可编辑
    if (proxyUsername && proxyPassword) {
      proxyUsername.disabled = false;
      proxyPassword.disabled = false;
      if (toggleProxyPassword) {
        toggleProxyPassword.disabled = false;
      }
    }
    
    // 显示/隐藏认证设置
    proxyAuthSettings.style.display = proxyAuthRequired.checked ? 'block' : 'none';
  }
  }
  
  // 显示代理帮助信息
  function showProxyHelp() {
    // 创建模态框
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '1000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    
    // 创建内容容器
    const content = document.createElement('div');
    content.style.backgroundColor = 'white';
    content.style.padding = '20px';
    content.style.borderRadius = '8px';
    content.style.width = '90%';
    content.style.maxWidth = '500px';
    content.style.maxHeight = '80vh';
    content.style.overflow = 'auto';
    content.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // 添加帮助内容
    content.innerHTML = `
      <h2 style="margin-top: 0; color: #1a73e8;">代理设置帮助</h2>
      
      <h3>基本配置流程</h3>
      <ol style="padding-left: 20px; line-height: 1.5;">
        <li>输入代理服务器地址和端口（这些字段始终可编辑）</li>
        <li>选择合适的代理协议（HTTP、HTTPS、SOCKS4或SOCKS5）</li>
        <li>如果需要认证，勾选"需要认证"并填写用户名和密码</li>
        <li>勾选"启用代理"选项</li>
        <li>点击"保存设置"按钮应用配置</li>
        <li>点击"测试连接"验证代理是否正常工作</li>
      </ol>
      
      <h3>代理模式解释</h3>
      <p>本扩展支持以下代理模式：</p>
      <ul style="padding-left: 20px; line-height: 1.5;">
        <li><b>直接连接</b> - 不使用任何代理，直接连接到目标服务器</li>
        <li><b>自动检测</b> - 尝试自动检测网络的代理设置</li>
        <li><b>PAC脚本</b> - 使用PAC(代理自动配置)脚本动态确定使用哪个代理</li>
        <li><b>固定服务器</b> - 使用手动配置的固定代理服务器</li>
        <li><b>系统代理</b> - 使用操作系统配置的代理设置</li>
      </ul>
      
      <h3>实现原理</h3>
      <p>本扩展的代理功能基于Chrome扩展API实现：</p>
      <ul style="padding-left: 20px; line-height: 1.5;">
        <li>使用<code>chrome.proxy</code>API管理浏览器的代理设置</li>
        <li>代理配置应用于所有由扩展发起的网络请求</li>
        <li>支持HTTP/HTTPS代理和SOCKS4/5代理</li>
        <li>可以设置特定网址的绕过规则，避免某些网站通过代理访问</li>
        <li>配置保存在扩展的本地存储中，可以在不同会话间保持</li>
      </ul>
      
      <h3>禁用代理时编辑设置</h3>
      <p>为了方便配置，即使在代理禁用状态下，您也可以编辑以下字段：</p>
      <ul style="padding-left: 20px; line-height: 1.5;">
        <li><b>代理模式</b> - 选择代理工作方式</li>
        <li><b>代理协议</b> - 选择HTTP、HTTPS或SOCKS协议</li>
        <li><b>代理服务器</b> - 输入服务器地址</li>
        <li><b>端口</b> - 输入端口号</li>
      </ul>
      <p>其他字段（如PAC脚本URL、认证字段、绕过列表等）需要先启用代理才能编辑。</p>
      
      <h3>常见问题</h3>
      <p><b>问题：设置了代理但不生效</b></p>
      <p>可能原因：</p>
      <ul style="padding-left: 20px; line-height: 1.5;">
        <li>代理服务器未正常运行或不可访问</li>
        <li>代理设置未正确保存（请确保点击"保存设置"按钮）</li>
        <li>代理认证信息不正确</li>
        <li>Chrome的代理权限受限</li>
        <li>忘记勾选"启用代理"选项</li>
      </ul>
      
      <h3>HTTP/HTTPS代理认证说明</h3>
      <p>Chrome扩展的代理API对HTTP/HTTPS代理的认证支持有限：</p>
      <ul style="padding-left: 20px; line-height: 1.5;">
        <li>当访问需要代理认证的网站时，Chrome会弹出认证对话框</li>
        <li>您需要在弹出窗口中手动输入用户名和密码</li>
        <li>这是Chrome的安全限制，无法通过扩展自动处理</li>
      </ul>
      
      <h3>SOCKS代理说明</h3>
      <p>SOCKS4/5代理支持在扩展中直接设置认证信息，通常不需要额外的认证步骤。</p>
      
      <h3>测试连接说明</h3>
      <p>点击"测试连接"会显示您当前的IP地址。如果显示的IP与您的代理服务器IP一致，说明代理设置成功。即使在代理未启用时，您也可以测试连接以查看当前的IP地址。</p>
      
      <div style="text-align: center; margin-top: 20px;">
        <button id="closeHelpBtn" style="padding: 8px 16px; background-color: #1a73e8; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
      </div>
    `;
    
    // 添加内容到模态框
    modal.appendChild(content);
    
    // 添加模态框到页面
    document.body.appendChild(modal);
    
    // 添加关闭按钮事件
    document.getElementById('closeHelpBtn').addEventListener('click', function() {
      document.body.removeChild(modal);
    });
    
    // 点击模态框背景关闭
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // 检查当前代理状态
  function checkProxyStatus() {
    chrome.proxy.settings.get({}, function(details) {
      const proxyStatus = document.getElementById('proxyStatus');
      if (!proxyStatus) return;
      
      let statusText = '';
      let statusColor = '';
      
      // 确认代理状态
      if (details && details.value) {
        const proxyConfig = details.value;
        
        if (proxyConfig.mode === 'direct') {
          statusText = '✓ 正在使用直接连接（无代理）';
          statusColor = '#666';
        } else if (proxyConfig.mode === 'auto_detect') {
          statusText = '✓ 当前状态: 自动检测代理';
          statusColor = '#1a73e8';
        } else if (proxyConfig.mode === 'pac_script') {
          statusText = '✓ 当前状态: 使用PAC脚本';
          statusColor = '#1a73e8';
        } else if (proxyConfig.mode === 'fixed_servers') {
          const proxy = proxyConfig.rules && proxyConfig.rules.singleProxy;
          if (proxy) {
            statusText = `✓ 当前状态: 使用${proxy.scheme}代理 ${proxy.host}:${proxy.port}`;
            statusColor = '#34a853';
          } else {
            statusText = '✓ 当前状态: 使用固定代理服务器';
            statusColor = '#1a73e8';
          }
        } else if (proxyConfig.mode === 'system') {
          statusText = '✓ 当前状态: 使用系统代理设置';
          statusColor = '#1a73e8';
        }
      } else {
        statusText = '✗ 未能获取当前代理状态';
        statusColor = '#ea4335';
      }
      
      // 显示状态
      proxyStatus.textContent = statusText;
      proxyStatus.style.color = statusColor;
      proxyStatus.style.display = 'block';
      
      // 不自动隐藏状态信息，让测试连接函数自己控制显示
      // 这样避免与测试连接功能产生冲突
    });
  }

  // 显示对应代理模式的设置面板
  function showProxySettings(mode) {
    const pacScriptSettings = document.getElementById('pacScriptSettings');
    const fixedServersSettings = document.getElementById('fixedServersSettings');

    // 隐藏所有设置面板
    pacScriptSettings.style.display = 'none';
    fixedServersSettings.style.display = 'none';

    // 根据选择的模式显示对应的设置面板
    switch (mode) {
      case 'pac_script':
        pacScriptSettings.style.display = 'block';
        break;
      case 'fixed_servers':
        fixedServersSettings.style.display = 'block';
        break;
    }
  }

  // 加载保存的代理设置
  function loadProxySettings() {
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
      document.getElementById('proxyEnabled').checked = data.proxyEnabled;
      document.getElementById('proxyMode').value = data.proxyMode;
      document.getElementById('pacScriptUrl').value = data.pacScriptUrl;
      document.getElementById('proxyScheme').value = data.proxyScheme;
      document.getElementById('proxyHost').value = data.proxyHost;
      document.getElementById('proxyPort').value = data.proxyPort;
      document.getElementById('proxyAuthRequired').checked = data.proxyAuthRequired;
      document.getElementById('proxyUsername').value = data.proxyUsername;
      document.getElementById('proxyPassword').value = data.proxyPassword;
      document.getElementById('bypassList').value = data.bypassList;

      // 显示对应的设置面板
      showProxySettings(data.proxyMode);
      
      // 显示/隐藏认证设置
      document.getElementById('proxyAuthSettings').style.display = 
        data.proxyAuthRequired ? 'block' : 'none';
    });
  }

  // 保存代理设置
  function saveProxySettings() {
    const proxyEnabled = document.getElementById('proxyEnabled').checked;
    const proxyMode = document.getElementById('proxyMode').value;
    const pacScriptUrl = document.getElementById('pacScriptUrl').value.trim();
    const proxyScheme = document.getElementById('proxyScheme').value;
    const proxyHost = document.getElementById('proxyHost').value.trim();
    const proxyPort = parseInt(document.getElementById('proxyPort').value, 10) || 8080;
    const proxyAuthRequired = document.getElementById('proxyAuthRequired').checked;
    const proxyUsername = document.getElementById('proxyUsername').value.trim();
    const proxyPassword = document.getElementById('proxyPassword').value;
    const bypassList = document.getElementById('bypassList').value.trim();

    // 检查必要的输入项（只在代理启用时检查）
    if (proxyEnabled) {
      if (proxyMode === 'pac_script' && !pacScriptUrl) {
        showToast('请输入PAC脚本URL', 'error');
        return;
      }
      
      if (proxyMode === 'fixed_servers' && !proxyHost) {
        showToast('请输入代理服务器地址', 'error');
        return;
      }
    }

    // 保存设置到本地存储
    const settings = {
      proxyEnabled,
      proxyMode,
      pacScriptUrl,
      proxyScheme,
      proxyHost,
      proxyPort,
      proxyAuthRequired,
      proxyUsername,
      proxyPassword,
      bypassList
    };

    chrome.storage.local.set(settings, function() {
      // 应用代理设置
      applyProxySettings(settings);
      
      // 检查是否有正在进行的测试连接
      // 如果正在测试连接（proxyStatusTimer存在），则不显示保存成功消息
      // 这样避免干扰测试连接的状态显示
      if (!window.proxyStatusTimer) {
        // 显示成功消息
        const proxyStatus = document.getElementById('proxyStatus');
        if (proxyStatus) {
          proxyStatus.textContent = '✓ 代理设置已保存并应用!';
          proxyStatus.style.display = 'block';
          proxyStatus.style.color = '#34a853';
          
          // 15秒后隐藏消息
          setTimeout(function() {
            proxyStatus.style.display = 'none';
          }, 15000); // 统一设置为15秒
        }
      } else {
        // 如果正在测试连接，只显示Toast消息
        showToast('代理设置已保存并应用!', 'success', 3000);
      }
    });
  }

  // 应用代理设置
  function applyProxySettings(settings) {
    // 如果未启用代理，设置为直接连接
    if (!settings.proxyEnabled) {
      chrome.proxy.settings.set({
        value: { mode: 'direct' },
        scope: 'regular'
      }, function() {
        if (chrome.runtime.lastError) {
          console.error('禁用代理失败:', chrome.runtime.lastError);
          showToast('禁用代理失败:' + chrome.runtime.lastError.message, 'error');
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
          // 构建代理服务器配置
          const singleProxy = {
            scheme: settings.proxyScheme,
            host: settings.proxyHost,
            port: parseInt(settings.proxyPort, 10)
          };
          
          // HTTP认证不能直接在代理配置中设置，需要通过webRequest API
          // 这里只设置SOCKS认证
          if (settings.proxyAuthRequired && 
              (settings.proxyScheme === 'socks4' || settings.proxyScheme === 'socks5')) {
            if (settings.proxyUsername) {
              singleProxy.username = settings.proxyUsername;
            }
            if (settings.proxyPassword) {
              singleProxy.password = settings.proxyPassword;
            }
          }
          
          // 处理绕过列表
          const bypassList = settings.bypassList
            .split(/[,\n]/)
            .map(item => item.trim())
            .filter(item => item);
          
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
          showToast('代理设置应用失败:' + chrome.runtime.lastError.message, 'error');
        } else {
          console.log('代理设置已应用:', config);
          
          // 如果是HTTP/HTTPS代理且需要认证，设置提醒
          if (settings.proxyEnabled && settings.proxyAuthRequired && 
              (settings.proxyScheme === 'http' || settings.proxyScheme === 'https')) {
            showToast('注意: HTTP/HTTPS代理的认证凭据可能需要在浏览器认证提示中手动输入', 'info', 8000);
          }
          
          // 使用timeout确保状态更新
          // 只有在没有正在进行的测试连接时才更新状态
          if (!window.proxyStatusTimer) {
            setTimeout(function() {
              checkProxyStatus();
            }, 500);
          }
        }
      });
    } catch (error) {
      console.error('设置代理时发生错误:', error);
      showToast('设置代理时发生错误:' + error.message, 'error');
    }
  }

  // 测试代理连接
  function testProxyConnection() {
    // 获取状态显示元素
    const proxyStatus = document.getElementById('proxyStatus');
    if (!proxyStatus) return;
    
    // 清除可能存在的任何定时器
    if (window.proxyStatusTimer) {
      clearTimeout(window.proxyStatusTimer);
      window.proxyStatusTimer = null;
    }
    
    // 显示初始测试状态
    proxyStatus.textContent = '正在测试连接...';
    proxyStatus.style.display = 'block';
    proxyStatus.style.color = '#1a73e8';
    
    // 检查代理配置
    const proxyEnabled = document.getElementById('proxyEnabled').checked;
    const proxyHost = document.getElementById('proxyHost').value.trim();
    const proxyPort = document.getElementById('proxyPort').value.trim();
    
    // 如果配置了代理服务器但未启用，提供友好提示
    if (!proxyEnabled && (proxyHost || proxyPort)) {
      proxyStatus.innerHTML = `
        ⚠️ 您已配置代理 ${proxyHost}:${proxyPort} 但尚未启用<br>
        <span style="font-size: 13px; color: #666;">
          请勾选"启用代理"并点击"保存设置"后再测试
        </span>
      `;
      proxyStatus.style.color = '#f4b400';  // 警告黄色
      
      // 使用全局变量存储定时器ID，以便后续可以清除
      window.proxyStatusTimer = setTimeout(function() {
        proxyStatus.style.display = 'none';
        window.proxyStatusTimer = null;
      }, 15000); // 统一设置为15秒
      return;
    }
    
    // 先检查当前代理状态
    chrome.proxy.settings.get({}, function(details) {
      try {
        // 如果当前是直接连接模式，并且代理未启用
        if (!proxyEnabled || (details && details.value && details.value.mode === 'direct')) {
          // 如果代理未启用，提示用户
          if (!proxyEnabled) {
            proxyStatus.innerHTML = '⚠️ 当前代理未启用，测试将使用直接连接';
            proxyStatus.style.color = '#f4b400';  // 警告黄色
          } else {
            proxyStatus.innerHTML = '✓ 正在使用直接连接（无代理）';
            proxyStatus.style.color = '#666';
          }
        }
        
        // 无论如何都进行连接测试，这样用户可以看到自己的实际IP
        setTimeout(() => {
          try {
            // 添加测试中的提示
            if (proxyEnabled) {
              proxyStatus.innerHTML += '<br>正在通过代理连接测试服务器...';
            } else {
              proxyStatus.innerHTML += '<br>正在直接连接测试服务器...';
            }
            
            // 设置超时时间
            const TIMEOUT_MS = 20000; // 20秒超时
            
            // 创建一个超时Promise
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('请求超时，请检查网络连接或代理设置')), TIMEOUT_MS);
            });
            
            // 创建IP检测请求
            const fetchHttpbin = fetch('https://www.httpbin.org/ip', {
              method: 'GET', 
              cache: 'no-store',
              mode: 'cors'
            })
            .then(response => {
              if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
              return response.json();
            });
            
            const fetchIpify = fetch('https://api.ipify.org?format=json', {
              method: 'GET', 
              cache: 'no-store',
              mode: 'cors'
            })
            .then(response => {
              if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
              return response.json();
            });
            
            // 添加额外的备用IP检测服务
            const fetchIpinfo = fetch('https://ipinfo.io/json', {
              method: 'GET',
              cache: 'no-store',
              mode: 'cors'
            })
            .then(response => {
              if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
              return response.json();
            });
            
                          // 创建多个检查连通性的请求，使用多个常用网站提高可靠性
              const connectivityChecks = [
                // Google favicon
                fetch('https://www.google.com/favicon.ico', {
                  method: 'HEAD',
                  cache: 'no-store',
                  mode: 'no-cors'
                }).then(() => true).catch(() => false),
                
                // Microsoft favicon
                fetch('https://www.microsoft.com/favicon.ico', {
                  method: 'HEAD',
                  cache: 'no-store',
                  mode: 'no-cors'
                }).then(() => true).catch(() => false),
                
                // Cloudflare
                fetch('https://www.cloudflare.com/favicon.ico', {
                  method: 'HEAD',
                  cache: 'no-store',
                  mode: 'no-cors'
                }).then(() => true).catch(() => false)
              ];
              
              // 只要有一个请求成功，就认为网络连接正常
              const connectivityCheck = Promise.any(connectivityChecks)
                .then(() => true)
                .catch(() => false);
              
              // 尝试所有可能的IP检测服务，包括超时处理
              Promise.race([
                Promise.any([fetchHttpbin, fetchIpify, fetchIpinfo]).catch(err => {
                  console.error('所有IP检测服务都失败:', err);
                  
                  // 检查错误信息中是否包含特定的标记，表明可能是被代理拦截
                  const errorMsg = err.toString().toLowerCase();
                  if (errorMsg.includes('unexpected token') || 
                      errorMsg.includes('syntax error') || 
                      errorMsg.includes('failed to fetch') ||
                      errorMsg.includes('<')) {
                    throw new Error('IP检测服务可能被代理服务器拦截');
                  }
                  
                  throw new Error('无法连接到IP检测服务，请检查网络或代理设置');
                }),
                timeoutPromise
              ])
              .then(data => {
                // 提取IP地址（适配不同的API响应格式）
                let ip = '';
                
                // 处理不同服务的响应格式
                if (data.origin) {
                  // httpbin.org格式
                  ip = data.origin;
                } else if (data.ip) {
                  // ipify.org格式
                  ip = data.ip;
                } else if (data.ip && typeof data.ip === 'string') {
                  // ipinfo.io格式
                  ip = data.ip;
                } else {
                  // 未知格式，尝试从JSON中提取
                  const dataStr = JSON.stringify(data);
                  // 尝试匹配IP地址格式
                  const ipMatch = dataStr.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
                  if (ipMatch) {
                    ip = ipMatch[0];
                  } else {
                    ip = '未能识别的IP格式: ' + dataStr.substring(0, 50);
                  }
                }
                
                // 显示成功消息和IP地址（可帮助确认是否通过了代理）
                if (proxyEnabled) {
                  proxyStatus.innerHTML = `✓ 连接测试成功!<br>当前IP地址: ${ip}<br><span style="font-size: 13px; color: #666;">如果此IP与您的代理服务器IP一致，说明代理正常工作</span>`;
                } else {
                  proxyStatus.innerHTML = `✓ 直接连接测试成功!<br>当前IP地址: ${ip}<br><span style="font-size: 13px; color: #666;">这是您的真实IP地址，因为代理未启用</span>`;
                }
                proxyStatus.style.color = '#34a853';
                
                // 使用全局变量存储定时器ID，以便后续可以清除
                window.proxyStatusTimer = setTimeout(function() {
                  proxyStatus.style.display = 'none';
                  window.proxyStatusTimer = null;
                }, 15000); // 统一设置为15秒
              })
              .catch(error => {
                // 连接失败，但我们需要检查是否只是IP检测服务被拦截
                console.error('代理测试失败:', error);
                
                // 检查是否可以连接到其他网站
                connectivityCheck.then(canConnect => {
                  if (canConnect) {
                    // 如果可以连接到其他网站，说明代理可能工作正常，只是IP检测服务被拦截
                    if (error.message.includes('IP检测服务可能被代理服务器拦截')) {
                      if (proxyEnabled) {
                        proxyStatus.innerHTML = `
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="color: #f4b400; font-size: 20px; margin-right: 8px;">⚠️</span>
                            <span style="color: #1a73e8; font-weight: 500;">代理连接可能正常</span>
                          </div>
                          <div style="margin-bottom: 8px;">IP检测服务被拦截，无法获取IP地址</div>
                          <div style="font-size: 13px; color: #666;">
                            您的代理服务器似乎拦截了IP检测服务，但能够连接到其他常用网站。<br>
                            这通常意味着代理工作正常，只是无法显示您的IP地址。
                          </div>
                        `;
                      } else {
                        proxyStatus.innerHTML = `
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="color: #f4b400; font-size: 20px; margin-right: 8px;">⚠️</span>
                            <span style="color: #1a73e8; font-weight: 500;">连接可能正常</span>
                          </div>
                          <div style="margin-bottom: 8px;">IP检测服务被拦截，无法获取IP地址</div>
                          <div style="font-size: 13px; color: #666;">
                            您的网络似乎拦截了IP检测服务，但能够连接到其他常用网站。
                          </div>
                        `;
                      }
                      proxyStatus.style.color = '#1a73e8';
                    } else {
                      // 其他错误，但网络连接正常
                      if (proxyEnabled) {
                        proxyStatus.innerHTML = `
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="color: #f4b400; font-size: 20px; margin-right: 8px;">⚠️</span>
                            <span style="color: #1a73e8; font-weight: 500;">代理连接可能正常</span>
                          </div>
                          <div style="margin-bottom: 8px;">无法获取IP地址，但能连接到其他网站</div>
                          <div style="font-size: 13px; color: #666;">
                            我们尝试连接到Google、Microsoft和Cloudflare等多个网站，至少有一个连接成功。<br>
                            错误信息: ${error.message}
                          </div>
                        `;
                      } else {
                        proxyStatus.innerHTML = `
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="color: #f4b400; font-size: 20px; margin-right: 8px;">⚠️</span>
                            <span style="color: #1a73e8; font-weight: 500;">连接可能正常</span>
                          </div>
                          <div style="margin-bottom: 8px;">无法获取IP地址，但能连接到其他网站</div>
                          <div style="font-size: 13px; color: #666;">
                            我们尝试连接到Google、Microsoft和Cloudflare等多个网站，至少有一个连接成功。<br>
                            错误信息: ${error.message}
                          </div>
                        `;
                      }
                      proxyStatus.style.color = '#1a73e8';
                    }
                  } else {
                    // 如果无法连接到其他网站，说明代理可能确实有问题
                    if (proxyEnabled) {
                      proxyStatus.innerHTML = `✗ 代理连接测试失败: ${error.message}<br>请检查代理服务器是否可用`;
                    } else {
                      proxyStatus.innerHTML = `✗ 直接连接测试失败: ${error.message}<br>请检查您的网络连接`;
                    }
                    proxyStatus.style.color = '#ea4335';
                  }
                  
                  // 使用全局变量存储定时器ID，以便后续可以清除
                  window.proxyStatusTimer = setTimeout(function() {
                    proxyStatus.style.display = 'none';
                    window.proxyStatusTimer = null;
                  }, 15000); // 统一设置为15秒
                });
              });
          } catch (err) {
            console.error('执行测试连接过程中出错:', err);
            proxyStatus.innerHTML = `✗ 测试过程出错: ${err.message}`;
            proxyStatus.style.color = '#ea4335';
            
            window.proxyStatusTimer = setTimeout(function() {
              proxyStatus.style.display = 'none';
              window.proxyStatusTimer = null;
            }, 15000); // 统一设置为15秒
          }
        }, 1000); // 增加延迟，确保状态显示更新
      } catch (err) {
        console.error('测试连接初始化出错:', err);
        proxyStatus.innerHTML = `✗ 测试初始化错误: ${err.message}`;
        proxyStatus.style.color = '#ea4335';
        
        window.proxyStatusTimer = setTimeout(function() {
          proxyStatus.style.display = 'none';
          window.proxyStatusTimer = null;
        }, 30000);
      }
    });
  }

  // 加载代理配置列表
  function loadProxyConfigList() {
    chrome.storage.local.get({ proxyConfigs: {} }, function(data) {
      const proxyConfigs = data.proxyConfigs;
      const proxyConfigList = document.getElementById('proxyConfigList');
      
      // 清空列表
      proxyConfigList.innerHTML = '<option value="">-- 选择已保存的配置 --</option>';
      
      // 添加配置选项
      Object.keys(proxyConfigs).forEach(configName => {
        const option = document.createElement('option');
        option.value = configName;
        option.textContent = configName;
        proxyConfigList.appendChild(option);
      });
    });
  }

  // 将当前设置保存为新的代理配置
  function saveCurrentAsProxyConfig(configName) {
    // 获取当前设置
    const settings = {
      proxyEnabled: document.getElementById('proxyEnabled').checked,
      proxyMode: document.getElementById('proxyMode').value,
      pacScriptUrl: document.getElementById('pacScriptUrl').value.trim(),
      proxyScheme: document.getElementById('proxyScheme').value,
      proxyHost: document.getElementById('proxyHost').value.trim(),
      proxyPort: parseInt(document.getElementById('proxyPort').value, 10) || 8080,
      proxyAuthRequired: document.getElementById('proxyAuthRequired').checked,
      proxyUsername: document.getElementById('proxyUsername').value.trim(),
      proxyPassword: document.getElementById('proxyPassword').value,
      bypassList: document.getElementById('bypassList').value.trim()
    };
    
    // 获取现有配置列表
    chrome.storage.local.get({ proxyConfigs: {} }, function(data) {
      const proxyConfigs = data.proxyConfigs;
      
      // 添加或更新配置
      proxyConfigs[configName] = settings;
      
      // 保存配置列表
      chrome.storage.local.set({ proxyConfigs }, function() {
        // 更新配置列表
        loadProxyConfigList();
        
        // 清空配置名称输入框
        document.getElementById('proxyConfigName').value = '';
        
        // 显示成功消息
        showToast(`配置 "${configName}" 已保存`, 'success');
      });
    });
  }

  // 加载选定的代理配置
  function loadProxyConfig(configName) {
    chrome.storage.local.get({ proxyConfigs: {} }, function(data) {
      const proxyConfigs = data.proxyConfigs;
      
      // 检查配置是否存在
      if (!proxyConfigs[configName]) {
        showToast(`配置 "${configName}" 不存在`, 'error');
        return;
      }
      
      // 获取配置
      const config = proxyConfigs[configName];
      
      // 应用配置到界面
      document.getElementById('proxyEnabled').checked = config.proxyEnabled;
      document.getElementById('proxyMode').value = config.proxyMode;
      document.getElementById('pacScriptUrl').value = config.pacScriptUrl;
      document.getElementById('proxyScheme').value = config.proxyScheme;
      document.getElementById('proxyHost').value = config.proxyHost;
      document.getElementById('proxyPort').value = config.proxyPort;
      document.getElementById('proxyAuthRequired').checked = config.proxyAuthRequired;
      document.getElementById('proxyUsername').value = config.proxyUsername;
      document.getElementById('proxyPassword').value = config.proxyPassword;
      document.getElementById('bypassList').value = config.bypassList;
      
      // 显示对应的设置面板
      showProxySettings(config.proxyMode);
      
      // 显示/隐藏认证设置
      document.getElementById('proxyAuthSettings').style.display = 
        config.proxyAuthRequired ? 'block' : 'none';
      
      // 在固定服务器模式下，所有配置始终可编辑
      
      // 特殊处理认证相关字段 - 认证复选框始终可编辑
      const proxyAuthRequired = document.getElementById('proxyAuthRequired');
      const proxyUsername = document.getElementById('proxyUsername');
      const proxyPassword = document.getElementById('proxyPassword');
      const toggleProxyPassword = document.getElementById('toggleProxyPassword');
      const proxyAuthSettings = document.getElementById('proxyAuthSettings');
      
      if (proxyAuthRequired) {
        // 认证复选框始终可编辑
        proxyAuthRequired.disabled = false;
        
        // 用户名和密码字段始终可编辑
        if (proxyUsername && proxyPassword) {
          proxyUsername.disabled = false;
          proxyPassword.disabled = false;
          if (toggleProxyPassword) {
            toggleProxyPassword.disabled = false;
          }
        }
        
        // 显示/隐藏认证设置
        if (proxyAuthSettings) {
          proxyAuthSettings.style.display = proxyAuthRequired.checked ? 'block' : 'none';
        }
      }
      
      // 显示成功消息
      showToast(`配置 "${configName}" 已加载`, 'success');
    });
  }

  // 删除代理配置
  function deleteProxyConfig(configName) {
    chrome.storage.local.get({ proxyConfigs: {} }, function(data) {
      const proxyConfigs = data.proxyConfigs;
      
      // 检查配置是否存在
      if (!proxyConfigs[configName]) {
        showToast(`配置 "${configName}" 不存在`, 'error');
        return;
      }
      
      // 删除配置
      delete proxyConfigs[configName];
      
      // 保存配置列表
      chrome.storage.local.set({ proxyConfigs }, function() {
        // 更新配置列表
        loadProxyConfigList();
        
        // 显示成功消息
        showToast(`配置 "${configName}" 已删除`, 'success');
      });
    });
  }

  // 初始化各功能
  initializeSettings();
  initializeHistory();
  initializeDefaultPrompts();
  initPromptManagement();
  initializeTabs();
  initializeMemo();
  initializeProxy();
  initializeChat();
  initializeCodec(); // 初始化编码解码功能
  initializeRequest(); // 初始化HTTP请求工具
  
  // 初始更新导航遮罩
  tryUpdateNavMask();
});

// 初始化HTTP请求工具
function initializeRequest() {
  const requestMethod = document.getElementById('requestMethod');
  const requestUrl = document.getElementById('requestUrl');
  const requestHeaders = document.getElementById('requestHeaders');
  const requestBody = document.getElementById('requestBody');
  const responseOutput = document.getElementById('responseOutput');
  const sendRequestBtn = document.getElementById('sendRequestBtn');
  const clearRequestBtn = document.getElementById('clearRequestBtn');
  const copyResponseBtn = document.getElementById('copyResponseBtn');
  
  if (!requestMethod || !requestUrl || !requestHeaders || !requestBody || !responseOutput || !sendRequestBtn || !clearRequestBtn) {
    console.error('HTTP请求工具组件未找到');
    return;
  }
  
  // 加载保存的请求数据
  loadRequestData();
  
  // 发送请求按钮点击事件
  sendRequestBtn.addEventListener('click', function() {
    const method = requestMethod.value;
    const url = requestUrl.value.trim();
    
    if (!url) {
      showToast('请输入请求URL', 'error');
      return;
    }
    
    // 解析请求头
    let headers = {};
    try {
      const headersText = requestHeaders.value.trim();
      if (headersText) {
        headers = JSON.parse(headersText);
      }
    } catch (error) {
      showToast('请求头格式错误，请使用有效的JSON格式', 'error');
      return;
    }
    
    // 准备请求选项
    const options = {
      method: method,
      headers: headers
    };
    
    // 添加请求体（对于非GET/HEAD请求）
    if (method !== 'GET' && method !== 'HEAD') {
      const bodyText = requestBody.value.trim();
      if (bodyText) {
        options.body = bodyText;
      }
    }
    
    // 保存当前请求数据
    saveRequestData(method, url, requestHeaders.value, requestBody.value);
    
    // 显示加载状态（JSON格式）
    responseOutput.value = JSON.stringify({
      status: "loading",
      message: "正在发送请求..."
    }, null, 2);
    
    // 发送请求
    fetch(url, options)
      .then(response => {
        // 获取响应头
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        
        // 检查响应类型
        const contentType = response.headers.get('content-type') || '';
        
        // 处理不同类型的响应
        if (contentType.includes('application/json')) {
          return response.json().then(data => {
            return {
              status: response.status,
              statusText: response.statusText,
              headers: headers,
              body: data
            };
          });
        } else {
          return response.text().then(text => {
            return {
              status: response.status,
              statusText: response.statusText,
              headers: headers,
              body: text
            };
          });
        }
      })
      .then(data => {
        // 创建统一的JSON格式响应
        const jsonResponse = {
          status: data.status,
          statusText: data.statusText,
          headers: data.headers,
          body: data.body
        };
        
        // 格式化为美观的JSON字符串
        responseOutput.value = JSON.stringify(jsonResponse, null, 2);
      })
      .catch(error => {
        // 错误信息也以JSON格式显示
        const errorResponse = {
          error: true,
          message: `请求失败: ${error.message}`
        };
        responseOutput.value = JSON.stringify(errorResponse, null, 2);
      });
  });
  
  // 清空按钮点击事件
  clearRequestBtn.addEventListener('click', function() {
    // 清空所有数据，包括请求数据和响应结果
    resetRequestData();
  });
  
  // 复制响应按钮点击事件
  if (copyResponseBtn) {
    copyResponseBtn.addEventListener('click', function() {
      const output = responseOutput.value;
      if (!output) {
        showToast('没有可复制的内容', 'error');
        return;
      }
      
      navigator.clipboard.writeText(output).then(function() {
        showToast('已复制到剪贴板', 'success');
      }).catch(function(err) {
        showToast('复制失败: ' + err, 'error');
      });
    });
  }
  
  // 添加数据变更事件监听器，自动保存数据
  requestMethod.addEventListener('change', function() {
    saveRequestData(requestMethod.value, requestUrl.value, requestHeaders.value, requestBody.value);
  });
  
  requestUrl.addEventListener('input', function() {
    saveRequestData(requestMethod.value, requestUrl.value, requestHeaders.value, requestBody.value);
  });
  
  requestHeaders.addEventListener('input', function() {
    saveRequestData(requestMethod.value, requestUrl.value, requestHeaders.value, requestBody.value);
  });
  
  requestBody.addEventListener('input', function() {
    saveRequestData(requestMethod.value, requestUrl.value, requestHeaders.value, requestBody.value);
  });
}

// 保存请求数据
function saveRequestData(method, url, headers, body) {
  const requestData = {
    method: method,
    url: url,
    headers: headers,
    body: body
  };
  
  chrome.storage.local.set({ requestData: requestData }, function() {
    if (chrome.runtime.lastError) {
      console.error('保存请求数据失败:', chrome.runtime.lastError);
      return;
    }
    console.log('请求数据已保存');
  });
}

// 加载保存的请求数据
function loadRequestData() {
  chrome.storage.local.get({ requestData: null }, function(data) {
    if (chrome.runtime.lastError) {
      console.error('加载请求数据失败:', chrome.runtime.lastError);
      return;
    }
    
    if (data.requestData) {
      const requestMethod = document.getElementById('requestMethod');
      const requestUrl = document.getElementById('requestUrl');
      const requestHeaders = document.getElementById('requestHeaders');
      const requestBody = document.getElementById('requestBody');
      
      if (requestMethod && data.requestData.method) {
        requestMethod.value = data.requestData.method;
      }
      
      if (requestUrl && data.requestData.url) {
        requestUrl.value = data.requestData.url;
      }
      
      if (requestHeaders && data.requestData.headers) {
        requestHeaders.value = data.requestData.headers;
      }
      
      if (requestBody && data.requestData.body) {
        requestBody.value = data.requestData.body;
      }
      
      console.log('已加载保存的请求数据');
    }
  });
} 

// 重置请求数据
function resetRequestData() {
  const requestMethod = document.getElementById('requestMethod');
  const requestUrl = document.getElementById('requestUrl');
  const requestHeaders = document.getElementById('requestHeaders');
  const requestBody = document.getElementById('requestBody');
  const responseOutput = document.getElementById('responseOutput');
  
  // 重置为默认值
  if (requestMethod) requestMethod.value = 'GET';
  if (requestUrl) requestUrl.value = '';
  if (requestHeaders) requestHeaders.value = '';
  if (requestBody) requestBody.value = '';
  if (responseOutput) responseOutput.value = '';
  
  // 从存储中删除保存的请求数据
  chrome.storage.local.remove('requestData', function() {
    if (chrome.runtime.lastError) {
      console.error('删除请求数据失败:', chrome.runtime.lastError);
      return;
    }
    console.log('请求数据已清空');
  });
} 