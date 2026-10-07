# 全量升级交付清单

用户授权：所有前述候选功能按最佳实践完成；AI 操作浏览器优先；API Key 等敏感信息不得上传 GitHub。

状态以代码和验证证据为准。`[ ]` 未完成，`[x]` 有交付证据；不能因为完成一部分就标整类完成。外部依赖与浏览器限制必须实现可用配套方案或明确请求必要条件，不以空入口冒充功能。

## 01 AI 浏览器助手（当前）

BA-AUTO / BA-MULTI 交付证据：[范围与自动授权验证](feature/browser-scope-automation/verification.md)。自动策略为元素/动作/次数/时限授权，其余写入逐次确认。

- [x] BA：首切片的侧栏、顶层 DOM 观察、自然语言、受控操作、确认、停止、范围、隐私、内存轨迹、失败后重启、自动验证；证据见 docs/feature/browser-assistant/verification.md。高级能力如下仍未完成。
- [x] BA-AUTO：明确授权范围内的连续自动模式与可配置确认策略
- [x] BA-MULTI：多标签页操作与范围授权
- [ ] BA-VISION：截图/视觉辅助与可验证操作
- [ ] BA-FRAME：iframe/Shadow DOM 覆盖
- [ ] BA-TOOLS：调用代理、转换、请求、笔记、项目工具
- [ ] BA-REPLAY：操作配方、回放与断点接管

## 02 信任、隐私、稳定性（所有阶段贯穿）

- [ ] TRUST-01 按需权限
- [ ] TRUST-02 站点启停
- [ ] TRUST-03 数据流预览
- [ ] TRUST-04 敏感字段管理
- [ ] TRUST-05 默认脱敏导出
- [ ] TRUST-06 安全内容渲染
- [ ] TRUST-07 草稿与异常恢复
- [ ] TRUST-08 存储容量管理
- [ ] TRUST-09 脱敏诊断日志
- [ ] TRUST-10 配置迁移
- [ ] TRUST-11 数据删除与保留
- [ ] TRUST-12 加密备份
- [ ] TRUST-13 无痕策略
- [x] TRUST-14 提交/CI 敏感信息扫描（源码及暂存区；不等同于所有二进制内容和所有凭据类型审计）

## 03 代理对标 Omega

- [ ] PROXY-01 情景模式
- [ ] PROXY-02 快切与徽标
- [ ] PROXY-03 自动分流
- [ ] PROXY-04 当前域名规则
- [ ] PROXY-05 临时规则
- [ ] PROXY-06 分流规则测试
- [ ] PROXY-07 冲突诊断
- [ ] PROXY-08 健康检查
- [ ] PROXY-09 PAC 编辑校验
- [ ] PROXY-10 订阅与回退
- [ ] PROXY-11 Omega 导入
- [ ] PROXY-12 项目代理绑定
- [ ] PROXY-13 故障策略
- [ ] PROXY-14 环境快照
- [ ] PROXY-15 认证修正与协议验证

## 04 智能入口与 UI

- [ ] ENTRY-01 文本类型识别
- [ ] ENTRY-02 动态划词菜单
- [ ] ENTRY-03 自定义搜索引擎
- [ ] ENTRY-04 选区发送工具
- [ ] ENTRY-05 命令面板
- [ ] ENTRY-06 收藏与最近工具
- [ ] ENTRY-07 上下文选择
- [ ] ENTRY-08 链接右键
- [ ] ENTRY-09 图片 OCR/二维码/证据
- [ ] ENTRY-10 自定义动作
- [ ] UI-01 快捷弹窗/侧栏/完整工作台布局
- [ ] UI-02 统一组件、主题与紧凑模式
- [ ] UI-03 技术编辑器与完整状态
- [ ] UI-04 键盘、无障碍、响应式
- [ ] UI-05 常驻项目/代理/模型状态

## 05 本地处理工具箱

