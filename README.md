# pot-simplify

<img src="public/icon.svg" width="80" height="80" alt="pot-simplify 图标" />

pot-simplify 是一个 Windows 桌面翻译与识别工具：选中文字就能翻译，框选屏幕就能提取文字、翻译图片，或读取二维码网址，不必反复切换到网页。它基于 [Pot](https://github.com/pot-app/pot-desktop) 精简，移除了服务插件系统、本地 HTTP 服务和自动更新，围绕日常翻译与识别保留功能，并加入 Markdown 译文预览。

-   **快捷翻译**：支持划词、输入和截图翻译，多个服务的结果可以并列展示、拖动排序。
-   **Markdown**：译文支持标题、列表、引用、代码块和表格；可切换源码，复制时仍保留原始 Markdown。
-   **两种 OCR**：使用 Windows 本机 OCR，或接入支持图片输入的 OpenAI 兼容视觉模型。
-   **本地扫码**：截图框选二维码，在本机解码 HTTP/HTTPS 网址，复制链接并打开默认浏览器。
-   **模型接入**：内置阿里百炼、硅基流动和 OpenAI 地址预设，支持自定义端点、模型列表、Prompt 和流式输出。
-   **Windows**：发布 x64、x86、ARM64 安装包，每种架构提供普通版和内置固定 WebView2 运行时版。

## 使用示例

先设置对应热键，就能完成这些操作：

```text
文档中的句子 → 选中文字 → 划词翻译热键 → 查看译文
图片中的文字 → 文字识别热键 → 框选区域 → 复制识别结果
屏幕上的外文 → 截图翻译热键 → 框选区域 → 查看译文
屏幕上的二维码 → 识别二维码热键 → 框选完整二维码 → 复制网址并打开浏览器
```

> **扫码成功后会自动打开网址。** 请只扫描可信来源的二维码；非 HTTP/HTTPS 内容不会被当作链接打开。

[下载最新版](https://github.com/Dean-op/pot-simplify/releases/latest) · [查看更新记录](CHANGELOG.md) · [反馈问题](https://github.com/Dean-op/pot-simplify/issues)

## 目录

-   [安装与首次使用](#安装与首次使用)
-   [翻译与识别服务](#翻译与识别服务)
-   [使用边界与隐私](#使用边界与隐私)
-   [开发与验证](#开发与验证)
-   [版本与发布](#版本与发布)
-   [常见问题](#常见问题)
-   [上游与许可证](#上游与许可证)

---

## 安装与首次使用

### 1. 选择安装包

打开 [Releases](https://github.com/Dean-op/pot-simplify/releases/latest)，在 **Assets** 中下载与你的 Windows 架构对应的 `setup.exe`。

| 架构    | 适用设备               |
| ------- | ---------------------- |
| `x64`   | 64 位 Intel / AMD 电脑 |
| `arm64` | ARM64 Windows 设备     |
| `x86`   | 32 位 Windows 设备     |

**优先选择普通版。** 普通版使用系统 WebView2；如果没有安装，安装器通过内置引导程序联网安装运行时。已有运行时的电脑不需要下载完整的内置运行时包。

文件名包含 `_fix_webview2_runtime-setup.exe` 的版本自带固定 WebView2，适合无法在线安装运行时的环境。当前仓库使用的固定版本为 `109.0.1518.78`，并非最新浏览器内核；可以正常使用系统运行时的环境建议选择普通版。

> 从上游 Pot 迁移时，先退出旧应用并备份配置，再卸载旧版、安装本分支。两者共用配置标识，历史配置可以继续读取，但上游已被移除的服务插件不能在本分支使用。

### 2. 完成首次配置

1. 安装并启动 `pot-simplify`。首次运行会打开设置窗口；之后可从系统托盘打开 **偏好设置**。
2. 在 **常规** 中选择界面语言。默认界面为英文，可切换为中文。
3. 在 **热键** 中为需要的动作设置快捷键，并点击对应的保存按钮。**所有全局热键默认留空，不会自动生效。**
4. 在 **服务** 中选择翻译与识别服务。未配置时，翻译列表默认为有道、Google 和 ECDict，OCR 默认为系统 OCR。
5. 使用系统 OCR 时，在 Windows 中安装目标语言的 OCR 功能；使用视觉模型 OCR 时，添加对应服务并填写端点、API Key 和模型。
6. 按需在 **翻译**、**文字识别** 中设置目标语言、自动复制、窗口关闭行为等选项。

无需使用大模型时，可以先使用免密钥翻译通道与系统 OCR。免密钥不等于离线，在线服务的可用性仍取决于网络和服务商。

### 3. 开始使用

| 动作       | 操作与结果                                   |
| ---------- | -------------------------------------------- |
| 划词翻译   | 选中文字，按热键打开翻译窗口                 |
| 输入翻译   | 按热键或使用托盘菜单，输入文本后翻译         |
| 文字识别   | 按热键或使用托盘菜单，拖动框选屏幕区域后识别 |
| 截图翻译   | 框选屏幕文字，先 OCR，再将结果送入翻译窗口   |
| 识别二维码 | 框选完整二维码，识别到网址后复制并打开浏览器 |

右键托盘图标还可以切换剪贴板监听、自动复制模式，打开设置与日志，或退出程序。**关闭窗口不会退出应用**；结束后台运行请使用托盘菜单的“退出”。

## 翻译与识别服务

### 翻译

| 服务           | 需要配置                                 | 适合的用途                           |
| -------------- | ---------------------------------------- | ------------------------------------ |
| 有道翻译       | 可免密钥；也可填写有道智云 AppKey / 密钥 | 日常翻译，配置凭据后使用官方 OpenAPI |
| 百度翻译       | App ID / 密钥                            | 使用百度翻译开放平台                 |
| Google 翻译    | 可免密钥；支持自定义请求地址             | 日常翻译，需能访问对应服务           |
| OpenAI 兼容    | 请求地址 / API Key / 模型                | 模型翻译、自定义 Prompt 和流式结果   |
| 必应词典       | 无需密钥                                 | 音标、释义、词形和例句               |
| ECDict（在线） | 无需密钥                                 | 中英文词条查询                       |
| 剑桥词典       | 无需密钥                                 | 英文单词的英中释义                   |

### 文字识别

| 服务         | 需要配置                                       | 数据处理方式           |
| ------------ | ---------------------------------------------- | ---------------------- |
| 系统 OCR     | 安装对应的 Windows OCR 语言功能                | 图片在本机处理         |
| 视觉模型 OCR | OpenAI 兼容端点 / API Key / 支持图片输入的模型 | 将图片发送到配置的端点 |

**接入模型服务：** 在“服务”中添加 OpenAI 兼容翻译或视觉模型 OCR，选择服务商预设或填写自定义地址，输入 API Key，再选择或填写模型。地址应对应 Chat Completions 接口；模型列表功能还需要端点支持 `/models`。OCR 模型必须支持图片输入，不能只看它是否出现在模型列表中。

模型服务支持自定义请求参数和流式开关。视觉 OCR 还可限制发送图片的长边尺寸；翻译 Prompt 可自行调整，应用会补充保留 Markdown 结构的规则，但这不保证模型一定输出有效语法。

**保存服务：** 有连通性测试的配置会先测试再保存。测试阶段可以取消；实际写入期间会显示保存状态并禁止关闭。未保存修改在关闭前需要确认，删除服务也需要确认；每类服务至少保留一个。

## 使用边界与隐私

### 功能边界

-   **Windows 专用**：不提供 macOS、Linux 或移动端安装包。
-   **扫码仅限截图网址**：不包含摄像头扫码、粘贴图片扫描、批量识别或其他二维码协议。
-   **OCR 依赖引擎**：系统 OCR 需要对应语言功能；视觉模型 OCR 需要你提供可用端点和凭据。
-   **本地语种检测**：仅包含中、日、英检测模型，不代表翻译服务只能翻译这三种语言；其他语言的识别准确性可能受限。
-   **精简范围**：不包含上游的服务插件系统、本地 HTTP 服务、自动更新、设置备份同步和生词本。

### 数据去向

-   **本机识别**：系统 OCR 与二维码解码不上传截图；扫码后打开网址会让浏览器访问对应网站。
-   **在线服务**：在线翻译发送文本，视觉模型 OCR 发送图片，接收方是你配置的服务商。数据处理与费用由对应服务商决定。
-   **配置凭据**：API Key 保存在本机配置文件中，并在请求时发送给对应端点。不要公开配置文件，也不要将真实凭据提交到 Git。
-   **剪贴板监听**：默认关闭。开启后复制文本会触发翻译，处理敏感信息时请关闭。
-   **日志与缓存**：截图会写入缓存，日志可能包含二维码网址等内容。共享排错资料前请脱敏。

| 内容         | Windows 路径或入口                                                   |
| ------------ | -------------------------------------------------------------------- |
| 配置文件     | `%APPDATA%\com.pot-app.desktop\config.json`                          |
| 原始截图缓存 | `%LOCALAPPDATA%\com.pot-app.desktop\pot_simplify_screenshot.png`     |
| 裁剪截图缓存 | `%LOCALAPPDATA%\com.pot-app.desktop\pot_simplify_screenshot_cut.png` |
| 日志         | 托盘菜单 → 查看日志                                                  |

应用继续使用 `com.pot-app.desktop` 标识，以便读取旧配置。二次开发时随意修改该标识会改变配置与缓存目录，不能再自动继承原来的设置。

---

## 开发与验证

本项目使用 **Tauri 1 + Rust + React 18 + Vite 5**。桌面功能依赖 Tauri 原生接口，不是运行一个网页就能完整验证的应用。

### 准备环境

在 Windows 上先安装以下工具；系统依赖的安装方式见 [Tauri 1 环境准备](https://v1.tauri.app/v1/guides/getting-started/prerequisites/)。

-   Git。
-   Node.js 22，与 `.node-version` 和 CI 保持一致。
-   Rust stable，使用 MSVC 工具链。
-   Visual Studio C++ Build Tools，勾选“使用 C++ 的桌面开发”，安装 Windows SDK。
-   [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

### 获取代码并运行

以下命令在 PowerShell 中执行：

```powershell
npm install --global pnpm@9
git clone https://github.com/Dean-op/pot-simplify.git
cd pot-simplify
pnpm install --frozen-lockfile
pnpm tauri dev
```

`pnpm tauri dev` 会同时启动 Vite 和真实 Tauri 桌面窗口。`pnpm dev` 只启动前端服务器，可用于局部页面开发，但不能替代快捷键、托盘、截图、系统 OCR、存储等桌面功能的验收。

开发实例默认使用同一配置标识。调试会接触已有配置；需要隔离测试时应使用独立标识与端口，做法见 [服务设置验收记录](docs/service-settings-3.2.1.md)。

### 检查与打包

```powershell
pnpm check:version
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
pnpm build
pnpm tauri build -b nsis
```

-   `check:version` 校验四处版本号是否一致。
-   `test` 覆盖 Markdown 渲染与安全边界、流式翻译、服务配置异步流程、版本检查和构建资产下载器。
-   `cargo test` 覆盖二维码解码与 HTTP/HTTPS 网址校验。
-   `build` 只构建前端；`tauri build` 才生成 Windows 安装包。

本机 NSIS 输出目录为 `src-tauri/target/release/bundle/nsis/`。也可用 `.scripts/verify.ps1` 一次执行依赖安装、前端测试与构建、Rust 测试；添加 `-Full` 会额外打包，日志写入 `verify-output.log`。

功能修改后除自动化检查外，还应在真实 Tauri/WebView2 窗口中操作验证。已有记录：[Markdown 验收](docs/markdown-verification.md)、[服务设置验收](docs/service-settings-verification.md)、[服务设置后续修复与发布](docs/service-settings-3.2.1.md)。

## 版本与发布

二次开发按 [语义化版本](https://semver.org/lang/zh-CN/) 管理：修复用补丁版本，兼容的新功能用次版本，不兼容变更用主版本。

发布前同步更新以下四处版本号，并维护 [CHANGELOG.md](CHANGELOG.md)：

-   `package.json`
-   `src-tauri/tauri.conf.json`
-   `src-tauri/Cargo.toml`
-   `src-tauri/Cargo.lock` 中 `pot-simplify` 包的版本

运行 `pnpm check:version` 和相关检查后，使用中文 Conventional Commits 提交，例如 `fix(service): 修复服务保存行为`。提交推送后创建并推送对应的 `vX.Y.Z` 标签；**不移动或覆盖已有发布标签**。仅修改文档无需提升应用版本。

[GitHub Actions](.github/workflows/package.yml) 的发布流程：

-   **master 推送**：执行回归检查，不生成安装包。
-   **版本标签**：校验版本，构建三种架构的普通版与固定运行时版，共六个安装包；全部成功后发布 Release。
-   **手动触发**：留空 `release_tag` 时仅打包；填写已有标签时，从原标签检出应用源码，使用当前工作流重新构建并发布，不改写原标签。

## 常见问题

### 窗口关了，程序还在运行？

这是托盘常驻行为。点击托盘图标可重新打开设置；完全退出请使用托盘菜单的“退出”。托盘图标可能藏在通知区域的折叠菜单中。

### 热键没有反应？

默认没有热键。先到“热键”页面设置并保存，检查是否与其他程序冲突；可先通过托盘菜单确认对应功能能否正常运行。

### 界面空白或提示缺少 WebView2？

安装 WebView2 Runtime，再重新启动应用。无法联网安装时，可选择文件名包含 `fix_webview2_runtime` 的包。若仍失败，从托盘打开日志查看具体错误。

### 系统 OCR 提示语言不可用？

在 Windows“设置 → 时间和语言”中，为目标语言安装 OCR 功能；只有显示语言包不一定包含 OCR。也可以改用支持该语言的视觉模型 OCR。

### 模型列表或翻译、OCR 请求失败？

检查请求地址、API Key 和模型权限。拉取模型需要 `/models`，翻译需要 Chat Completions，OCR 还需要模型支持图片输入；三者不能相互替代。网关不支持流式输出时可关闭流式重试。保存阶段使用的是测试文本或内置 OCR 测试图片，不会为了测试自动上传你的屏幕截图。

### Markdown 译文仍不好读？

使用译文底部的预览/源码切换按钮查看结果。翻译 Markdown 时请关闭“翻译 → 自动删除换行”，避免在请求前破坏段落结构；服务返回的语法仍可能不完整。预览支持 Markdown 与 GFM，但不执行原始 HTML、不加载图片，只允许点击绝对 HTTP/HTTPS 链接。

### 二维码没有识别到？

框选时包含完整二维码及四周留白，避免截断或模糊。纯文本、`mailto:` 等内容会提示不是网址，本功能只处理 HTTP/HTTPS 链接。

### GitHub 安装包下载返回 5xx？

先检查网络与 [构建记录](https://github.com/Dean-op/pot-simplify/actions)。服务端下载失败不代表本地服务配置有问题。也可登录 GitHub，在成功的打包任务中下载 `windows_*` 安装包产物；下载 ZIP 后解压，再运行其中的 `setup.exe`。

## 上游与许可证

本项目 Fork 自 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) v3.0.7，感谢上游作者与贡献者。本分支面向 Windows 精简和二次开发，不是上游官方发行版。

使用 [GPL-3.0-only](LICENSE) 许可证。修改或分发时须遵守 GPLv3 的相应要求，并保留上游许可与归属信息。

主要依赖：[Tauri](https://github.com/tauri-apps/tauri)、[React](https://github.com/facebook/react)、[lingua-rs](https://github.com/pemistahl/lingua-rs)、[rqrr](https://github.com/WanzenBug/rqrr)、[react-markdown](https://github.com/remarkjs/react-markdown) 与 [remark-gfm](https://github.com/remarkjs/remark-gfm)。
