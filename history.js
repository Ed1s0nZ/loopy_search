document.addEventListener('DOMContentLoaded', function() {
  // DOM元素
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');
  const pagination = document.getElementById('pagination');
  const settingsBtn = document.getElementById('settings');
  const clearHistoryBtn = document.getElementById('clearHistory');
  const searchInput = document.getElementById('searchInput');
  const filterOptions = document.querySelectorAll('input[name="filter"]');
  const exportHistoryBtn = document.getElementById('exportHistory');
  const sourceSelect = document.getElementById('sourceFilter');
  
  // 分页设置
  const itemsPerPage = 10;
  let currentPage = 1;
  let filteredHistory = [];
  
  // 加载历史记录
  loadHistory();
  
  // 事件监听
  settingsBtn.addEventListener('click', openSettings);
  clearHistoryBtn.addEventListener('click', confirmClearHistory);
  exportHistoryBtn.addEventListener('click', function() {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      if (history.length === 0) {
        alert('暂无历史记录可导出');
        return;
      }
      exportHistory(history);
    });
  });
  
  searchInput.addEventListener('input', filterHistory);
  filterOptions.forEach(option => {
    option.addEventListener('change', filterHistory);
  });
  sourceSelect.addEventListener('change', filterHistory);
  
  // 加载历史记录
  function loadHistory() {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      
      if (history.length === 0) {
        showEmptyState();
        return;
      }
      
      // 默认按时间倒序排列
      history.sort((a, b) => b.timestamp - a.timestamp);
      
      // 应用过滤
      filterHistory();
    });
  }
  
  // 过滤历史记录
  function filterHistory() {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      const searchTerm = searchInput.value.toLowerCase();
      const filterValue = document.querySelector('input[name="filter"]:checked').value;
      const sourceValue = sourceSelect.value;
      
      // 应用过滤条件
      filteredHistory = history.filter(item => {
        // 搜索词过滤
        const matchesSearch = 
          (item?.query?.toLowerCase()?.includes(searchTerm) || false) || 
          (item?.response?.toLowerCase()?.includes(searchTerm) || false);
        
        // 评分过滤
        let matchesFilter = true;
        if (filterValue === 'liked') {
          matchesFilter = item.rating === 1;
        } else if (filterValue === 'disliked') {
          matchesFilter = item.rating === -1;
        }
        
        // 来源过滤
        let matchesSource = true;
        if (sourceValue !== 'all') {
          const t = (item.type === 'search' ? 'select' : (item.type || 'other')).toLowerCase().trim();
          matchesSource = t === sourceValue;
        }
        
        return matchesSearch && matchesFilter && matchesSource;
      });

      // 按时间倒序排列
      filteredHistory.sort((a, b) => b.timestamp - a.timestamp);
      
      // 更新UI
      if (filteredHistory.length === 0) {
        showEmptyState();
      } else {
        hideEmptyState();
        currentPage = 1;
        renderHistoryPage();
        renderPagination();
      }
    });
  }
  
  // 渲染当前页的历史记录
  function renderHistoryPage() {
    historyList.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredHistory.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const item = filteredHistory[i];
      const historyItem = createHistoryItem(item);
      historyList.appendChild(historyItem);
    }
  }
  
  // 创建历史记录项
  function createHistoryItem(item) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.id = item.id;
    
    // 格式化日期
    const date = new Date(item.timestamp);
    const formattedDate = `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
    
    // 来源标签
    const sourceTag = document.createElement('span');
    let type = item.type === 'search' ? 'select' : (item.type || 'other');
    sourceTag.className = 'history-source ' + type;
    sourceTag.textContent = type === 'chat' ? '对话' : (type === 'select' ? '划词/右键' : '其他');
    
    // 评分图标
    let ratingIcon = '';
    if (item.rating === 1) {
      ratingIcon = '👍';
    } else if (item.rating === -1) {
      ratingIcon = '👎';
    }
    
    // 截取查询内容作为标题
    const titleText = item?.query?.length > 50 ? item.query.substring(0, 50) + '...' : (item?.query || '无查询内容');
    
    historyItem.innerHTML = `
      <div class="history-item-header">
        <span class="history-source-placeholder"></span>
        <div class="history-item-title">${titleText}</div>
        <div class="history-item-meta">
          <div class="history-item-rating">${ratingIcon}</div>
          <div class="history-item-date">${formattedDate}</div>
        </div>
      </div>
      <div class="history-item-content">
        <div class="history-query">${item?.query || '无查询内容'}</div>
        <div class="history-response">${marked.parse(item?.response || '无响应内容')}</div>
      </div>
      <div class="history-actions">
        <button class="history-action-btn copy-btn" data-id="${item.id}">复制结果</button>
        <button class="history-action-btn like-btn ${item.rating === 1 ? 'active' : ''}" data-id="${item.id}">👍 点赞</button>
        <button class="history-action-btn dislike-btn ${item.rating === -1 ? 'active' : ''}" data-id="${item.id}">👎 踩</button>
        <button class="history-action-btn delete-btn" data-id="${item.id}">删除</button>
      </div>
    `;
    
    // 用sourceTag替换占位符
    const placeholder = historyItem.querySelector('.history-source-placeholder');
    if (placeholder) placeholder.replaceWith(sourceTag);
    
    // 添加事件监听
    setTimeout(() => {
      const copyBtn = historyItem.querySelector('.copy-btn');
      const likeBtn = historyItem.querySelector('.like-btn');
      const dislikeBtn = historyItem.querySelector('.dislike-btn');
      const deleteBtn = historyItem.querySelector('.delete-btn');
      
      copyBtn.addEventListener('click', () => copyResult(item.id));
      likeBtn.addEventListener('click', () => rateResult(item.id, 1));
      dislikeBtn.addEventListener('click', () => rateResult(item.id, -1));
      deleteBtn.addEventListener('click', () => deleteHistoryItem(item.id));
    }, 0);
    
    return historyItem;
  }
  
  // 渲染分页控件
  function renderPagination() {
    pagination.innerHTML = '';
    
    const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
    
    if (totalPages <= 1) {
      return;
    }
    
    // 上一页按钮
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderHistoryPage();
        renderPagination();
      }
    });
    pagination.appendChild(prevBtn);
    
    // 页码按钮
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = i === currentPage ? 'active' : '';
      pageBtn.addEventListener('click', () => {
        currentPage = i;
        renderHistoryPage();
        renderPagination();
      });
      pagination.appendChild(pageBtn);
    }
    
    // 下一页按钮
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderHistoryPage();
        renderPagination();
      }
    });
    pagination.appendChild(nextBtn);
  }
  
  // 复制结果
  function copyResult(id) {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      const item = history.find(item => item.id === id);
      
      if (item) {
        navigator.clipboard.writeText(item.response).then(() => {
          const copyBtn = document.querySelector(`.copy-btn[data-id="${id}"]`);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '已复制';
          setTimeout(() => {
            copyBtn.textContent = originalText;
          }, 2000);
        });
      }
    });
  }
  
  // 评分结果
  function rateResult(id, rating) {
    chrome.storage.local.get('searchHistory', function(data) {
      const history = data.searchHistory || [];
      const index = history.findIndex(item => item.id === id);
      
      if (index !== -1) {
        // 如果已经有相同评分，则取消评分
        if (history[index].rating === rating) {
          history[index].rating = 0;
        } else {
          history[index].rating = rating;
        }
        
        chrome.storage.local.set({ searchHistory: history }, function() {
          // 更新UI
          filterHistory();
        });
      }
    });
  }
  
  // 删除历史记录项
  function deleteHistoryItem(id) {
    if (confirm('确定要删除这条历史记录吗？')) {
      chrome.storage.local.get('searchHistory', function(data) {
        const history = data.searchHistory || [];
        const updatedHistory = history.filter(item => item.id !== id);
        
        chrome.storage.local.set({ searchHistory: updatedHistory }, function() {
          // 更新UI
          filterHistory();
        });
      });
    }
  }
  
  // 确认清空历史记录
  function confirmClearHistory() {
    if (confirm('确定要清空所有历史记录吗？此操作无法撤销。')) {
      chrome.storage.local.remove('searchHistory', function() {
        loadHistory();
      });
    }
  }
  
  // 打开设置
  function openSettings() {
    chrome.runtime.sendMessage({ action: 'openSettings' }, function(response) {
      if (chrome.runtime.lastError || !response.success) {
        console.error('打开设置页面失败:', chrome.runtime.lastError || response.error);
      }
    });
  }
  
  // 显示空状态
  function showEmptyState() {
    historyList.style.display = 'none';
    pagination.style.display = 'none';
    emptyState.style.display = 'block';
    
    // 添加返回使用按钮的点击事件
    const returnButton = emptyState.querySelector('button');
    returnButton.addEventListener('click', () => {
      // 关闭当前标签页并返回到上一页
      chrome.tabs.getCurrent(function(tab) {
        chrome.tabs.remove(tab.id);
      });
    });
  }
  
  // 隐藏空状态
  function hideEmptyState() {
    historyList.style.display = 'flex';
    pagination.style.display = 'flex';
    emptyState.style.display = 'none';
  }
  
  // 数字前补零
  function padZero(num) {
    return num.toString().padStart(2, '0');
  }

  // 导出历史记录功能
  function exportHistory(history) {
    // 生成导出内容
    let exportContent = '# AI划词搜索 - 历史记录导出\n\n';
    exportContent += `导出时间：${new Date().toLocaleString()}\n\n`;
    
    history.forEach((item, index) => {
      exportContent += `## ${index + 1}. ${new Date(item.timestamp).toLocaleString()}\n\n`;
      exportContent += `### 查询内容\n${item.query}\n\n`;
      exportContent += `### AI 回复\n${item.response}\n\n`;
      if (item.rating) {
        exportContent += `### 评分\n${item.rating > 0 ? '👍 有用' : '👎 没用'}\n\n`;
      }
      exportContent += '---\n\n';
    });

    // 创建并下载文件
    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI划词搜索历史记录_${new Date().toLocaleDateString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 在文件末尾或合适位置加样式
  const style = document.createElement('style');
  style.textContent = `
  .history-source {
    display: inline-block;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 8px;
    margin-right: 8px;
    color: #fff;
  }
  .history-source.chat { background: #1a73e8; }
  .history-source.select { background: #34a853; }
  .history-source.other { background: #fbbc05; }
  `;
  document.head.appendChild(style);
}); 
