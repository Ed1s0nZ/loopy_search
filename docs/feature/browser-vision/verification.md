# 浏览器视觉验证

2026-10-07，分支 codex/browser-vision；代码 5071597，基线 codex/browser-scope-automation / PR #7。本切片验收不代表全量路线或发布。

## 运行结果

- `npm test` 36/36，新增矩形校验、坐标合同、图像消息清理、活动页竞争拒绝、停止后无迟到写入、探测溢出全图遮挡、截图过期以及本机密钥精确匹配遮挡及特殊目标 label 脱敏（不把密钥注入页面）。
- `npm run check` 通过语法/资源/空白/敏感信息扫描；staged hook 通过，真实密钥只从仓库外私有配置读取，值不打印。
- `npm run test:e2e` 27/27（含 2 个根测试），旧 browser 19 + vision 8。临时 Chromium Profile、本地 HTTP 页面与合成服务，无真实账号页数据操作。
- 真实 DeepSeek 图像只读 smoke：一次 finish，输入 833 / 输出 101 tokens；编号仅绘制在 Canvas，不在 DOM 文本，识别编号 42。目标网页写入零。
- 真实 DeepSeek 视觉操作 smoke：模型定位合成蓝色圆形，程序先验证坐标落在圆形安全半径内才确认；一份新截图再次批准后 finish。2 步，输入 1944 / 输出 242 tokens，仅一次本地合成 Canvas 点击。没有真实业务数据写入。
- 本轮真实模型合计 3 个请求，2777 输入 / 343 输出 tokens。未打印模型响应、密钥或图片，不对价格作未验证估计。
- 代码提交 5071597 的 Linux GitHub CI 已 SUCCESS：[run](https://github.com/Ed1s0nZ/loopy_search/actions/runs/37590614231)；后续文档/示例提交仍以最新 head CI 为准。
- 420px light/dark 预览人工检查，无横向溢出，图像、区域、键盘字段、放大及状态可辨；截图在忽略的 artifacts，不提交。

## 需求对应

| ID | 证据 |
| --- | --- |
| BV-001 | DOM prepare 不含 vision；视觉 UI opt-in；实际截图后恢复原活动页测试；范围沿用 browser 源文档和窗口断言 |
| BV-002 | 捕获前后 active/source/probe 校验；活动页竞争 fake API 测试在图像处理前拒绝；尺寸/dpr 严格校验，真实不匹配原图拒绝 |
| BV-003 | 实际像素确认 input、textarea、select、contenteditable、iframe、image、closed 自定义 host 和凭据实心遮挡；手工区域增加/清除保持自动遮挡；1600px 缩放映射像素证明；超过探测边界全图遮挡 |
| BV-004 | 未批准 modelCalls=0；批准后的 image_url 与处理后 preview PNG 完全一致；每动作新图暂停，调用数不增长；旧图 payload 清理与停止释放单元测试 |
| BV-005 | read 拒绝坐标工具；auto 仍 confirmation；遮挡区 BLOCKED；真实 Canvas 事件坐标与批准的 x/y 一致；实际模型选择蓝圆位置 |
| BV-006 | DOM/视口变化拒绝模型发送；Canvas 仅像素重绘也在发送前和确认后 STALE_SNAPSHOT，旧点击无执行；节点命中/签名与私有 token 再验证 |
| BV-007 | 点击后新观察、新 imageId、再次预览；toolResult executed 及 synthetic 字段，最多一个图像消息；无 debugger 或通用执行工具 |
| BV-008 | CAPTURE / STALE_SNAPSHOT / BLOCKED / INVALID_MASK / MODEL_ERROR；非法坐标和遮挡输入单元，旧 DOM 19 E2E 全回归；像素复核不支持的动画站点需手动/DOM |
| BV-009 | 所有自动测试本地/临时 Profile；真实 smoke 也只访问本地 Canvas，测试配置仓库外，finally 删除 Profile；CI 不跑 paid smoke，图片不入 Git |

## 失败与修正记录

早期测试用 Playwright 模拟 viewport，Chrome captureVisibleTab 取实际窗口尺寸，触发 CAPTURE；保留严格拒绝，改测试实际窗口。脚本序列化后对象属性顺序不同，原 JSON viewport 比较误拒绝，改逐字段。UI 测试拖拽前须滚动到截图；恢复活动标签验证以原实际活动页为准（安装页有时是 popup），不假设一定是 assistant。全部修正有后续成功运行，未用降低校验掩盖失败。

## 使用边界

每张图仅内存，不自动落盘；图像内容无法靠 DOM 矩形识别全部业务机密，必须人工检查，可取消发送。非自定义普通元素上的 closed Shadow root、CSS 伪元素、Canvas 内部机密仍可能无法自动识别；此处不声称完成敏感字段/BA-FRAME 全量覆盖。

像素复核是派发前检查，不是冻结页面；变化剧烈/动画导致拒绝是预期。坐标输入是合成事件，不能冒充 trusted 输入。输入框等区域遮挡后不可坐标点击，仍可使用普通 DOM 填写的确认流程。停止不能撤销已派发操作。截图期限 60 秒、任务 16 步/3 分钟，过期后检查页面再重新开始。
