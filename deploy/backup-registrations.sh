#!/usr/bin/env bash
set -euo pipefail

source_file="/var/lib/katbuu-warranty/registrations.json"
backup_dir="/var/backups/katbuu-warranty"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"

install -d -m 700 "$backup_dir"
python3 -m json.tool "$source_file" >/dev/null
install -m 600 "$source_file" "$backup_dir/registrations-$timestamp.json"

