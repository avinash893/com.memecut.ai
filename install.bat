@echo off
echo.
echo ==========================================
echo   MemeCut AI - Windows Installer v1.2.1
echo ==========================================
echo.

:: Step 1 - Enable unsigned CEP extensions
echo [1/6] Enabling unsigned extensions in registry...
REG ADD "HKCU\Software\Adobe\CSXS.11" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
REG ADD "HKCU\Software\Adobe\CSXS.10" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
REG ADD "HKCU\Software\Adobe\CSXS.9"  /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
echo    Done.

:: Step 2 - Install npm packages (frontend + backend)
echo [2/6] Installing npm packages...
call npm install
if %errorlevel% neq 0 (
    echo    WARNING: npm install had errors. Trying to continue...
)
echo    Done.

:: Step 3 - Build frontend
echo [3/6] Building frontend...
call npm run build
if %errorlevel% neq 0 (
    echo    ERROR: Build failed. See error above.
    pause & exit /b 1
)
echo    Done.

:: Step 4 - Copy to CEP extensions folder
echo [4/6] Copying to Premiere Pro extensions folder...
set DEST=%APPDATA%\Adobe\CEP\extensions\com.memecut.ai
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"

:: Copy all source folders
xcopy /e /i /q "CSXS"    "%DEST%\CSXS\"    >nul
xcopy /e /i /q "host"    "%DEST%\host\"    >nul
xcopy /e /i /q "dist"    "%DEST%\dist\"    >nul
xcopy /e /i /q "backend" "%DEST%\backend\" >nul
xcopy /e /i /q "scripts" "%DEST%\scripts\" >nul
xcopy /e /i /q "node_modules" "%DEST%\node_modules\" >nul
xcopy /e /i /q "src"     "%DEST%\src\"     >nul

:: Copy root files
copy /y "package.json"      "%DEST%\package.json"      >nul
copy /y "start-backend.bat" "%DEST%\start-backend.bat" >nul

:: Verify CSInterface.js landed in the right place
if not exist "%DEST%\dist\CSInterface.js" (
    echo    WARNING: CSInterface.js missing from installed dist!
    echo    Attempting emergency copy...
    if exist "dist\CSInterface.js" (
        copy /y "dist\CSInterface.js" "%DEST%\dist\CSInterface.js" >nul
        echo    Copied CSInterface.js successfully.
    ) else (
        echo    FAILED: Cannot find CSInterface.js to copy.
        echo    Extension will show 'No Sequence'. See README for manual fix.
    )
)

echo    Installed to: %DEST%

:: Step 6 - Create meme + data folders
echo [6/6] Creating meme folder structure...
for %%d in (funny angry sad surprised cringe hype fail rage victory confusion sus emotional) do (
    mkdir "%DEST%\assets\memes\%%d" >nul 2>&1
)
mkdir "%DEST%\backend\data\temp" >nul 2>&1
echo    Done.

echo.
echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo   CSInterface.js check:
if exist "%DEST%\dist\CSInterface.js" (
    echo   [OK] dist\CSInterface.js is present - Premiere connection ENABLED
) else (
    echo   [!!] dist\CSInterface.js is MISSING - extension will NOT connect
    echo        Download from: https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/CSInterface.js
    echo        Copy to: %DEST%\dist\CSInterface.js
)
echo.
echo Next steps:
echo   1. Restart Adobe Premiere Pro
echo   2. Window ^> Extensions ^> MemeCut AI
echo   3. Double-click start-backend.bat  (keep it running!)
echo   4. Set your Gemini API key in Settings tab
echo   5. Open a project and check DEBUG tab - should show CSInterface: OK
echo.
pause
