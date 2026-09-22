param([Parameter(ValueFromRemainingArguments = $true)]$Args)
if (Get-Command python -ErrorAction SilentlyContinue) {
    & python "$PSScriptRoot\python\tracer.py" @Args
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py "$PSScriptRoot\python\tracer.py" @Args
} else {
    Write-Error "Python not found in PATH. Please install Python 3."
}
