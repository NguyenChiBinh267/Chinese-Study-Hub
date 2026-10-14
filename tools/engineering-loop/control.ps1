param([ValidateSet('doctor','status','pick','candidate-pick','dry-run','dry-local','dry-git','dry-multi','multi-resume','autonomous','autonomous-resume','dry-github','ssot-status','step','start','pause','stop','resume')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$loopFile = Join-Path $PSScriptRoot 'loop.mjs'
if ($Action -eq 'start') {
    $nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $runtimeDir = Join-Path $taskRoot '.engineering-loop'
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    Start-Process -FilePath $nodeCommand -ArgumentList @(('"' + $loopFile + '"'),'autonomous') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'controller.out.log') -RedirectStandardError (Join-Path $runtimeDir 'controller.err.log')
    Write-Output 'Authorization-checking driver launched. It refuses missing/dormant grants; use status and autonomous-report.json to verify execution.'
} else {
    & node $loopFile $Action
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
