# AI划词搜索 Chrome扩展 (Loopy Search)

<div align="center">
  <img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/icon128.png" width="300px">
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ![Platform](https://img.shields.io/badge/platform-Chrome-brightgreen.svg)
  ![Language](https://img.shields.io/badge/language-JavaScript-blue.svg)
</div>

## 📝 项目简介

AI划词搜索是一个智能的 Chrome 浏览器扩展，它能让你在浏览网页时快速获取 AI 对选中文本的解释和翻译。通过支持 OpenAI 协议，它可以连接到各种 AI 服务，为你提供即时的智能解答。不仅如此，它还提供了备忘录、历史记录、编码工具等多种实用功能，让你的浏览体验更加高效。

## ✨ 核心特性

- 🔍 **智能划词搜索**：选中文本后右键显示 AI 搜索按钮
- 🤖 **广泛兼容性**：支持 OpenAI API 及所有兼容 OpenAI 协议的服务
- 🔧 **高度可定制**：支持自定义 API 配置、模型选择和提示词
- 💬 **AI对话**：支持连续对话模式，实现更自然的交互体验
- 📃 **上下文关联**：支持继续提问，并且关联上下文
- 🌐 **智能翻译**：自动语言检测与多语言翻译支持
- 📝 **备忘录功能**：快速记录和管理重要内容
- ⌨️ **快捷操作**：支持多种快捷键和右键菜单操作
- 📚 **历史记录**：完整的搜索历史管理与检索功能
- 🔄 **编码工具**：内置多种编码/解码工具
- 🌍 **网络代理**：支持多种代理配置，解决网络访问限制
- 📡 **HTTP请求工具**：内置HTTP请求发包工具，支持多种请求方法


## 📸 功能展示

### 划词搜索
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/使用界面.png" width="800px">  

### 搜索结果
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/搜索界面.png" width="500px">  

### 设置界面
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/设置.png" width="500px">  

### 提示词管理
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/提示词.png" width="500px">  

### 新建提示词
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/新建提示词.png" width="500px">  

### 备忘录功能
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/备忘录.png" width="500px">  

### AI对话功能
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/对话功能-带记忆.png" width="500px">  

### 历史对话管理
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/对话-历史对话.png" width="500px">  

### 历史记录
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/历史记录.png" width="800px">  

### 编码/解码工具
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/编码解码工具.png" width="500px">  

### 编码/解码类型
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/编码解码-种类.png" width="500px">  

### HTTP请求工具
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/发包工具.png" width="500px">  

### 代理设置
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/代理工具.png" width="500px">  

### 代理模式选择
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/代理模式种类.png" width="500px">  

## 🚀 详细功能

### AI 搜索与翻译
- 划词后自动显示 AI 搜索按钮
- 支持 OpenAI API 及兼容 OpenAI 协议的其他 API 服务
- 智能语言检测与多语言翻译
- 可选择直接解释、仅翻译或解释并翻译
- 支持继续提问，保持对话上下文

### AI 对话
- 独立的对话界面，支持连续对话
- 对话历史保存与管理
- 可创建多个对话主题，方便切换
- 支持一键清空当前对话
- 对话内容支持 Markdown 渲染

### 网络代理设置
- 支持多种代理类型（HTTP、HTTPS、SOCKS）
- 可配置代理服务器地址、端口、用户名和密码
- 支持保存多个代理配置方案，快速切换
- 内置代理连接测试功能
- 可设置特定域名绕过代理

### 备忘录功能
- 快速记录重要内容和想法
- 支持编辑和删除已保存的备忘录
- 一键复制备忘录内容
- 支持导出所有备忘录到本地文件

### 提示词管理
- 预设多种常用提示词模板
- 支持自定义提示词创建和管理
- 按分类组织提示词，方便查找
- 一键应用提示词到当前搜索

### 实用工具集
- 多种编码/解码工具（Unicode、UTF-8、Base64、URL、HTML实体、Hex、二进制等）
- HTTP 请求工具，支持GET、POST、PUT、DELETE等多种请求方法
- 自定义请求头和请求体，支持JSON格式
- 时间戳转换工具
- 响应结果实时显示和复制功能

### 个性化设置
- 可配置 API 地址、密钥和模型
- 支持自定义提示词前缀
- 可自定义划词搜索按钮的显示方式

### 便捷操作
- 右键菜单快速搜索选项
- 多种快捷键支持
- 历史记录管理与搜索
- 一键清空或导出历史记录

## 📥 安装方法

### 从 Chrome 商店安装

*(即将上线)*

### 手动安装

1. 下载此仓库的 ZIP 文件或克隆仓库到本地
2. 打开 Chrome 浏览器，进入扩展管理页面：`chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"，选择仓库文件夹
5. 安装完成后，浏览器右上角会出现扩展图标

## 🔰 使用指南

### 基本使用
1. 安装扩展后，首次启动会自动打开设置页面
2. 配置你的 API 信息（API 地址、密钥、模型等）
3. 在任意网页上选中文本，会在文本旁边显示扩展图标
4. 点击图标，即可获取 AI 对所选文本的解释
5. 你也可以右键选中文本，点击"使用 AI 解释"菜单项

### 语言检测与翻译
当选中非中文文本时，扩展会自动检测语言并提供以下选项：
- **解释原文**：直接解释原始语言内容
- **翻译成中文**：只翻译不解释
- **解释并翻译**：先翻译再提供解释

### 备忘录使用
1. 点击扩展图标，进入扩展弹出窗口
2. 选择"备忘录"选项卡
3. 在输入框中输入内容，点击"保存"按钮
4. 已保存的备忘录会显示在下方列表中
5. 可以对备忘录进行编辑、复制或删除操作
6. 编辑时可以点击"更新"保存修改，或点击"取消"放弃修改

### HTTP请求工具使用
1. 点击扩展图标，进入扩展弹出窗口
2. 选择"请求"选项卡
3. 选择请求方法（GET、POST、PUT、DELETE等）
4. 输入请求URL地址
5. 根据需要添加请求头（JSON格式）
6. 对于POST等方法，可添加请求体内容
7. 点击"发送请求"按钮执行请求
8. 查看响应结果，可一键复制响应内容

### 代理设置使用
1. 点击扩展图标，进入扩展弹出窗口
2. 选择"设置"选项卡，找到"代理设置"部分
3. 选择代理类型（HTTP、HTTPS、SOCKS等）
4. 输入代理服务器地址和端口
5. 如需认证，输入用户名和密码
6. 可以保存当前配置为方案，方便后续快速切换
7. 点击"测试连接"验证代理是否工作正常

## ⚙️ 配置说明

- **API 设置**
  - **API 地址**：OpenAI 或兼容 OpenAI 协议的 API 地址
  - **API 密钥**：你的 API 访问密钥
  - **AI 模型**：选择使用的 AI 模型
  - **自定义模型**：如果使用的模型不在列表中，可以输入自定义模型名称
  - **默认提示词前缀**：向 AI 发送请求时的前缀提示词

- **界面设置**
  - **使用 Markdown 渲染**：启用后，AI 回复将以 Markdown 格式渲染
  - **显示划词按钮**：控制划词后按钮的显示方式

- **代理设置**
  - **代理类型**：HTTP、HTTPS、SOCKS5等多种代理类型
  - **代理服务器**：代理服务器地址和端口
  - **认证信息**：代理服务器用户名和密码（如需要）
  - **代理配置方案**：可保存多套代理配置，便于快速切换
  - **代理测试**：测试当前代理配置的连接状态

- **历史记录设置**
  - **保存历史记录**：是否保存搜索历史
  - **历史记录保留时间**：设置历史记录的自动清理时间

## 📢 注意事项

- 本扩展需要网络连接才能正常工作
- API 请求可能会产生费用，请参考你使用的 AI 服务提供商的收费标准
- 本扩展不会收集你的个人数据，所有 API 配置和备忘录内容都存储在你的本地浏览器中
- 建议定期导出重要的备忘录内容，以防数据丢失

## 📄 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 贡献与反馈

欢迎提交问题报告、功能请求或贡献代码。如有任何建议或问题，请通过 GitHub Issues 与我们联系。
