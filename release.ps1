# Parse latest changelog entry
$changelogLines = Get-Content CHANGELOG.md
$version = ""
$title = ""
$body = ""
$foundFirst = $false

foreach ($line in $changelogLines) {
    if ($line -match "^## \[(\d+\.\d+\.\d+)\] - (.+)") {
        if ($foundFirst) { break }
        $version = $Matches[1]
        $title = $Matches[2]
        $foundFirst = $true
        continue
    }
    if ($foundFirst) {
        if ($line -match "^## \[") { break }
        $body += $line + "`n"
    }
}

if (-not $version) {
    Write-Error "Could not parse version from CHANGELOG.md"
    exit 1
}

# Check current npm version
$currentVersion = (Get-Content package.json | ConvertFrom-Json).version

Write-Host "About to release:" -ForegroundColor Cyan
Write-Host "  Version: $version - $title"
if ($currentVersion -ne $version) {
    Write-Host "  npm version: $currentVersion -> $version"
}
Write-Host "`nNotes:`n$body"

$confirm = Read-Host "Proceed? [y/N]"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Aborted."
    exit 0
}

# 1. Bump version if needed
if ($currentVersion -ne $version) {
    Write-Host "Bumping version..."
    npm.cmd version $version
}

# 2. Build
Write-Host "Building project..."
npm.cmd run build

# 3. Push
Write-Host "Pushing to origin..."
git push origin fixes --follow-tags

# 4. Create Release (requires gh CLI)
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Host "Creating GitHub release..."
    gh release create $version `
        --title "$version - $title" `
        --notes $body `
        --latest `
        main.js styles.css manifest.json
    Write-Host "Release $version created successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[!] GitHub CLI (gh) not found in PATH." -ForegroundColor Yellow
    Write-Host "Please create the release manually at: https://github.com/alanalvarado/obsidian-fountain-1/releases/new"
    Write-Host "Upload these files: main.js, styles.css, manifest.json"
}
