"""
storage.py — JSON-backed persistent storage abstraction.
Drop-in replaceable with SQLite later without touching other modules.
"""
import json
import asyncio
from pathlib import Path
from typing import Any

import config

_locks: dict[str, asyncio.Lock] = {}


def _lock_for(path: Path) -> asyncio.Lock:
    key = str(path)
    if key not in _locks:
        _locks[key] = asyncio.Lock()
    return _locks[key]


async def read(filename: str) -> Any:
    path = config.DATA_DIR / filename
    async with _lock_for(path):
        if not path.exists():
            return None
        return json.loads(path.read_text())


async def write(filename: str, data: Any) -> None:
    path = config.DATA_DIR / filename
    async with _lock_for(path):
        path.write_text(json.dumps(data, indent=2))


async def read_or_default(filename: str, default: Any) -> Any:
    result = await read(filename)
    return result if result is not None else default
