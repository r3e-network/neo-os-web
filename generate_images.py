#!/usr/bin/env python3
"""
Generate logo.jpg (640x640) and banner.jpg (1280x640) PNG images
for each game app using struct + zlib for PNG writing.
"""

import struct
import zlib
import math
import os

# ── PNG writer (struct + zlib) ──────────────────────────────────────────────

def write_png(filename, width, height, pixels_rgb):
    """Write a truecolor (RGB) PNG file using only struct and zlib.
    pixels_rgb is a flat bytearray of [R,G,B,R,G,B,...] in row-major order.
    """
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR: width, height, bit_depth=8, color_type=2 (RGB), compression=0,
    #       filter=0, interlace=0
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    # IDAT: raw pixel data with filter byte 0 (None) per row
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter byte
        row_start = y * width * 3
        row_end = row_start + width * 3
        raw.extend(pixels_rgb[row_start:row_end])

    compressed = zlib.compress(bytes(raw))
    idat = chunk(b'IDAT', compressed)

    iend = chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(sig + ihdr + idat + iend)


# ── Gradient helpers ─────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB tuples."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def make_radial_gradient(width, height, colors):
    """Create a radial gradient from center.
    colors: list of (position, RGB) stops where position is 0.0 to 1.0 (radius).
    """
    cx, cy = width / 2, height / 2
    max_r = math.sqrt(cx * cx + cy * cy)
    pixels = bytearray(width * height * 3)
    for y in range(height):
        for x in range(width):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy) / max_r
            dist = min(dist, 1.0)
            # find the two stops
            for i in range(len(colors) - 1):
                p1, c1 = colors[i]
                p2, c2 = colors[i + 1]
                if p1 <= dist <= p2:
                    t = (dist - p1) / (p2 - p1) if p2 != p1 else 0
                    r, g, b = lerp_color(c1, c2, t)
                    break
            else:
                r, g, b = colors[-1][1]
            idx = (y * width + x) * 3
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
    return pixels

def make_linear_gradient(width, height, colors, angle=0):
    """Create a linear gradient at the given angle (degrees).
    colors: list of (position, RGB) stops along the gradient axis.
    """
    rad = math.radians(angle)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    # Project each pixel onto the gradient axis
    pixels = bytearray(width * height * 3)
    for y in range(height):
        for x in range(width):
            # Normalized projection onto axis
            proj = (x * cos_a + y * sin_a) / (width * abs(cos_a) + height * abs(sin_a))
            proj = (proj + 1) / 2  # normalize to 0..1
            proj = min(max(proj, 0.0), 1.0)
            for i in range(len(colors) - 1):
                p1, c1 = colors[i]
                p2, c2 = colors[i + 1]
                if p1 <= proj <= p2:
                    t = (proj - p1) / (p2 - p1) if p2 != p1 else 0
                    r, g, b = lerp_color(c1, c2, t)
                    break
            else:
                r, g, b = colors[-1][1]
            idx = (y * width + x) * 3
            pixels[idx] = r
            pixels[idx + 1] = g
            pixels[idx + 2] = b
    return pixels


# ── Shape / decoration helpers ───────────────────────────────────────────────

def composite_circle(pixels, width, height, cx, cy, radius, color, feather=0):
    """Draw a filled circle onto pixel buffer."""
    r_min, g_min, b_min = max(0, color[0] - feather), max(0, color[1] - feather), max(0, color[2] - feather)
    r_max, g_max, b_max = min(255, color[0] + feather), min(255, color[1] + feather), min(255, color[2] + feather)
    for y in range(max(0, int(cy - radius)), min(height, int(cy + radius) + 1)):
        for x in range(max(0, int(cx - radius)), min(width, int(cx + radius) + 1)):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                idx = (y * width + x) * 3
                if feather > 0 and dist > radius - feather:
                    t = (radius - dist) / feather
                    pixels[idx] = int(pixels[idx] * (1 - t) + color[0] * t)
                    pixels[idx+1] = int(pixels[idx+1] * (1 - t) + color[1] * t)
                    pixels[idx+2] = int(pixels[idx+2] * (1 - t) + color[2] * t)
                else:
                    pixels[idx] = min(255, pixels[idx] + color[0])
                    pixels[idx+1] = min(255, pixels[idx+1] + color[1])
                    pixels[idx+2] = min(255, pixels[idx+2] + color[2])

