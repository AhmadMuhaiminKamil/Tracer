"""The command list, in one place, for both the CLI and the web composer.

Single source: the CLI registers these with readline, the web route serves them
to the composer. A second copy would drift the moment one gains a command.
"""

COMMANDS = [
    {"cmd": "/scan", "args": "", "en": "list the latest clusters", "id": "daftar cluster terbaru"},
    {"cmd": "/detail", "args": "<TICKER>", "en": "one issuer's detail and filings", "id": "detail satu emiten dan filingnya"},
    {"cmd": "/newdata", "args": "", "en": "pull fresh data from Sectors (1 credit)", "id": "tarik data baru dari Sectors (1 kredit)"},
    {"cmd": "/history", "args": "", "en": "conversation history", "id": "riwayat percakapan"},
    {"cmd": "/session", "args": "", "en": "open the session picker", "id": "buka pemilih sesi"},
    {"cmd": "/help", "args": "", "en": "this help", "id": "bantuan ini"},
    {"cmd": "/quit", "args": "", "en": "exit", "id": "keluar"},
]

NAMES = [c["cmd"] for c in COMMANDS]

# Aliases the REPL also accepts; they complete but are not listed.
ALIASES = {
    "/sessions": "/session",
    "/tracer session": "/session",
    "/tracer sessions": "/session",
    "tracer session": "/session",
    "/q": "/quit",
    "/exit": "/quit",
}
