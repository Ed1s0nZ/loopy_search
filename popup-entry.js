document.getElementById('openAssistant')?.addEventListener('click', async () => {
  const button = document.getElementById('openAssistant');
  try {
    const window = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: window.id });
  } catch {
    await chrome.tabs.create({ url: chrome.runtime.getURL('assistant.html') });
    button.textContent = '助手已在新标签页打开';
  }
});
