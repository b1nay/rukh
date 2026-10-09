"""Additive schema changes for existing databases.

create_all() adds new tables but never new columns. Until Alembic is set up,
each column added to an existing table is listed here and added in place.
Data is never dropped.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

# (table, column, SQL type)
ADDED_COLUMNS = [
    ("allocations", "request_id", "INTEGER REFERENCES allocation_requests(id) ON DELETE SET NULL"),
    ("travelers", "journey", "JSON"),
]


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
