"""
把五张 GIF（默认放在 assets/src-gif/{1..5}.gif）做成运行状态用的五张动画 mask：

  1. 取每一帧的墨线 alpha（白底、纸纹阈值掉）；
  2. 用五张 GIF 的全局外框统一裁切，保证随机换表情时大小/位置不跳；
  3. 保留全部 120 帧（约 24fps），缩到 104×104（52px 图标的 2x 资源），
     每帧时长按 SPEED 调整（默认 1.0 = 原速 5s；小于 1 更慢）；
  4. 输出 assets/glyph-0..4.webp（各自的循环动画）和 assets/still-0..4.png
     （减少动效时用的第一帧）。

依赖：Pillow + numpy。换素材后跑：
  & <python> assets/build-glyph.py && node build.mjs
"""

from PIL import Image
import numpy as np
import os

HERE = os.path.dirname(os.path.abspath(__file__))
GIF_DIR = os.environ.get("THINKING_FX_GIF_DIR", os.path.join(HERE, "src-gif"))
FILES = ["1.gif", "2.gif", "3.gif", "4.gif", "5.gif"]
SIZE = 104
PAD = 2
SPEED = 1.0       # 1.0 = 原 GIF 速度/帧率（5s、120 帧、约 24fps）；<1 更慢但会降低有效帧率
SAMPLE = 4        # 求全局外框/阈值时的采样间隔
QUALITY = 20      # 颜色是纯色，画质参数只影响体积
ALPHA_QUALITY = 100
ALPHA_LEVELS = 4  # 把 alpha 量化成 4 级：52px 下几乎看不出，体积约为原来的 1/2

LUMA = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def lum_of(im):
    rgb = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    return rgb @ LUMA


def alpha_of(lum, paper, ink):
    span = max(paper - ink, 1e-3)
    a = np.clip((paper - lum) / span, 0.0, 1.0)
    a[a < 0.10] = 0.0
    return np.clip((a - 0.10) / 0.90, 0.0, 1.0) ** 0.9


def sample_stats():
    """全局纸色/墨色与所有帧的并集外框。"""
    lums = []
    for name in FILES:
        gif = Image.open(os.path.join(GIF_DIR, name))
        for i in range(0, gif.n_frames, SAMPLE):
            gif.seek(i)
            lum = lum_of(gif)
            lums.append(lum.ravel()[::7])
    all_lum = np.concatenate(lums)
    paper = float(np.percentile(all_lum, 90))
    ink = float(np.percentile(all_lum, 1))

    box = [10**9, 10**9, -1, -1]
    for name in FILES:
        gif = Image.open(os.path.join(GIF_DIR, name))
        for i in range(0, gif.n_frames, SAMPLE):
            gif.seek(i)
            a = alpha_of(lum_of(gif), paper, ink)
            bbox = Image.fromarray((a * 255).astype(np.uint8)).getbbox()
            if bbox is None:
                continue
            box[0] = min(box[0], bbox[0])
            box[1] = min(box[1], bbox[1])
            box[2] = max(box[2], bbox[2])
            box[3] = max(box[3], bbox[3])
    # 稍微留一点边，避免抗锯齿被切
    box[0] = max(0, box[0] - 4)
    box[1] = max(0, box[1] - 4)
    box[2] = min(480, box[2] + 4)
    box[3] = min(480, box[3] + 4)
    return paper, ink, tuple(box)


def frame_rgba(im, paper, ink, box, scale):
    lum = lum_of(im)
    a = alpha_of(lum, paper, ink)
    alpha = Image.fromarray((a * 255).round().astype(np.uint8), "L").crop(box)
    alpha = alpha.resize(
        (max(1, round(alpha.width * scale)), max(1, round(alpha.height * scale))),
        Image.LANCZOS,
    )
    rgba = np.zeros((*np.asarray(alpha).shape, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 136, 168, 255
    a = np.asarray(alpha).astype(np.float32)
    if ALPHA_LEVELS > 1:
        step = 255.0 / (ALPHA_LEVELS - 1)
        a = np.round(a / step) * step
    rgba[..., 3] = a.clip(0, 255).astype(np.uint8)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(
        Image.fromarray(rgba, "RGBA"),
        ((SIZE - rgba.shape[1]) // 2, (SIZE - rgba.shape[0]) // 2),
    )
    return canvas


def main():
    if not os.path.isdir(GIF_DIR):
        raise SystemExit(f"GIF 目录不存在：{GIF_DIR}（可用 THINKING_FX_GIF_DIR 覆盖）")

    paper, ink, box = sample_stats()
    print(f"global paper={paper:.3f} ink={ink:.3f} box={box}")
    scale = min((SIZE - PAD * 2) / (box[2] - box[0]), (SIZE - PAD * 2) / (box[3] - box[1]))

    for index, name in enumerate(FILES):
        gif = Image.open(os.path.join(GIF_DIR, name))
        durations = []
        for i in range(gif.n_frames):
            gif.seek(i)
            durations.append(gif.info.get("duration") or 40)

        # 原 GIF 是 120 帧 / 5s（约 24fps）：全部保留，只把每帧时长按 SPEED 缩短。
        # 这样不靠“补帧”也没有丢帧，动起来是顺的；5s → 4s，看起来更快。
        frames, frame_durations = [], []
        for i in range(gif.n_frames):
            gif.seek(i)
            frames.append(frame_rgba(gif, paper, ink, box, scale))
            frame_durations.append(max(20, round(durations[i] / SPEED)))

        webp = os.path.join(HERE, f"glyph-{index}.webp")
        frames[0].save(
            webp,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=frame_durations,
            loop=0,
            quality=QUALITY,
            alpha_quality=ALPHA_QUALITY,
            method=6,
        )
        still = os.path.join(HERE, f"still-{index}.png")
        frames[0].save(still)
        print(
            f"{name} -> glyph-{index}.webp {os.path.getsize(webp)} bytes, "
            f"{len(frames)} frames, {sum(frame_durations)} ms; still {os.path.getsize(still)} bytes"
        )


if __name__ == "__main__":
    main()

