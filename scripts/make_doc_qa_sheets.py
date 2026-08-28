import os
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
RENDER = Path(os.environ.get("DOC_QA_RENDER", ROOT / "tmp" / "docs_render"))


def natural_key(path):
    tail = path.stem.rsplit("-", 1)[-1]
    return int(tail) if tail.isdigit() else tail


for page_dir in sorted(p for p in RENDER.iterdir() if p.is_dir()):
    pages = sorted(page_dir.glob("*.png"), key=natural_key)
    if not pages:
        continue
    thumb_width = 720
    gap = 24
    label_height = 34
    thumbs = []
    for index, page in enumerate(pages, 1):
        image = Image.open(page).convert("RGB")
        height = round(image.height * thumb_width / image.width)
        image = image.resize((thumb_width, height), Image.Resampling.LANCZOS)
        thumbs.append((index, image))
    columns = 2
    rows = (len(thumbs) + columns - 1) // columns
    cell_height = max(image.height for _, image in thumbs) + label_height
    sheet = Image.new("RGB", (columns * thumb_width + (columns + 1) * gap, rows * cell_height + (rows + 1) * gap), "#d8d5cf")
    draw = ImageDraw.Draw(sheet)
    for position, (page_number, image) in enumerate(thumbs):
        row, column = divmod(position, columns)
        x = gap + column * (thumb_width + gap)
        y = gap + row * cell_height
        sheet.paste(image, (x, y + label_height))
        draw.text((x, y + 7), f"PAGE {page_number}", fill="#2e2924")
    sheet.save(RENDER / f"{page_dir.name}_CONTACT.png", optimize=True)
    print(RENDER / f"{page_dir.name}_CONTACT.png")
