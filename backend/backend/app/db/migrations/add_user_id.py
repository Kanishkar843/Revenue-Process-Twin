"""
add_user_id.py — Migration script to add user_id column to all business tables
and create the business_profiles table for multi-tenant SaaS support.

Run once:  python app/db/migrations/add_user_id.py
"""
import os
import sys
import sqlite3

# Ensure we can import from app package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.db.connection import get_db_path


TABLES_TO_ADD_USER_ID = [
    "customers",
    "invoices",
    "payments",
    "transactions",
    "renewals",
    "event_log",
    "alerts",
    "audit_log",
]

CREATE_BUSINESS_PROFILES = """
CREATE TABLE IF NOT EXISTS business_profiles (
    user_id       TEXT PRIMARY KEY,
    email         TEXT,
    company_name  TEXT,
    business_type TEXT,
    company_size  TEXT,
    revenue_model TEXT,
    currency      TEXT DEFAULT 'INR',
    created_at    TEXT DEFAULT (datetime('now'))
);
"""


def migrate():
    db_path = get_db_path()
    print(f"Migrating database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Add user_id column to each business table (ignore if already exists)
    for table in TABLES_TO_ADD_USER_ID:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN user_id TEXT DEFAULT 'system';")
            print(f"  ✓ Added user_id to {table}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"  - {table}: user_id already exists, skipping")
            else:
                print(f"  ! {table}: {e}")

    # 2. Create business_profiles table
    cursor.execute(CREATE_BUSINESS_PROFILES)
    print("  ✓ Created/verified business_profiles table")

    # 3. Create index on user_id for fast tenant-scoped queries
    for table in TABLES_TO_ADD_USER_ID:
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_user_id ON {table}(user_id);")
            print(f"  ✓ Index on {table}.user_id")
        except sqlite3.OperationalError as e:
            print(f"  ! Index {table}: {e}")

    conn.commit()
    conn.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    migrate()
