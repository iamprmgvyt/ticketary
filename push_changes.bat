@echo off
cd /d "%~dp0"
echo ========================================================
echo 🚀 Ticketary Auto-Publisher to GitHub
echo ========================================================
git add .
git commit -m "feat: AI 5-questions auto interview, setup 6 steps with optional category & publish persistence"
git push origin main
echo.
echo ========================================================
echo ✅ DONE! Changes published to GitHub successfully.
echo ➡️ Now on your VPS terminal, run:
echo    git pull origin main
echo    pm2 restart all
echo ========================================================
pause
