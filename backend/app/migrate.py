"""Schema changes for existing databases.

create_all() adds new tables but never new columns. Until Alembic is set up,
each column added to an existing table is listed here and added in place.
Data is never dropped.
"""

import json
import shutil
from datetime import datetime
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# (table, column, SQL type)
ADDED_COLUMNS = [
    ("allocations", "request_id", "INTEGER REFERENCES allocation_requests(id) ON DELETE SET NULL"),
    ("travelers", "journey", "JSON"),
    ("invoices", "payer_wallet", "VARCHAR(64)"),
    ("payouts", "wallet", "VARCHAR(64)"),
]

# Money moved from USD to SOL. Old columns are renamed and their amounts converted
# at this reference rate, the one the SOL prices in catalog.py were set from.
LEGACY_USD_PER_SOL = 180.0
RENAMED_MONEY = {
    "allocation_requests": ["subtotal", "fee", "total"],
    "invoices": ["subtotal", "fee", "total"],
    "allocations": ["amount", "landowner"],
    "payouts": ["amount"],
}
# Amounts inside JSON line items: table -> keys
MONEY_IN_LINES = {"invoices": ["unit_price", "amount"], "payouts": ["amount"]}


def add_missing_columns(engine: Engine) -> list[str]:
    added = []
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, column, sql_type in ADDED_COLUMNS:
            if table not in tables:
                continue
            if column not in {c["name"] for c in insp.get_columns(table)}:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sql_type}"))
                added.append(f"{table}.{column}")
    return added


def _backup_sqlite(engine: Engine) -> Path | None:
    path = engine.url.database
    if engine.url.get_backend_name() != "sqlite" or not path or path == ":memory:" or not Path(path).exists():
        return None
    backup = Path(f"{path}.{datetime.now():%Y%m%d-%H%M%S}.pre-sol.bak")
    shutil.copy2(path, backup)
    return backup


def convert_usd_to_sol(engine: Engine) -> list[str]:
    """Rename *_usd columns to *_sol and convert their amounts. Runs once; a backup is kept."""
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    todo = {
        t: [p for p in prefixes if f"{p}_usd" in {c["name"] for c in insp.get_columns(t)}]
        for t, prefixes in RENAMED_MONEY.items() if t in tables
    }
    todo = {t: p for t, p in todo.items() if p}
    if not todo:
        return []

    _backup_sqlite(engine)
    rate = LEGACY_USD_PER_SOL
    done = []
    with engine.begin() as conn:
        for table, prefixes in todo.items():
            for p in prefixes:
                conn.execute(text(f"ALTER TABLE {table} RENAME COLUMN {p}_usd TO {p}_sol"))
                conn.execute(text(f"UPDATE {table} SET {p}_sol = ROUND({p}_sol / :rate, 6)"), {"rate": rate})
                done.append(f"{table}.{p}_usd")
            if table == "allocation_requests":
                conn.execute(text("UPDATE allocation_requests SET price_per_tonne = ROUND(price_per_tonne / :rate, 6)"), {"rate": rate})
            if table in MONEY_IN_LINES:
                keys = MONEY_IN_LINES[table]
                for row_id, lines in conn.execute(text(f"SELECT id, lines FROM {table}")).all():
                    items = json.loads(lines) if isinstance(lines, str) else (lines or [])
                    for item in items:
                        for k in keys:
                            if isinstance(item.get(k), (int, float)):
                                item[k] = round(item[k] / rate, 6)
                    conn.execute(text(f"UPDATE {table} SET lines = :lines WHERE id = :id"), {"lines": json.dumps(items), "id": row_id})
    return done
