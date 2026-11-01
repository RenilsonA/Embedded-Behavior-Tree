#!/usr/bin/env sh
# BTree Studio - Linux / macOS
cd "$(dirname "$0")" || exit 1
python3 -c "import serial" 2>/dev/null || echo "(dica) para UART pelo servidor: pip install pyserial"
exec python3 studio.py "$@"
