# iframe 与 Shadow DOM 交付记录

## F0 接入与门禁

2026-10-07。用户授权所有功能按最佳实践自主完成，先浏览器操作；密钥不得上传，隔离测试避免真实数据删改，使用 Ed1s0nZ 提交。上一轮 progress：视觉 PR #8 head 7df99a2，36 单元/27 扩展测试与 CI SUCCESS。本分支 codex/browser-frames 基于 #8，工作区干净，不改主分支。

Workflow Gate Report：阶段 P1/P5/P7，页面结构、范围、权限与执行。已有 DOM/vision/scope/grants 和真实扩展证据；缺深层 DOM 遍历、影子根 mutation、iframe 文档引用与选择。先补需求/设计/计划后实施；既有用户授权覆盖可推断方案，不声称文档逐项确认。验收为开放/闭合 Shadow DOM 和明确选中 iframe 可读取/操作，敏感字段/隐藏父链过滤，跨框架/重载旧确认拒绝，新文档先预览。隐私风险是嵌入第三方页面与影子内部字段，默认只顶层 frame。

Maintainability Gate Report：跨 UI/Chrome/页面协议 medium；page-tools 119、browser 100、runner 164 行；旧 content/popup 不新增业务。先提取独立 composed DOM runtime 与 frame adapter，浏览器与状态机仅薄组合。允许 adapter_extraction / feature_after_refactor；生产模块目标低于 200 行，固定工具不接受 selector/JS。验证单元范围合同与真实扩展跨源、srcdoc、影子/slot、mutation、授权及原回归。

Feature Lifecycle Report：BA-FRAME，当前 F0；用户在 Web Components 或嵌入表单中无法完成任务。目标为同一套观察/确认覆盖新结构，影子内容视为当前页面，iframe 单独选择。新增可选 webNavigation 权限（仅枚举当前页 frame，不监听历史），列表/切换 frame 工具与 frameIds 启动参数。F0/F1/F2/F3 文档各提交推送，F4 实现记录，F5 需求映射与使用，F6 changelog/review/draft PR。未授权商店发布，无 paid 模型调用必要。

## F4 实现进展（未完成 F5/F6）

新增独立 dom-runtime / frame-adapter / frame-ui，使用 Chrome 隔离世界 openOrClosedShadowRoot 遍历开放/闭合/嵌套根并观察 mutation；固定工具引用沿用快照/元素授权。框架默认顶层，列表仅元数据，选择绑定父 documentId，执行使用具体 Chrome documentIds，子文档观察检查可见性，父页重载撤销子范围。模型 list_frames/switch_frame；切换先暂停预览，填写仍单次确认。子框架只用 DOM，上次截图和图片历史清除，切回顶层才能重新获取标签截图。

真实 Chromium 本地测试新增 5 项（含父测试）：闭合/嵌套/slot fallback、隐藏/输入值过滤、影子填写和 mutation 失效、跨源 iframe/srcdoc/未选择/隐藏拒绝、助手切换后二次预览与单次确认、子/父文档重载。测试临时复制扩展并预授予 webNavigation，**不代表原生可选权限弹窗已验证**。本轮模型请求全部本地合成，无付费 API 调用，无真实站点写入。

待 F5：扩展同源/about:blank、实际 slot 分发、影子 select/click 和自动授权、权限 UI/视觉边界/预算更多覆盖；完整需求映射和 UI 检视。待 F6：review、changelog、草稿 PR 与 CI。不得据现有子集测试宣称 BA-FRAME 全量完成。

### F4 验收补充

实际分发到闭合根 slot 的 light DOM 标签被正确用于按钮识别；真实闭合根 click/select 和隐藏宿主旧引用拒绝通过。新增同源 HTTP iframe 与继承来源 about:blank 实际注入观察，内容保持独立，未选择前拒绝读取。框架专项现 7 项（含父测试），其余现有 27 项扩展回归通过。框架 UI 限制最多 16 项、列表可滚动；撤销 webNavigation 后重置选择并给出提示；权限申请仍在点击的同步调用链内，异常进入统一 notice。

尚未将上述证据扩大为所有 BF 要求完成：真实原生权限弹窗、影子自动授权、预算与视觉组合、完整 UI 仍需补验。无付费模型请求。

### F4 自动授权与视觉边界补充

真实闭合根连续填写仅在明确授权的同一节点上执行；limit=1 耗尽后进入单次确认。模型响应等待期间替换影子内输入节点，旧快照/自动同意得到 STALE_SNAPSHOT，新节点保持空值。专项增至 9 项（含父测试）。

发现视觉探测仅扫描顶层文字会漏掉闭合影子文字越过宿主边界的区域。改用已预算限制的深层 textNodes，计算文字 Range 与父矩形并集，长文本也遮挡实际溢出范围。真实 PNG 像素测试证明闭合根内溢出宿主的输入和合成凭证均为遮挡色；无模型发送必要。全套 38 单元、37 扩展测试通过；最后范围计算整理另复跑 vision 专项，检查记录以实际命令结果为准。

原生权限提示、预算及完整 UI 检视仍待验证，F5/F6 不标完成。密钥扫描通过；未调用付费 API。

### F4 预算与默认权限验收

真实结构预算（30k 节点/64 影子根）超限明确拒绝并可恢复，输出上限 80 元素/12k 字符。未修改生产 manifest 的独立临时 Profile 中 webNavigation 默认 false，框架枚举 FRAME_PERMISSION，顶层观察成功。完整 39 项扩展测试通过，syntax/manifest/secret 检查通过。前一 head a4b02b7 的 CI run 37595363635 SUCCESS。

新 verification.md 对 BF-001..010 逐条列明证据和缺口，F5 保持进行中。原生 optional 权限 UI 在 headless 实验未返回，30 秒超时并关闭隔离 Profile；没有计入成功或提交不稳定测试。后续用有界面隔离浏览器补证。无 paid 调用。

### F4 composed slot 与嵌套框架

发现闭合 slot 的 assignedSlot 返回不可见引用时，原 composed parent 可能沿 light DOM 父链，遗漏实际 slot 父区域 opacity/hidden。runtime 现在在预算内遍历 SLOT.assignedNodes 建立 WeakMap 分发关系，每次刷新替换，避免残留节点。真实闭合 slot 内 opacity=0 父链排除文字/按钮；恢复后文字可见。新 attachShadow 根不产生普通子节点 mutation 时，根集合变化仍使旧 snapshot 拒绝。

嵌套跨源 iframe 的 frameId/parentFrameId 和独立授权实际验证；未选拒绝，选后只观察子文档，祖先 iframe display:none 导致 FRAME_HIDDEN。专项 13 项（含父测试）通过；没有访问真实网站或 paid API。F5 验收表更新相关证据，仍未勾选全量完成。