- [ ] TOOL-01 多步编码
- [ ] TOOL-02 转换配方
- [ ] TOOL-03 编码候选
- [ ] TOOL-04 JWT 解析
- [ ] TOOL-05 JWT 验签
- [ ] TOOL-06 URL 分析
- [ ] TOOL-07 JSON 工具
- [ ] TOOL-08 文本差异
- [ ] TOOL-09 正则工作台
- [ ] TOOL-10 哈希计算
- [ ] TOOL-11 HMAC
- [ ] TOOL-12 时间工具
- [ ] TOOL-13 数据提取去重
- [ ] TOOL-14 格式转换
- [ ] TOOL-15 Hex/字节
- [ ] TOOL-16 Unicode 分析
- [ ] TOOL-17 压缩解压
- [ ] TOOL-18 IP/CIDR
- [ ] TOOL-19 文本批处理
- [ ] TOOL-20 二维码

## 06 HTTP/API 工作台

- [ ] HTTP-01 cURL 导入导出
- [ ] HTTP-02 参数/头/Body 编辑器
- [ ] HTTP-03 多 Body 类型与文件
- [ ] HTTP-04 环境变量
- [ ] HTTP-05 请求集合
- [ ] HTTP-06 超时取消重试
- [ ] HTTP-07 响应分栏与指标
- [ ] HTTP-08 响应差异
- [ ] HTTP-09 历史快照
- [ ] HTTP-10 Cookie 策略
- [ ] HTTP-11 认证助手
- [ ] HTTP-12 HAR 分析
- [ ] HTTP-13 OpenAPI 导入
- [ ] HTTP-14 请求链
- [ ] HTTP-15 断言
- [ ] HTTP-16 受控批量执行
- [ ] HTTP-17 GraphQL
- [ ] HTTP-18 WebSocket
- [ ] HTTP-19 SSE
- [ ] HTTP-20 请求代码生成

## 07 项目与证据

- [ ] PROJECT-01 项目空间
- [ ] PROJECT-02 目标范围
- [ ] PROJECT-03 结构化笔记
- [ ] PROJECT-04 证据卡片
- [ ] PROJECT-05 截图标注打码
- [ ] PROJECT-06 时间线
- [ ] PROJECT-07 漏洞条目
- [ ] PROJECT-08 报告模板
- [ ] PROJECT-09 项目打包
- [ ] PROJECT-10 内容哈希
- [ ] PROJECT-11 标签全文检索
- [ ] PROJECT-12 跨项目知识
- [ ] PROJECT-13 备份恢复

## 08 页面与前端资产

- [ ] PAGE-01 页面资源
- [ ] PAGE-02 表单分析
- [ ] PAGE-03 外部域名
- [ ] PAGE-04 参数端点提取
- [ ] PAGE-05 脚本搜索
- [ ] PAGE-06 JS 美化
- [ ] PAGE-07 技术指纹及依据
- [ ] PAGE-08 Source Map 线索
- [ ] PAGE-09 DOM 助手
- [ ] PAGE-10 快照比较
- [ ] PAGE-11 隐藏字段
- [ ] PAGE-12 资源导出

## 09 会话与存储

- [ ] SESSION-01 Cookie 管理
- [ ] SESSION-02 属性检查
- [ ] SESSION-03 变化记录
- [ ] SESSION-04 Local/Session Storage
- [ ] SESSION-05 存储快照恢复
- [ ] SESSION-06 Token 生命周期
- [ ] SESSION-07 站点数据清理
- [ ] SESSION-08 多角色对比
- [ ] SESSION-09 独立浏览器环境协作

## 10 被动检查与验证

- [ ] CHECK-01 安全头
- [ ] CHECK-02 CSP
- [ ] CHECK-03 CORS
- [ ] CHECK-04 混合内容
- [ ] CHECK-05 敏感信息线索
- [ ] CHECK-06 前端危险用法
- [ ] CHECK-07 权限差异矩阵
- [ ] CHECK-08 缓存分析
- [ ] CHECK-09 重定向
- [ ] CHECK-10 公开文件（主动触发）
- [ ] CHECK-11 测试清单
- [ ] CHECK-12 验证记录
- [ ] CHECK-13 测试样例

