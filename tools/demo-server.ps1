[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$LanIPv4 = "auto"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ToolsDir = $PSScriptRoot
$RootDir = (Resolve-Path -LiteralPath (Join-Path $ToolsDir "..")).Path
$SiteDir = Join-Path $RootDir "_site"
$CertDir = Join-Path $ToolsDir ".certs"

function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$Command,
        [Parameter(ValueFromRemainingArguments)] [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Befehl fehlgeschlagen ($LASTEXITCODE): $Command"
    }
}

function Update-ProcessPath {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = @($machinePath, $userPath) -join ";"
}

function Get-OrInstallCommand {
    param(
        [Parameter(Mandatory)] [string]$Name,
        [Parameter(Mandatory)] [string]$WingetId
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $winget = Get-Command "winget.exe" -ErrorAction SilentlyContinue
    if (-not $winget) {
        throw "winget.exe fehlt. Installieren Sie zuerst den Windows App Installer."
    }

    Write-Host "$Name fehlt; Installation über winget ..."
    Invoke-Checked $winget.Source "install" "--id" $WingetId "--exact" "--accept-package-agreements" "--accept-source-agreements" "--disable-interactivity" | Out-Host
    Update-ProcessPath

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        throw "$Name wurde installiert, ist aber noch nicht im PATH. Starten Sie das Terminal neu."
    }
    return $command.Source
}

function Test-PrivateIPv4 {
    param([Parameter(Mandatory)] [string]$Address)

    $parsed = $null
    if (-not [Net.IPAddress]::TryParse($Address, [ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
        return $false
    }
    $bytes = $parsed.GetAddressBytes()
    return $bytes[0] -eq 10 -or
        ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
        ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
}

function Find-PrivateLanIPv4 {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.AddressState -eq "Preferred" -and
            $_.PrefixOrigin -ne "WellKnown" -and
            (Test-PrivateIPv4 $_.IPAddress)
        } |
        Sort-Object InterfaceMetric, SkipAsSource, InterfaceIndex
    return $addresses | Select-Object -First 1 -ExpandProperty IPAddress
}

try {
    if ([string]::IsNullOrWhiteSpace($env:APPS_SCRIPT_WEB_APP_URL)) {
        throw "Umgebungsvariable APPS_SCRIPT_WEB_APP_URL fehlt."
    }

    $python = Get-Command "python.exe" -ErrorAction SilentlyContinue
    $node = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if (-not $python) { throw "python.exe fehlt im PATH." }
    if (-not $node) { throw "node.exe fehlt im PATH." }

    $caddy = Get-OrInstallCommand "caddy.exe" "CaddyServer.Caddy"
    $mkcert = Get-OrInstallCommand "mkcert.exe" "FiloSottile.mkcert"

    $selectedLanIPv4 = $null
    if ($LanIPv4 -eq "auto") {
        $selectedLanIPv4 = Find-PrivateLanIPv4
    } elseif ($LanIPv4 -ne "none") {
        if (-not (Test-PrivateIPv4 $LanIPv4)) {
            throw "-LanIPv4 muss eine private IPv4-Adresse, 'auto' oder 'none' sein."
        }
        $selectedLanIPv4 = $LanIPv4
    }

    Push-Location $RootDir
    try {
        Invoke-Checked $python.Source "scripts/build-content-index.py"
        Invoke-Checked $python.Source "scripts/build-pages-site.py"
        Invoke-Checked $python.Source "scripts/verify-pages-site.py"
        Invoke-Checked $node.Source "tests/service-worker.test.js"
        Invoke-Checked $python.Source "scripts/configure-runtime.py" $env:APPS_SCRIPT_WEB_APP_URL "_site"
        Invoke-Checked $python.Source "scripts/verify-pages-site.py" "--final-artifact"
    } finally {
        Pop-Location
    }

    New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
    $certFile = Join-Path $CertDir "localhost.pem"
    $keyFile = Join-Path $CertDir "localhost-key.pem"
    $certificateNames = @("localhost", "127.0.0.1")
    if ($selectedLanIPv4) { $certificateNames += $selectedLanIPv4 }

    Invoke-Checked $mkcert "-install"
    Invoke-Checked $mkcert "-cert-file" $certFile "-key-file" $keyFile @certificateNames

    $env:DEMO_SITE_ROOT = $SiteDir
    $env:DEMO_CERT_FILE = $certFile
    $env:DEMO_KEY_FILE = $keyFile

    Write-Host "Demo: https://localhost:8443/Vermietung/"
    if ($selectedLanIPv4) {
        Write-Host "LAN:  https://${selectedLanIPv4}:8443/Vermietung/"
    } else {
        Write-Host "Keine private LAN-IPv4 gewählt oder erkannt."
    }
    Write-Host "Beenden mit Strg+C."
    Invoke-Checked $caddy "run" "--config" (Join-Path $ToolsDir "Caddyfile") "--adapter" "caddyfile"
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
