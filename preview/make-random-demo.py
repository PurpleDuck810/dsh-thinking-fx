"""画出「每次运行随机抽一张」的示意：五条运行状态行，各用一张表情。"""

from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    FONT = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 28)
    SMALL = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 20)
    TITLE = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 24)
except OSError:
    FONT = SMALL = TITLE = ImageFont.load_default()
BG = (13, 15, 22, 255)
TEXT = (111, 150, 255, 255)
LABEL = (150, 158, 178, 255)

names = ["咬牙", "平静", "泪眼", "无奈", "开心"]
label = "深度求索中，用时 4分45秒 ···"
pad = 24
row_h = 96
width = 900
height = pad * 2 + 40 + row_h * 5
sheet = Image.new("RGBA", (width, height), BG)
d = ImageDraw.Draw(sheet)
d.text((pad, pad), "每张都是一段循环动画，每次运行随机抽一张（40px）", font=TITLE, fill=LABEL)

y = pad + 40
for i in range(5):
    frame = Image.open(os.path.join(ROOT, "assets", f"still-{i}.png")).convert("RGBA")
    frame = frame.resize((80, 80), Image.LANCZOS)
    sheet.alpha_composite(frame, (pad + 60, y + (row_h - 80) // 2))
    d.text((pad, y + row_h // 2 - 14), f"第 {i + 1} 次", font=SMALL, fill=LABEL)
    d.text((pad + 60 + 80 + 16, y + row_h // 2 - 18), label, font=FONT, fill=TEXT)
    d.text((width - 120, y + row_h // 2 - 12), names[i], font=SMALL, fill=LABEL)
    y += row_h

sheet.save(os.path.join(ROOT, "preview", "random-demo.png"))
print("random-demo", sheet.size)
