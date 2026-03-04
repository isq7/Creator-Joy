# git-nightly-sync.ps1
# Automates the daily push to GitHub

$repoPath = "c:\Users\2299a\OneDrive\Desktop\Creator Joy\outlier-video-ui"
Set-Location $repoPath

$date = Get-Date -Format "yyyy-MM-dd HH:mm"
Write-Host "--- 📅 Git Sync Started: $date ---"

# Check for changes
$status = git status --porcelain
if ($status) {
    Write-Host "🚀 Changes detected. Committing and pushing..."
    git add .
    git commit -m "Auto-update: $date"
    git push origin master
    Write-Host "✅ Sync completed successfully."
} else {
    Write-Host "😴 No changes to sync today."
}

Write-Host "-------------------------------------"
