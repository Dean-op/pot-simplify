# Changelog

本项目的重要变更记录在此文件中。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [3.2.0] - 2026-11-08

### 新增

-   译文支持 Markdown 预览与源码切换，支持标题、列表、引用、代码块和 GFM 表格；复制仍保留原始 Markdown。
-   预览禁止原始 HTML 与远程图片加载，仅允许通过默认浏览器打开 HTTP/HTTPS 链接。

### 修复

-   移除 OpenAI 流式译文末尾的临时下划线，避免干扰 Markdown 语法。
-   正确处理 SSE 网络分片与 UTF-8 字符，避免中文、空格和代码内容丢失。
-   翻译请求补充 Markdown 结构保留规则，兼容已有自定义 Prompt。

### 工程

-   新增 Markdown 与流式翻译回归测试，并在打包前执行前端及 Rust 测试。
-   全部架构的安装包构建成功后统一发布，避免提前发布不完整的 Release。

## [3.1.0] - 2026-10-26

### 新增

-   支持截图框选识别二维码，本地解码 `http://` / `https://` 网址后复制到剪贴板并打开默认浏览器。
-   增加二维码识别托盘菜单项和全局热键配置。
-   增加有道翻译与百度翻译服务。
-   增加必应词典与 ECDict 在线查词。

### 优化

-   视觉模型 OCR 支持流式输出，并默认关闭思考模式。
-   发给视觉模型的截图支持按长边缩放并转为 JPEG，减少上传体积。
-   精简为 Windows 专用构建，界面保留简体中文与英文。

### 文档

-   重写 README，补充功能、服务、快速开始、隐私数据、开发构建和已知边界。
-   新增本变更日志。

[3.2.0]: https://github.com/Dean-op/pot-simplify/releases/tag/v3.2.0
[3.1.0]: https://github.com/Dean-op/pot-simplify/releases/tag/v3.1.0
