param(
    [switch]$DryRun,
    [switch]$SkipAuthCheck,
    [switch]$SkipBootstrap,
    [switch]$SkipImport,
    [switch]$SkipRefresh,
    [switch]$Force,
    [switch]$NoMarkReady,
    [int]$Retry = 1,
    [string]$Only = "",
    [string]$BootstrapOut = "scripts/notebooklm-level-map.generated.json",
    [string]$Manifest = "scripts/notebooklm-drive-import.manifest.json",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Output "NotebookLM sync: textbook levels -> notebooks -> mapping -> drive import"
    Write-Output ""
    Write-Output "Usage:"
    Write-Output "  npm run nlm:sync -- [options]"
    Write-Output ""
    Write-Output "Options:"
    Write-Output "  -DryRun             Print actions without mutating notebooks/sources"
    Write-Output "  -SkipAuthCheck      Skip notebooklm auth checks"
    Write-Output "  -SkipBootstrap      Skip notebook creation + mapping writeback"
    Write-Output "  -SkipImport         Skip drive import step"
    Write-Output "  -SkipRefresh        Skip source refresh during import step"
    Write-Output "  -Force              Force notebook creation even if notebookId exists"
    Write-Output "  -NoMarkReady        Do not mark registry items ready during mapping writeback"
    Write-Output "  -Retry <n>          Retry count per step (default: 1)"
    Write-Output "  -Only a,b,c         Restrict to selected level keys"
    Write-Output "  -BootstrapOut PATH  Mapping output path"
    Write-Output "  -Manifest PATH      Drive import manifest path"
}

function Invoke-CommandWithRetry {
    param(
        [string]$Label,
        [string]$Exe,
        [string[]]$CmdArgs,
        [int]$RetryCount = 1
    )

    for ($attempt = 0; $attempt -le $RetryCount; $attempt++) {
        if ($attempt -gt 0) {
            Write-Output "[warn] $Label failed, retrying ($attempt/$RetryCount)..."
        }

        Write-Output ""
        Write-Output "[step] $Label"
        Write-Output "[cmd] $Exe $($CmdArgs -join ' ')"
        & $Exe @CmdArgs

        $exitCode = $LASTEXITCODE
        if (($null -eq $exitCode) -or ($exitCode -eq 0)) {
            return
        }

        if ($attempt -eq $RetryCount) {
            throw "$Label failed with exit code $exitCode"
        }
    }
}

if ($Help) {
    Show-Help
    exit 0
}

if (-not $SkipAuthCheck) {
    try {
        Invoke-CommandWithRetry -Label "NotebookLM auth status check" -Exe "notebooklm" -CmdArgs @("status") -RetryCount $Retry
        Invoke-CommandWithRetry -Label "NotebookLM auth data check" -Exe "notebooklm" -CmdArgs @("list", "--json") -RetryCount $Retry
    }
    catch {
        Write-Output ""
        Write-Output "[error] NotebookLM auth check failed. Please run: notebooklm login"
        throw
    }
}

if (-not $SkipBootstrap) {
    $bootstrapArgs = @("scripts/notebooklm-bootstrap-level-notebooks.js", "--out", $BootstrapOut)
    if ($DryRun) { $bootstrapArgs += "--dry-run" }
    if ($Force) { $bootstrapArgs += "--force" }
    if ($Only) { $bootstrapArgs += @("--only", $Only) }

    Invoke-CommandWithRetry -Label "Bootstrap textbook-level notebooks" -Exe "node" -CmdArgs $bootstrapArgs -RetryCount $Retry

    $mappingArgs = @("scripts/notebooklm-write-level-mapping.js", "--mapping", $BootstrapOut)
    if (-not $NoMarkReady) { $mappingArgs += "--mark-ready" }
    Invoke-CommandWithRetry -Label "Write level mapping back to registry" -Exe "node" -CmdArgs $mappingArgs -RetryCount $Retry
}

if (-not $SkipImport) {
    $importArgs = @("scripts/notebooklm-import-drive-sources.js", "--manifest", $Manifest)
    if ($DryRun) { $importArgs += "--dry-run" }
    if ($SkipRefresh) { $importArgs += "--skip-refresh" }
    if ($Only) { $importArgs += @("--only", $Only) }

    Invoke-CommandWithRetry -Label "Import and refresh Drive sources" -Exe "node" -CmdArgs $importArgs -RetryCount $Retry
}

Write-Output ""
Write-Output "[done] NotebookLM level KB sync finished successfully."
