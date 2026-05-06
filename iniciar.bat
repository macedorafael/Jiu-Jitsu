@echo off
echo ============================================
echo   Academia Jiu-Jitsu
echo ============================================
echo.

echo Encerrando processos anteriores...
powershell -Command "Get-Process -Name python, pythonw -ErrorAction SilentlyContinue | Stop-Process -Force" >nul 2>&1

timeout /t 2 /nobreak >nul

echo Liberando portas...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo Iniciando Backend (nova aba)...
start "Academia - Backend" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

timeout /t 5 /nobreak >nul

echo Iniciando Frontend (nova aba)...
start "Academia - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================
echo  Sistema iniciado!
echo  Frontend: http://localhost:5173
echo  API Docs: http://localhost:8000/docs
echo.
echo  Login root:  root@academia.com / root123
echo ============================================
