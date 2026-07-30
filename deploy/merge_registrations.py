#!/usr/bin/env python3
"""Merge warranty registration exports without exposing customer data."""

import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def load_records(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list) or not all(isinstance(item, dict) for item in data):
        raise ValueError(f"{path} must contain a JSON array of objects")
    return data


def record_key(record: dict) -> tuple[str, str]:
    order_id = str(record.get("amazonOrderId", "")).strip()
    if order_id:
        return ("amazonOrderId", order_id)
    record_id = str(record.get("id", "")).strip()
    if record_id:
        return ("id", record_id)
    return ("json", json.dumps(record, sort_keys=True, separators=(",", ":")))


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: merge_registrations.py CURRENT IMPORT", file=sys.stderr)
        return 2

    current_path = Path(sys.argv[1]).resolve()
    import_path = Path(sys.argv[2]).resolve()
    current = load_records(current_path)
    imported = load_records(import_path)

    merged = list(current)
    index = {record_key(item): position for position, item in enumerate(merged)}
    added = 0
    updated = 0

    for item in imported:
        key = record_key(item)
        if key in index:
            position = index[key]
            if merged[position] != item:
                merged[position] = item
                updated += 1
        else:
            index[key] = len(merged)
            merged.append(item)
            added += 1

    backup_dir = Path("/var/backups/katbuu-warranty")
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = backup_dir / f"registrations-{timestamp}.json"
    shutil.copy2(current_path, backup_path)

    fd, temp_name = tempfile.mkstemp(prefix="registrations-", suffix=".json", dir=current_path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(merged, handle, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, 0o600)
        os.replace(temp_name, current_path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)

    print(
        f"current={len(current)} imported={len(imported)} added={added} "
        f"updated={updated} total={len(merged)} backup={backup_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
