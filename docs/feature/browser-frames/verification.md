# iframe / Shadow DOM 验收证据（进行中）

状态：F5 未完成。依据实际测试覆盖，不以代码存在代替用户场景证明。

| 需求 | 当前证据 | 尚需核对 |
| --- | --- | --- |
| BF-001 | 真实 Chrome open/closed/nested/实际 slot、隐藏 host、输入值过滤 | 敏感区域祖先/影子编辑器组合已实际验证，区域文字和字段排除 |
| BF-002 | 真实影子 click/fill/select；mutation、host hidden、节点替换拒绝；自动预算与同节点连续操作 | 新挂载影子根的根集合变化已证明旧引用拒绝 |
| BF-003 | 跨源、同源、srcdoc、about:blank；未选读取拒绝；元数据只枚举 | 嵌套跨源/隐藏祖先证明；当前 Chrome 对 opaque sandbox srcdoc 允许隔离世界观察且只返回其自身 DOM，不声称所有 sandbox 可注入 |
| BF-004 | 默认 manifest optional；真实 Chrome 无权限时 FRAME_PERMISSION，顶层照常；单元拒绝/撤销；UI 同步手势调用和错误显示 | 有界面 Chromium 原生允许、拒绝后再申请、实际撤销清空列表与提示全部验证 |
| BF-005 | 实际助手切换后暂停预览，批准后模型才能看到子内容，填写待单次确认 | 实际 list_frames、子页 scrollY=200 且父页 scrollY 不变、确认后 root navigate 全部验证 |
| BF-006 | 子文档同 URL 重载拒绝；父导航撤销选择；指定 documentIds | 真实 iframe 替换拒绝旧操作/新 frame 不继承选择；跨环境公共 gate 的既有单元证据需最终审阅 |
| BF-007 | 代码在多标签切换/新开/导航恢复 frame 0；既有标签回归通过 | 实际混合标签/子 frame 切换后恢复 0，拒绝旧标签 frameId；新开/关闭路径仍沿用已验证顶层回归 |
| BF-008 | 像素验证 closed/iframe 遮挡；溢出影子宿主的输入和密钥实际遮挡；子页路径清除图像历史 | 真实模型请求证明：子页不含任何 image_url/data:image，回顶层新图与再批准；已验证 |
| BF-009 | 真实 30k 节点和 64 root 超限 DOCUMENT_LIMIT，移除后恢复；80 元素/12k 文字输出上限 | 真实助手界面显示 DOCUMENT_LIMIT；已验证 |
| BF-010 | 隔离临时扩展/Profile/本地 fixture，合成模型；秘密扫描通过 | 完成上述缺口后再判定全量完成 |

专项 tests/frames.e2e.js：预授权临时 manifest 测试实际路由；独立未修改扩展测试默认无权限。**预授权不证明弹窗**。曾在无界面 Chromium 点击生产 loadFrames 申请原生可选权限，30 秒未返回，实验超时后关闭 Profile；没有记成通过，也未用模拟权限替代。此 UI 实验需有界面隔离浏览器补证。

远端 CI：a4b02b7bb2505791897a1cc70598b15f2d8c5787 的 GitHub run 37595363635 SUCCESS；后续新增预算/默认权限测试须等待对应新 head CI，不能复用此结果宣称新 head 成功。

有界面原生权限验证：`node scripts/verify-frame-permission.mjs` 和 `node scripts/verify-frame-permission.mjs --deny-first` 均 exit 0。CUA 实际读到“AI划词搜索请求获得更多权限/读取您的浏览记录”，在临时 Profile 操作允许，以及第二轮拒绝后再允许。脚本通过真实 contains/request/remove、UI 列表与 onRemoved 提示核验，随后关闭 Chromium 并删除 Profile。没有本机真实浏览历史、凭据或模型请求。此补证取代此前 headless 未完成交互；不改 CI 预授权测试的范围说明。
