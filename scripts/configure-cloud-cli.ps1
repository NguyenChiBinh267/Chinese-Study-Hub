$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath 'D:\Chinese-Study-Hub'
Write-Host 'Complete the official Supabase browser login. Enter the browser verification code ONLY in this window. Do not send it to chat.'
& npx.cmd --yes supabase@2.121.0 login --output pretty --agent no
if ($LASTEXITCODE -ne 0) { throw 'Official CLI login did not finish.' }
& npx.cmd --yes supabase@2.121.0 projects list --output json --agent no | Out-File -LiteralPath .local-postgres/cloud-gates/cli-projects.json -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'CLI could not read its saved login. Leave this error window open.' }
& npx.cmd --yes supabase@2.121.0 projects api-keys --project-ref yartjbdapoyqcxfagsrj --output json --agent no | Out-File -LiteralPath .local-postgres/cloud-gates/api-keys.json -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'Project access did not verify.' }
Set-Content -LiteralPath .local-postgres/cloud-gates/cli-ready.txt -Value 'Official CLI login and exact-project access verified.'
Write-Host 'VERIFIED: CLI login and exact project access. You can return to Codex.' -ForegroundColor Green