def composite_rect(pixels, width, height, x1, y1, x2, y2, color):
    """Draw a filled rectangle."""
    for y in range(max(0, y1), min(height, y2)):
        for x in range(max(0, x1), min(width, x2)):
            idx = (y * width + x) * 3
            pixels[idx] = min(255, pixels[idx] + color[0])
            pixels[idx+1] = min(255, pixels[idx+1] + color[1])
            pixels[idx+2] = min(255, pixels[idx+2] + color[2])


# ── Text rendering (8x8 bitmap font) ────────────────────────────────────────

# Minimal 8x8 bitmap font for uppercase letters and digits
# Each char is 8 bytes (8 rows x 8 columns), MSB = leftmost pixel
FONT_BITMAP = {
    'A': bytes([0x18,0x24,0x42,0x7e,0x42,0x42,0x42,0x00]),
    'B': bytes([0x7c,0x42,0x42,0x7c,0x42,0x42,0x7c,0x00]),
    'C': bytes([0x3c,0x42,0x40,0x40,0x40,0x42,0x3c,0x00]),
    'D': bytes([0x78,0x44,0x42,0x42,0x42,0x44,0x78,0x00]),
    'E': bytes([0x7e,0x40,0x40,0x7c,0x40,0x40,0x7e,0x00]),
    'F': bytes([0x7e,0x40,0x40,0x7c,0x40,0x40,0x40,0x00]),
    'G': bytes([0x3c,0x42,0x40,0x4e,0x42,0x42,0x3c,0x00]),
    'H': bytes([0x42,0x42,0x42,0x7e,0x42,0x42,0x42,0x00]),
    'I': bytes([0x7e,0x18,0x18,0x18,0x18,0x18,0x7e,0x00]),
    'J': bytes([0x1e,0x0c,0x0c,0x0c,0x0c,0x4c,0x38,0x00]),
    'K': bytes([0x42,0x44,0x48,0x70,0x48,0x44,0x42,0x00]),
    'L': bytes([0x40,0x40,0x40,0x40,0x40,0x40,0x7e,0x00]),
    'M': bytes([0x42,0x66,0x5a,0x5a,0x42,0x42,0x42,0x00]),
    'N': bytes([0x42,0x62,0x52,0x4a,0x46,0x42,0x42,0x00]),
    'O': bytes([0x3c,0x42,0x42,0x42,0x42,0x42,0x3c,0x00]),
    'P': bytes([0x7c,0x42,0x42,0x7c,0x40,0x40,0x40,0x00]),
    'Q': bytes([0x3c,0x42,0x42,0x42,0x4a,0x44,0x3a,0x00]),
    'R': bytes([0x7c,0x42,0x42,0x7c,0x48,0x44,0x42,0x00]),
    'S': bytes([0x3c,0x42,0x40,0x3c,0x02,0x42,0x3c,0x00]),
    'T': bytes([0x7e,0x18,0x18,0x18,0x18,0x18,0x18,0x00]),
    'U': bytes([0x42,0x42,0x42,0x42,0x42,0x42,0x3c,0x00]),
    'V': bytes([0x42,0x42,0x42,0x42,0x42,0x24,0x18,0x00]),
    'W': bytes([0x42,0x42,0x42,0x5a,0x5a,0x66,0x42,0x00]),
    'X': bytes([0x42,0x42,0x24,0x18,0x24,0x42,0x42,0x00]),
    'Y': bytes([0x42,0x42,0x24,0x18,0x18,0x18,0x18,0x00]),
    'Z': bytes([0x7e,0x02,0x04,0x18,0x20,0x40,0x7e,0x00]),
    '0': bytes([0x3c,0x42,0x46,0x4a,0x52,0x62,0x3c,0x00]),
    '1': bytes([0x18,0x38,0x18,0x18,0x18,0x18,0x7e,0x00]),
    '2': bytes([0x3c,0x42,0x02,0x0c,0x30,0x40,0x7e,0x00]),
    '3': bytes([0x3c,0x42,0x02,0x1c,0x02,0x42,0x3c,0x00]),
    '4': bytes([0x0c,0x1c,0x2c,0x4c,0x7e,0x0c,0x0c,0x00]),
    '5': bytes([0x7e,0x40,0x7c,0x02,0x02,0x42,0x3c,0x00]),
    '6': bytes([0x1c,0x20,0x40,0x7c,0x42,0x42,0x3c,0x00]),
    '7': bytes([0x7e,0x02,0x04,0x08,0x10,0x10,0x10,0x00]),
    '8': bytes([0x3c,0x42,0x42,0x3c,0x42,0x42,0x3c,0x00]),
    '9': bytes([0x3c,0x42,0x42,0x3e,0x02,0x04,0x38,0x00]),
    ' ': bytes([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]),
    '-': bytes([0x00,0x00,0x00,0x7e,0x00,0x00,0x00,0x00]),
    "'": bytes([0x18,0x18,0x18,0x00,0x00,0x00,0x00,0x00]),
}

