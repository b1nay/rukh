#!/bin/sh
set -e

# The image carries a demo database generated at build time (see Dockerfile).
# First start: an empty data volume gets a copy of it.
# RUKH_DEMO_RESET=true replaces an existing database with a fresh copy, keeping a backup.
DB=/data/rukh.db
DEMO=/app/demo/rukh.db

if [ -f "$DEMO" ]; then
  if [ ! -f "$DB" ]; then
    cp "$DEMO" "$DB"
    echo "Loaded the demo database into $DB"
  elif [ "$RUKH_DEMO_RESET" = "true" ]; then
    backup="$DB.$(date +%Y%m%d-%H%M%S).bak"
    mv "$DB" "$backup"
    cp "$DEMO" "$DB"
    echo "Replaced $DB with the demo database (previous copy: $backup)"
  fi
fi

exec "$@"
