$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlPath = Join-Path $projectRoot "supabase-setup.sql"
$sql = Get-Content -LiteralPath $sqlPath -Raw

Set-Clipboard -Value $sql
Start-Process "https://supabase.com/dashboard/project/cjhgbkjaiblvwugozlle/sql/new"

Write-Host "Supabase storage setup SQL is copied to your clipboard."
Write-Host "Paste it into the SQL Editor page that opened, then click Run."
