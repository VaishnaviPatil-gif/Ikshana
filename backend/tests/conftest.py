import os
import sys
import pathlib

BACKEND = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
# Isolated SQLite DB for the API tests (never touches the demo DB)
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{BACKEND / 'test_oilspill.db'}")
