"""Keeps the download list and saved defaults in a small SQLite file so they survive a restart."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pathlib import Path

    from rayohx_api.jobs import JobRecord

MAX_EVENTS = 200
#: Trim a download's log once this many lines were added since the last trim.
PRUNE_EVERY = 20
INTERRUPTED = "Interrupted: the app was closed before this download finished."


def default_db_path() -> Path:
    """Per-user app data folder, ``ColdSoft Technologies/RayoHX/rayohx.db``."""
    import sys
    from pathlib import Path

    home = Path.home()
    if sys.platform == "win32":
        base = home / "AppData" / "Local"
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support"
    else:
        base = home / ".local" / "share"
    return base / "ColdSoft Technologies" / "RayoHX" / "rayohx.db"


class Store:
    """One row per download; safe to call from the worker threads."""

    def __init__(self, path: Path) -> None:
        import sqlite3
        import threading

        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._unpruned: dict[str, int] = {}
        self._closed = False
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS jobs ("
            "id TEXT PRIMARY KEY, url TEXT NOT NULL, state TEXT NOT NULL,"
            "created_at REAL NOT NULL, updated_at REAL NOT NULL, progress TEXT,"
            "output_path TEXT, output_size INTEGER, error TEXT, quality TEXT, request TEXT)"
        )
        have = [r[1] for r in self._db.execute("PRAGMA table_info(jobs)")]
        for column in ("quality", "request"):
            if column not in have:
                self._db.execute(f"ALTER TABLE jobs ADD COLUMN {column} TEXT")
        self._db.execute("CREATE TABLE IF NOT EXISTS prefs (key TEXT PRIMARY KEY, value TEXT)")
        self._db.execute(
            "CREATE TABLE IF NOT EXISTS events ("
            "seq INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, event TEXT NOT NULL)"
        )
        self._db.execute("CREATE INDEX IF NOT EXISTS events_job ON events (job_id)")
        self._db.commit()

    def close(self) -> None:
        """Close the database; a worker still running afterwards has its writes ignored."""
        with self._lock:
            self._closed = True
            self._db.close()

    def get_pref(self, key: str) -> str | None:
        with self._lock:
            row = self._db.execute("SELECT value FROM prefs WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def set_pref(self, key: str, value: str) -> None:
        with self._lock:
            if self._closed:
                return
            self._db.execute("INSERT OR REPLACE INTO prefs VALUES (?, ?)", (key, value))
            self._db.commit()

    def load(self) -> list[JobRecord]:
        """Every saved download, oldest first. Unfinished ones are marked as interrupted."""
        import json
        import time

        from rayohx.enums import DownloadState

        from rayohx_api.jobs import JobRecord

        with self._lock:
            rows = self._db.execute(
                "SELECT id, url, state, created_at, updated_at, progress, output_path,"
                " output_size, error, quality, request FROM jobs ORDER BY created_at"
            ).fetchall()
        records = []
        for id_, url, state, created, updated, progress, path, size, error, quality, saved in rows:
            record = JobRecord(
                id=id_,
                url=url,
                state=DownloadState(state),
                created_at=created,
                updated_at=updated,
                progress=json.loads(progress) if progress else None,
                output_path=path,
                output_size=size,
                error=error,
                quality=quality,
                request=json.loads(saved) if saved else None,
            )
            record.events.extend(self.events(id_))
            if not record.state.is_terminal:
                record.state = DownloadState.FAILED
                record.error = INTERRUPTED
                record.updated_at = time.time()
                self.save(record)
            records.append(record)
        return records

    def save(self, record: JobRecord) -> None:
        import json

        progress = json.dumps(record.progress) if record.progress is not None else None
        with self._lock:
            if self._closed:
                return
            self._db.execute(
                "INSERT OR REPLACE INTO jobs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    record.id,
                    record.url,
                    record.state.value,
                    record.created_at,
                    record.updated_at,
                    progress,
                    record.output_path,
                    record.output_size,
                    record.error,
                    record.quality,
                    json.dumps(record.request, default=str) if record.request else None,
                ),
            )
            self._db.commit()

    def add_event(self, job_id: str, event: dict[str, Any]) -> None:
        """Save one log line, keeping only the last ``MAX_EVENTS`` for the download."""
        import json

        with self._lock:
            if self._closed:
                return
            self._db.execute(
                "INSERT INTO events (job_id, event) VALUES (?, ?)",
                (job_id, json.dumps(event, default=str)),
            )
            self._unpruned[job_id] = self._unpruned.get(job_id, 0) + 1
            if self._unpruned[job_id] >= PRUNE_EVERY:
                self._unpruned[job_id] = 0
                self._db.execute(
                    "DELETE FROM events WHERE job_id = ? AND seq <= ("
                    "SELECT seq FROM events WHERE job_id = ? ORDER BY seq DESC LIMIT 1 OFFSET ?)",
                    (job_id, job_id, MAX_EVENTS),
                )
            self._db.commit()

    def events(self, job_id: str) -> list[dict[str, Any]]:
        """The last ``MAX_EVENTS`` saved log lines of one download, oldest first."""
        import json

        with self._lock:
            rows = self._db.execute(
                "SELECT event FROM (SELECT seq, event FROM events WHERE job_id = ?"
                " ORDER BY seq DESC LIMIT ?) ORDER BY seq",
                (job_id, MAX_EVENTS),
            ).fetchall()
        return [json.loads(r[0]) for r in rows]

    def delete(self, job_ids: list[str]) -> None:
        ids = [(i,) for i in job_ids]
        with self._lock:
            for (job_id,) in ids:
                self._unpruned.pop(job_id, None)
            self._db.executemany("DELETE FROM jobs WHERE id = ?", ids)
            self._db.executemany("DELETE FROM events WHERE job_id = ?", ids)
            self._db.commit()
