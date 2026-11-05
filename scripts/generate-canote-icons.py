"""Regenerate Canote's vector and Windows icons: python scripts/generate-canote-icons.py.

Requires Pillow for development only; never runs inside the app or installer.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "src" / "assets"
PINK = "#EC6396"
SOFT_PINK = "#F5B0CC"
SVG = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 256 256" fill="none">
  <title>Canote — notes made with love</title>
  <rect width="256" height="256" rx="60" fill="{PINK}"/>
  <rect x="59" y="42" width="138" height="172" rx="22" fill="white"/>
  <path d="M94 34v23M162 34v23" stroke="{SOFT_PINK}" stroke-width="10" stroke-linecap="round"/>
  <path d="M128 139C119 131 94 116 94 101C94 82 118 78 128 94C138 78 162 82 162 101C162 116 137 131 128 139Z" fill="{PINK}"/>
  <path d="M91 163h74M91 184h48" stroke="{SOFT_PINK}" stroke-width="9" stroke-linecap="round"/>
</svg>
'''


def bezier(a, b, c, d):
    return [
        tuple((1-t)**3*a[i] + 3*(1-t)**2*t*b[i] + 3*(1-t)*t*t*c[i] + t**3*d[i] for i in (0, 1))
        for t in (n / 32 for n in range(33))
    ]


scale = 8
image = Image.new("RGBA", (256 * scale, 256 * scale))
draw = ImageDraw.Draw(image)


def rounded(box, radius, color):
    draw.rounded_rectangle(tuple(v * scale for v in box), radius * scale, fill=color)


def line(a, b, width, color):
    draw.line(tuple((x * scale, y * scale) for x, y in (a, b)), fill=color, width=width * scale)
    for x, y in (a, b):
        draw.ellipse(((x-width/2)*scale, (y-width/2)*scale, (x+width/2)*scale, (y+width/2)*scale), fill=color)


rounded((0, 0, 256, 256), 60, PINK)
rounded((59, 42, 197, 214), 22, "white")
for x in (94, 162):
    line((x, 34), (x, 57), 10, SOFT_PINK)
heart = []
for curve in (
    ((128,139), (119,131), (94,116), (94,101)),
    ((94,101), (94,82), (118,78), (128,94)),
    ((128,94), (138,78), (162,82), (162,101)),
    ((162,101), (162,116), (137,131), (128,139)),
):
    heart.extend(bezier(*curve))
draw.polygon([(round(x*scale), round(y*scale)) for x, y in heart], fill=PINK)
line((91, 163), (165, 163), 9, SOFT_PINK)
line((91, 184), (139, 184), 9, SOFT_PINK)

(ASSETS / "logo.svg").write_text(SVG, encoding="utf-8")
image.resize((1024, 1024), Image.Resampling.LANCZOS).save(ASSETS / "icon.png")
image.resize((256, 256), Image.Resampling.LANCZOS).save(
    ASSETS / "icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 128, 256)]
)
print("Generated logo.svg, icon.png and icon.ico")
