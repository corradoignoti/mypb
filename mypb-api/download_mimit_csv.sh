#!/usr/bin/env bash
set -euo pipefail

print_help() {
    cat <<EOF
Usage: $(basename "$0") [dest_dir]

Download MIMIT fuel price CSV files into dest_dir.

Arguments:
  dest_dir     Destination directory for downloaded files (default: source-files)

Options:
  -h, --help   Show this help and exit

Examples:
  $(basename "$0")
  $(basename "$0") ./source-files
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_help
    exit 0
fi

DEST_DIR="${1:-source-files}"
mkdir -p "$DEST_DIR"

FILES=(
  "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
  "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
)

for url in "${FILES[@]}"; do
  filename=$(basename "$url")
  echo "Downloading $filename..."
  curl -sSL -o "$DEST_DIR/$filename" "$url"
done

echo "Done. Files in $DEST_DIR/"
