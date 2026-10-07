# iframe / Shadow DOM 需求

状态 Implementation authorized，依据用户全量自主实施指令，不声称逐项确认。

| ID | 需求和验收 |
| --- | --- |
| BF-001 | 同一观察覆盖开放/闭合/嵌套影子根和 slot，隐藏/敏感/编辑区输入值不采集；不绕过站点认证 |
| BF-002 | 影子内 click/fill/select 使用现有元素身份、明确授权和确认；mutation、替换、隐藏 host、目标变化使旧引用拒绝 |
| BF-003 | 可枚举目标页 iframe 元数据并明确选择，默认仅顶层；最多 16 frame，同源/跨源和继承来源的 about:blank/srcdoc 支持；未选择内容不读取 |
| BF-004 | webNavigation 可选权限，UI 仅用户动作申请；拒绝/撤销有提示，顶层功能不依赖它；无历史监听 |
| BF-005 | 模型 list_frames/switch_frame 只访问范围内 frame，切换新文档先预览；点击/填写/选择/滚动对当前 frame，navigate 总是整个标签 |
| BF-006 | 子文档身份绑定 frameId/documentId/top document，确认/执行前复查；重载/替换/父页导航/跨环境变化拒绝旧操作，父页新文档撤销子 frame 范围 |
| BF-007 | 多标签切换与新开恢复顶层 frame；初始页可授权子 frame，其他标签默认顶层；任务结束无自动删除/关闭 frame |
| BF-008 | 视觉仍为整个标签视口，iframe/影子区域遮挡；子 frame 当前任务只用 DOM 操作，不混用顶层视觉坐标 |
| BF-009 | 观察预算 80 元素/12k 文字/30k 节点/64 影子根，超限明确状态；维护独立模块，不给旧大型脚本堆新业务 |
| BF-010 | 真实扩展证明跨源和 srcdoc、closed/slot、敏感过滤、确认/自动授权/失效、未授权拒绝；无真实用户数据或 paid 请求，源码密钥扫描通过 |

iframe 子文档需处于可见父链中，离屏/隐藏时提示先显示，不盲目操作。Chrome 内部页、错误页、无站点权限和特殊 sandbox 不冒充可访问；显示具体失败状态。Canvas/可信输入的边界保留视觉文档。不同标签的复杂 frame 授权可通过先将其选为初始页开启任务，不自动扩展权限。
