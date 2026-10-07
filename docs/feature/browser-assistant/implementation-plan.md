# 浏览器助手实施计划

分支：codex/browser-assistant；设计：design.md；用户授权按最佳实践自主推进。

| 切片 | 模块 | 行为 | 验证 | 回滚 |
| --- | --- | --- | --- | --- |
| 1 | assistant/privacy.js, policy.js, model.js | 脱敏、URL/工具合同、限长/超时模型客户端 | Node 单元测试 | 移除新模块 |
| 2 | assistant/page-tools.js | 顶层 DOM 观察、快照引用和受控操作 | 浏览器 DOM 测试 | 取消 scripting 调用 |
| 3 | assistant/runner.js, service.js | 状态机、确认、固定标签、停止/断连 | 生命周期与消息授权测试 | 移除后台入口 |
| 4 | assistant.html/css/js, popup-entry.js | 侧栏预览、任务、模型配置、状态、无障碍 | 真实扩展 E2E + 截图检查 | 移除侧栏入口 |
| 5 | security/settings.js, legacy-ai.js, public-storage.js | storage trusted-only、公开白名单桥接、后台持有密钥 | 旧划词合同与泄漏测试 | 不回退密钥保护，只修兼容 |
| 6 | scripts、tests、CI、README、CHANGELOG | 提交检查、合成浏览器 fixture、操作说明 | 全量新增测试/静态校验/提交扫描 | 单独撤销入口，保留防护 |

## 文件与边界

- background.js 仅导入模块并委托旧 AI 请求，不继续放新功能业务。
- content.js 的 local storage 调用委托公开适配器；不接收/发送 apiKey。
- popup.js 不新增助手业务；popup.html 仅挂载按钮与独立脚本。
- 所有测试数据为合成数据，不使用真实浏览器 Profile、账户、网络页面或模型密钥。

## 验证

- npm test：动作/URL/schema 校验、隐私、模型协议与超时、执行状态机、确认绑定、停止竞态、白名单。
- npm run check：生产 JS 语法、manifest 资源、git diff、敏感信息检查。
- npm run test:e2e：独立临时 Chromium Profile 加载真实扩展；本地页面与模型 fixture；读→预览→模型→确认→操作→再观察→完成；只读拒绝写入、密码屏蔽、stale、停止、跨站预览。
- 截图仅在忽略的 artifacts 目录用于本地视觉检查。
- 真实用户配置的模型服务不在测试中调用；连通性状态不得由 mock 证明。

## 发布与后续

先 feature branch / draft PR，不直接合并、发布商店或打版本标签。全量 roadmap 保持未完成状态。每阶段记录实际检查，不能先填通过。外部工具与其他功能另开独立分支逐项推进。
