#!/usr/bin/env python3
"""
Generate publication-quality LMS C4 Level 2 container architecture diagrams.
Outputs: architecture.svg, architecture.png, architecture.pdf under docs/architecture/

Drawn exclusively from reverse-engineered LMSV2-main components (no invented services).
Style: white background, black borders, no gradients/shadows/icons/emojis.
"""

from __future__ import annotations

import os
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "docs" / "architecture"
OUT.mkdir(parents=True, exist_ok=True)

# Canvas — ≥5000 px width for thesis print (≈300 dpi on A3 landscape)
W, H = 5200, 3400
MARGIN = 80

# Colors (academic B/W)
BG = "#FFFFFF"
FG = "#000000"
BAND = "#F7F7F7"
BOX_FILL = "#FFFFFF"
HEADER_FILL = "#EEEEEE"


def esc(t: str) -> str:
    return (
        t.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class Box:
    def __init__(self, key, x, y, w, h, title, lines, kind="container"):
        self.key = key
        self.x, self.y, self.w, self.h = x, y, w, h
        self.title = title
        self.lines = lines
        self.kind = kind  # container | person | db | external

    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def edge(self, toward_x, toward_y):
        """Point on box border toward a target (orthogonal preference)."""
        dx = toward_x - self.cx
        dy = toward_y - self.cy
        if abs(dx) * self.h > abs(dy) * self.w:
            # hit left/right
            if dx > 0:
                return self.x + self.w, self.cy
            return self.x, self.cy
        if dy > 0:
            return self.cx, self.y + self.h
        return self.cx, self.y


def layout():
    boxes = {}
    # Actors row
    ay, ah, aw = 120, 110, 280
    gap = 80
    total_actors = 3 * aw + 2 * gap
    ax0 = (W - total_actors) / 2
    for i, (k, t, sub) in enumerate(
        [
            ("student", "Student", "Browser"),
            ("instructor", "Instructor", "Browser"),
            ("admin", "Administrator", "Browser"),
        ]
    ):
        boxes[k] = Box(k, ax0 + i * (aw + gap), ay, aw, ah, t, [sub], "person")

    # Layer bands Y positions
    # Presentation
    py = 320
    ph = 260
    bw, bh = 520, 200
    pgap = 60
    ptotal = 3 * bw + 2 * pgap
    px0 = (W - ptotal) / 2
    for i, (k, t, lines) in enumerate(
        [
            (
                "sui",
                "Student UI",
                [
                    "app/[locale]/(main)",
                    "Courses · Lessons · Quizzes",
                    "Account · Checkout",
                ],
            ),
            (
                "iui",
                "Instructor UI",
                [
                    "app/[locale]/dashboard",
                    "Courses · Quizzes · Grading",
                    "Analytics · Lives",
                ],
            ),
            (
                "aui",
                "Admin UI",
                [
                    "app/[locale]/admin",
                    "Users · Courses · Payments",
                    "Analytics · Quiz/Tutor Settings",
                ],
            ),
        ]
    ):
        boxes[k] = Box(k, px0 + i * (bw + pgap), py + 40, bw, bh, t, lines)

    # Application
    apy = 660
    aph = 280
    abw, abh = 460, 210
    agap = 50
    items = [
        (
            "mw",
            "Edge Middleware",
            [
                "middleware.js",
                "Auth.js Edge · next-intl",
                "RBAC · Security Headers",
            ],
        ),
        (
            "sa",
            "Server Actions",
            [
                "app/actions/*",
                "Course · Module · Lesson",
                "Quizv2 · Enrollment · Admin",
            ],
        ),
        (
            "api",
            "API Route Handlers",
            [
                "app/api/*",
                "Upload · Tutor · Quiz Gen",
                "Analytics · Payments · Certs",
            ],
        ),
        (
            "auth",
            "Authentication Module",
            [
                "auth.js · auth.config.js",
                "Credentials Provider",
                "JWT · bcryptjs",
            ],
        ),
    ]
    atotal = 4 * abw + 3 * agap
    ax0 = (W - atotal) / 2
    for i, (k, t, lines) in enumerate(items):
        boxes[k] = Box(k, ax0 + i * (abw + agap), apy + 45, abw, abh, t, lines)

    # Business
    by = 1020
    bbw, bbh = 560, 230
    bgap = 55
    bitems = [
        (
            "quiz",
            "AI Quiz Pipeline",
            [
                "generation-orchestrator",
                "quiz-generator · mcq-validator",
                "docx-extractor · docx-validator",
            ],
        ),
        (
            "rag",
            "AI RAG Tutor Pipeline",
            [
                "ai-tutor · lecture-embedder",
                "vector-store (Chroma client)",
                "Gemini embed + generate",
            ],
        ),
        (
            "anal",
            "Analytics Services",
            [
                "admin-analytics · instructor",
                "export · projection · anomaly",
                "dashboard-preference",
            ],
        ),
        (
            "mongo_svc",
            "Mongo Connection",
            ["service/mongo.js", "Cached mongoose.connect", "Optional transactions"],
        ),
    ]
    btotal = 4 * bbw + 3 * bgap
    bx0 = (W - btotal) / 2
    for i, (k, t, lines) in enumerate(bitems):
        boxes[k] = Box(k, bx0 + i * (bbw + bgap), by + 45, bbw, bbh, t, lines)

    # Data access
    dy = 1380
    boxes["queries"] = Box(
        "queries",
        700,
        dy + 40,
        900,
        200,
        "Query Layer",
        ["queries/* · queries/analytics/*", "CRUD + aggregations"],
    )
    boxes["models"] = Box(
        "models",
        1750,
        dy + 40,
        1700,
        200,
        "Mongoose Models (model/*)",
        [
            "User · Course · Module · Lesson · Category · Enrollment · Payment",
            "Watch · Report · Quiz · Question · Attempt · GenerationJob",
            "TutorConfiguration · TutorInteraction · TutorReport · DashboardPreference",
        ],
    )

    # Persistence + External
    ey = 1740
    eitems = [
        ("mdb", "MongoDB", ["Primary document store", "MONGODB_CONNECTION_STRING"], "db"),
        (
            "fs",
            "Local Filesystem",
            ["uploads/videos · uploads/lessons", "uploads/lesson-images · public/uploads"],
            "db",
        ),
        (
            "chroma",
            "ChromaDB",
            ["Vector collections", "lms_course_{courseId}", "CHROMA_URL"],
            "db",
        ),
        (
            "gemini",
            "Google Gemini API",
            ["@google/genai", "generateContent", "embedContent"],
            "external",
        ),
        (
            "mockpay",
            "MockPay",
            ["/api/payments/mock", "Enrollment + Payment write"],
            "external",
        ),
    ]
    ew, eh = 720, 200
    egap = 40
    etotal = 5 * ew + 4 * egap
    ex0 = (W - etotal) / 2
    for i, (k, t, lines, kind) in enumerate(eitems):
        boxes[k] = Box(k, ex0 + i * (ew + egap), ey + 50, ew, eh, t, lines, kind)

    bands = [
        ("ACTORS", 90, 160, None),
        ("PRESENTATION LAYER", 300, 280, BAND),
        ("APPLICATION LAYER", 640, 300, BAND),
        ("BUSINESS LAYER — service/", 1000, 300, BAND),
        ("DATA ACCESS LAYER", 1360, 260, BAND),
        ("PERSISTENCE & EXTERNAL SYSTEMS", 1720, 300, BAND),
    ]
    return boxes, bands


def orthogonal_path(x1, y1, x2, y2):
    """Simple elbow: horizontal then vertical mid-point."""
    mx = (x1 + x2) / 2
    return f"M {x1:.1f} {y1:.1f} L {mx:.1f} {y1:.1f} L {mx:.1f} {y2:.1f} L {x2:.1f} {y2:.1f}"


def connections():
    """(from, to, label, style) style: solid|dashed|ai|db|auth|file"""
    return [
        ("student", "mw", "HTTPS", "solid"),
        ("instructor", "mw", "HTTPS", "solid"),
        ("admin", "mw", "HTTPS", "solid"),
        ("mw", "sui", "localize / RBAC", "solid"),
        ("mw", "iui", "localize / RBAC", "solid"),
        ("mw", "aui", "localize / RBAC", "solid"),
        ("sui", "sa", "mutations", "solid"),
        ("sui", "api", "REST", "solid"),
        ("iui", "sa", "mutations", "solid"),
        ("iui", "api", "REST", "solid"),
        ("aui", "sa", "mutations", "solid"),
        ("aui", "api", "REST", "solid"),
        ("mw", "auth", "session (Edge)", "auth"),
        ("sa", "auth", "requireAuth", "auth"),
        ("api", "auth", "session", "auth"),
        ("auth", "queries", "load User", "auth"),
        ("sa", "queries", "CRUD", "db"),
        ("api", "queries", "CRUD / jobs", "db"),
        ("api", "quiz", "quiz-generation", "ai"),
        ("api", "rag", "tutor / embed", "ai"),
        ("api", "anal", "analytics", "db"),
        ("api", "fs", "media I/O", "file"),
        ("api", "mockpay", "confirm", "solid"),
        ("quiz", "gemini", "structured quiz", "ai"),
        ("rag", "gemini", "embed + answer", "ai"),
        ("rag", "chroma", "upsert / query", "ai"),
        ("anal", "queries", "aggregations", "db"),
        ("queries", "models", "ORM", "db"),
        ("models", "mongo_svc", "Mongoose", "db"),
        ("quiz", "mongo_svc", "GenerationJob", "db"),
        ("rag", "mongo_svc", "interactions", "db"),
        ("mongo_svc", "mdb", "TCP", "db"),
        ("mockpay", "queries", "enroll + pay", "db"),
    ]


def svg_box(b: Box) -> str:
    parts = []
    if b.kind == "person":
        # stick-figure style box (rectangle with label — no decorative icons)
        parts.append(
            f'<rect x="{b.x}" y="{b.y}" width="{b.w}" height="{b.h}" '
            f'fill="{BOX_FILL}" stroke="{FG}" stroke-width="2"/>'
        )
        parts.append(
            f'<text x="{b.cx}" y="{b.y + 45}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="28" font-weight="bold" fill="{FG}">'
            f"{esc(b.title)}</text>"
        )
        for i, line in enumerate(b.lines):
            parts.append(
                f'<text x="{b.cx}" y="{b.y + 80 + i * 28}" text-anchor="middle" '
                f'font-family="Times New Roman, Times, serif" font-size="20" fill="{FG}">'
                f"{esc(line)}</text>"
            )
    elif b.kind == "db":
        # cylinder approximation: rounded rect
        parts.append(
            f'<rect x="{b.x}" y="{b.y}" width="{b.w}" height="{b.h}" rx="18" ry="18" '
            f'fill="{BOX_FILL}" stroke="{FG}" stroke-width="2"/>'
        )
        parts.append(
            f'<ellipse cx="{b.cx}" cy="{b.y + 18}" rx="{b.w/2 - 2}" ry="16" '
            f'fill="{HEADER_FILL}" stroke="{FG}" stroke-width="1.5"/>'
        )
        parts.append(
            f'<text x="{b.cx}" y="{b.y + 70}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="26" font-weight="bold" fill="{FG}">'
            f"{esc(b.title)}</text>"
        )
        for i, line in enumerate(b.lines):
            parts.append(
                f'<text x="{b.cx}" y="{b.y + 105 + i * 26}" text-anchor="middle" '
                f'font-family="Times New Roman, Times, serif" font-size="18" fill="{FG}">'
                f"{esc(line)}</text>"
            )
    else:
        parts.append(
            f'<rect x="{b.x}" y="{b.y}" width="{b.w}" height="{b.h}" '
            f'fill="{BOX_FILL}" stroke="{FG}" stroke-width="2"/>'
        )
        # title bar
        parts.append(
            f'<rect x="{b.x}" y="{b.y}" width="{b.w}" height="44" '
            f'fill="{HEADER_FILL}" stroke="{FG}" stroke-width="2"/>'
        )
        parts.append(
            f'<text x="{b.cx}" y="{b.y + 30}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="24" font-weight="bold" fill="{FG}">'
            f"{esc(b.title)}</text>"
        )
        for i, line in enumerate(b.lines):
            parts.append(
                f'<text x="{b.cx}" y="{b.y + 78 + i * 28}" text-anchor="middle" '
                f'font-family="Times New Roman, Times, serif" font-size="18" fill="{FG}">'
                f"{esc(line)}</text>"
            )
    return "\n".join(parts)


def stroke_for(style: str) -> tuple[str, str]:
    # return stroke-dasharray, stroke-width
    if style == "dashed" or style == "auth":
        return "8 6", "1.8"
    if style == "ai":
        return "12 4", "2.2"
    if style == "file":
        return "2 6", "1.8"
    if style == "db":
        return "", "2"
    return "", "1.8"


def build_svg() -> str:
    boxes, bands = layout()
    conns = connections()
    parts = [
        f'<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="{BG}"/>',
        # Title
        f'<text x="{W/2}" y="48" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="42" font-weight="bold" fill="{FG}">LMS Container Architecture (C4 Level 2)</text>',
        f'<text x="{W/2}" y="88" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="24" fill="{FG}">Modular Monolith — Next.js 15 · Auth.js · MongoDB · Gemini · ChromaDB</text>',
        f'<text x="{W/2}" y="118" text-anchor="middle" font-family="Times New Roman, Times, serif" '
        f'font-size="18" fill="{FG}">IEEE 1016 / UML 2.x / C4 — reverse-engineered from LMSV2-main source</text>',
    ]

    # Layer bands
    for label, y, h, fill in bands:
        if fill:
            parts.append(
                f'<rect x="{MARGIN}" y="{y}" width="{W - 2 * MARGIN}" height="{h}" '
                f'fill="{fill}" stroke="{FG}" stroke-width="1.5"/>'
            )
        parts.append(
            f'<text x="{MARGIN + 20}" y="{y + 28}" font-family="Times New Roman, Times, serif" '
            f'font-size="20" font-weight="bold" fill="{FG}">{esc(label)}</text>'
        )

    # Connections (under boxes)
    parts.append('<defs>')
    parts.append(
        f'<marker id="arrow" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto">'
        f'<path d="M0,0 L12,5 L0,10 Z" fill="{FG}"/></marker>'
    )
    parts.append("</defs>")

    for frm, to, label, style in conns:
        a, b = boxes[frm], boxes[to]
        x2, y2 = b.edge(a.cx, a.cy)
        x1, y1 = a.edge(b.cx, b.cy)
        dash, sw = stroke_for(style)
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        d = orthogonal_path(x1, y1, x2, y2)
        parts.append(
            f'<path d="{d}" fill="none" stroke="{FG}" stroke-width="{sw}"{dash_attr} marker-end="url(#arrow)"/>'
        )
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - 8
        parts.append(
            f'<text x="{mx:.1f}" y="{my:.1f}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="14" fill="{FG}">'
            f'<tspan fill="{BG}" stroke="{BG}" stroke-width="6">{esc(label)}</tspan></text>'
        )
        parts.append(
            f'<text x="{mx:.1f}" y="{my:.1f}" text-anchor="middle" '
            f'font-family="Times New Roman, Times, serif" font-size="14" fill="{FG}">{esc(label)}</text>'
        )

    for b in boxes.values():
        parts.append(svg_box(b))

    # Legend
    lx, ly = MARGIN, H - 280
    parts.append(
        f'<rect x="{lx}" y="{ly}" width="1600" height="200" fill="{BG}" stroke="{FG}" stroke-width="1.5"/>'
    )
    parts.append(
        f'<text x="{lx + 20}" y="{ly + 36}" font-family="Times New Roman, Times, serif" '
        f'font-size="22" font-weight="bold" fill="{FG}">Legend</text>'
    )
    legend = [
        (60, "Solid arrow — Request / response / control flow"),
        (95, "Dashed arrow — Authentication / session"),
        (130, "Dash-dot arrow — AI communication (Gemini / RAG)"),
        (165, "Dotted arrow — File I/O · Thick solid — Database access"),
    ]
    for yy, text in legend:
        parts.append(
            f'<text x="{lx + 40}" y="{ly + yy}" font-family="Times New Roman, Times, serif" '
            f'font-size="18" fill="{FG}">{esc(text)}</text>'
        )

    # Footer note
    parts.append(
        f'<text x="{W - MARGIN}" y="{H - 40}" text-anchor="end" '
        f'font-family="Times New Roman, Times, serif" font-size="16" fill="{FG}">'
        f"Excluded as unused in runtime: Resend · Stripe SDK · OAuth providers</text>"
    )
    parts.append("</svg>")
    return "\n".join(parts)


def write_png_with_pillow(svg_path: Path, png_path: Path):
    """Rasterize by redrawing layout with Pillow (no cairo dependency)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        import subprocess
        import sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow", "-q"])
        from PIL import Image, ImageDraw, ImageFont

    boxes, bands = layout()
    img = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(img)

    def font(size, bold=False):
        candidates = [
            "C:/Windows/Fonts/timesbd.ttf" if bold else "C:/Windows/Fonts/times.ttf",
            "C:/Windows/Fonts/timesi.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        ]
        for c in candidates:
            if os.path.exists(c):
                try:
                    return ImageFont.truetype(c, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    f_title = font(42, True)
    f_sub = font(24)
    f_band = font(20, True)
    f_box_t = font(22, True)
    f_box = font(16)
    f_small = font(14)
    f_leg = font(18)

    draw.text((W / 2, 20), "LMS Container Architecture (C4 Level 2)", fill=0, font=f_title, anchor="mt")
    draw.text(
        (W / 2, 70),
        "Modular Monolith — Next.js 15 · Auth.js · MongoDB · Gemini · ChromaDB",
        fill=0,
        font=f_sub,
        anchor="mt",
    )
    draw.text(
        (W / 2, 105),
        "IEEE 1016 / UML 2.x / C4 — reverse-engineered from LMSV2-main source",
        fill=0,
        font=f_small,
        anchor="mt",
    )

    for label, y, h, fill in bands:
        if fill:
            draw.rectangle([MARGIN, y, W - MARGIN, y + h], outline=0, width=2, fill=(247, 247, 247))
        draw.text((MARGIN + 20, y + 8), label, fill=0, font=f_band)

    # connections
    for frm, to, label, style in connections():
        a, b = boxes[frm], boxes[to]
        x1, y1 = a.edge(b.cx, b.cy)
        x2, y2 = b.edge(a.cx, a.cy)
        mx = (x1 + x2) / 2
        width = 3 if style in ("ai", "db") else 2
        draw.line([(x1, y1), (mx, y1), (mx, y2), (x2, y2)], fill=0, width=width)
        # arrow head
        draw.polygon([(x2, y2), (x2 - 10, y2 - 6), (x2 - 10, y2 + 6)], fill=0)
        draw.text((mx, (y1 + y2) / 2 - 10), label, fill=0, font=f_small, anchor="mm")

    for b in boxes.values():
        draw.rectangle([b.x, b.y, b.x + b.w, b.y + b.h], outline=0, width=2, fill=(255, 255, 255))
        if b.kind != "person":
            draw.rectangle([b.x, b.y, b.x + b.w, b.y + 44], outline=0, width=2, fill=(238, 238, 238))
            draw.text((b.cx, b.y + 22), b.title, fill=0, font=f_box_t, anchor="mm")
            for i, line in enumerate(b.lines):
                draw.text((b.cx, b.y + 70 + i * 26), line, fill=0, font=f_box, anchor="mm")
        else:
            draw.text((b.cx, b.y + 40), b.title, fill=0, font=f_box_t, anchor="mm")
            for i, line in enumerate(b.lines):
                draw.text((b.cx, b.y + 75 + i * 26), line, fill=0, font=f_box, anchor="mm")

    # legend
    lx, ly = MARGIN, H - 280
    draw.rectangle([lx, ly, lx + 1600, ly + 200], outline=0, width=2, fill=(255, 255, 255))
    draw.text((lx + 20, ly + 16), "Legend", fill=0, font=f_band)
    for i, text in enumerate(
        [
            "Solid arrow — Request / response / control flow",
            "Dashed / auth — Authentication / session",
            "AI arrows — Gemini generation & RAG retrieval",
            "DB arrows — MongoDB / query-layer access · File — local uploads",
        ]
    ):
        draw.text((lx + 40, ly + 55 + i * 32), text, fill=0, font=f_leg)

    draw.text(
        (W - MARGIN, H - 40),
        "Excluded as unused in runtime: Resend · Stripe SDK · OAuth providers",
        fill=0,
        font=f_small,
        anchor="rb",
    )

    # 300 dpi metadata via PNG; physical size ~17.3" wide
    img.save(png_path, "PNG", dpi=(300, 300))
    print(f"Wrote {png_path} ({img.size[0]}x{img.size[1]})")


def write_pdf_from_png(png_path: Path, pdf_path: Path):
    try:
        from PIL import Image
    except ImportError:
        raise

    try:
        from reportlab.lib.pagesizes import landscape
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
    except ImportError:
        import subprocess
        import sys

        subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab", "-q"])
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import inch

    # A3 landscape-ish custom page matching aspect
    page_w, page_h = 16.54 * inch, 10.81 * inch  # ~A3 landscape
    c = canvas.Canvas(str(pdf_path), pagesize=(page_w, page_h))
    c.drawImage(str(png_path), 0, 0, width=page_w, height=page_h, preserveAspectRatio=True, anchor="c")
    c.save()
    print(f"Wrote {pdf_path}")


def main():
    svg = build_svg()
    svg_path = OUT / "architecture.svg"
    png_path = OUT / "architecture.png"
    pdf_path = OUT / "architecture.pdf"
    svg_path.write_text(svg, encoding="utf-8")
    print(f"Wrote {svg_path}")
    write_png_with_pillow(svg_path, png_path)
    write_pdf_from_png(png_path, pdf_path)


if __name__ == "__main__":
    main()
