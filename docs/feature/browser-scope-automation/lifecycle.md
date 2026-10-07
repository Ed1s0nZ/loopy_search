# 浏览器范围与自动操作交付记录

## F0 接入

- 用户明确授权：全部功能按最佳实践完成，先浏览器操作；敏感信息不得进入 GitHub。测试使用独立环境，避免真实数据删改；提交使用 Ed1s0nZ 账号。
- 2026-10-07；基线 42a7e00，browser-assistant PR #6 当前 OPEN 且 CI SUCCESS；工作区干净。
- 分支 codex/browser-scope-automation，基于 codex/browser-assistant，采用依赖 PR，不改主分支。
- 当前责任：顶层 DOM、单任务单标签、只读/逐次确认。BA-AUTO 和 BA-MULTI 在全量路线未完成。
- 上一轮判定：progress，已有实际代码、提交、测试和远端 CI 证据。

## Workflow Gate Report

- User request：全量升级，继续优先完成浏览器助手。
- Detected phase：P1/P5 现有模块增量。
- Task type：执行权限、浏览器集成和 UI。
- Required upstream artifacts：任务范围、自动授权、数据流和测试合同。
- Found artifacts：首版需求/设计、runner/policy/browser/page-tools、21 单元与真实扩展测试。
- Missing/weak artifacts：多标签与自动授权文档，本轮补齐。
- Implementation allowed now：完成 F1–F3 后允许；既有用户授权覆盖最佳实践实施，不声称文档已获逐条确认。
- Prework required：稳定元素身份、文档身份、授权预算、范围校验、导航/标签管理规则。
- Execution scope：选定标签任务、列出/切换/创建/关闭标签、元素级自动授权、UI 和验证。
- Acceptance criteria：范围外拒绝；未批准内容不发模型；授权只作用于同文档同元素且有次数上限；停止和过期不写入；真实扩展证明。
- Risks/assumptions：任意网页按钮可能有业务副作用；必须明确授权具体动作，默认仍只读。

## Maintainability Gate Report

- Requested change：BA-AUTO / BA-MULTI。
- Files/modules inspected：assistant 模块、侧栏入口、既有测试。
- Trigger：UI/执行器/安全合同跨界；旧 content/popup 超过 2000 行。
- Current risk level：新模块 medium；旧大文件仍不允许堆业务。
- Responsibility count：策略、DOM、browser API、状态机、UI 已分离。
- Size/complexity signals：新生产模块均低于 200 行；新增权限模块与 UI 模块独立。
- Coupling signals：模型只输出工具；后台维护范围；DOM 适配器负责实际引用校验。
- Tests covering the area：Node 与独立 Chromium 扩展测试。
- Refactor required first：不改旧大文件；runner 引入独立 scope/grants 边界，避免直接堆安全逻辑。
- Allowed change type：adapter_extraction / feature_after_refactor。
- Proposed slice：授权策略 → 文档/元素身份 → 多标签适配器 → 状态机/UI → 真扩展验证。
- Acceptance criteria：无通用 eval/selector 工具，无页面自行授权，身份失效拒绝自动写入。
- Validation commands：npm test、npm run check、npm run test:e2e、staged secret scan、GitHub CI。
- Risks and assumptions：真实测试仅本地合成页面；闭合 Shadow DOM/视觉仍另行交付。

## 生命周期计划

F0/F1/F2/F3 各自文档提交并推送；F4 代码与实现记录；F5 使用与验证；F6 changelog、review 和 draft PR。每阶段记录实际提交与验证，不提前填成功。
