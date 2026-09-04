<img width="140px" src="public/icon.svg" align="left"/>

# pot-simplify

> 专为 Windows 平台打造的划词翻译与截图文字识别工具，轻量、极速、低资源占用。

![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-1.8-blue?logo=tauri)
![Windows](https://img.shields.io/badge/Windows%20only-0078D4?logo=windows&logoColor=white)

<br/>
<hr/>

## 基本介绍

**pot-simplify** 是一个专为 Windows 平台深度精简和优化的桌面翻译与 OCR 工具，Fork 自开源项目 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) v3.0.7。

本项目围绕 **“核心聚焦、开箱即用、极速响应”** 的理念，剔除了冗余繁杂的跨平台抽象、插件系统、无鉴权本地 HTTP 服务与臃肿的第三方离线包，专注于日常查词、翻译与多模态 LLM 提速体验。

### 相对上游的主要差异

| 维度 | 上游 (pot-desktop) | 本项目 (pot-simplify) |
| --- | --- | --- |
| **支持平台** | Windows / macOS / Linux | 专注 Windows，仅打包 NSIS 安装包 |
| **翻译服务** | 21 个内置服务 + 外部插件 | 精简为 5 个核心服务，云端统一走 OpenAI 兼容端点 |
| **文字识别** | 15 个内置服务 + 外部插件 | 精简为 2 个：Windows 系统 OCR + LLM 视觉 OCR |
| **离线语种检测** | 22 个语种模型（体积约 20MB） | 精简 lingua 至中日英 3 语种模型（体积压缩至 1.18MB） |
| **界面语言** | 19 种多语言支持 | 精简按需加载，仅保留简体中文与英文 |
| **设置项** | 8 项繁杂设置 | 精简为 5 项：常规 / 翻译 / 文字识别 / 热键 / 服务 |

> 彻底移除了外部插件系统、本地无鉴权 HTTP 端口（60828）、自动更新服务、设置备份同步、关于页、生词本、网络代理配置以及 4MB 的 Tesseract WASM 文件。

---

## 核心功能

### 1. 划词与输入翻译
- **OpenAI 兼容端点**：内置阿里百炼、硅基流动、OpenAI 三大服务商预设，亦可自由填写任意兼容端点；支持一键拉取模型列表；支持按需添加多个服务实例。
- **思考模式优化**：针对 DeepSeek、百炼等推理模型支持强制关闭思考链，消除短句翻译时的无谓 Token 消耗，实现首字毫秒级秒出。
- **谷歌翻译容灾轮换**：按 `translate.googleapis.com` → `clients5.google.com` → `translate.google.com` 顺序自动轮换，避免单节点触发 429 访问受限。
- **高可用词典查询**：
  - **Bing 词典**：抓取必应官方网页词典，支持美英音标、真人发音音频、词性释义、词形变形及双语例句。
  - **ECDict(在线)**：基于有道开放接口提供稳定查词支持，具备丰富的汉英/英汉释义、音标发音与例句。
  - **剑桥词典**：抓取剑桥官方双语词典，提供权威释义。
- **长句自动识别与过滤**：智能判断输入文本，段落与长句子自动跳过词典接口请求，既杜绝无效网络流量与报错，又保持界面整洁优雅。
- **离线语音朗读**：基于 WebView2 原生语音合成（SpeechSynthesis），离线调用系统语音库，免费零依赖。

### 2. 截图文字识别 (OCR)
- **Windows 系统 OCR**：直接调用 Windows 原生 WinRT `Windows.Media.Ocr`，毫秒级快速返回，无需联网，离线且零额外模型体积。
- **LLM 视觉多模态识别**：
  - 支持调用 Qwen-VL 等视觉大模型识别图中文本；
  - **图片长边自动缩放**：超过设定尺寸（默认 2048px）自动压缩分辨率，大幅减少 Token 计费与网络上传开销；
  - **流式输出 (SSE)**：文字边识别边输出，显著缩短首字呈现时间。

