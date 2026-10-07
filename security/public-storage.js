// Compatibility adapter for existing content features; credentials never cross it.
globalThis.LoopyPublicStorage = {
  get(keys, callback) {
    const requested = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys ?? {});
    const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
    chrome.runtime.sendMessage({ action: 'publicSettings:get', keys: requested }, response => {
      if (chrome.runtime.lastError || !response?.success) { callback({ ...defaults }); return; }
      callback({ ...defaults, ...response.data });
    });
  },
  set(values, callback = () => {}) {
    chrome.runtime.sendMessage({ action: 'publicSettings:set', values }, response => {
      const failed = chrome.runtime.lastError || !response?.success;
      if (failed) console.warn('本地设置保存失败');
      callback();
    });
  },
  onChanged: {
    addListener(listener) {
      chrome.runtime.onMessage.addListener(message => {
        if (message?.action === 'publicSettings:changed') listener(message.changes, 'local');
      });
    }
  }
};
