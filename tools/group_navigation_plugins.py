"""Move managed reading/navigation branches, without rewriting any script content."""
import argparse
import datetime as dt
import json
import sqlite3
from pathlib import Path
from plugin_groups import ensure_navigation_group, group_components


def group(path):
    path = path.resolve(strict=True)
    now = dt.datetime.now().astimezone()
    local = now.isoformat(sep=' ', timespec='milliseconds')
    utc = now.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    backup = path.parent / 'backup' / f'before-plugin-grouping-{now:%Y%m%d-%H%M%S-%f}.db'
    backup.parent.mkdir(exist_ok=True)
    with sqlite3.connect(path, timeout=20) as connection:
        with sqlite3.connect(backup) as destination:
            connection.backup(destination)
        connection.execute('BEGIN IMMEDIATE')
        parent = ensure_navigation_group(connection, local, utc)
        moved = group_components(connection, parent, utc)
    return {'group': '阅读与导航', 'moved': moved, 'backup': str(backup), 'restartRequired': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, required=True)
    print(json.dumps(group(parser.parse_args().db), ensure_ascii=False))
