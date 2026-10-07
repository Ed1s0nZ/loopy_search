# iframe / Shadow DOM 验收证据

状态：F5 本地验收完成；F6 草稿 PR 与对应 head CI 分别记录，不代表已合并或发布。需求为 Implementation authorized，来源为用户自主实施授权。

| 需求 | 权威证据及结论 |
| --- | --- |
| BF-001 | frames.e2e 实际开放/闭合/嵌套根、真实 slot 分发、隐藏 composed 父链、敏感祖先与编辑区过滤，原字段值不采集 |
| BF-002 | 真实影子 click/fill/select；mutation、host hidden、节点替换、新挂载 root 拒绝旧引用；同节点自动连续填写、预算耗尽转确认；原生 disabled fieldset 子控件排除 |
| BF-003 | 同源/跨源/嵌套 iframe、srcdoc、about:blank 的独立观察；未选 frame 拒绝，元数据明确选择最多 16 个；只枚举当前页 |
| BF-004 | 未修改 manifest/Profile 实际 contains=false、FRAME_PERMISSION、顶层可用；有界面原生允许/拒绝后再申请/撤销重置 UI 两次 smoke exit 0 |
| BF-005 | 模型实际 list_frames/switch_frame；子文档预览前不发送内容；填写单次确认；子 frame scrollY=200 且父 scrollY 不变；确认后 navigate 替换整个标签并重预览 |
| BF-006 | 子文档同 URL 重载、iframe 替换、父导航拒绝旧引用；替换后的新 frame 不继承授权；注入锁定 documentIds。browser-scope 单元对非 0 frame 与 metadata catalog 跨窗口/incognito 状态注入前拒绝 |
| BF-007 | 实际切换标签恢复 0，旧标签 frameId 拒绝；从子页新开/关闭均单次确认，新页默认 0，关闭返回原标签 0；原标签 URL 保持 |
| BF-008 | 真实 PNG 像素证明 iframe/closed root、溢出宿主的输入/密钥遮挡；子 frame 请求没有 image_url/data:image，回顶层新 imageId 再批准；坐标动作仅顶层 |
| BF-009 | 30k 节点/64 根超限 DOCUMENT_LIMIT，移除后恢复；输出最多 80 元素/12k 文字；真实 UI 显示错误；生产模块均低于 200 行 |
| BF-010 | 临时 Profile、本地合成 HTTP/模型、无 paid 调用；39 单元/50 扩展测试全通过，syntax/manifest/secret 检查通过；420px light/dark 截图已目视检查 |

执行：`npm run check`、`npm test`、`npm run test:e2e`，全部 exit 0。框架专项包含 22 项（父测试计数）；全扩展 50 项不是 50 个不同页面。临时预授权 manifest 只证明实际 frame 路由，不替代原生权限 UI。独立未修改扩展证明默认权限缺失。

原生权限：`node scripts/verify-frame-permission.mjs` 与 `--deny-first` 均 exit 0。CUA 实际读取“AI划词搜索请求获得更多权限/读取您的浏览记录”，只在临时本地 Profile 允许；第二轮先拒绝，UI notice/contains=false 验证后再申请允许。真实 remove=true、onRemoved 清空列表与撤销提示；脚本关闭 Chromium 并删除 Profile。零模型请求，不访问用户真实历史或凭据。此前 headless 30 秒实验未返回，没有算通过；上述有界面证据补齐该缺口。

边界：当前验证浏览器为本机/CI Playwright Chromium，未以此声称所有 Chrome 版本或其他浏览器兼容。当前 Chrome 允许测试 sandbox="" srcdoc 的隔离世界观察，仅返回自身 DOM；其他不可注入页面显式拒绝，不承诺所有 sandbox 访问。iframe 须可见，操作会短暂激活目标页并恢复原活动页；可信原生输入仍由用户手动执行。密码/编辑区/未知业务机密不能因脱敏而一概声称安全，仍须核对预览。跨普通/无痕任务拒绝；浏览器本地配置共享属于后续 TRUST-13 工作，不在本切片解决。

截图 artifacts/frames-{light,dark}-420.png 为忽略的本地验收输出，没有提交 Git。源码扫描读取本机已配置值用于比对时不输出原值。此次没有使用本机实际 API Key 或真实用户站点。
