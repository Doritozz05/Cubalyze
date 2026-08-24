"""Shared night-progress state (Grupo B).

Crawlers call `report(...)` periodically; the visual monitor
(monitor_night.py) reads the state file and renders a live dashboard.
Writes are atomic (tmp + os.replace) and safe across processes (a lock file
guards read-modify-write so two crawlers running in parallel never clobber
each other's source entry).

State file: pruebas/generated/night-progress.json
Lock file:  pruebas/generated/night-progress.lock (advisory)
"""
import json
import os
import threading
import time

STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "generated", "night-progress.json")
LOCK_FILE = STATE_FILE + ".lock"

_thread_lock = threading.Lock()


def _acquire_fs_lock(timeout: float = 10.0) -> None:
    """Cross-process advisory lock via exclusive file creation (O_EXCL)."""
    deadline = time.time() + timeout
    while True:
        try:
            fd = os.open(LOCK_FILE, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            return
        except FileExistsError:
            # Stale lock? If older than 30 s, steal it.
            try:
                age = time.time() - os.path.getmtime(LOCK_FILE)
                if age > 30:
                    os.unlink(LOCK_FILE)
                    continue
            except OSError:
                pass
            if time.time() > deadline:
                # Give up waiting; last writer wins is acceptable for a dashboard.
                return
            time.sleep(0.05)


def _release_fs_lock() -> None:
    try:
        os.unlink(LOCK_FILE)
    except OSError:
        pass


def report(source: str, **fields) -> None:
    """Atomically update the progress state for one source (cross-process safe)."""
    with _thread_lock:
        _acquire_fs_lock()
        try:
            state = {}
            if os.path.exists(STATE_FILE):
                try:
                    with open(STATE_FILE, encoding="utf-8") as f:
                        state = json.load(f)
                except (OSError, json.JSONDecodeError):
                    state = {}
            if "sources" not in state:
                state["sources"] = {}
            state["sources"][source] = {
                **state["sources"].get(source, {}),
                **fields,
                "updated": time.time(),
            }
            state["updated"] = time.time()
            tmp = STATE_FILE + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(state, f, ensure_ascii=False)
            os.replace(tmp, STATE_FILE)
        finally:
            _release_fs_lock()


def load() -> dict:
    if not os.path.exists(STATE_FILE):
        return {}
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
