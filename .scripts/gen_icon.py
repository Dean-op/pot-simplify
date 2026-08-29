#!/usr/bin/env python3
"""生成 pot 的应用图标。

设计：Fluent 描边极简 —— 无底板、无投影、单一强调色 #4C6FFF。
  · 48px 及以上用完整标记：「文」与「A」并排，下方一个双向箭头
  · 32px 及以下换成简化标记：只留一个加粗的「文」撑满画布
    （完整标记在 16~32px 会糊成一团，托盘图标尤其明显，所以分档）

字形轮廓已经内联在下面的 GLYPH_* 常量里（取自 Noto Sans CJK SC，
用 cairo 的 text_path + copy_path 抽出后归一化），所以这个脚本不依赖
任何字体。只需要 pycairo 和 Pillow：

    pip install pycairo pillow
    python .scripts/gen_icon.py

产物（全部覆盖写入）：
    src-tauri/icons/  32x32.png  128x128.png  128x128@2x.png  icon.png  icon.ico
    public/           icon.png（favicon）  icon.svg（设置页侧边栏，矢量）

icon.ico 里放 8 档：16/20/24/32 是简化标记，48/64/128/256 是完整标记。
<=64 的档用 BMP 条目、128 和 256 用 PNG 条目——这是各类图标工具的通行
组合，tauri-build 走 winres 把条目原样塞进 RT_ICON，两种都认。
"""
import io
import struct
from pathlib import Path

import cairo
from PIL import Image

ACCENT = (0x4C / 255, 0x6F / 255, 1.0)
ICO_SIZES = (16, 20, 24, 32, 48, 64, 128, 256)

# --- 字形轮廓：归一化到 [0,1]，最长边为 1，墨迹左上角在原点 -----------------
# 文 归一化轮廓，墨迹宽高 = (1.0, 0.9945)
GLYPH_WEN = (
    ('m', 0.4157, 0.0258),
    ('c', 0.4479, 0.0786, 0.4823, 0.1507, 0.4952, 0.1949),
    ('l', 0.5843, 0.1658),
    ('c', 0.5693, 0.1217, 0.5317, 0.0517, 0.4995, 0.0),
    ('z',),
    ('m', 0.015, 0.197),
    ('l', 0.015, 0.2765),
    ('l', 0.1826, 0.2765),
    ('c', 0.246, 0.4399, 0.3308, 0.5807, 0.4415, 0.6957),
    ('c', 0.3233, 0.7946, 0.1783, 0.8677, 0.0, 0.9182),
    ('c', 0.0161, 0.9376, 0.0419, 0.9752, 0.0505, 0.9945),
    ('c', 0.2299, 0.9365, 0.3792, 0.8591, 0.5005, 0.7538),
    ('c', 0.6219, 0.8612, 0.768, 0.9408, 0.9441, 0.9891),
    ('c', 0.9581, 0.9666, 0.9817, 0.9322, 1.0, 0.915),
    ('c', 0.8281, 0.872, 0.6821, 0.7957, 0.5628, 0.6946),
    ('c', 0.6713, 0.5839, 0.754, 0.4463, 0.8163, 0.2765),
    ('l', 0.986, 0.2765),
    ('l', 0.986, 0.197),
    ('z',),
    ('m', 0.5027, 0.6387),
    ('c', 0.4017, 0.5366, 0.3222, 0.4141, 0.2664, 0.2765),
    ('l', 0.725, 0.2765),
    ('c', 0.6713, 0.4216, 0.5972, 0.5409, 0.5027, 0.6387),
    ('z',),
    ('m', 1.0354, 0.9102),
)
GLYPH_WEN_WH = (1.0, 0.9945)

# 文 归一化轮廓，墨迹宽高 = (1.0, 0.9947)
GLYPH_WEN_BOLD = (
    ('m', 0.4057, 0.0399),
    ('c', 0.4298, 0.0851, 0.4539, 0.145, 0.4654, 0.1881),
    ('l', 0.0199, 0.1881),
    ('l', 0.0199, 0.3107),
    ('l', 0.1855, 0.3107),
    ('c', 0.2421, 0.4586, 0.3155, 0.5856, 0.4099, 0.6905),
    ('c', 0.3008, 0.7754, 0.1646, 0.8352, 0.0, 0.8761),
    ('c', 0.0252, 0.9055, 0.0629, 0.9643, 0.0765, 0.9947),
    ('c', 0.2453, 0.9454, 0.3868, 0.8751, 0.5031, 0.7807),
    ('c', 0.6143, 0.8741, 0.7495, 0.9433, 0.9151, 0.9873),
    ('c', 0.934, 0.9527, 0.9717, 0.8982, 1.0, 0.8698),
    ('c', 0.8417, 0.8342, 0.7096, 0.7712, 0.6006, 0.6884),
    ('c', 0.6939, 0.5866, 0.7652, 0.4618, 0.8187, 0.3107),
    ('l', 0.9801, 0.3107),
    ('l', 0.9801, 0.1881),
    ('l', 0.5231, 0.1881),
    ('l', 0.6122, 0.1597),
    ('c', 0.5996, 0.1166, 0.5681, 0.0494, 0.5398, 0.0),
    ('z',),
    ('m', 0.5052, 0.6023),
    ('c', 0.4245, 0.5195, 0.3616, 0.4209, 0.3155, 0.3107),
    ('l', 0.6782, 0.3107),
    ('c', 0.6352, 0.4261, 0.5786, 0.5226, 0.5052, 0.6023),
    ('z',),
    ('m', 1.022, 0.9019),
)
GLYPH_WEN_BOLD_WH = (1.0, 0.9947)

