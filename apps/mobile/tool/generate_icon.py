"""Generates the NutriMind app icon (1024x1024) — a deep-forest gradient squircle with a white
leaf mark and a saffron vein accent. Brand palette from lib/core/design_system/tokens.dart.
Run: python apps/mobile/tool/generate_icon.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

S = 1024
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "icon")
os.makedirs(OUT_DIR, exist_ok=True)

PRIMARY_DARK = (13, 68, 34)     # 0D4422
PRIMARY = (27, 107, 58)         # 1B6B3A
PRIMARY_LIGHT = (76, 158, 107)  # 4C9E6B
ACCENT = (232, 133, 26)         # E8851A saffron
WHITE = (247, 251, 247)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def diagonal_gradient(size, c0, c1, c2):
    """Top-left c0 -> mid c1 -> bottom-right c2, along the diagonal."""
    grad = Image.new("RGB", (size, size))
    px = grad.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            if t < 0.5:
                px[x, y] = lerp(c0, c1, t * 2)
            else:
                px[x, y] = lerp(c1, c2, (t - 0.5) * 2)
    return grad


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def leaf_layer(size):
    """A vesica-piscis leaf (intersection of two circles), upright, white."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Two circle masks whose intersection is a pointed leaf.
    r = int(size * 0.46)
    off = int(size * 0.30)
    cx, cy = size // 2, size // 2
    m1 = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m1).ellipse([cx - off - r, cy - r, cx - off + r, cy + r], fill=255)
    m2 = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m2).ellipse([cx + off - r, cy - r, cx + off + r, cy + r], fill=255)
    from PIL import ImageChops
    leaf_mask = ImageChops.multiply(m1, m2)
    white = Image.new("RGBA", (size, size), WHITE + (255,))
    layer.paste(white, (0, 0), leaf_mask)
    # Veins drawn on a separate layer, then clipped strictly inside the leaf mask so nothing
    # pokes past the leaf edge.
    vein = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(vein)
    vein_w = max(4, int(size * 0.020))
    tip_y = int(cy - size * 0.30)
    base_y = int(cy + size * 0.30)
    d.line([(cx, tip_y), (cx, base_y)], fill=ACCENT + (255,), width=vein_w)
    span = base_y - tip_y
    side_w = max(3, int(vein_w * 0.6))
    for frac in (0.30, 0.5, 0.70):
        y0 = int(tip_y + span * frac)
        reach = size * 0.16 * (1 - frac * 0.6)   # taper toward the base
        rise = reach * 0.8
        d.line([(cx, y0), (cx - int(reach), y0 - int(rise))], fill=ACCENT + (230,), width=side_w)
        d.line([(cx, y0), (cx + int(reach), y0 - int(rise))], fill=ACCENT + (230,), width=side_w)
    from PIL import ImageChops as _IC
    vein.putalpha(_IC.multiply(vein.getchannel("A"), leaf_mask))
    layer = Image.alpha_composite(layer, vein)
    return layer


def main():
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = diagonal_gradient(S, PRIMARY_DARK, PRIMARY, PRIMARY_LIGHT).convert("RGBA")
    mask = rounded_mask(S, radius=int(S * 0.235))  # iOS-squircle-ish
    base.paste(grad, (0, 0), mask)

    # Soft radial highlight top-left for depth.
    glow = Image.new("L", (S, S), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([int(-S * 0.1), int(-S * 0.1), int(S * 0.6), int(S * 0.6)], fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.12))
    highlight = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    tmp = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    tmp.paste(highlight, (0, 0), glow)
    tmp.putalpha(tmp.getchannel("A").point(lambda a: int(a * 0.5)))
    base = Image.alpha_composite(base, Image.composite(tmp, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

    # Leaf, scaled and rotated ~ -35° for a natural angle.
    leaf = leaf_layer(int(S * 0.66))
    leaf = leaf.rotate(-35, expand=True, resample=Image.BICUBIC)
    lx = (S - leaf.width) // 2
    ly = (S - leaf.height) // 2
    base.alpha_composite(leaf, (lx, ly))

    # Full-bleed icon (for adaptive foreground we also export a padded version).
    base.save(os.path.join(OUT_DIR, "app_icon.png"))

    # Adaptive foreground: leaf on transparent, with safe-zone padding (66% content).
    fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    leaf_fg = leaf_layer(int(S * 0.46))
    leaf_fg = leaf_fg.rotate(-35, expand=True, resample=Image.BICUBIC)
    fg.alpha_composite(leaf_fg, ((S - leaf_fg.width) // 2, (S - leaf_fg.height) // 2))
    fg.save(os.path.join(OUT_DIR, "app_icon_foreground.png"))

    print("wrote", os.path.abspath(OUT_DIR))


if __name__ == "__main__":
    main()
