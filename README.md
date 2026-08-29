<img width="140px" src="public/icon.svg" align="left"/>

# pot-simplify

> 划词翻译 + 截图文字识别。只跑在 Windows 上的个人精简 fork。

![License](https://img.shields.io/badge/license-GPL--3.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-1.8-blue?logo=tauri)
![Windows](https://img.shields.io/badge/Windows%20only-0078D4?logo=windows&logoColor=white)

<br/>
<hr/>

## 这是什么

Fork 自 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) v3.0.7，按「只要翻译、文字识别、快捷键」的目标做了大幅精简，同时只保留 Windows 平台。完整的改造记录、取舍理由和实测数据在 [docs/精简与性能优化方案.md](docs/精简与性能优化方案.md)。

相对上游的主要差异：

|          | 上游                    | 这里                                       |
| -------- | ----------------------- | ------------------------------------------ |
| 平台     | Windows / macOS / Linux | 只有 Windows，只出 NSIS 安装包             |
| 翻译服务 | 21 个内置 + 插件        | 5 个内置，云端统一走 OpenAI 兼容端点       |
| 文字识别 | 15 个内置 + 插件        | 2 个：Windows 系统 OCR、LLM 视觉 OCR       |
| 界面语言 | 19 种                   | 中文 / English                             |
| 设置页   | 8 项                    | 5 项：常规 / 翻译 / 文字识别 / 热键 / 服务 |

整块移除的功能：插件系统（含大龙虾翻译）、本地 HTTP 服务（`60828` 端口，无鉴权）、自动更新、备份设置、关于页、历史记录、生词本、语音合成、网络代理设置，以及 4 MB 的 tesseract wasm。

## 用法

四个全局快捷键，在 设置 → 热键 里配置，默认都是空的：

| 快捷键   | 作用                             |
| -------- | -------------------------------- |
| 划词翻译 | 选中文字后按下，弹出翻译窗口     |
| 输入翻译 | 呼出空白翻译窗口，输入后回车翻译 |
| 截图 OCR | 框选屏幕区域，识别其中文字       |
| 截图翻译 | 框选屏幕区域，识别后直接翻译     |

翻译窗口左上角的图标可以开启剪贴板监听，开着的时候复制任何文字都会自动翻译。托盘菜单里有输入翻译、监听剪切板、自动复制（原文 / 译文 / 原文+译文 / 关闭）、文字识别、截图翻译、偏好设置、查看日志、重启应用、退出；单击托盘图标触发哪个动作可以在 设置 → 常规 里改。

## 支持的服务

**翻译**

-   OpenAI 兼容端点 —— 内置 [阿里百炼](https://bailian.console.aliyun.com/)、[硅基流动](https://cloud.siliconflow.cn/)、[OpenAI](https://platform.openai.com/) 三个预设，也可以填任意自定义地址；支持一键拉取模型列表；同一个服务可以加多个实例，翻译和识别各配各的模型
-   [Google 翻译](https://translate.google.com)
-   [Bing 词典](https://www.bing.com/dict)
-   [剑桥词典](https://dictionary.cambridge.org/)
-   [ECDICT](https://github.com/skywind3000/ECDICT) —— 离线英汉词典

**文字识别**

-   Windows 系统 OCR —— 走 [Windows.Media.Ocr](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine)，离线、免费、毫秒级返回
-   LLM 视觉 OCR —— 把截图发给多模态模型识别，和翻译共用同一套 OpenAI 兼容配置

> 填地址时写到 `https://host`、`https://host/v1` 或完整的 `https://host/v1/chat/completions` 都可以，程序会自己补全。

## 觉得翻译慢的时候先看这两处

**思考模式**（翻译服务配置里的下拉框，默认关）。现在的推理模型大多默认开着思考链，翻一句话要先输出几百个思考 token。实测硅基流动的 `deepseek-ai/DeepSeek-V4-Flash` 翻同一句话：跟随模型默认要 206~272 个 completion token、5~7 秒；显式关掉思考只有 19 个 token、1 秒上下。参数按域名分派（DeepSeek 用 `thinking`，百炼和硅基流动用 `enable_thinking`，其余域名不发，免得 OpenAI 因为不认识的字段直接 400）。需要长推理时再手动开。

**语种检测引擎**（设置 → 翻译，默认「本地」）。本地引擎用嵌进程序的 lingua 模型，只留了中日英三个语种，检测不走网络。检测和翻译是并发的，不会拖慢出译文的时间——检测结果只用于界面上的语言标签、译文语言和检测语言撞车时切到第二目标语言、以及系统 OCR 判断是不是中文好去掉字间空格。发给翻译服务的源语言始终是 `auto`，所以检测错了也不会把源语言标错。

## 安装

三种拿到安装包的方式，选一种就行。

**从 Releases 下载**（打过 tag 才有）。在本地打一个 tag 推上去，CI 会把三个架构的安装包传到 Release：

```powershell
git tag 3.1.0
git push origin 3.1.0
```

tag 名必须是 `x.y.z`（`v3.1.0` 也行，`v` 会被去掉），它会成为安装包的版本号；没有 tag 时沿用 `package.json` 里的版本。

**从 Actions 下载**（每次推 master 或手动触发都有）。进仓库的 Actions 页面，选最新一次 Package 运行，页面底部 Artifacts 里有 `windows_x86_64-pc-windows-msvc` 等六个压缩包，解开就是 `.exe` 安装程序。保留期 90 天。不想为了拿包专门推 commit 的话，在 Actions 页面点 Run workflow 手动跑一次。

**本地自己构建**：

```powershell
pnpm install
pnpm tauri build          # 产物在 src-tauri/target/release/bundle/nsis/
```

首次 release 构建因为开了 LTO 会比较久（十几分钟量级），之后增量快很多。

安装包是 NSIS 的 `pot-simplify_<版本>_x64-setup.exe`，per-machine 安装，会要管理员权限，装到 `Program Files\pot-simplify` 并建开始菜单快捷方式；卸载走「应用和功能」。配置和日志仍在 `%APPDATA%\com.pot-app.desktop`——这个目录名由 bundle identifier 决定，改名时故意没动它，否则老的热键和 API key 全部作废。卸载不会清空它，所以重装或换版本设置都还在。

CI 一共出六个包：三个架构各一个普通版，加三个 `*_fix_webview2_runtime-setup.exe`——后者把固定版本的 WebView2 运行时打进了安装包，体积大很多，只在系统里 WebView2 被卸载或禁用、装不上的环境才需要。启动后没有界面、点托盘图标没反应，基本都是这个原因。

装完记得先去 设置 → 热键 配四个快捷键（默认全空），以及 设置 → 服务 里填 API key。想开机自启的话在 设置 → 常规 里打开。

如果之前装过叫 `pot` 的旧版本：可执行文件名从 `pot.exe` 变成了 `pot-simplify.exe`，安装目录也跟着变，所以要先在「应用和功能」里卸掉旧的，否则两份并存。开机自启是按可执行文件名写进注册表 `HKCU\...\CurrentVersion\Run` 的，旧的那条 `pot` 不会被卸载程序清掉，装完新版后到 设置 → 常规 里关一次再开一次即可。设置本身不受影响。

## 开发

环境要求：Node.js >= 18、pnpm 9、Rust >= 1.80.0、MSVC 工具链。

```powershell
pnpm install
pnpm tauri dev            # 开发模式
pnpm build                # 只构建前端
cd src-tauri && cargo check --target x86_64-pc-windows-msvc
.scripts\verify.ps1       # 版本检查 + frozen-lockfile 安装 + 前端构建 + cargo check
```

几件容易踩的事：

-   仓库统一 LF 行尾（`.gitattributes` 已配），改文件别写 CRLF
-   代码格式是 prettier，配置文件名是 `.prettierrc.json`；`src/utils/lang_detect.js` 和 `src-tauri/tauri.conf.json` 从上游继承下来就不合规，别顺手格式化
-   Rust 侧整体不是 rustfmt-clean，只格式化自己重写过的文件，不要跑全项目 `cargo fmt`
-   `src-tauri/webview.{x64,x86,arm64}.json` 看着没人引用，其实是 CI 里那个固定 WebView2 版本的 job 改名顶掉 `tauri.windows.conf.json` 用的，别删
-   `tauri.conf.json` 的 allowlist 和 `Cargo.toml` 的 tauri features 必须成对增删，否则 build script 直接报错
-   图标全部由 `.scripts/gen_icon.py` 从一份 SVG 生成（`src-tauri/icons/` + `public/icon.png` + `public/icon.svg`），改图标改脚本，别手动改 PNG

## 许可与致谢

GPL-3.0，跟随上游。

-   [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) —— 本仓库的上游
-   [Bob](https://github.com/ripperhe/Bob) —— 灵感来源
-   [Tauri](https://github.com/tauri-apps/tauri) —— GUI 框架
-   [lingua-rs](https://github.com/pemistahl/lingua-rs) —— 离线语种检测