# A 归一化轮廓，墨迹宽高 = (0.8186, 1.0)
GLYPH_A = (
    ('m', 0.0, 1.0),
    ('l', 0.1269, 1.0),
    ('l', 0.2237, 0.6944),
    ('l', 0.5894, 0.6944),
    ('l', 0.6849, 1.0),
    ('l', 0.8186, 1.0),
    ('l', 0.4789, 0.0),
    ('l', 0.3383, 0.0),
    ('z',),
    ('m', 0.2551, 0.5948),
    ('l', 0.3042, 0.4407),
    ('c', 0.3397, 0.3274, 0.3724, 0.2196, 0.4038, 0.1023),
    ('l', 0.4093, 0.1023),
    ('c', 0.442, 0.2183, 0.4734, 0.3274, 0.5102, 0.4407),
    ('l', 0.558, 0.5948),
    ('z',),
    ('m', 0.824, 1.0),
)
GLYPH_A_WH = (0.8186, 1.0)
# --- 绘制 -------------------------------------------------------------------


def _put(ctx, path, wh, box):
    """把归一化轮廓填充进 box=(x, y, w, h)，等比缩放并居中。"""
    x, y, w, h = box
    s = min(w / wh[0], h / wh[1])
    ctx.save()
    ctx.translate(x + (w - wh[0] * s) / 2, y + (h - wh[1] * s) / 2)
    ctx.scale(s, s)
    ctx.new_path()
    for seg in path:
        kind = seg[0]
        if kind == 'm':
            ctx.move_to(seg[1], seg[2])
        elif kind == 'l':
            ctx.line_to(seg[1], seg[2])
        elif kind == 'c':
            ctx.curve_to(*seg[1:])
        else:
            ctx.close_path()
    ctx.restore()  # 路径已经在设备空间里，恢复 CTM 不影响它
    ctx.fill()


def _arrows(ctx, cx, cy, width, gap, lw):
    """双向箭头：上行指右、下行指左。"""
    ctx.set_line_width(lw)
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    half, head = width / 2, lw * 1.8
    for sign, ty in ((1, cy - gap / 2), (-1, cy + gap / 2)):
        ctx.move_to(cx - half, ty)
        ctx.line_to(cx + half, ty)
        ctx.stroke()
        tip = cx + sign * half
        for dy in (-1, 1):
            ctx.move_to(tip, ty)
            ctx.line_to(tip - sign * head * 0.8, ty + dy * head * 0.66)
            ctx.stroke()


def _paint(ctx, simplified):
    """在 100×100 的设计网格上画标记。"""
    ctx.set_source_rgb(*ACCENT)
    if simplified:
        _put(ctx, GLYPH_WEN_BOLD, GLYPH_WEN_BOLD_WH, (4, 4, 92, 92))
    else:
        _put(ctx, GLYPH_WEN, GLYPH_WEN_WH, (3, 13, 43, 43))
        _put(ctx, GLYPH_A, GLYPH_A_WH, (54, 13, 43, 43))
        _arrows(ctx, 50, 77, 38, 12, 4)


def render(size):
    """位图：画在设计网格上再缩放到 size，<48px 自动换简化标记。"""
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size)
    ctx = cairo.Context(surf)
    ctx.scale(size / 100.0, size / 100.0)
    _paint(ctx, size < 48)
    buf = io.BytesIO()
    surf.write_to_png(buf)
    return Image.open(buf).convert('RGBA')


def render_svg(dest):
    """矢量：设置页侧边栏那个 60px 的 logo 用的是这一份，永远画完整标记。"""
    surf = cairo.SVGSurface(str(dest), 100, 100)
    _paint(cairo.Context(surf), False)
    surf.finish()


# --- ICO 封装 ---------------------------------------------------------------


def _dib(im):
    """32bpp 的 BITMAPINFOHEADER + 自底向上的 BGRA 像素 + 全 0 的 AND 掩码。"""
    w, h = im.size
    header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, w * h * 4, 0, 0, 0, 0)
    px = im.tobytes('raw', 'BGRA')
    rows = [px[y * w * 4:(y + 1) * w * 4] for y in range(h)]
    mask_stride = ((w + 31) // 32) * 4
    return header + b''.join(reversed(rows)) + b'\x00' * (mask_stride * h)


def write_ico(images, dest):
    blobs = []
    for im in images:
        if im.size[0] >= 128:
            buf = io.BytesIO()
            im.save(buf, 'PNG')
            blobs.append(buf.getvalue())
        else:
            blobs.append(_dib(im))
    out = [struct.pack('<HHH', 0, 1, len(blobs))]
    offset = 6 + 16 * len(blobs)
    for im, blob in zip(images, blobs):
        side = im.size[0] % 256  # 256 在目录项里记作 0
        out.append(struct.pack('<BBBBHHII', side, side, 0, 0, 1, 32, len(blob), offset))
        offset += len(blob)
    out.extend(blobs)
    dest.write_bytes(b''.join(out))


def main():
    root = Path(__file__).resolve().parent.parent
    icons = root / 'src-tauri' / 'icons'
    for size, name in ((32, '32x32.png'), (128, '128x128.png'),
                       (256, '128x128@2x.png'), (512, 'icon.png')):
        render(size).save(icons / name)
        print(f'  icons/{name:22} {size}×{size}')
    write_ico([render(s) for s in ICO_SIZES], icons / 'icon.ico')
    print(f"  {'icons/icon.ico':29} {'/'.join(str(s) for s in ICO_SIZES)}")
    render(256).save(root / 'public' / 'icon.png')  # index.html / daemon.html 的 favicon
    print(f'  {"public/icon.png":29} 256×256')
    render_svg(root / 'public' / 'icon.svg')  # 设置页侧边栏
    print(f'  {"public/icon.svg":29} vector')


if __name__ == '__main__':
    main()
