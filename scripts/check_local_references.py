from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent.parent
SOURCE_SUFFIXES = {".html", ".css", ".oan~"}
IGNORED_DIRECTORIES = {".git", "node_modules"}
ASSET_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}
ATTRIBUTE_PATTERN = re.compile(
    r"(?:src|href|data)\s*=\s*(?:[\"']([^\"']+)[\"']|([^\s>]+))",
    re.IGNORECASE,
)
CSS_URL_PATTERN = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)", re.IGNORECASE)
EXPERIENCE_DATA = ROOT / "assets" / "data" / "experience.json"


def exists_with_exact_case(target: Path) -> bool:
    try:
        relative = target.relative_to(ROOT)
    except ValueError:
        return False

    current = ROOT
    for segment in relative.parts:
        try:
            entries = {entry.name for entry in current.iterdir()}
        except (FileNotFoundError, NotADirectoryError):
            return False
        if segment not in entries:
            return False
        current /= segment
    return current.exists()


def is_ignored(source: Path) -> bool:
    return any(part in IGNORED_DIRECTORIES for part in source.relative_to(ROOT).parts)


def validate_experience_data() -> None:
    data = json.loads(EXPERIENCE_DATA.read_text(encoding="utf-8"))
    errors: list[str] = []
    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", data.get("lastUpdated", "")):
        errors.append("lastUpdated must use YYYY-MM-DD")

    identity = data.get("identity", {})
    for field in ("name", "title", "summary", "source"):
        if not identity.get(field):
            errors.append(f"identity.{field} is required")

    records = []
    for section in ("experience", "education", "certifications", "projects"):
        items = data.get(section)
        if not isinstance(items, list) or not items:
            errors.append(f"{section} must be a non-empty list")
            continue
        records.extend((section, item) for item in items)

    ids: set[str] = set()
    all_html = "\n".join(
        source.read_text(encoding="utf-8-sig", errors="replace")
        for source in ROOT.rglob("*.html")
        if not is_ignored(source)
    )
    for section, record in records:
        record_id = record.get("id", "")
        if not record_id:
            errors.append(f"{section} record is missing id")
        elif record_id in ids:
            errors.append(f"duplicate experience id: {record_id}")
        else:
            ids.add(record_id)
        for field in ("summary", "source"):
            if not record.get(field):
                errors.append(f"{record_id or section}.{field} is required")

        source_reference = record.get("source", "")
        source_path, _, fragment = source_reference.partition("#")
        target = ROOT / source_path
        if source_path and not exists_with_exact_case(target.resolve()):
            errors.append(f"{record_id or section}.source does not exist: {source_path}")
        if fragment and not re.search(rf"\bid=[\"']{re.escape(fragment)}[\"']", all_html):
            errors.append(f"{record_id or section}.source anchor does not exist: #{fragment}")

    serialized = json.dumps(data)
    if re.search(r"[\w.+-]+@[\w.-]+\.[a-z]{2,}", serialized, re.IGNORECASE):
        errors.append("experience data must not contain email addresses")
    if re.search(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}", serialized):
        errors.append("experience data must not contain phone numbers")

    for required_path in (
        ROOT / "js" / "digital-twin.js",
        ROOT / "js" / "digital-twin-worker.js",
        ROOT / "partials" / "digital-twin.html",
        ROOT / "css" / "digital-twin.css",
    ):
        if not exists_with_exact_case(required_path):
            errors.append(f"required digital twin file is missing: {required_path.relative_to(ROOT)}")

    if errors:
        print(f"Invalid experience data ({len(errors)}):")
        print("\n".join(errors))
        raise SystemExit(1)


missing: list[str] = []
validate_experience_data()
outside_asset_root = [
    source.relative_to(ROOT)
    for source in ROOT.rglob("*")
    if source.is_file()
    and not is_ignored(source)
    and source.suffix.lower() in ASSET_SUFFIXES
    and source.relative_to(ROOT).parts[0] != "assets"
]

if outside_asset_root:
    print("Files outside the assets directory:")
    print("\n".join(map(str, outside_asset_root)))
    raise SystemExit(1)

for source in ROOT.rglob("*"):
    if not source.is_file() or is_ignored(source) or source.suffix.lower() not in SOURCE_SUFFIXES:
        continue

    contents = source.read_text(encoding="utf-8-sig", errors="replace")
    searchable_contents = contents
    if source.suffix.lower() != ".css":
        searchable_contents = re.sub(
            r"(<script\b[^>]*>).*?(</script>)",
            r"\1\2",
            contents,
            flags=re.IGNORECASE | re.DOTALL,
        )
    pattern = CSS_URL_PATTERN if source.suffix.lower() == ".css" else ATTRIBUTE_PATTERN
    for match in pattern.finditer(searchable_contents):
        reference = next((group for group in match.groups() if group is not None), "").strip()
        if not reference or re.match(r"^(?:#|[a-z]+:|//)", reference, re.IGNORECASE):
            continue

        clean_reference = unquote(re.split(r"[?#]", reference, maxsplit=1)[0])
        source_relative = source.relative_to(ROOT)
        base = ROOT if source_relative.parts[0] == "partials" else source.parent
        target = ROOT / clean_reference.lstrip("/") if clean_reference.startswith("/") else base / clean_reference
        target = target.resolve()

        if not exists_with_exact_case(target):
            line = searchable_contents.count("\n", 0, match.start()) + 1
            missing.append(f"{source_relative}:{line} -> {reference}")

if missing:
    print(f"Broken local references ({len(missing)}):")
    print("\n".join(missing))
    raise SystemExit(1)

print("All raster/PDF assets are grouped under assets/.")
print("All local HTML and CSS references resolve with exact filename casing.")
print("Experience data has a valid schema, unique IDs, and working source references.")
