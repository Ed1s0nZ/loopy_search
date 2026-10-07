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

## F4 实现记录（2026-10-07）

- 新增 scope、grants、actions、scope-ui 模块；runner 负责流程，browser 负责浏览器 API 和文档身份，避免旧 popup/content 大文件新增业务。
- 多标签范围最多 8 页，同一窗口与普通/无痕环境；支持范围内列出/切换，以及逐次确认的新开和关闭。关闭记录绑定确认时的文档与标题。
- 自动授权仅适用于本次预览选定元素的 click/fill/select；请求必须包含 `acknowledged: true` 才能授予非空权限，默认 3 次，范围 1–8 次，60 秒过期。授权绑定文档和 DOM 节点，撤销可阻止尚未派发的操作。
- UI 在任务预览期间也锁定标签范围，避免界面选择与后台已冻结范围不一致；自动权限选择仍可在批准前编辑。
- 验证：`npm test` 26/26；`npm run check` 通过；既有真实扩展 E2E 11/11。新增 5 项策略测试覆盖明确同意、动作范围、次数、节点/文档失效、过期撤销、跨窗口/环境和关闭确认。
- 尚未完成：新增多标签与自动授权的专门真实扩展流程、界面视觉检查、F5 使用文档与验收证据、F6 review/PR；BA-AUTO 和 BA-MULTI 不提前标记完成。
- 测试使用临时 Chromium 配置和本地合成网页，无真实站点数据写入；本轮没有付费模型请求。密钥保留在仓库外，提交前检查不输出密钥值。

### F4 验收修正

- 真实新开标签测试发现 Chrome 会先暴露 about:blank/pendingUrl；加载等待现在验证待加载 HTTP(S) 地址，并等待完成后才观察内容。不会把空白中间态当作任务文档。
- 关闭检查使用确认时捕获的标题，防止同文档记录刷新掩盖标题变化。新增独立适配器/执行器测试证明跨环境前置拒绝和异步派发前撤销。
- 新增真实扩展流程覆盖连续授权、预算耗尽、撤销、同 URL 重载、列表/切换/越权、新开/关闭、重载后关闭拒绝、节点/表单身份及实际 UI 明确同意。
- 修正模型只读错误文案、标签关闭风险说明，并将 acknowledged 字段补入设计合同。
