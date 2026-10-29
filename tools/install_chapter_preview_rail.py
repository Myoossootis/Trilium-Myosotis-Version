"""Install only the chapter preview rail; back up first, restart to activate."""
import argparse
import json
from pathlib import Path
from install_reading_position import install

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(install(args.db, note_id="MyoChapRail", blob_id="MyoChapBlob", title="章节分级预览条",
        source_path="customizations/frontend/chapter-preview-rail.js", id_prefix="MyoChap",
        backup_label="chapter-preview-rail"), ensure_ascii=False))
