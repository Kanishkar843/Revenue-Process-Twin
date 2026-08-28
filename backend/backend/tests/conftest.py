import os
import shutil
import tempfile
import pytest
from app.db.connection import get_db_path

_SESSION_DB_BACKUP = None

@pytest.fixture(scope="session", autouse=True)
def setup_pristine_db_backup(tmp_path_factory):
    """Make a pristine backup of the seed DB at session start before any test runs."""
    global _SESSION_DB_BACKUP
    orig_db = get_db_path()
    if os.path.exists(orig_db):
        backup_dir = tmp_path_factory.mktemp("db_backup")
        _SESSION_DB_BACKUP = os.path.join(backup_dir, "pristine_seed.db")
        shutil.copy2(orig_db, _SESSION_DB_BACKUP)
    yield

@pytest.fixture(autouse=True, scope="function")
def isolate_test_db(tmp_path):
    """
    Copy pristine seed DB into a fresh temporary path for every test.
    This guarantees 100% test isolation so purge/upload tests don't affect other tests.
    """
    global _SESSION_DB_BACKUP
    if _SESSION_DB_BACKUP and os.path.exists(_SESSION_DB_BACKUP):
        test_db = os.path.join(tmp_path, "test_app.db")
        shutil.copy2(_SESSION_DB_BACKUP, test_db)
        os.environ["REVENUE_DB_PATH"] = test_db
        yield
        if "REVENUE_DB_PATH" in os.environ:
            del os.environ["REVENUE_DB_PATH"]
    else:
        yield
