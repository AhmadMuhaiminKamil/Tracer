@echo off
setlocal
set "DIR=%~dp0"
if exist "%DIR%python\.venv\Scripts\python.exe" (
    "%DIR%python\.venv\Scripts\python.exe" "%DIR%python\tracer.py" %*
) else (
    where python >nul 2>&1 && (
        python "%DIR%python\tracer.py" %*
    ) || (
        py "%DIR%python\tracer.py" %*
    )
)