def text_width(text):
    """Return width of text in pixels (8px per char * len)."""
    return len(text) * 8

def draw_text(pixels, width, height, text, x, y, color, scale=1):
    """Draw text using the 8x8 bitmap font at (x,y) with optional scale."""
    for ch_idx, ch in enumerate(text.upper()):
        if ch not in FONT_BITMAP:
            continue
        bitmap = FONT_BITMAP[ch]
        for row in range(8):
            for col in range(8):
                if bitmap[row] & (0x80 >> col):
                    for sy in range(scale):
                        for sx in range(scale):
                            px = x + ch_idx * 8 * scale + col * scale + sx
                            py = y + row * scale + sy
                            if 0 <= px < width and 0 <= py < height:
                                idx = (py * width + px) * 3
                                pixels[idx] = min(255, pixels[idx] + color[0])
                                pixels[idx+1] = min(255, pixels[idx+1] + color[1])
                                pixels[idx+2] = min(255, pixels[idx+2] + color[2])

def draw_text_centered(pixels, width, height, text, cy, color, scale=1):
    """Draw text centered horizontally at y=cy."""
    tw = text_width(text) * scale
    x = (width - tw) // 2
    draw_text(pixels, width, height, text, x, cy, color, scale)


# ── Decorative helpers ──────────────────────────────────────────────────────

def draw_star(pixels, width, height, cx, cy, outer_r, inner_r, points, color):
    """Draw a simple star polygon."""
    import math
    pts = []
    for i in range(points * 2):
        angle = math.radians(-90 + i * 180 / points)
        r = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    # fill via scanline
    # Find bounding box
    min_y = max(0, int(min(p[1] for p in pts)))
    max_y = min(height, int(max(p[1] for p in pts)) + 1)
    for y in range(min_y, max_y):
        intersections = []
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            if (y1 < y <= y2) or (y2 < y <= y1):
                t = (y - y1) / (y2 - y1) if y2 != y1 else 0
                ix = x1 + t * (x2 - x1)
                intersections.append(ix)
        intersections.sort()
        for i in range(0, len(intersections), 2):
            if i + 1 < len(intersections):
                x_start = max(0, int(intersections[i]))
                x_end = min(width, int(intersections[i + 1]) + 1)
                for x in range(x_start, x_end):
                    idx = (y * width + x) * 3
                    pixels[idx] = min(255, pixels[idx] + color[0])
                    pixels[idx+1] = min(255, pixels[idx+1] + color[1])
                    pixels[idx+2] = min(255, pixels[idx+2] + color[2])


# ── Generate images for each game ──────────────────────────────────────────

