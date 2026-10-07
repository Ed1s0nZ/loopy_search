# iframe / Shadow DOM 交付自检

范围：codex/browser-vision..codex/browser-frames 的生产模块、manifest、测试、文档。这是实现者自检，不冒充独立评审或已获 GitHub approval。

结论：本地验收通过，可提交草稿 PR；合并/发布未执行，PR 的最终 head CI 另核验。BF-001..010 的逐条证据见 verification.md。完整 Swiss army knife 路线仍有未完成项。

- Chrome 绑定：先校验窗口、普通/无痕及任务标签，再查可选权限/当前框架目录；frame 范围绑定根 documentId，操作锁定 Chrome documentIds。父导航、子重载、iframe 替换、未选范围都实际拒绝，不自动重试写入。
- DOM 绑定：composed slot/closed root 由独立预算遍历处理，MutationObserver 与根集合变化共同撤销旧快照；原生 :disabled、敏感祖先、隐藏/编辑值过滤；同节点自动授权和替换拒绝实际验证。
- 同意链：新文档预览、单次操作确认、自动授权预算/撤销仍由既有 runner 管理。新开/关闭、视觉点始终确认；子 frame 禁止顶层视觉点、清图片历史，回顶层新图再预览。
- 隐私：不接受模型 JS/selector/documentId；密钥不注入网页，URL 含已配置凭据/编码形式也过滤。iframe 和影子区域、溢出文字/字段由实际 PNG 验证遮挡。源码扫描通过，图片/真实私有配置未提交。
- 维护：runtime、adapter、frame UI 独立，所有生产 assistant 模块小于 200 行；未给旧 popup/content 大文件新增业务。文档与固定工具 schema/提示对齐，无新增 debugger 权限或历史事件监听。

自检发现并修复：闭合 slot 父链隐私遗漏、影子溢出文字脱敏、opaque key URL 路径过滤、刷新目标旧目录、root-only scope 收缩、disabled fieldset 子控件误列。每项有实际/单元回归，无已知未修复本切片 blocker。

验证：39 单元、50 扩展；check/secret/whitespace 全通过。原生 grant/deny/retry/remove 两次有界面临时 Profile smoke exit 0。420px light/dark 真实 UI 已目视检查；图片仅 ignored artifacts。付费 API 调用 0、真实用户站点写入 0。

限制保留：可见框架、特殊不可注入页显式失败、Chrome 当前测试版本而非全浏览器兼容、合成输入不等价 trusted 原生输入、预览不能保证识别全部业务机密；本地配置跨无痕共享留在 TRUST-13。本切片不增加下载/文件上传或站点认证绕过。
