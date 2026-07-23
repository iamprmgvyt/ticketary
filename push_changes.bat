@echo off
cd /d "%~dp0"
echo 🚀 Staging and pushing latest Ticketary updates to GitHub...
git add .
git commit -m "feat: AI multi-turn interview (5 questions max), optional ticket category setup & publish persistence"
git push origin main
echo.
echo ✅ Successfully pushed to GitHub! Now run 'git pull origin main' on your VPS.
pause
