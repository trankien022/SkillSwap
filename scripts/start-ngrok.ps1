<#
.SYNOPSIS
  Start the SkillSwap ngrok tunnel for the SePay payment gateway (FR-008 / ADR-033).

.DESCRIPTION
  Exposes the local API (:4001) at the team's reserved ngrok domain so SePay can
  deliver the IPN to POST /api/wallet/top-ups/callback.

  The script:
    1. finds the repository root regardless of the current directory;
    2. checks that .env exists and defines NGROK_AUTHTOKEN;
    3. loads the token into THIS process's environment (never printed);
    4. verifies the ngrok executable is installed;
    5. starts the 'api' endpoint from the repository's ngrok.yml.

  The token is read with a small line-based parser: the .env file is data, not
  PowerShell, and is never executed as code.

.PARAMETER AgentConfig
  Optional path to a global ngrok agent config to merge in. Defaults to the
  standard per-user config path when it exists.

.EXAMPLE
  .\scripts\start-ngrok.ps1

.EXAMPLE
  # Explicit global config (if the agent's authtoken lives there):
  .\scripts\start-ngrok.ps1 -AgentConfig "$env:LOCALAPPDATA\ngrok\ngrok.yml"
#>
[CmdletBinding()]
param(
    [string]$AgentConfig
)

$ErrorActionPreference = 'Stop'

function Write-Info { param([string]$Message) Write-Host "[ngrok] $Message" }
function Fail {
    param([string]$Message)
    Write-Error "[ngrok] $Message"
    exit 1
}

# -- 1. Locate the repository root (this script lives in <root>/scripts) ------
$RepoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $RepoRoot 'ngrok.yml'))) {
    Fail "ngrok.yml not found at $RepoRoot - is this script inside the repository's scripts/ directory?"
}
$ConfigPath = Join-Path $RepoRoot 'ngrok.yml'
$EnvPath = Join-Path $RepoRoot '.env'

Write-Info "repository root: $RepoRoot"

# -- 2. Verify ngrok is installed and see what version we are driving --------
$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
if ($null -eq $ngrok) {
    Fail 'ngrok was not found on PATH. Install ngrok Agent v3: https://ngrok.com/download'
}
$ngrokVersion = (& ngrok version 2>&1 | Select-Object -First 1)
Write-Info "found $ngrokVersion"

# -- 3. Require .env and parse NGROK_AUTHTOKEN out of it ---------------------
if (-not (Test-Path $EnvPath)) {
    Fail ".env not found at $EnvPath. Copy .env.example to .env and set NGROK_AUTHTOKEN. Do not commit .env."
}

$authToken = $null
foreach ($line in Get-Content -LiteralPath $EnvPath) {
    $trimmed = $line.Trim()
    # Skip blanks and comments.
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }

    $match = [regex]::Match($trimmed, '^\s*(?:export\s+)?NGROK_AUTHTOKEN\s*=\s*(.*)$')
    if (-not $match.Success) { continue }

    $value = $match.Groups[1].Value.Trim()

    # Strip one layer of matching quotes, if present.
    if ($value.Length -ge 2) {
        $first = $value.Substring(0, 1)
        $last = $value.Substring($value.Length - 1, 1)
        $doubleQuote = [char]34
        $singleQuote = [char]39
        if (($first -eq $doubleQuote -and $last -eq $doubleQuote) -or
            ($first -eq $singleQuote -and $last -eq $singleQuote)) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    # Only take the first definition; do not overwrite an already-set env value.
    if (-not [string]::IsNullOrWhiteSpace($value)) { $authToken = $value }
    break
}

if ([string]::IsNullOrWhiteSpace($authToken) -or $authToken -like 'replace-*') {
    Fail "NGROK_AUTHTOKEN is missing or still a placeholder in $EnvPath. Set it from https://dashboard.ngrok.com/get-started/your-authtoken"
}

# -- 4. Export the token for THIS process only, never echo it ----------------
$env:NGROK_AUTHTOKEN = $authToken
Write-Info 'NGROK_AUTHTOKEN loaded from .env (value not shown)'

# -- 5. Run the 'api' endpoint with the repo config -------------------------
# ngrok does not expand ${NGROK_AUTHTOKEN} from the file; the agent reads the
# process environment, which is why we export it above. The global config is
# merged only when it exists.
$ngrokArgs = @('start', 'api', '--config', $ConfigPath)
if (-not [string]::IsNullOrWhiteSpace($AgentConfig)) {
    if (-not (Test-Path $AgentConfig)) { Fail "-AgentConfig path not found: $AgentConfig" }
    $ngrokArgs = @('start', 'api', '--config', $AgentConfig, '--config', $ConfigPath)
    Write-Info "merging global config: $AgentConfig"
}
else {
    $defaultGlobal = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'
    if (Test-Path $defaultGlobal) {
        $ngrokArgs = @('start', 'api', '--config', $defaultGlobal, '--config', $ConfigPath)
        Write-Info "merging global config: $defaultGlobal"
    }
}

Write-Info "starting endpoint 'api' -> http://localhost:4001"
Write-Info 'press Ctrl+C to stop'

& ngrok @ngrokArgs
exit $LASTEXITCODE
