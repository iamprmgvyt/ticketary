@echo off
cd /d "%~dp0"
echo 🚀 Staging and pushing latest Ticketary updates to GitHub...
git add .
git commit -m "feat(setup): add required step 5 for transcript format choice (docs, html_file, html_web, pdf, txt)"
git push origin main
echo.
echo ✅ Successfully pushed to GitHub! Now run 'git pull origin main' on your VPS.
pause
