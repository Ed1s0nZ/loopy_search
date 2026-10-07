# 范围与自动授权验证

日期：2026-10-07。实现提交 fb8d401、5824ccc；分支 codex/browser-scope-automation，依赖 browser-assistant。结果为开发分支验收，不代表商店发布或全量路线完成。

## 自动化与界面证据

- `npm test`：29/29，覆盖策略、身份、浏览器适配器、状态机、模型客户端与凭据边界。
- `npm run check`：语法、manifest 资源、空白与敏感信息检查通过；提交 hook 对 staged 内容扫描，不输出密钥值。
- `npm run test:e2e`：19/19（18 个场景及根测试），真实 Chromium 扩展，临时 Profile、本地 HTTP 页面和合成模型；没有真实业务数据或付费 API 请求。
- 420px 界面实际操作：自动预览、锁定范围、选择确切填写动作、缺少明确同意时拒绝、批准后连续动作。截图 artifacts/assistant-auto-preview.png 与 light/dark 输出仅在忽略目录，未进入 Git。人工检查自动授权截图无横向溢出，字段与动作选项可区分。
- 本轮曾发现新标签的空白加载中间态导致 PAGE_UNAVAILABLE，已通过真实新建/关闭流程复测修复。单元测试最初使用不合法短 snapshotId，修正 fixture 后通过；没有隐藏早期失败。

## 需求映射

| ID | 直接证据 |
| --- | --- |
| BSA-001 | validateTabIds 数量/去重测试；browser adapter 在注入前拒绝跨窗口/无痕环境；真实范围选择/锁定 UI |
| BSA-002 | 真实 list_tabs 只含已选 ID，未选 URL 不进模型；switch 后停在预览且模型调用数不增长；越权 switch SCOPE |
| BSA-003 | 自动模式 open/close 仍进入确认；新页加入范围并预览；关闭后保留原页；最后一页关闭拒绝；关闭目标重载后不关页 |
| BSA-004 | 明确同意校验；单次预算执行一个 fill 后第二个请求确认；两次预算连续完成且有两条 automatic 事件 |
| BSA-005 | 同 URL reload 旧授权 STALE_SNAPSHOT，字段未写；DOM 同名节点替换/表单 action 修改产生新 grantId；跨文档/节点 consume 拒绝 |
| BSA-006 | 无授权 consume 返回 null；不支持的工具/目标/额外授权参数/重复项拒绝；固定模型 JSON 合同禁止权限字段 |
| BSA-007 | 全部原只读/确认/导航/停止/凭据 E2E 继续通过，默认单页和只读未改变 |
| BSA-008 | 真实模型等待期间 revoke 后 fill 进入逐次确认，无写入；异步派发准备时 revoke 使 guard 拒绝实际写入；过期 ticket 拒绝；UI 显示剩余次数 |
| BSA-009 | 动作后重新观察，真实连续 fill 使用新快照；DOM mutation 和 reload 拒绝旧操作；确认不可重放 |
| BSA-010 | 独立临时 Profile 与本地页面，finally 清理；模型 body 无测试 key/query；密钥在仓库外，提交扫描通过 |

## 限制和恢复

- 授权绑定身份与动作，无法证明网页业务无副作用；addEventListener 内部行为或服务器语义无法通过 DOM 指纹完整识别。默认不授自动权限，选择前需判断业务目标。
- 撤销/停止可以阻止尚未派发的动作，已经交给 Chrome 或网页的操作不会自动撤销。新开的页在任务结束后保留；若加载失败，可能已创建标签，请手动检查。
- 无痕跨环境拒绝已由适配器测试证明，真实 incognito 窗口权限未自动改动，也未声称完成 TRUST-13 的持久数据隔离；Chrome storage.local 在 split 模式仍共享。
- 尚未包含视觉、iframe/Shadow DOM、工具箱、回放、代理升级等完整路线中的其他功能。遇到 SCOPE/STALE_SNAPSHOT，应检查窗口、页面和目标后重新开始，不自动重试失败写入。