APPS = [
    {
        'name': 'sheep-solitaire',
        'text': 'Sheep Solitaire',
        'logo_colors': [(0.0, (180, 60, 160)), (0.5, (220, 100, 200)), (1.0, (140, 30, 120))],
        'banner_colors': [(0.0, (200, 80, 180)), (0.5, (240, 120, 220)), (1.0, (160, 40, 140))],
        'accent': (255, 200, 230),
        'star': True,
    },
    {
        'name': 'flappy-dash',
        'text': 'Flappy Dash',
        'logo_colors': [(0.0, (30, 144, 255)), (0.5, (100, 200, 255)), (1.0, (20, 100, 200))],
        'banner_colors': [(0.0, (50, 160, 255)), (0.5, (120, 220, 255)), (1.0, (30, 120, 220))],
        'accent': (255, 255, 200),
        'clouds': True,
    },
    {
        'name': 'snake-bounty',
        'text': 'Snake Bounty',
        'logo_colors': [(0.0, (0, 120, 0)), (0.5, (50, 200, 50)), (1.0, (0, 80, 0))],
        'banner_colors': [(0.0, (0, 140, 0)), (0.5, (60, 220, 60)), (1.0, (0, 100, 0))],
        'accent': (200, 255, 150),
        'snake': True,
    },
    {
        'name': 'color-clash',
        'text': 'Color Clash',
        'logo_colors': [(0.0, (255, 50, 50)), (0.33, (255, 200, 0)), (0.66, (50, 200, 50)), (1.0, (50, 50, 255))],
        'banner_colors': [(0.0, (255, 80, 80)), (0.33, (255, 220, 30)), (0.66, (80, 220, 80)), (1.0, (80, 80, 255))],
        'accent': (255, 255, 255),
        'colorful': True,
    },
    {
        'name': 'aim-master',
        'text': 'Aim Master',
        'logo_colors': [(0.0, (180, 20, 20)), (0.5, (220, 60, 60)), (1.0, (120, 10, 10))],
        'banner_colors': [(0.0, (200, 30, 30)), (0.5, (240, 80, 80)), (1.0, (140, 15, 15))],
        'accent': (255, 200, 100),
        'target': True,
    },
    {
        'name': 'merge-kingdom',
        'text': 'Merge Kingdom',
        'logo_colors': [(0.0, (180, 130, 20)), (0.5, (255, 200, 50)), (1.0, (140, 100, 10))],
        'banner_colors': [(0.0, (200, 150, 30)), (0.5, (255, 220, 70)), (1.0, (160, 120, 15))],
        'accent': (255, 255, 200),
        'crown': True,
    },
    {
        'name': 'pet-potion',
        'text': 'Pet Potion',
        'logo_colors': [(0.0, (255, 182, 193)), (0.5, (200, 150, 255)), (1.0, (180, 220, 255))],
        'banner_colors': [(0.0, (255, 200, 210)), (0.5, (220, 170, 255)), (1.0, (200, 230, 255))],
        'accent': (255, 255, 255),
        'bubbles': True,
    },
]

