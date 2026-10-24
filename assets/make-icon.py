"""生成插件市场/管理器卡片用的 icon.png：深色圆角底 + 开心的表情包线稿。"""

from PIL import Image, ImageDraw, ImageFont
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = 256
RADIUS = 58


def ink_alpha(path):
    im = Image.open(path).convert("RGB")
    rgb = np.asarray(im, dtype=np.float32) / 255.0
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    paper = float(np.percentile(lum, 90))
    ink = float(np.percentile(lum, 1))
    span = max(paper - ink, 1e-3)
    a = np.clip((paper - lum) / span, 0.0, 1.0)
    a[a < 0.10] = 0.0
    return np.clip((a - 0.10) / 0.90, 0, 1) ** 0.9


# 深蓝到近黑的竖向渐变底
top = np.array([26, 38, 74], dtype=np.float32)
bottom = np.array([11, 15, 28], dtype=np.float32)
bg = np.zeros((SIZE, SIZE, 4), dtype=np.uint8)
for y in range(SIZE):
    t = y / (SIZE - 1)
    color = top * (1 - t) + bottom * t
    bg[y, :, :3] = color.round().astype(np.uint8)
bg[..., 3] = 255
bg_img = Image.fromarray(bg, "RGBA")

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=RADIUS, fill=255)

card = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
card.alpha_composite(bg_img)
card.putalpha(mask)

# 内描边
stroke = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(stroke).rounded_rectangle(
    (1, 1, SIZE - 2, SIZE - 2), radius=RADIUS - 1, outline=(120, 150, 230, 90), width=2
)
card.alpha_composite(stroke)

# 开心那张（源文件 e）
still = Image.open(os.path.join(HERE, "still-4.png")).convert("RGBA")
ys, xs = np.where(np.asarray(still)[..., 3] > 50)
crop = still.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
glyph = np.asarray(crop).copy()
glyph[..., 0], glyph[..., 1], glyph[..., 2] = 180, 203, 255
glyph_img = Image.fromarray(glyph, "RGBA")
scale = 190 / max(glyph_img.size)
glyph_img = glyph_img.resize(
    (max(1, round(glyph_img.width * scale)), max(1, round(glyph_img.height * scale))),
    Image.LANCZOS,
)
card.alpha_composite(
    glyph_img,
    ((SIZE - glyph_img.width) // 2, (SIZE - glyph_img.height) // 2 + 6),
)

out = os.path.join(HERE, "..", "icon.png")
card.save(out)
print(out, card.size)
