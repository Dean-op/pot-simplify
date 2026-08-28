# pot-desktop 构建验证脚本
#
# 用途：在 Windows 上跑一遍沙箱里跑不了的构建步骤，把完整输出落到
# verify-output.log（已被 .gitignore 的 *.log 规则忽略），方便 Claude 直接读取。
#
# 用法（在仓库根目录）：
#   powershell -ExecutionPolicy Bypass -File .scripts/verify.ps1
#   powershell -ExecutionPolicy Bypass -File .scripts/verify.ps1 -Full   # 额外跑 tauri build 打安装包
#
# 不带 -Full 时不会产出安装包，只做到编译通过为止，大约几分钟。

param([switch]$Full)

$ErrorActionPreference = 'Continue'
$log = Join-Path $PSScriptRoot '..\verify-output.log'
$log = [System.IO.Path]::GetFullPath($log)
$root = Split-Path $PSScriptRoot -Parent

if (Test-Path $log) { Remove-Item $log }

function Log($msg) {
    Write-Host $msg
    Add-Content -Path $log -Value $msg -Encoding utf8
}

function Step($name, $cmd, $dir) {
    Log ""
    Log "=============================================================="
    Log "### $name"
    Log "### cwd: $dir"
    Log "### cmd: $cmd"
    Log "=============================================================="
    Push-Location $dir
    $started = Get-Date
    # 2>&1 把 stderr 并进来；cargo/vite 的报错都走 stderr
    $out = & cmd /c "$cmd 2>&1"
    $code = $LASTEXITCODE
    Pop-Location
    $secs = [int]((Get-Date) - $started).TotalSeconds
    Add-Content -Path $log -Value $out -Encoding utf8
    Log ""
    Log ">>> $name 退出码 $code，耗时 ${secs}s"
    if ($code -ne 0) { Log ">>> 失败，后续步骤仍会继续跑，方便一次拿到全部问题" }
    return $code
}

Log "pot-desktop 构建验证  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "仓库: $root"
Log "commit: $(git -C $root rev-parse --short HEAD) $(git -C $root log -1 --pretty=%s)"
Log "工作区改动: $(@(git -C $root status --porcelain).Count) 个文件"

Step '环境版本' 'node -v && pnpm -v && rustc -V && cargo -V' $root | Out-Null

$fail = 0
$fail += Step 'pnpm install' 'pnpm install --frozen-lockfile' $root
$fail += Step 'pnpm build' 'pnpm build' $root
$fail += Step 'cargo check' 'cargo check' (Join-Path $root 'src-tauri')

if ($Full) {
    $fail += Step 'tauri build' 'pnpm tauri build' $root
}

Log ""
Log "=============================================================="
if ($fail -eq 0) { Log "全部通过" } else { Log "有步骤失败，往上翻看退出码非 0 的段落" }
Log "完整日志: $log"
