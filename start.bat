@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if not exist node_modules\electron\dist\electron.exe (
  echo Installing dependencies...
  call npm install
)
node_modules\electron\dist\electron.exe .
if errorlevel 1 pause
