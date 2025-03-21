# 浏览器资源抓取与下载工具

这是一个用于谷歌浏览器的脚本工具，能够拦截浏览器的网络请求，抓取视频、音频等资源数据，并通过弹出页面（Popup）与用户交互，允许用户下载他们感兴趣的资源到本地。项目目前支持视频和音频资源的抓取，并欢迎更多开发者参与完善和扩展功能。

---

## 功能特性

- ​**网络请求拦截**：实时监听浏览器的网络请求，抓取视频、音频等资源。
- ​**资源抓取**：自动识别并抓取网页中的视频和音频资源。
- ​**用户交互**：通过 Popup 页面展示抓取的资源，用户可以选择下载。
- ​**下载功能**：支持将抓取的资源下载到本地电脑。
- ​**扩展性强**：项目代码结构清晰，易于扩展支持更多资源类型（如图片、文档等）。

---

## 安装与使用

### 安装步骤

### 1. ​**下载项目代码**：
   ```bash
   git clone https://github.com/getabear/ResourceHunter.git
   ```
### 2. **​加载扩展**：

- 打开 Chrome 浏览器，进入 chrome://extensions/。
- 启用右上角的“开发者模式”。
- 点击“加载已解压的扩展程序”，选择项目根目录。
### **​使用工具**：
- 打开任意网页，点击浏览器工具栏中的扩展图标。
- 在 Popup 页面中查看抓取的资源，并选择下载。

**目录结构**
```bash
🌳 css/
  - popup.css   # 样式文件     

🌳 img/         # 图标
  - nodata.svg  
  - video.svg

🌳 js/         
  - background.js               # 拦截网络请求
  - content.js                  # 暂时未使用
  - functools.js                # 一些常用函数
  - handle_resource.js          # 资源过滤， 以及资源添加
  - m3u8download.js             # 下载m3u8，同时将齐转换为mp4
  - popup.js                    # 用户交互页面逻辑
  - util.js                     # 常用工具函数

🌳 lib/                         # 库文件

📄 manifest.json                # 浏览器配置文件

📄 popup.html                   # 交互页面
```


### **如何贡献**
我们欢迎任何形式的贡献！无论是代码改进、功能扩展、文档完善，还是提出问题和建议，都可以帮助项目变得更好。

### **贡献步骤**
**​Fork 项目：**

点击右上角的“Fork”按钮，将项目复制到你的 GitHub 账户。
​克隆你的 Fork：
```bash
git clone https://github.com/getabear/ResourceHunter.git
``` 
**​创建分支：**

```bash
git checkout -b feature/your-feature-name
```
**​提交更改：**

完成代码修改后，提交更改：
```bash
git add .
git commit -m "描述你的更改"
```
**​推送分支：**

```bash
git push origin feature/your-feature-name
```
**​提交 Pull Request：**

在你的 GitHub 仓库页面，点击“New Pull Request”，提交你的更改。
### **待实现功能**

- ​支持更多资源类型：如图片、PDF、文档等。
- 资源预览功能：在 Popup 页面中直接预览视频和音频。
- 批量下载：支持用户一次性下载多个资源。
- 跨平台支持：扩展到其他浏览器（如 Firefox、Edge）。
- 用户设置：允许用户自定义抓取规则和下载路径。