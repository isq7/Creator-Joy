# Hostinger Deployment Script (Optimized)
$username = "air_ideas_user"
$ip = "93.127.216.83"
$serverPath = "~/app_deploy"

Write-Host "Creating optimized deployment package..."
tar -czf deploy_package.tar.gz src public index.html package.json package-lock.json Dockerfile Dockerfile.extractor docker-compose.yml vite.config.js nginx.conf instagram-extractor.js proxy-package.json .env.local server_replicate.py generate_thumbnail_flux.py .env

Write-Host "Uploading package to $username@$ip..."
Write-Host "Password: App8899n@123"

# Create directory and upload
ssh -o StrictHostKeyChecking=no "${username}@${ip}" "mkdir -p $serverPath"
scp -o StrictHostKeyChecking=no deploy_package.tar.gz "${username}@${ip}:${serverPath}/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Upload Successful!"
    Write-Host "Connect to your server and run:"
    Write-Host "1. cd $serverPath"
    Write-Host "2. tar -xzf deploy_package.tar.gz"
    Write-Host "3. docker compose up -d --build"
} else {
    Write-Host "Deployment failed."
}

Remove-Item deploy_package.tar.gz -ErrorAction SilentlyContinue
