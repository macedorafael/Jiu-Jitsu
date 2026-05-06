@echo off
echo ============================================
echo   Instalando Academia Jiu-Jitsu
echo ============================================

echo.
echo [1/4] Criando ambiente virtual Python...
cd backend
python -m venv venv
call venv\Scripts\activate

echo.
echo [2/4] Instalando dependencias Python...
pip install -r requirements.txt

echo.
echo [3/4] Copiando arquivo de configuracao...
if not exist .env (
  copy .env.example .env
  echo IMPORTANTE: Edite o arquivo backend\.env com suas configuracoes!
)

echo.
echo [4/4] Instalando dependencias do frontend...
cd ..\frontend
call npm install

echo.
echo ============================================
echo   Instalacao concluida!
echo   Execute iniciar.bat para rodar o sistema
echo ============================================
pause
