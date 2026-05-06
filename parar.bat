@echo off
echo Encerrando Academia Jiu-Jitsu...

powershell -Command "Get-Process -Name python, pythonw -ErrorAction SilentlyContinue | Stop-Process -Force"
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*Academia*' } | Stop-Process -Force"

timeout /t 1 /nobreak >nul

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Sistema encerrado.
