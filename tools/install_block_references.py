"""Install paragraph/heading references and their reading-position integration.

Only these two startup components are updated. A SQLite backup precedes each
update; a normal restart is required to load the scripts into existing windows.
"""
import argparse
import json
from pathlib import Path
from install_reading_position import install


def install_references(path):
    reading = install(path)
    references = install(path, note_id="MyoBlockRef1", blob_id="MyoBlockBlob", title="段落与标题引用",
                         source_path="customizations/frontend/block-references.js", id_prefix="MyoBlock",
                         backup_label="block-references")
    return [reading, references]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(install_references(args.db), ensure_ascii=False))
