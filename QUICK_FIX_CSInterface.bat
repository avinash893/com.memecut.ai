@echo off
:: ============================================================
::  MemeCut AI - Quick Fix for "No Sequence" / CSInterface issue
::  Run this if the extension shows "No Sequence" after install.
::  No rebuild needed — just patches the installed dist folder.
:: ============================================================

echo.
echo ============================================================
echo   MemeCut AI - CSInterface Quick Fix
echo ============================================================
echo.
echo This patches your installed extension to fix "No Sequence".
echo.

set DEST=%APPDATA%\Adobe\CEP\extensions\com.memecut.ai
set HTML=%DEST%\dist\index.html
set CSI=%DEST%\dist\CSInterface.js

:: Check extension is installed
if not exist "%DEST%" (
    echo ERROR: Extension not found at %DEST%
    echo Run install.bat first.
    pause & exit /b 1
)

if not exist "%HTML%" (
    echo ERROR: dist\index.html not found.
    echo Run install.bat to rebuild.
    pause & exit /b 1
)

echo [1/2] Copying CSInterface.js to dist\...
copy /y "%~dp0src\public\CSInterface.js" "%CSI%" >nul
if %errorlevel% neq 0 (
    echo ERROR: Could not copy CSInterface.js
    pause & exit /b 1
)
echo    Done. CSInterface.js is now at %CSI%

echo [2/2] Patching dist\index.html...
:: Use PowerShell to inject the script tag
powershell -NoProfile -Command ^
  "$html = Get-Content '%HTML%' -Raw; ^
   if ($html -match 'CSInterface\.js') { ^
     Write-Host '   Already patched.' ^
   } else { ^
     $html = $html -replace '</head>', '  <script src=""./CSInterface.js""></script>`n</head>'; ^
     Set-Content -Path '%HTML%' -Value $html -NoNewline; ^
     Write-Host '   Injected script tag.' ^
   }"
echo    Done.

echo.
echo ============================================================
echo   Fix Applied!
echo ============================================================
echo.
echo   Now:
echo   1. Close MemeCut AI panel in Premiere
echo   2. Reopen: Window ^> Extensions ^> MemeCut AI
echo   3. Go to DEBUG tab - CSInterface should show: [OK] loaded
echo   4. Sequence name should appear in the header
echo.
pause
