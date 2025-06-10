# AI划词搜索 Chrome扩展 (Loopy Search)

<div align="center">
  <img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/icon128.png" width="300px">
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ![Platform](https://img.shields.io/badge/platform-Chrome-brightgreen.svg)
  ![Language](https://img.shields.io/badge/language-JavaScript-blue.svg)
</div>

## 📝 项目简介

AI划词搜索是一个智能的 Chrome 浏览器扩展，它能让你在浏览网页时快速获取 AI 对选中文本的解释和翻译。通过支持 OpenAI 协议，它可以连接到各种 AI 服务，为你提供即时的智能解答。

## ✨ 核心特性

- 🔍 智能划词搜索：选中文本后自动显示 AI 搜索按钮
- 🤖 广泛兼容性：支持 OpenAI API 及所有兼容 OpenAI 协议的服务
- 🔧 高度可定制：支持自定义 API 配置、模型选择和提示词
- 🌐 智能翻译：自动语言检测与多语言翻译支持
- ⌨️ 快捷操作：支持多种快捷键和右键菜单操作
- 📚 历史记录：完整的搜索历史管理与检索功能
## 功能展示
### 配置
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/%E8%AE%BE%E7%BD%AE%E7%95%8C%E9%9D%A2.png" width="300px">  

### 提示词界面
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/%E6%8F%90%E7%A4%BA%E8%AF%8D%E7%95%8C%E9%9D%A2.png" width="300px">  

### 使用
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/%E4%BD%BF%E7%94%A8%E7%95%8C%E9%9D%A2.png" width="800px">  

### 搜索结果
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/%E6%90%9C%E7%B4%A2%E7%95%8C%E9%9D%A2.png" width="400px">  

### 历史记录
<img src="https://github.com/Ed1s0nZ/loopy_search/blob/main/images/%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95%E7%95%8C%E9%9D%A2.png" width="800px">  


## 功能特点

- 划词后自动显示AI搜索按钮
- 支持OpenAI API及兼容OpenAI协议的其他API服务
- 可配置API地址、密钥和模型
- 支持自定义提示词前缀
- 提供右键菜单快速搜索选项
- 支持暗黑模式和跟随系统主题
- 智能语言检测与翻译功能
- 多种快捷键支持
- 历史记录管理与搜索

## 安装方法

### 从Chrome商店安装

*(即将上线)*

### 手动安装

1. 下载此仓库的ZIP文件或克隆仓库到本地
2. 打开Chrome浏览器，进入扩展管理页面：`chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"，选择仓库文件夹
5. 安装完成后，浏览器右上角会出现扩展图标

## 使用方法

1. 安装扩展后，首次启动会自动打开设置页面
2. 配置你的API信息（API地址、密钥、模型等）
3. 在任意网页上选中文本，会在文本旁边显示扩展图标
4. 点击图标，即可获取AI对所选文本的解释
5. 你也可以右键选中文本，点击"使用AI解释"菜单项


### 语言检测与翻译

当选中非中文文本时，扩展会自动检测语言并提供以下选项：
- 解释原文：直接解释原始语言内容
- 翻译成中文：只翻译不解释
- 解释并翻译：先翻译再提供解释

## 配置说明

- **API地址**：OpenAI或兼容OpenAI协议的API地址
- **API密钥**：你的API访问密钥
- **AI模型**：选择使用的AI模型
- **自定义模型**：如果使用的模型不在列表中，可以输入自定义模型名称
- **默认提示词前缀**：向AI发送请求时的前缀提示词
- **界面设置**：
  - 使用Markdown渲染
  - 显示划词按钮
  - 暗黑模式
  - 跟随系统主题
- **历史记录**：
  - 保存历史记录
  - 历史记录保留时间

## 注意事项

- 本扩展需要网络连接才能正常工作
- API请求可能会产生费用，请参考你使用的AI服务提供商的收费标准
- 本扩展不会收集你的个人数据，所有API配置都存储在你的本地浏览器中

## 许可证

MIT 
