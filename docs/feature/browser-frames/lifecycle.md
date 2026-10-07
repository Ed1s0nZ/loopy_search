# iframe 与 Shadow DOM 交付记录

## F0 接入与门禁

2026-10-07。用户授权所有功能按最佳实践自主完成，先浏览器操作；密钥不得上传，隔离测试避免真实数据删改，使用 Ed1s0nZ 提交。上一轮 progress：视觉 PR #8 head 7df99a2，36 单元/27 扩展测试与 CI SUCCESS。本分支 codex/browser-frames 基于 #8，工作区干净，不改主分支。

Workflow Gate Report：阶段 P1/P5/P7，页面结构、范围、权限与执行。已有 DOM/vision/scope/grants 和真实扩展证据；缺深层 DOM 遍历、影子根 mutation、iframe 文档引用与选择。先补需求/设计/计划后实施；既有用户授权覆盖可推断方案，不声称文档逐项确认。验收为开放/闭合 Shadow DOM 和明确选中 iframe 可读取/操作，敏感字段/隐藏父链过滤，跨框架/重载旧确认拒绝，新文档先预览。隐私风险是嵌入第三方页面与影子内部字段，默认只顶层 frame。

Maintainability Gate Report：跨 UI/Chrome/页面协议 medium；page-tools 119、browser 100、runner 164 行；旧 content/popup 不新增业务。先提取独立 composed DOM runtime 与 frame adapter，浏览器与状态机仅薄组合。允许 adapter_extraction / feature_after_refactor；生产模块目标低于 200 行，固定工具不接受 selector/JS。验证单元范围合同与真实扩展跨源、srcdoc、影子/slot、mutation、授权及原回归。

Feature Lifecycle Report：BA-FRAME，当前 F0；用户在 Web Components 或嵌入表单中无法完成任务。目标为同一套观察/确认覆盖新结构，影子内容视为当前页面，iframe 单独选择。新增可选 webNavigation 权限（仅枚举当前页 frame，不监听历史），列表/切换 frame 工具与 frameIds 启动参数。F0/F1/F2/F3 文档各提交推送，F4 实现记录，F5 需求映射与使用，F6 changelog/review/draft PR。未授权商店发布，无 paid 模型调用必要。
