# AI 浏览器助手交付记录

## F0：接入与仓库卫生

- 日期：2026-10-07（Asia/Shanghai）。
- 用户指令：所有讨论的功能按最佳实践完成；先做 AI 操作浏览器，再顺序推进其他功能；API Key 等敏感信息不得上传 GitHub。
- 分支：`codex/browser-assistant`。开始时工作区干净，无仓库 AGENTS.md。
- 当前代码：Manifest V3，原生 JavaScript，未配置测试。popup.js 4557 行，content.js 2075 行，background.js 810 行。
- 生命周期：F0 接入 → F1 需求 → F2 设计 → F3 计划 → F4 实现 → F5 验证 → F6 合并准备。每阶段单独提交和推送，主分支不直接写入。
- 用户已明确授权实施及最佳实践选择。本次不将未展示过的文档声称为用户逐条确认；按该执行授权推进，记录假设并允许后续调整。

## Workflow Gate Report

- User request：全量升级，优先浏览器助手，保护敏感信息。
- Detected phase：P0/P1，现有产品迭代。
- Task type：产品、安全、浏览器扩展集成。
- Required upstream artifacts：需求、工具合同、页面状态、数据流、安全与验收标准。
- Found artifacts：README、manifest、旧功能实现与截图。
- Missing/weak artifacts：上述新功能文档和测试框架。
- Implementation allowed now：文档完成后允许实现已授权的浏览器助手；其他功能依序独立交付。
- Prework required：全量路线、浏览器助手需求、设计和验证计划。
- Execution scope：独立侧栏、后台工具执行器、页面观察适配器、本地配置、测试和文档。
- Acceptance criteria：真实扩展工作流证据、敏感字段不采集、关键行为确认、停止后不再执行、提交前敏感信息检查。
- Risks/assumptions：Chrome/Chromium 116+；模型为用户配置的 OpenAI-compatible Chat Completions 服务；特殊浏览器页面不可操作。

## Maintainability Gate Report

- Requested change：新增浏览器助手。
- Files/modules inspected：manifest、background.js、content.js、popup.js/html。
- Trigger：两个文件超过 2000 行，后台超过 800 行，多职责且没有测试。
- Current risk level：旧模块 blocked（不允许继续堆业务）；新增独立模块 medium。
- Responsibility count：旧弹窗含配置、AI、HTTP、代理、存储与 UI。
- Size/complexity signals：见 F0 行数记录。
- Coupling signals：页面读取密钥、后台转发、两处代理应用逻辑。
- Tests covering the area：无；本次新增合同、策略、DOM、运行器与浏览器集成测试。
- Refactor required first：旧大文件中的新业务必须抽离；新功能可直接在独立边界实现。
- Allowed change type：adapter_extraction；旧入口仅加载模块和增加入口。
- Proposed slice：独立 assistant 模块；旧 AI 转发抽出凭据处理适配器。
- Acceptance criteria：不增加旧大文件职责；模块单责；旧划词与设置保持兼容。
- Validation commands：npm test、npm run check、npm run test:e2e、git diff --check、敏感信息检查。
- Risks and assumptions：浏览器事件与模型行为均须测试；真实模型连通性不能由模拟响应证明。

## 后续阶段

尚未完成，实际证据随各阶段追加。其他能力在 docs/roadmap.md 保留完整范围，不以浏览器助手代替全量目标。