### 3. 系统集成与交互体验
- **剪贴板监听**：开启后复制任意文字自动触发翻译。
- **全局快捷键**：支持划词翻译、输入翻译、截图 OCR、截图翻译四大核心功能一键呼出。
- **多显示器自适应**：精准计算 DPI 与屏幕边界，弹窗自动跟随光标且贴边防溢出。

---

## 快速开始

### 安装方式

你可以通过以下三种途径获取安装包：

1. **从 Releases 下载**：
   - 访问仓库 Releases 页面下载最新发布的 `pot-simplify_<版本>_x64-setup.exe`。
2. **从 GitHub Actions 下载**：
   - 进入 Actions 页面选择最新的构建记录，在页面底部 `Artifacts` 中直接下载构建产物压缩包。
3. **本地编译构建**：
   - 参考后文常用命令进行本地源码打包。

### 初始配置指南

安装完成后，建议依次完成以下初始化配置：
1. **热键设置**（设置 → 热键）：配置你顺手的全局快捷键（默认留空，需自行分配），常用包括「划词翻译」与「截图 OCR」。
2. **服务配置**（设置 → 服务）：添加 OpenAI 兼容服务并填入 API Key，选择翻译与识别所需的大模型。
3. **开机自启**（设置 → 常规）：根据需要选择是否跟随 Windows 登录自启动。

> [!IMPORTANT]
> **旧版升级须知**：
> - 可执行文件已从 `pot.exe` 更名为 `pot-simplify.exe`。若曾安装过官方旧版，建议先在系统「应用和功能」中卸载旧版。
> - 配置数据与日志依然保存在 `%APPDATA%\com.pot-app.desktop`，升级安装后历史 API Key 与热键配置将完整保留。

---

## 常用命令

开发与维护常用的脚本与命令一览：

### 环境要求
- **Node.js** >= 18
- **pnpm** >= 9
- **Rust** >= 1.80.0
- **Visual Studio MSVC** C++ 构建工具链

### 常用命令列表

```powershell
# 1. 依赖安装
pnpm install

# 2. 启动开发模式（前端 + Tauri 桌面容器）
pnpm tauri dev

# 3. 仅启动前端 Vite 开发服务器
pnpm dev

# 4. 前端打包编译测试
pnpm build

# 5. Rust 后端类型与编译检查
cargo check --manifest-path src-tauri/Cargo.toml

# 6. 打包 Windows 生产发布包 (NSIS 安装包)
pnpm tauri build
# 构建产物位于: src-tauri/target/release/bundle/nsis/

# 7. 运行项目全量校验（版本号对齐 + 依赖锁定校验 + 前端编译 + Cargo 检查）
.\.scripts\verify.ps1

# 8. 由 SVG 源文件重新生成各尺寸应用图标
python .\.scripts\gen_icon.py
```

### 全局快捷键功能说明

| 快捷动作 | 默认触发行为 |
| --- | --- |
| **划词翻译** | 选中文本后按下快捷键，自动读取屏幕选区文字并呼出翻译窗 |
| **输入翻译** | 呼出空白翻译卡片，输入文本并按回车直接翻译 |
| **截图 OCR** | 唤起全屏半透明选区截图，框选文本后完成文字识别 |
| **截图翻译** | 框选屏幕指定文字区域，完成识别后无缝进行翻译 |

---

## 开源说明

本项目采用 **GPL-3.0** 开源许可证，遵循并继承上游项目许可。

### 致谢
- [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) —— 优秀的开源跨平台翻译应用，本项目之上游基础
- [Bob](https://github.com/ripperhe/Bob) —— 优秀的 macOS 查词工具与交互灵感来源
- [Tauri](https://github.com/tauri-apps/tauri) —— 安全轻量且高性能的桌面端混合框架
- [lingua-rs](https://github.com/pemistahl/lingua-rs) —— 精准的离线自然语言识别库

