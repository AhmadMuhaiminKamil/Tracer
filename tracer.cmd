@echo off
setlocal
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python "%~dp0python\tracer.py" %*
) else (
    py "%~dp0python\tracer.py" %*
)
