# 浏览器视觉辅助交付记录

## F0 接入与门禁

2026-10-07，用户已授权全量最佳实践实施，先浏览器操作，密钥不进入 GitHub，独立环境避免真实数据写入；提交身份 Ed1s0nZ。上一轮 progress：PR #7 当前 OPEN/draft、head 7cc8279，push/PR CI SUCCESS，工作区干净。本分支 codex/browser-vision 基于 #7，依赖提交，不改主分支。

Workflow Gate Report：用户请求浏览器高级操作；阶段 P1/P5/P7；类型截图、模型多模态、隐私与执行 UI。已有 DOM/scope/grants/runner/真实扩展测试；缺截图采集、遮挡、坐标校验、模型图像合同。生产实施须先完成需求/设计/计划，用户既有自主授权覆盖可推断方案。范围是明确启用的视口截图、发送预览、额外遮挡、视觉坐标动作及新截图复核；验证必须证明截图绑定当前页、敏感区域遮挡、未经批准不发送、坐标操作始终确认及失效拒绝。截图可能含无法自动识别的业务机密，预览必须可进一步遮挡。

Maintainability Gate Report：跨模型/执行/隐私/UI，medium；runner 148 行，browser 97 行，page-tools 119 行，旧 popup/content 大文件不改。先独立 vision 页面探测、图像处理、IO 与 UI 模块，不在编排器混入像素算法。允许 feature_after_refactor/adapter_extraction，测试单元策略、实际截图像素、Canvas 合成动作、拒绝旧截图、模型输入、既有回归。禁止默认截图、任意 JS、任意标签捕获和隐藏自动坐标点击。

Feature Lifecycle Report：功能 BA-VISION；当前 F0；默认现有任务不截图，需要视觉判断的页面缺像素上下文。目标按需启用视觉、截图前明确焦点影响、发送前检查与遮挡、坐标后确认实际结果。公开输入新增 vision，工具新增 click_point；模型需支持图像输入。密钥继续后台持有，图像仅内存。F0/F1/F2/F3 分别提交推送；F4 代码与实现，F5 验证使用，F6 changelog/review/draft PR。没有商店发布或主分支合并授权。

## F4 实现与证据

- 新增 vision-page/image/browser/session/ui 五个模块。截图 opt-in，临时聚焦后恢复原活动页；自动遮挡可识别的输入、编辑区、iframe/媒体、Shadow host/自定义元素及常见/本机配置密钥文本。
- 原截图只在本地处理函数，公开预览与模型仅收到处理后 PNG；拖拽或键盘区域、删除/清除额外区域、应用与预览失效、完整尺寸放大检查。未应用区域阻止批准，过期时间可见。
- 视觉消息使用低 detail，旧图替换为文字，结束/停止清理。click_point 始终单次确认；文档/revision/viewport/命中节点验证，发送、确认生成与执行前复核像素，Canvas 像素变化也拒绝。每步重新截图并预览。
- 34 单元测试及 27 实际扩展 E2E（含 2 个根测试）通过，原有功能回归保留。像素测试证明字段/凭据/closed 自定义元素遮挡、追加/清除和缩放坐标；实际 Canvas 坐标、缺批准不发、旧像素拒绝、键盘/放大 UI 都有真实扩展证据。
- 真实 DeepSeek 只读视觉 smoke 一次成功：输入 833、输出 101 tokens，单个 finish，从 DOM 文本不包含的合成 Canvas 识别出编号 42；目标页面写入零。私有配置在仓库外；不记录响应/图像/密钥，不把 synthetic 结果冒充真实模型。
- 早期验证发现 Playwright 模拟视口与 Chrome 实际截图尺寸不匹配，保持生产严格校验，改使用真实窗口尺寸；跨 scripting 的对象属性顺序使 JSON stringify 视口比较误报，改逐字段比较；恢复活动页测试改以实际原活动页为依据，非固定假设 assistant。全部修正复测。
- 本切片没有新权限、第三方依赖、主分支合并或商店发布；原始图像与测试截图均未提交。

## F5 验证与使用文档

- verification.md 映射 BV-001..009，记录真实像素、实际 DeepSeek 识别/坐标操作、真实请求 3 次及总用量，包含失败修正与特殊页面限制。
- 新增可选 test:live-vision-action 示例，仅预先验证本地合成圆形坐标后允许一次 Canvas 点击，不访问实际账号页。README 描述 opt-in、遮挡、键盘/放大、60 秒与合成事件限制。
- 完整路线仅新增 BA-VISION 完成标记；BA-FRAME、TOOLS、REPLAY 与其他类别仍未完成。
