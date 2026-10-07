# 视觉实施计划

1. 新增 vision-page/image/browser 模块；browser.js 仅暴露封装后的 check/invoke/source，保持既有文档校验；纯策略测试与真实像素证明。
2. actions 加入仅确认的 click_point，runner 组合截图/重预览、批准图像消息与清理；服务校验 masks/previewId。现有非视觉合同不变。
3. vision-ui 独立组件，与现有 assistant UI 组合；启用说明、图像预览、指针选框、遮挡删除/清除和失效状态。
4. 独立 tests/vision.e2e.js 合成 Canvas、表单/凭据图块、活动页竞争、视口/节点变化、模型 image parts、确认后 Canvas 结果、新图停止。npm E2E 串行运行所有 *.e2e.js，防焦点竞争。
5. 只读真实模型 smoke 从仓库外私有配置读取，低 detail、小图、一个 finish，无浏览器写入；结果只记 token/成功，图像不提交。
6. F4 代码与实现记录测试后提交推送，F5 需求映射/README/路线证据，F6 changelog/review/draft PR 基于 #7。当前没有合并/发布。

回退：取消视觉或不传 vision 即沿用 DOM 任务。失败不自动重试坐标写入；用户检查页面后重开任务。完整路线仍包括 iframe/Shadow DOM、工具箱、回放等，不减少目标。
