@echo off
setlocal
set "PATH=C:\Program Files\nodejs;%PATH%"
set "PROJECT_DIR=%~dp0"

start "Conferencia de Folha - Servidor" /min cmd /c "cd /d "%PROJECT_DIR%server" && npm start"

timeout /t 3 /nobreak >nul

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000

endlocal
