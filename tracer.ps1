param([Parameter(ValueFromRemainingArguments = $true)]$Args)
$venvPy = Join-Path $PSScriptRoot "python\.venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        & python -m venv (Join-Path $PSScriptRoot "python\.venv")
        & (Join-Path $PSScriptRoot "python\.venv\Scripts\pip.exe") install -q prompt_toolkit
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        & py -m venv (Join-Path $PSScriptRoot "python\.venv")
        & (Join-Path $PSScriptRoot "python\.venv\Scripts\pip.exe") install -q prompt_toolkit
    }
}

if (Test-Path $venvPy) {
    & $venvPy (Join-Path $PSScriptRoot "python\tracer.py") @Args
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $PSScriptRoot "python\tracer.py") @Args
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py (Join-Path $PSScriptRoot "python\tracer.py") @Args
} else {
    Write-Error "Python not found in PATH. Please install Python 3."
}
