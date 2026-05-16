$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath "node_modules")) {
  npm install
}

Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot`" && npm run dev -- --port 5174"
Start-Sleep -Seconds 2
Start-Process "http://127.0.0.1:5174/"

