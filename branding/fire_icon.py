"""Render Fire app icons (flat full-bleed + macOS padded squircle) with Pillow."""
import sys
from PIL import Image, ImageDraw

S = 4  # supersample factor
N = 1024 * S
TOP, BOTTOM = (255, 154, 31), (238, 46, 46)

OUTER = [((512, 214), (566, 330), (706, 404), (706, 584)),
         ((706, 584), (706, 706), (618, 796), (512, 796)),
         ((512, 796), (406, 796), (318, 706), (318, 592)),
         ((318, 592), (318, 500), (372, 446), (404, 392)),
         ((404, 392), (418, 466), (446, 500), (480, 512)),
         ((480, 512), (466, 420), (466, 318), (512, 214))]
INNER = [((512, 520), (548, 584), (612, 610), (612, 684)),
         ((612, 684), (612, 740), (568, 776), (512, 776)),
         ((512, 776), (456, 776), (412, 740), (412, 688)),
         ((412, 688), (412, 628), (470, 600), (512, 520))]

def bez(p0, p1, p2, p3, steps=64):
    pts = []
    for i in range(steps + 1):
        t = i / steps; u = 1 - t
        x = u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0]
        y = u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts

def path(segs, scale, cx, cy, ox=512, oy=505):
    pts = []
    for seg in segs:
        pts += bez(*seg)
    return [((x - ox) * scale * S + cx * S, (y - oy) * scale * S + cy * S) for x, y in pts]

def gradient(y0, y1):
    g = Image.new("RGBA", (N, N))
    d = ImageDraw.Draw(g)
    for y in range(N):
        t = min(max((y - y0 * S) / ((y1 - y0) * S), 0), 1)
        d.line([(0, y), (N, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,))
    return g

def render(mac):
    img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    if mac:
        x0, y0, w, r, fs = 100, 100, 824, 185, 0.82
    else:
        x0, y0, w, r, fs = 0, 0, 1024, 0, 1.0
    grad = gradient(y0, y0 + w)
    mask = Image.new("L", (N, N), 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0*S, y0*S, (x0+w)*S - 1, (y0+w)*S - 1], radius=r*S, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.polygon(path(OUTER, fs, 512, 512), fill=(255, 255, 255, 255))
    inner = Image.new("L", (N, N), 0)
    ImageDraw.Draw(inner).polygon(path(INNER, fs, 512, 512), fill=255)
    img.paste(grad, (0, 0), inner)
    return img.resize((1024, 1024), Image.LANCZOS)

out = sys.argv[1]
render(False).save(f"{out}/flat-1024.png")
render(True).save(f"{out}/mac-1024.png")
