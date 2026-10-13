param([ValidateSet('doctor','status','pick','dry-run','dry-local','dry-github','ssot-status','step','start','pause','stop','resume')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$loopFile = Join-Path $PSScriptRoot 'loop.mjs'
if ($Action -eq 'start') {
    $nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
    $runtimeDir = Join-Path $taskRoot '.engineering-loop'
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
    Start-Process -FilePath $nodeCommand -ArgumentList @(('"' + $loopFile + '"'),'run') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'controller.out.log') -RedirectStandardError (Join-Path $runtimeDir 'controller.err.log')
    Write-Output 'Loop started in background. Use status, pause or stop to control it.'
} else {
    & node $loopFile $Action
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
