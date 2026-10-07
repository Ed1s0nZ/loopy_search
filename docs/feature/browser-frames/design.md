# 深层 DOM 与 frame 合同

## 模块与观察

dom-runtime.js 是隔离世界的无依赖 bootstrap，复合父链 parentElement/assignedSlot/root.host，使用 chrome.dom.openOrClosedShadowRoot（Chrome 88+，无 debugger）发现根。遍历每个 document/shadow root，避免读 UA 输入/媒体内部根。MutationObserver 观察所有当前根，新增/移除根使 revision 变化，重新注册避免保留脱离根。候选、文本、可见性和禁用/敏感祖先统一通过 runtime；page-tools 保持固定动作和现有数据形状，只添加 shadow 描述与 coverage。

每次 Chrome 注入先安装 runtime（幂等）；仍使用 ISOLATED world。预算 30k 节点/64 根，超限 DOCUMENT_LIMIT，不能静默漏掉安全边界。直接函数测试无 runtime 时保留顶层 fallback。文本去重，slot 服从复合可见性；密码、token、文件、编辑区值过滤贯穿开放和闭合根。

## frame 与权限

manifest optional_permissions 增加 webNavigation，只有用户点击“加载 iframe 列表”申请。助手页调用 permissions.request，拒绝不准备 iframe 任务。后台所有 frame 功能再查权限，只 getAllFrames/getFrame，不监听导航事件，不缓存浏览历史。

assistant:frames {tabId} 返回 frameId,parentFrameId,脱敏 url,documentId（用于校验元数据，不含正文），最多 128 元数据。assistant:prepare 可增加 frameIds（含 0，去重，最多 16），仅初始标签；其他选择标签默认 [0]。frame-adapter 在 scope.frameScopes 维护各标签根 documentId 和允许 ID，父页 documentId 变化即撤销非 0 范围。未授权 frame 不注入 page-tools。

list_frames {} / switch_frame {frameId} 是只读工具；switch 只选授权框架，读取后新 documentKey 转预览，未批准不发新正文。切换/新开标签恢复 frameId=0，navigate 明确整个标签。DOM click/fill/select/scroll 派发到当前观察保存的 frame，不是模型自行提供 frameId。引用私有 key 绑定 tabId/frameId/Chrome documentId/URL；执行前 getFrame 与根身份校验，注入优先使用 documentIds 锁定文档，不沿 frameId 重载复用。

继承来源 about:blank/srcdoc 仅接受其父链最终为本次 HTTP(S) 主文档；普通 blob/data/内部 URL 不接受。UI 元数据用“嵌入文档”而非泄漏原 URL 参数。非 0 frame 的观察/动作通过 IntersectionObserver 确认可见父链，隐藏/离屏拒绝，用户需先让它显示。

## 视觉与兼容

视觉截图仍为顶层整个标签，runtime 提供全部可识别影子 host/内部敏感区域用于遮挡。子 frame 当前任务拒绝 click_point，避免把 iframe DOM 坐标误作顶层图坐标；其表单可通过 DOM 确认工具操作。frame 切换重预览清授权，新根撤销子范围。旧无 frameIds 调用、单页/多页、视觉、只读与 auto 合同保持。

失败：FRAME_PERMISSION、FRAME_SCOPE、PAGE_UNAVAILABLE、STALE_SNAPSHOT、DOCUMENT_LIMIT、FRAME_HIDDEN。任何失败不自动重试写入。模型只知道范围内 frame 描述及已批准的当前文档观察；密钥不注入页面。父页可以不可信，但 Chrome 返回的 documentId/window/incognito 是绑定依据。

依据：[Chrome DOM](https://developer.chrome.com/docs/extensions/reference/api/dom)、[webNavigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)、[Scripting documentIds](https://developer.chrome.com/docs/extensions/reference/api/scripting)。图像与私有配置不提交，测试仅本地合成站点。
