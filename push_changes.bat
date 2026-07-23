@echo off
cd /d "%~dp0"
echo 🚀 Staging and pushing latest Ticketary AI updates to GitHub...
git add .
git commit -m "feat(ai): add NVIDIA AI diagnostic analysis and ping assistant"
git push origin main
echo.
echo ✅ Successfully pushed to GitHub! Now run 'git pull origin main' on your VPS.
pause
