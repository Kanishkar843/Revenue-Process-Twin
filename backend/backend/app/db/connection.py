import os
import sqlite3
from contextlib import contextmanager


def get_db_path() -> str:
    """Read DB path fresh each time — env vars may be set after module import."""
    if "REVENUE_DB_PATH" in os.environ:
        return os.environ["REVENUE_DB_PATH"]
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    default_path = os.path.join(base_dir, "data", "final", "revenue_leaks.db")
    return default_path


@contextmanager
def get_connection(row_factory: bool = True):
    """Context manager for SQLite connections. Auto-commits on success, rolls back on error."""
    conn = sqlite3.connect(get_db_path())
    if row_factory:
        conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_cursor():
    """Returns a (connection, cursor) tuple. Caller is responsible for closing."""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn, conn.cursor()
