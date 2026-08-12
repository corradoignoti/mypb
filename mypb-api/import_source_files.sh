#!/usr/bin/env bash
#
# import_source_files.sh
#
# Import every .csv file in source-files/ into a SQLite database.
# Each file becomes a table named after the filename (no extension).
# If the table exists it is dropped and fully recreated from the file
# (full replace); otherwise it is created fresh.
#
# CSV format assumed (matches source-files/*.csv):
#   line 1: junk banner line ("Estrazione del ...") -> skipped
#   line 2: pipe-separated column header
#   line 3+: pipe-separated data rows (all columns stored as TEXT)
#
# Parsing is done with python3's csv module (delimiter="|", no quoting)
# instead of sqlite3's `.import`, because the source data contains
# stray literal `"` characters that trip up sqlite3's CSV-quote parser.
#
# Usage:
#   ./import_source_files.sh [db_file] [source_dir]
#
# Defaults:
#   db_file    = ./mypb.db
#   source_dir = ./source-files

set -euo pipefail

print_help() {
    cat <<EOF
Usage: $(basename "$0") [db_file] [source_dir]

Import every .csv file in source_dir into a SQLite database.
Each file becomes a table named after the filename (no extension).
If the table exists it is dropped and fully recreated from the file
(full replace); otherwise it is created fresh.

Arguments:
  db_file      Path to SQLite database file (default: mypb.db)
  source_dir   Directory containing .csv files (default: source-files)

Options:
  -h, --help   Show this help and exit

CSV format assumed (matches source-files/*.csv):
  line 1: junk banner line ("Estrazione del ...") -> skipped
  line 2: pipe-separated column header
  line 3+: pipe-separated data rows (all columns stored as TEXT)

Examples:
  $(basename "$0")
  $(basename "$0") mypb.db source-files
  $(basename "$0") /tmp/test.db ./other-csvs
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_help
    exit 0
fi

DB_FILE="${1:-mypb.db}"
SRC_DIR="${2:-source-files}"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: python3 not found in PATH" >&2
    exit 1
fi

if [[ ! -d "$SRC_DIR" ]]; then
    echo "Error: source dir '$SRC_DIR' not found" >&2
    exit 1
fi

shopt -s nullglob
csv_files=("$SRC_DIR"/*.csv)
shopt -u nullglob

if [[ ${#csv_files[@]} -eq 0 ]]; then
    echo "No .csv files found in '$SRC_DIR'" >&2
    exit 1
fi

for csv_file in "${csv_files[@]}"; do
    base="$(basename "$csv_file" .csv)"
    table="$(echo "$base" | sed -E 's/[^A-Za-z0-9_]/_/g')"

    echo "Importing '$csv_file' -> table '$table' ..."

    python3 - "$DB_FILE" "$csv_file" "$table" <<'PY'
import csv
import sqlite3
import sys

db_file, csv_file, table = sys.argv[1], sys.argv[2], sys.argv[3]

with open(csv_file, newline="", encoding="utf-8") as f:
    f.readline()  # skip banner line ("Estrazione del ...")
    reader = csv.reader(f, delimiter="|", quoting=csv.QUOTE_NONE)
    header = next(reader)
    columns = [c.strip() for c in header]
    ncols = len(columns)

    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    cur.execute(f'DROP TABLE IF EXISTS "{table}"')
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    cur.execute(f'CREATE TABLE "{table}" ({col_defs})')

    placeholders = ", ".join("?" for _ in columns)
    insert_sql = f'INSERT INTO "{table}" VALUES ({placeholders})'

    rows = []
    skipped = 0
    for row in reader:
        if not row:
            continue
        if len(row) != ncols:
            skipped += 1
            row = (row + [None] * ncols)[:ncols]  # pad/truncate to fit
        rows.append(row)

    cur.executemany(insert_sql, rows)
    conn.commit()
    count = cur.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
    conn.close()

    if skipped:
        print(f"  warning: {skipped} row(s) had unexpected column count (padded/truncated)")
    print(f"  -> {count} rows loaded into '{table}'")
PY
done

echo "Done. Database: $DB_FILE"
