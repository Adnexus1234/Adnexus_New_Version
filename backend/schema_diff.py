"""
Schema diff script — run this ON THE VPS, inside the backend's venv.

It compares your SQLAlchemy models (source of truth) against what's
actually in the live PostgreSQL database, and prints:
  - Tables that exist in models but not in the DB
  - Columns that exist in models but not in the DB (per table)
  - (Informational) Columns that exist in the DB but not in models

It does NOT modify the database. It only reports differences so you
can write the correct ALTER TABLE statements yourself.

USAGE (on the VPS):
    cd /var/www/backend
    source venv/bin/activate
    python schema_diff.py
"""

import sys
from sqlalchemy import create_engine, inspect

# --- Adjust this import if your Base/engine live elsewhere ---
try:
    from app.models.models import Base
except ImportError as e:
    print(f"Could not import Base from app.models.models: {e}")
    print("Open this script and fix the import path if your models file")
    print("defines Base under a different module path.")
    sys.exit(1)

try:
    from app.database import SQLALCHEMY_DATABASE_URL
except ImportError:
    # Fallback: read from environment / .env manually if needed
    import os
    SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URL:
        print("Could not find SQLALCHEMY_DATABASE_URL or DATABASE_URL.")
        print("Edit this script and hardcode your DB connection string, e.g.:")
        print('  SQLALCHEMY_DATABASE_URL = "postgresql://adnexus_user:PASSWORD@localhost/adnexus_db"')
        sys.exit(1)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
inspector = inspect(engine)

db_tables = set(inspector.get_table_names())
model_tables = set(Base.metadata.tables.keys())

print("=" * 70)
print("SCHEMA DIFF: SQLAlchemy models  vs  live database")
print("=" * 70)

missing_tables = model_tables - db_tables
if missing_tables:
    print("\n[MISSING TABLES] In models but NOT in DB:")
    for t in sorted(missing_tables):
        print(f"  - {t}  (needs: CREATE TABLE)")
else:
    print("\n[OK] No missing tables.")

any_missing_cols = False
for table_name, table in Base.metadata.tables.items():
    if table_name not in db_tables:
        continue  # already reported above

    db_columns = {col["name"] for col in inspector.get_columns(table_name)}
    model_columns = {col.name for col in table.columns}

    missing_in_db = model_columns - db_columns
    extra_in_db = db_columns - model_columns

    if missing_in_db:
        any_missing_cols = True
        print(f"\n[MISSING COLUMNS] Table '{table_name}' — in models but NOT in DB:")
        for col_name in sorted(missing_in_db):
            col = table.columns[col_name]
            print(f"  - {col_name}  (type: {col.type}, nullable: {col.nullable})")

    if extra_in_db:
        print(f"\n[INFO] Table '{table_name}' — in DB but not in models (informational only):")
        for col_name in sorted(extra_in_db):
            print(f"  - {col_name}")

if not any_missing_cols and not missing_tables:
    print("\nEverything matches. No ALTER TABLE needed.")

print("\n" + "=" * 70)
print("Done. Review [MISSING COLUMNS]/[MISSING TABLES] above and write")
print("the corresponding ALTER TABLE / CREATE TABLE statements manually.")
print("=" * 70)