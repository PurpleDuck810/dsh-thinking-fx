"""生成用于展示/README 的对比图：行内尺寸对比 + 五张表情。"""

from PIL import Image, ImageDraw, ImageFont
import os
import shutil

PREVIEW = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(os.path.dirname(PREVIEW), "assets", "work")
try:
    FONT = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 22)
except OSError:
    FONT = ImageFont.load_default()
BG = (13, 15, 22, 255)
LABEL = (150, 158, 178, 255)

rows = [
    ("原版：14px 图标 / 12px 文字", "row-none.png"),
    ("本插件：52px 图标 / 16.8px 文字", "row-glyph52.png"),
]
pad = 20
label_w = 330
imgs = [(label, Image.open(os.path.join(PREVIEW, name)).convert("RGBA")) for label, name in rows]
w = pad * 2 + label_w + max(im.width for _, im in imgs)
h = pad * 2 + sum(im.height for _, im in imgs) + 18 * (len(imgs) - 1)
sheet = Image.new("RGBA", (w, h), BG)
d = ImageDraw.Draw(sheet)
y = pad
for label, im in imgs:
    d.text((pad, y + im.height // 2 - 14), label, font=FONT, fill=LABEL)
    sheet.alpha_composite(im, (pad + label_w, y))
    y += im.height + 18
sheet.save(os.path.join(PREVIEW, "row-compare.png"))
print("row-compare", sheet.size)

ROOT = os.path.dirname(PREVIEW)
keys = [
    ("still-0.png", "咬牙"),
    ("still-1.png", "平静"),
    ("still-2.png", "泪眼"),
    ("still-3.png", "无奈"),
    ("still-4.png", "开心"),
]
cell, gap = 96, 18
sw = pad * 2 + len(keys) * (cell + gap)
sh = pad * 2 + cell + 34
strip = Image.new("RGBA", (sw, sh), BG)
sd = ImageDraw.Draw(strip)
for i, (name, label) in enumerate(keys):
    im = Image.open(os.path.join(ROOT, "assets", name)).convert("RGBA")
    im = im.resize((64, 64), Image.LANCZOS)
    x = pad + i * (cell + gap)
    strip.alpha_composite(im, (x + (cell - im.width) // 2, pad + (cell - im.height) // 2))
    tw = sd.textlength(label, font=FONT)
    sd.text((x + (cell - tw) / 2, pad + cell + 6), label, font=FONT, fill=LABEL)
strip.save(os.path.join(PREVIEW, "expressions.png"))
print("expressions", strip.size)
