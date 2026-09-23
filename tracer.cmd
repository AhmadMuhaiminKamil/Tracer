@echo off
setlocal
set "DIR=%~dp0"
if not exist "%DIR%python\.venv\Scripts\python.exe" (
    where python >nul 2>&1 && (
        python -m venv "%DIR%python\.venv"
        "%DIR%python\.venv\Scripts\pip.exe" install -q prompt_toolkit
    ) || (
        py -m venv "%DIR%python\.venv"
        "%DIR%python\.venv\Scripts\pip.exe" install -q prompt_toolkit
    )
)

if exist "%DIR%python\.venv\Scripts\python.exe" (
    "%DIR%python\.venv\Scripts\python.exe" "%DIR%python\tracer.py" %*
) else (
    where python >nul 2>&1 && (
        python "%DIR%python\tracer.py" %*
    ) || (
        py "%DIR%python\tracer.py" %*
    )
)
