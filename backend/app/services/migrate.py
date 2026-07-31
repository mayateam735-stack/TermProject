"""Lightweight additive migrations, run once at startup.

SQLAlchemy's `create_all()` creates missing TABLES but never ALTERs existing
ones — so a new model column on an already-deployed database (SQLite locally,
Postgres on Neon) otherwise needs a manual `ALTER TABLE`. We hit exactly that
with `reminders.start_date` twice.

This reconciles the common case — *adding* columns — by comparing each mapped
table against the live schema and issuing a dialect-correct
`ALTER TABLE ... ADD COLUMN` for anything the model has but the DB doesn't. It
deliberately does NOT drop, rename, or retype columns; do those by hand.
"""
from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateColumn

from ..database import Base, engine


def ensure_columns(bind: Engine = engine) -> list[str]:
    """Add any model columns missing from existing tables. Returns what it added."""
    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())
    added: list[str] = []

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue  # brand-new table — create_all() already handled it
        db_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in db_cols:
                continue
            col_def = str(CreateColumn(col).compile(dialect=bind.dialect)).strip()
            try:
                with bind.begin() as conn:
                    conn.execute(text(f"ALTER TABLE {table.name} ADD COLUMN {col_def}"))
                added.append(f"{table.name}.{col.name}")
            except Exception as exc:  # e.g. NOT NULL w/o default on a populated table
                print(f"[migrate] skipped {table.name}.{col.name}: {exc}")
    return added