## 11 情报与 OSINT

- [ ] INTEL-01 IP/ASN
- [ ] INTEL-02 DNS
- [ ] INTEL-03 RDAP
- [ ] INTEL-04 证书透明度
- [ ] INTEL-05 哈希信誉
- [ ] INTEL-06 URL/域名信誉
- [ ] INTEL-07 CVE 与公告
- [ ] INTEL-08 IOC 提取
- [ ] INTEL-09 去活化恢复
- [ ] INTEL-10 查询模板
- [ ] INTEL-11 缓存/来源/时间
- [ ] INTEL-12 实体关联

## 12 AI 安全与开发助手

- [ ] AI-01 场景模板
- [ ] AI-02 上下文附件
- [ ] AI-03 多服务/模型
- [ ] AI-04 流式/停止
- [ ] AI-05 脱敏预览
- [ ] AI-06 来源关联
- [ ] AI-07 代码日志解释
- [ ] AI-08 请求差异解释
- [ ] AI-09 公告阅读
- [ ] AI-10 报告草稿
- [ ] AI-11 结构化输出
- [ ] AI-12 项目知识检索
- [ ] AI-13 提示词版本
- [ ] AI-14 用量成本

## 13 DevTools 与调试

- [ ] DEBUG-01 DevTools 面板
- [ ] DEBUG-02 请求送入工作台
- [ ] DEBUG-03 网络搜索
- [ ] DEBUG-04 时序分析
- [ ] DEBUG-05 请求头规则
- [ ] DEBUG-06 重定向/阻断
- [ ] DEBUG-07 UA 方案
- [ ] DEBUG-08 控制台材料
- [ ] DEBUG-09 前后状态
- [ ] DEBUG-10 临时规则到期与关闭

## 14 本地与外部协作

- [ ] BRIDGE-01 Burp/ZAP 交换与配套接口
- [ ] BRIDGE-02 本地任务入口
- [ ] BRIDGE-03 文件分析
- [ ] BRIDGE-04 本地代理
- [ ] BRIDGE-05 内部知识库
- [ ] BRIDGE-06 工单草稿
- [ ] BRIDGE-07 笔记连接
- [ ] BRIDGE-08 本地 AI
- [ ] BRIDGE-09 结果标准化

## 15 工作流自动化

- [ ] FLOW-01 配方
- [ ] FLOW-02 参数化
- [ ] FLOW-03 本地批量
- [ ] FLOW-04 运行记录
- [ ] FLOW-05 暂停取消重跑
- [ ] FLOW-06 分支条件
- [ ] FLOW-07 页面变化监测
- [ ] FLOW-08 情报规则更新
- [ ] FLOW-09 项目检查任务

## 16 日常阅读与开发

- [ ] DAILY-01 阅读模式
- [ ] DAILY-02 双语阅读
- [ ] DAILY-03 摘要摘录
- [ ] DAILY-04 报错助手
- [ ] DAILY-05 文档生成请求
- [ ] DAILY-06 结构化提取导出
- [ ] DAILY-07 Markdown 剪藏
- [ ] DAILY-08 OCR
- [ ] DAILY-09 项目标签页
- [ ] DAILY-10 表单测试数据
- [ ] DAILY-11 前端质量检查
- [ ] DAILY-12 文档变化比较

## 完成标准

每项必须有可操作 UI 或明确公共入口、输入校验、失败状态、权限/敏感数据说明、相关自动验证和可复核的运行证据。用户明确要求的敏感信息约束贯穿所有阶段。受外部账号、服务或本地宿主影响的能力记录具体依赖和未完成证据，不用 mock 成功宣称真实服务可用。
