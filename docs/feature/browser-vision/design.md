# 浏览器视觉合同与设计

输入 requirements.md，沿用用户自主实施授权。新增模块隔离像素处理，不增加旧 content/popup 业务。

## 数据与接口

- `assistant:prepare {vision?:boolean,...}`，默认 false，UI 勾选明确说明激活任务页。启用时后台 tabs.update active + windows.update focused，校验当前活动标签，captureVisibleTab PNG，前后探测同文档/revision/viewport，限制每次截图至少间隔 550ms。
- vision 页面探测通过 ISOLATED world，自包含函数共享 page-tools 的文档与 revision。返回私有 documentToken/pageUrl/revision/viewport {width,height,scrollX,scrollY,dpr} 和遮挡矩形，不提供输入值。
- 自动遮挡包括表单输入/选择/编辑区、iframe、图像/视频、可识别的 Shadow host/自定义元素及匹配常见凭据文本的区域；已配置密钥精确匹配也遮挡。超过探测数量/异常尺寸则整个视口遮挡或拒绝，不能静默省略敏感区。
- 图像处理使用 OffscreenCanvas/createImageBitmap，校验原始截图尺寸与 CSS 视口 × dpr（允许 3px 舍入误差），已缩小基图按 1600 最大边重新验证；总像素 <=16M，遮挡使用实心像素覆盖并向外扩 3px，输出最大边 1600、PNG data URL <=4MB。原始截图只在处理函数临时变量，不返回 UI/model，不落盘。
- `vision` 公开形状 {id,dataUrl,width,height,viewport,maskedCount}；imageId 随机 UUID，坐标仍为 viewport CSS px。私有 capture 身份保存在 browser adapter 内存，有效期 60s；公开图像只在 preview。`assistant:visionMasks {id,previewId,masks:[{x,y,width,height}]}` 最多 32 个手动矩形，从已自动遮挡的基图重新渲染，以支持清除额外遮挡；每次修改使预览 ID 失效。
- `click_point {imageId,x,y}` 两个整数坐标，绑定当前截图。只读拒绝；辅助/auto 都单次确认。后台解析命中按钮/链接/普通字段/role/button/Canvas，拒绝遮挡区、文件、敏感、下载/新窗口链接、隐藏/禁用/非交互区域。capture 保存命中实际节点的 WeakMap identity/指纹；pending 公共目标只有标签和坐标，私有 token 不进模型。
- 确认派发前再次验证活动页、文档、revision、scroll/viewport、命中节点/描述。DOM 节点坐标命中变动也拒绝；Canvas 派发含 clientX/clientY 的 mousedown/mouseup/click 合成事件，明确非 trusted。

## 执行与生命周期

prepare -> observe -> capture -> 本地遮挡预览 -> 可选额外遮挡 -> 批准 -> 模型 multimodal 消息 -> 固定动作 -> 坐标/其他写入确认 -> execute -> observe/capture -> 新图预览。截图模式每动作都重新预览；自动授权不自动批准新图，坐标从不进入元素 grant。

模型文本观察不含 dataUrl；另 user 消息 content parts [{type:text,text:metadata},{type:image_url,image_url:{url:dataUrl,detail:low}}]。多模态图片仅用户已批准时进消息，下一张图替换旧图上下文以限制成本；保留旧图 metadata/工具结果，结束/停止清除图片。没有 vision 时拒绝 click_point。每次新图重置权限与确认。

## 模块

- vision-page.js：页面敏感矩形、viewport/revision、坐标解析与执行。
- vision-image.js：矩形/尺寸校验、自动与手工遮挡、图像编码。
- vision-browser.js：捕获/焦点、活动页一致性、私有身份/TTL、动作确认；browser.js 暴露检查/注入/来源的窄适配接口。
- vision-ui.js：启用、截图显示、指针拖拽遮挡、遮挡列表删除/全部清除、加载/错误/预览与取消。
- runner/actions：编排、图像消息/确认，模块上限优先 <=200 行。

## 风险与恢复

截图可能仍含业务机密，自动遮挡不是保证；用户先审图，仍可选择不发送。活动页或文档变化、捕获超时/尺寸失败则失败，不发旧图。发送前、生成坐标确认前及确认执行前重新采集处理后像素并比较，Canvas 仅像素变化也拒绝；每次捕获后恢复原活动标签，避免独立助手标签被藏到后台。聚焦是用户选择视觉任务后的明确副作用，不对非视觉任务生效。停止防尚未派发动作，已执行动作不可撤销。模型服务不支持多模态时显示 MODEL_ERROR，用户改模型或取消视觉重开。

依据：[Chrome captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)、[Scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)、[OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)、[DeepSeek Vision](https://api-docs.deepseek.com/guides/vision/)。2026-10-07 官方搜索结果显示 deepseek-flash 支持图像；实际接口兼容性需单独只读 smoke，不仅依据文档声称成功。