def render_decoration(app_cfg, pixels, width, height):
    """Add game-specific decorations."""
    cx, cy = width // 2, height // 2
    ac = app_cfg['accent']

    if app_cfg.get('star'):
        # Draw a decorative star
        draw_star(pixels, width, height, cx, height // 3, 100, 40, 5,
                  (ac[0]//3, ac[1]//3, ac[2]//3))
        draw_star(pixels, width, height, cx, height // 3, 70, 28, 5, ac)

    if app_cfg.get('clouds'):
        # Draw cloud-like circles
        for i in range(6):
            r = 30 + i * 10
            cx_c = width * (0.15 + i * 0.14)
            cy_c = height * (0.2 + (i % 3) * 0.15)
            composite_circle(pixels, width, height, cx_c, cy_c, r,
                            (ac[0]//2, ac[1]//2, ac[2]//2), feather=5)

    if app_cfg.get('snake'):
        # Draw a simple sine-wave snake trail
        for t in range(0, 360, 5):
            rad = math.radians(t)
            sx = int(width * 0.1 + (width * 0.8) * t / 360)
            sy = int(height * 0.5 + 80 * math.sin(rad * 2))
            r = 6 + 3 * math.sin(rad)
            composite_circle(pixels, width, height, sx, sy, int(r),
                           (int(80 + 40 * math.sin(rad)), 200, int(80 + 40 * math.cos(rad))), feather=2)

    if app_cfg.get('colorful'):
        # Draw colorful circles
        hues = [(255, 50, 50), (255, 200, 0), (50, 200, 50), (50, 50, 255), (200, 50, 200)]
        for i, h in enumerate(hues):
            angle = math.radians(i * 72)
            r = 60
            cx_c = cx + int(180 * math.cos(angle))
            cy_c = cy + int(180 * math.sin(angle))
            composite_circle(pixels, width, height, cx_c, cy_c, r, h, feather=8)

    if app_cfg.get('target'):
        # Draw target rings
        for i in range(5):
            r = 150 - i * 28
            if i % 2 == 0:
                col = (200, 30, 30)
            else:
                col = (255, 255, 255)
            # Draw ring (outline)
            for y in range(max(0, int(cy - r)), min(height, int(cy + r) + 1)):
                for x in range(max(0, int(cx - r)), min(width, int(cx + r) + 1)):
                    dx, dy = x - cx, y - cy
                    dist = math.sqrt(dx * dx + dy * dy)
                    if r - 4 <= dist <= r:
                        idx = (y * width + x) * 3
                        pixels[idx] = min(255, pixels[idx] + col[0])
                        pixels[idx+1] = min(255, pixels[idx+1] + col[1])
                        pixels[idx+2] = min(255, pixels[idx+2] + col[2])
            # Center dot
            if i == 4:
                composite_circle(pixels, width, height, cx, cy, 15, (255, 50, 50))

    if app_cfg.get('crown'):
        # Draw a simple crown shape
        crown_pts = [
            (cx - 100, cy - 20), (cx - 80, cy - 80), (cx - 50, cy - 40),
            (cx - 20, cy - 100), (cx + 20, cy - 100), (cx + 50, cy - 40),
            (cx + 80, cy - 80), (cx + 100, cy - 20),
        ]
        # Base
        composite_rect(pixels, width, height, cx - 110, cy - 15, cx + 110, cy + 20,
                       (ac[0]//2, ac[1]//2, ac[2]//2))
        for px, py in crown_pts:
            composite_circle(pixels, width, height, int(px), int(py), 15,
                           (ac[0]//2, ac[1]//2, ac[2]//2))
        for px, py in crown_pts:
            composite_circle(pixels, width, height, int(px), int(py), 8, ac)

    if app_cfg.get('bubbles'):
        # Draw pastel bubbles
        import random
        # Use a deterministic seed for reproducibility
        random.seed(42)
        for _ in range(20):
            r = random.randint(10, 40)
            bx = random.randint(r, width - r)
            by = random.randint(r, height - r)
            col = (random.randint(180, 255), random.randint(180, 255), random.randint(180, 255))
            composite_circle(pixels, width, height, bx, by, r, col, feather=4)


def generate_game_images(app_dir, app_cfg):
    """Generate logo.jpg and banner.jpg for one game app."""
    public_dir = os.path.join(app_dir, 'public')
    os.makedirs(public_dir, exist_ok=True)

    # ── Logo: 640x640 ──
    print(f"  Generating logo.jpg (640x640)...")
    pixels = make_radial_gradient(640, 640, app_cfg['logo_colors'])
    render_decoration(app_cfg, pixels, 640, 640)
    # Draw game title
    draw_text_centered(pixels, 640, 640, app_cfg['text'], 520, app_cfg['accent'], scale=3)
    write_png(os.path.join(public_dir, 'logo.jpg'), 640, 640, pixels)

    # ── Banner: 1280x640 ──
    print(f"  Generating banner.jpg (1280x640)...")
    pixels = make_linear_gradient(1280, 640, app_cfg['banner_colors'], angle=135)
    # Simpler decorations on banner
    ac = app_cfg['accent']
    cx, cy = 640, 320

    if app_cfg.get('star'):
        draw_star(pixels, 1280, 640, cx, cy, 80, 30, 5, (ac[0]//3, ac[1]//3, ac[2]//3))
        draw_star(pixels, 1280, 640, cx, cy, 55, 22, 5, ac)

    if app_cfg.get('clouds'):
        for i in range(8):
            r = 20 + i * 8
            cx_c = 1280 * (0.1 + i * 0.11)
            cy_c = 640 * (0.2 + (i % 3) * 0.15)
            composite_circle(pixels, 1280, 640, int(cx_c), int(cy_c), r,
                           (ac[0]//2, ac[1]//2, ac[2]//2), feather=4)

    if app_cfg.get('snake'):
        for t in range(0, 360, 5):
            rad = math.radians(t)
            sx = int(100 + (1080) * t / 360)
            sy = int(320 + 100 * math.sin(rad * 2))
            r = 5 + 2 * math.sin(rad)
            composite_circle(pixels, 1280, 640, sx, sy, int(r),
                           (int(80 + 40 * math.sin(rad)), 200, int(80 + 40 * math.cos(rad))), feather=2)

    if app_cfg.get('colorful'):
        hues = [(255, 50, 50), (255, 200, 0), (50, 200, 50), (50, 50, 255), (200, 50, 200)]
        for i, h in enumerate(hues):
            angle = math.radians(i * 72)
            r = 50
            cx_c = cx + int(200 * math.cos(angle))
            cy_c = cy + int(200 * math.sin(angle))
            composite_circle(pixels, 1280, 640, cx_c, cy_c, r, h, feather=6)

    if app_cfg.get('target'):
        for i in range(5):
            r = 180 - i * 32
            col = (200, 30, 30) if i % 2 == 0 else (255, 255, 255)
            for y in range(max(0, int(cy - r)), min(640, int(cy + r) + 1)):
                for x in range(max(0, int(cx - r)), min(1280, int(cx + r) + 1)):
                    dx, dy = x - cx, y - cy
                    dist = math.sqrt(dx * dx + dy * dy)
                    if r - 4 <= dist <= r:
                        idx = (y * 1280 + x) * 3
                        pixels[idx] = min(255, pixels[idx] + col[0])
                        pixels[idx+1] = min(255, pixels[idx+1] + col[1])
                        pixels[idx+2] = min(255, pixels[idx+2] + col[2])
            if i == 4:
                composite_circle(pixels, 1280, 640, cx, cy, 18, (255, 50, 50))

    if app_cfg.get('crown'):
        crown_pts = [
            (cx - 120, cy - 10), (cx - 90, cy - 90), (cx - 50, cy - 40),
            (cx - 20, cy - 120), (cx + 20, cy - 120), (cx + 50, cy - 40),
            (cx + 90, cy - 90), (cx + 120, cy - 10),
        ]
        composite_rect(pixels, 1280, 640, cx - 130, cy - 5, cx + 130, cy + 25,
                       (ac[0]//2, ac[1]//2, ac[2]//2))
        for px, py in crown_pts:
            composite_circle(pixels, 1280, 640, int(px), int(py), 18,
                           (ac[0]//2, ac[1]//2, ac[2]//2))
        for px, py in crown_pts:
            composite_circle(pixels, 1280, 640, int(px), int(py), 10, ac)

    if app_cfg.get('bubbles'):
        import random
        random.seed(42)
        for _ in range(30):
            r = random.randint(10, 50)
            bx = random.randint(r, 1280 - r)
            by = random.randint(r, 640 - r)
            col = (random.randint(180, 255), random.randint(180, 255), random.randint(180, 255))
            composite_circle(pixels, 1280, 640, bx, by, r, col, feather=4)

    # Draw game title on banner
    draw_text_centered(pixels, 1280, 640, app_cfg['text'], 560, app_cfg['accent'], scale=4)
    write_png(os.path.join(public_dir, 'banner.jpg'), 1280, 640, pixels)


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    base = '/Users/jinghuiliao/git/r3e/neo-miniapps-platform/apps'

    for app in APPS:
        app_dir = os.path.join(base, app['name'])
        if not os.path.isdir(app_dir):
            print(f"SKIP: {app_dir} not found")
            continue
        print(f"\n{'='*60}")
        print(f"Generating images for {app['name']}...")
        generate_game_images(app_dir, app)

    print(f"\n{'='*60}")
    print("Done! All images generated.")

if __name__ == '__main__':
    main()
