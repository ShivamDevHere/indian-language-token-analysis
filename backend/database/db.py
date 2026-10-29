"""db.py - database access.
TODO: set up SQLite (or similar) tables for runs, results and test cases, plus simple helper functions."""

"""
database/db.py - tiny SQLite helper (connect + run migrations).

WHY SQLITE?
    It is a single file, needs no server, and is built into Python. Perfect for
    a hackathon laptop. If the project grows, only this file and repository.py
    need to change (for example to PostgreSQL).

HOW IT IS USED
    configure(path)   -> tell the module where the database file is (once)
    init_db()         -> create / upgrade tables
    session()         -> `with session() as conn:` gives a connection that is
                         committed on success and rolled back on error.

Every call opens its own connection, which makes it safe to use from the
background benchmark thread and from Flask request threads at the same time.
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .schema import MIGRATIONS

_db_path = None


def configure(path) -> None:
    """Set the database file location and make sure its folder exists."""
    global _db_path
    _db_path = str(path)
    Path(_db_path).parent.mkdir(parents=True, exist_ok=True)


def get_db_path() -> str:
    if _db_path is None:
        raise RuntimeError("Database not configured. Call database.db.configure(path) first.")
    return _db_path


def connect() -> sqlite3.Connection:
    """Open a new connection. Rows behave like dicts (row['column'])."""
    conn = sqlite3.connect(get_db_path(), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite ignores foreign keys unless asked
    return conn


@contextmanager
def session():
    """Context manager: commit if the block succeeds, roll back if it raises."""
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> int:
    """Apply any migrations that have not run yet. Returns the schema version."""
    conn = connect()
    try:
        conn.execute("PRAGMA journal_mode = WAL")  # readers do not block the writer
        current = conn.execute("PRAGMA user_version").fetchone()[0]
        for version, sql in enumerate(MIGRATIONS, start=1):
            if version > current:
                conn.executescript(sql)
                conn.execute(f"PRAGMA user_version = {version}")
        conn.commit()
        return conn.execute("PRAGMA user_version").fetchone()[0]
    finally:
        conn.close()