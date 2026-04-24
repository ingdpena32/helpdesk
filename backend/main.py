"""
Punto de entrada: ejecutar desde esta carpeta (backend):

    python main.py

Arranca el API en http://127.0.0.1:8000
"""

from __future__ import annotations

import sys
from pathlib import Path

# Raíz del backend en sys.path para resolver el paquete `app`
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.main import run_server

if __name__ == "__main__":
    run_server()
