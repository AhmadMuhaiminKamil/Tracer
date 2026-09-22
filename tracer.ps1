param([Parameter(ValueFromRemainingArguments = $true)]$Args)
$venvPy = Join-Path $PSScriptRoot "python\.venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    & $venvPy (Join-Path $PSScriptRoot "python\tracer.py") @Args
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python (Join-Path $PSScriptRoot "python\tracer.py") @Args
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py (Join-Path $PSScriptRoot "python\tracer.py") @Args
} else {
    Write-Error "Python not found in PATH. Please install Python 3."
}
