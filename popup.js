// 全局函数定义
function showToast(message, type = 'success') {
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
  
  // 3秒后移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toastContainer.remove();
    }, 300);
  }, 3000);
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
    chrome.storage.sync.get({ 
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

    chrome.storage.sync.get({ 
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
          chrome.storage.sync.set({ prompt: template.content }, function() {
            const promptInput = document.getElementById('prompt');
            if (promptInput) {
              promptInput.value = template.content;
              showToast('提示词已应用成功');
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
          chrome.storage.sync.set({ promptTemplates: updatedTemplates }, function() {
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
      
      // 如果修改了历史记录保留时间，立即执行一次清理
      chrome.runtime.sendMessage({
        action: 'updateHistoryRetention',
        days: parseInt(historyRetentionSelect.value)
      }, function() {
        console.debug('已更新历史记录保留天数，并触发清理');
      });
      
      setTimeout(function() {
        statusDiv.style.display = 'none';
        // 关闭设置窗口
        window.close();
      }, 1000);
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
      chrome.storage.sync.get({ memos: [] }, function(data) {
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
      chrome.storage.sync.get({ memos: [] }, function(data) {
        const memos = data.memos;
        if (memos.length === 0) {
          memoList.innerHTML = '<div class="memo-empty">暂无备忘录</div>';
          return;
        }

        memoList.innerHTML = '';
        memos.sort((a, b) => b.id - a.id).forEach(memo => {
          const memoItem = document.createElement('div');
          memoItem.className = 'memo-item';
          memoItem.innerHTML = `
            <div class="memo-text">${memo.text}</div>
            <div class="memo-time">${new Date(memo.timestamp).toLocaleString()}</div>
            <button class="memo-delete-btn" data-id="${memo.id}">删除</button>
          `;
          memoList.appendChild(memoItem);
        });

        // 添加删除事件监听
        document.querySelectorAll('.memo-delete-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            deleteMemo(id);
          });
        });
      });
    }

    // 保存新备忘录
    function saveMemo() {
      const text = memoInput.value.trim();
      if (!text) return;

      chrome.storage.sync.get({ memos: [] }, function(data) {
        const memos = data.memos;
        memos.push({
          id: Date.now(),
          text: text,
          timestamp: new Date().toISOString()
        });
        chrome.storage.sync.set({ memos: memos }, function() {
          memoInput.value = '';
          loadMemos();
        });
      });
    }

    // 删除备忘录
    function deleteMemo(id) {
      chrome.storage.sync.get({ memos: [] }, function(data) {
        const memos = data.memos.filter(memo => memo.id !== id);
        chrome.storage.sync.set({ memos: memos }, function() {
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
    // ... 设置相关代码 ...
  }

  // 初始化历史记录功能
  function initializeHistory() {
    // ... 历史记录相关代码 ...
  }

  // 初始化默认提示词
  function initializeDefaultPrompts() {
    console.log('开始初始化默认提示词...');
    chrome.storage.sync.get({ 
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
      chrome.storage.sync.set({
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
        background-color: #1a73e8;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        font-size: 14px;
        transition: background-color 0.3s;
      }

      .btn-primary:hover {
        background-color: #1557b0;
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
        background: #1a73e8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-apply:hover {
        background: #1557b0;
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

      /* 导航容器样式 */
      .nav-tabs {
        display: flex;
        border-bottom: 1px solid #eee;
        margin-bottom: 20px;
        padding: 0 10px;     /* 添加水平内边距 */
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
      chrome.storage.sync.get({ 
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
      chrome.storage.sync.get({ 
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
        chrome.storage.sync.set({ 
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

        chrome.storage.sync.get({ customCategories: ['通用'] }, function(data) {
          const categories = data.customCategories;
          
          if (categories.includes(newCategory)) {
            showToast(`分类"${newCategory}"已存在`, 'error');
            input.value = '';
            input.focus();
            return;
          }

          categories.push(newCategory);
          chrome.storage.sync.set({ customCategories: categories }, function() {
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

        chrome.storage.sync.get({ promptTemplates: [] }, function(data) {
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

          chrome.storage.sync.set({ promptTemplates: templates }, function() {
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

        chrome.storage.sync.get({ promptTemplates: [] }, function(data) {
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

          chrome.storage.sync.set({ promptTemplates: templates }, function() {
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
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // 移除所有标签页的active类
        tabs.forEach(t => t.classList.remove('active'));
        // 移除所有内容区域的active类
        tabContents.forEach(content => content.classList.remove('active'));

        // 激活当前点击的标签页
        this.classList.add('active');
        // 激活对应的内容区域
        const tabId = this.getAttribute('data-tab');
        const content = document.getElementById(tabId);
        if (content) {
          content.classList.add('active');
        }
      });
    });

    // 默认激活第一个标签页
    const firstTab = document.querySelector('.nav-tab');
    if (firstTab) {
      firstTab.click();
    }
  }

  // 初始化所有功能
  initializeMemo();
  initializeSettings();
  initializeHistory();
  initPromptManagement();
  initializeTabs(); // 添加标签页初始化
}); 