from pathlib import Path
from PIL import Image, ImageDraw

source = Path(r"D:\BYU中文文化任务网站_第二稿\output\doc\rendered-review")
pages = sorted(source.glob("page-*.png"))
for group_index in range(0, len(pages), 6):
    group = pages[group_index:group_index + 6]
    thumbs = []
    for page_index, path in enumerate(group, start=group_index + 1):
        image = Image.open(path).convert("RGB")
        image.thumbnail((420, 594))
        canvas = Image.new("RGB", (440, 630), "white")
        canvas.paste(image, ((440 - image.width) // 2, 24))
        ImageDraw.Draw(canvas).text((12, 6), f"Page {page_index}", fill="black")
        thumbs.append(canvas)
    sheet = Image.new("RGB", (440 * 3, 630 * 2), "#d8d8d8")
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % 3) * 440, (index // 3) * 630))
    sheet.save(source / f"contact-{group_index + 1:02d}-{group_index + len(group):02d}.jpg", quality=88)
