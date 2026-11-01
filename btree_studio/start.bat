@echo off
rem BTree Studio - Windows
cd /d "%~dp0"
python -c "import serial" 2>NUL || echo (dica) para UART pelo servidor: pip install pyserial
python studio.py %*
