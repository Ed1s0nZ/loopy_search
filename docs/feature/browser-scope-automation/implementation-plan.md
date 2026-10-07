# 实施计划

分支 codex/browser-scope-automation；依赖 PR #6；用户已授权按最佳实践实施。

| 顺序 | 文件 | 工作 | 验证 |
| --- | --- | --- | --- |
| 1 | scope.js / grants.js / policy.js | 标签范围与自动授权纯策略、新工具合同 | Node 范围/次数/期限/撤销/伪造输入测试 |
| 2 | page-tools.js / privacy.js / browser.js | 稳定元素与文档身份、浏览器适配、标签创建/关闭验证 | DOM 身份、reload、元素替换、窗口/环境、取消测试 |
| 3 | runner.js / service.js / model.js | 多标签编排、预览重授权、自动执行和确认、状态投影 | 任务级正负路径与停止竞态 |
| 4 | scope-ui.js / assistant.html/js/css | 标签选择、权限与预算控件、当前范围/撤销显示 | 实际 UI 路径、窄布局和明暗截图 |
| 5 | tests / scripts / README / docs / CHANGELOG | 真实扩展集成、使用指南、阶段证据、draft PR | 全套测试、secret scan、远端 CI |

测试只使用新建的临时 Chromium Profile、本地服务器、合成模型；不读取仓库外真实密钥、不调用 DeepSeek，无真实业务数据改动。现有 read/assist 和单标签 E2E 必须保持通过。

关键否定证明：未选页不读；同 URL reload 不沿用旧批准；DOM 替换不继承权限；非授权工具需单次确认；预算耗尽/期限到/撤销后不能自动写；关闭确认过期不关闭新内容；停止后模型迟到不执行。新开/关闭测试仅针对 fixture 标签。

回滚：禁用新增 UI 模式和工具；保留文档身份改进及密钥保护。不会恢复内容脚本直接读密钥。完整目标仍按 docs/roadmap.md 保存。
