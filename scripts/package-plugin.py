"""Package the portable plugin and its local catalog using an explicit file list."""
from hashlib import sha256
from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parent.parent
plugin = root / "plugins" / "jarvis-ultron"
version = json.loads((plugin / "plugin.json").read_text(encoding="utf-8"))["version"]
files = [
    ".agents/plugins/marketplace.json",
    "plugins/jarvis-ultron/plugin.json",
    "plugins/jarvis-ultron/mcp.json",
    "plugins/jarvis-ultron/server.mjs",
    "plugins/jarvis-ultron/bridge.mjs",
    "plugins/jarvis-ultron/skills/jarvis/SKILL.md",
]
output = root / "release"
output.mkdir(exist_ok=True)
archive = output / f"Jarvis-Ultron-{version}.zip"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
    for name in files:
        source = root / name
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Invalid package file: {name}")
        bundle.write(source, name)
digest = sha256(archive.read_bytes()).hexdigest()
Path(str(archive) + ".sha256").write_text(f"{digest}  {archive.name}\n", encoding="utf-8")
print(f"Plugin packaged: {archive.name} ({len(files)} files)")
