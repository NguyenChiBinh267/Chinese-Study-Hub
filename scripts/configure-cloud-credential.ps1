$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$directory = Join-Path $workspace '.local-postgres\cloud-gates'
$target = Get-Content -LiteralPath (Join-Path $directory 'project.json') -Raw | ConvertFrom-Json
if ($target.projectRef -ne 'yartjbdapoyqcxfagsrj' -or $target.poolerHost -ne 'aws-0-ap-southeast-1.pooler.supabase.com') {
    throw 'Unrecognized project; no credential will be stored.'
}
Write-Host 'Configure only the NEW chinese-study-hub project. Do not enter a password for BankManagement.'
$secured = Read-Host 'Database password for chinese-study-hub (hidden input; never sent to chat)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secured)
try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ([string]::IsNullOrWhiteSpace($plain)) { throw 'Empty password; configuration unchanged.' }
    $encoded = [uri]::EscapeDataString($plain)
    $url = 'postgresql://postgres.' + $target.projectRef + ':' + $encoded + '@' + $target.poolerHost + ':5432/postgres?sslmode=verify-full'
    @{ adminUrl = $url } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'connection.json') -Encoding UTF8
    Write-Host 'Saved in ignored local connection.json. No password was displayed or uploaded.'
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $plain = $null; $encoded = $null; $url = $null
}
