# Remove Cursor / Spec Kit paths from ALL branches and tags in local Git history.
# Run from repo root after committing your current work:
#   powershell -ExecutionPolicy Bypass -File scripts/purge-cursor-from-git-history.ps1
#
# Then re-add remote (filter-repo removes it) and force-push:
#   git remote add origin https://github.com/houssamghawi/LMSV2.git
#   git push --force --all origin
#   git push --force --tags origin
#
# All contributors must re-clone or hard-reset after a force-push.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path ".git")) { throw "Not a git repository." }

$pathsToDrop = @(".cursor", ".specify", ".chroma-data", "specs")
$filterCmd = Get-Command git-filter-repo -ErrorAction SilentlyContinue

if ($filterCmd) {
    $pathsFile = Join-Path $env:TEMP "lmsv2-filter-paths.txt"
    ($pathsToDrop | ForEach-Object { "$_/" }) | Set-Content -Encoding utf8 $pathsFile
    Write-Host "Using git-filter-repo..."
    git filter-repo --paths-from-file $pathsFile --invert-paths --force
} else {
    Write-Host "git-filter-repo not found; using git filter-branch (slower)..."
    $indexFilter = "git rm -rf --cached --ignore-unmatch " + ($pathsToDrop -join " ")
    git filter-branch --force --index-filter $indexFilter --prune-empty --tag-name-filter cat -- --all
    if (Test-Path ".git/refs/original") {
        git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
        git reflog expire --expire=now --all
        git gc --prune=now --aggressive
    }
}

Write-Host ""
Write-Host "History rewrite complete."
Write-Host "If remote was removed, run:"
Write-Host '  git remote add origin https://github.com/houssamghawi/LMSV2.git'
Write-Host "  git push --force --all origin"
Write-Host "  git push --force --tags origin"
