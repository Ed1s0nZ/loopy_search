# iframe / Shadow 实施计划

1. 提取 composed DOM runtime，page-tools 接入遍历/visibility/文本/根 observer；实际 closed root 与 slot 样例证明，原顶层回归。
2. frame-adapter 管理可选权限、元数据、允许 ID/根 documentId；browser 注入指定 documentId/frameId，记录和来源区分顶层/子页。
3. runner/actions 加 frameId、list/switch 工具、prepare frameIds、切换重预览及父导航撤销；privacy 模块只投影脱敏描述，auto 元素权限仍绑定单文档。
4. frame-ui 用户动作请求 optional 权限，列表/checkbox、准备期间锁定、当前 frame 指示及权限失败；服务核验 sender/window/incognito。
5. 新 tests/frames.e2e.js 临时 Profile 与本地跨 host/port、srcdoc、Shadow closed/open/slot、隐藏/敏感、确认后重载、范围拒绝；可选权限测试若使用测试 manifest 预授权须明确记录，不能冒充实际用户权限弹窗证明。
6. 验证 syntax/secret/unit/全 E2E；F4 实现记录与提交推送，F5 README/verification/路线只在证明全 BF 后勾选，F6 changelog/review/draft PR 基于 #8。

每个模块目标 <200 行，旧大文件不堆业务。无需 paid API 测试此结构路由功能。没有自动父页数据改动；点击仅本地 fixture，失败不重试。回退取消 frameIds 或回退切片即原顶层合同。
