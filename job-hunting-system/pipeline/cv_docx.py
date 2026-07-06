#!/usr/bin/env python3
"""
cv_docx.py — Render a tailored CV JSON into a clean .docx.

Usage: cv_docx.py <cv_json_path> [--output <path>]

If --output is omitted, writes to <cv_json_path>.docx next to the JSON.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
except ImportError:
    print("python-docx is required. Install with: pip install python-docx", file=sys.stderr)
    sys.exit(1)


# ── colour palette (matches dashboard) ────────────────────────────────────

GOLD = RGBColor(0xEA, 0xC2, 0x66)
DARK_BG = RGBColor(0x0B, 0x11, 0x20)
SECTION_BG = RGBColor(0x12, 0x17, 0x24)
TEXT_WHITE = RGBColor(0xF3, 0xF5, 0xFB)
TEXT_SECONDARY = RGBColor(0xB4, 0xB7, 0xC1)
TEXT_FAINT = RGBColor(0x70, 0x74, 0x7F)
ACCENT_TEAL = RGBColor(0x00, 0xC8, 0x9C)

# For PDF rendering we need lighter colours on white background
HEADING_COLOR = RGBColor(0x0B, 0x11, 0x20)
ACCENT_COLOR = RGBColor(0xBF, 0x96, 0x3C)
BAR_COLOR = RGBColor(0x12, 0x17, 0x24)
BAR_TEXT = RGBColor(0xF3, 0xF5, 0xFB)


def _set_cell_shading(cell, color: RGBColor):
    """Set background shading on a table cell."""
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), f"{color[0]:02X}{color[1]:02X}{color[2]:02X}")
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def _add_colored_paragraph(cell, text: str, bold: bool = False,
                           size: int = 11, color: RGBColor = TEXT_WHITE,
                           alignment=None):
    """Add a paragraph with specific styling to a cell."""
    p = cell.paragraphs[0] if cell.paragraphs and not cell.paragraphs[0].text else cell.add_paragraph()
    if alignment:
        p.alignment = alignment
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    run.font.color.rgb = color
    return p


def render_docx(cv: dict, output_path: str) -> str:
    """Render a tailored CV JSON to a .docx file."""
    doc = Document()

    # Page setup
    section = doc.sections[0]
    section.top_margin = Inches(0.6)
    section.bottom_margin = Inches(0.6)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    # ── Name + Headline ────────────────────────────────────────────────
    name = cv.get("name", "Your Name")
    headline = cv.get("headline", "")

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(name)
    run.bold = True
    run.font.size = Pt(22)
    run.font.color.rgb = HEADING_COLOR

    if headline:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(headline)
        run.font.size = Pt(11)
        run.font.color.rgb = ACCENT_COLOR

    # ── Contact line ───────────────────────────────────────────────────
    contact = cv.get("contact", {})
    contact_parts = []
    if isinstance(contact, dict):
        for key in ("email", "phone", "location"):
            v = contact.get(key, "")
            if v:
                contact_parts.append(str(v))
    if contact_parts:
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run("  |  ".join(contact_parts))
        run.font.size = Pt(9)
        run.font.color.rgb = TEXT_FAINT

    # ── Summary ────────────────────────────────────────────────────────
    summary = cv.get("summary", "")
    if summary:
        doc.add_paragraph()  # spacer
        p = doc.add_paragraph()
        run = p.add_run(summary)
        run.font.size = Pt(10)
        run.font.color.rgb = TEXT_SECONDARY

    # ── Section helper ─────────────────────────────────────────────────
    def add_section(title: str):
        doc.add_paragraph()  # spacer
        # Section bar (shaded table row for the title)
        table = doc.add_table(rows=1, cols=1)
        table.autofit = True
        cell = table.cell(0, 0)
        _set_cell_shading(cell, BAR_COLOR)
        _add_colored_paragraph(cell, title.upper(), bold=True,
                               size=10, color=BAR_TEXT)

    def add_bullets(items: list, size: int = 10):
        for item in items:
            p = doc.add_paragraph(item, style="List Bullet")
            for run in p.runs:
                run.font.size = Pt(size)
                run.font.color.rgb = TEXT_SECONDARY

    # ── Experience ─────────────────────────────────────────────────────
    experiences = cv.get("experience", [])
    if experiences:
        add_section("Experience")
        for exp in experiences:
            # Role + date (two-column style)
            p = doc.add_paragraph()
            run = p.add_run(exp.get("role", ""))
            run.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = HEADING_COLOR

            # Company + location + dates
            parts = []
            for k in ("company", "location"):
                v = exp.get(k, "")
                if v:
                    parts.append(str(v))
            dates = f"{exp.get('start', '')} — {exp.get('end', '')}"
            if parts or dates:
                p = doc.add_paragraph()
                if parts:
                    run = p.add_run(" · ".join(parts))
                    run.font.size = Pt(9)
                    run.font.color.rgb = ACCENT_COLOR
                    run = p.add_run(f"  |  {dates}")
                    run.font.size = Pt(9)
                    run.font.color.rgb = TEXT_FAINT
                else:
                    run = p.add_run(dates)
                    run.font.size = Pt(9)
                    run.font.color.rgb = TEXT_FAINT

            # Bullets
            bullets = exp.get("bullets", [])
            add_bullets(bullets, size=9)

    # ── Skills ─────────────────────────────────────────────────────────
    skills = cv.get("skills", [])
    if skills:
        add_section("Skills")
        for sg in skills:
            category = sg.get("category", "")
            items = sg.get("items", [])
            if category:
                p = doc.add_paragraph()
                run = p.add_run(category + ":  ")
                run.bold = True
                run.font.size = Pt(9)
                run.font.color.rgb = HEADING_COLOR
                run = p.add_run(", ".join(items))
                run.font.size = Pt(9)
                run.font.color.rgb = TEXT_SECONDARY

    # ── Competencies ───────────────────────────────────────────────────
    competencies = cv.get("competencies", [])
    if competencies:
        add_section("Competencies")
        p = doc.add_paragraph()
        run = p.add_run(" · ".join(competencies))
        run.font.size = Pt(9)
        run.font.color.rgb = TEXT_SECONDARY

    # ── Education ──────────────────────────────────────────────────────
    education = cv.get("education", [])
    if education:
        add_section("Education")
        for edu in education:
            p = doc.add_paragraph()
            run = p.add_run(edu.get("degree", edu.get("institution", "")))
            run.bold = True
            run.font.size = Pt(10)
            run.font.color.rgb = HEADING_COLOR

            parts = []
            for k in ("institution", "field"):
                v = edu.get(k, "")
                if v and k != "degree":
                    parts.append(str(v))
            if parts:
                p = doc.add_paragraph()
                run = p.add_run(" · ".join(parts))
                run.font.size = Pt(9)
                run.font.color.rgb = TEXT_SECONDARY

            dates = f"{edu.get('start', '')} — {edu.get('end', '')}"
            if dates.strip(" —"):
                p = doc.add_paragraph()
                run = p.add_run(dates)
                run.font.size = Pt(8)
                run.font.color.rgb = TEXT_FAINT

    # ── Languages ──────────────────────────────────────────────────────
    languages = cv.get("languages", [])
    if languages:
        add_section("Languages")
        for lang in languages:
            p = doc.add_paragraph()
            run = p.add_run(f"{lang.get('lang', '')}: {lang.get('level', '')}")
            run.font.size = Pt(9)
            run.font.color.rgb = TEXT_SECONDARY

    # Save
    doc.save(output_path)
    return output_path


def convert_to_pdf(docx_path: str, output_dir: str = None) -> str | None:
    """Use LibreOffice headless to convert .docx to PDF."""
    if output_dir is None:
        output_dir = os.path.dirname(docx_path)

    try:
        r = subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf",
             "--outdir", output_dir, docx_path],
            capture_output=True, text=True, timeout=60,
        )
        if r.returncode == 0:
            pdf_path = str(Path(docx_path).with_suffix(".pdf"))
            if os.path.exists(pdf_path):
                return pdf_path
            # LibreOffice may write to output_dir with same basename
            expected = Path(output_dir) / Path(docx_path).with_suffix(".pdf").name
            if expected.exists():
                return str(expected)
        print(f"LibreOffice warning: {r.stderr[:200]}", file=sys.stderr)
    except FileNotFoundError:
        print("soffice not found — install LibreOffice for PDF conversion", file=sys.stderr)
    except Exception as e:
        print(f"PDF conversion failed: {e}", file=sys.stderr)
    return None


def main():
    parser = argparse.ArgumentParser(description="Render tailored CV JSON to .docx")
    parser.add_argument("cv_json", help="Path to tailored CV JSON file")
    parser.add_argument("--output", "-o", help="Output path for .docx (default: <input>.docx)")
    parser.add_argument("--pdf", action="store_true", help="Also convert to PDF")
    args = parser.parse_args()

    with open(args.cv_json) as f:
        cv = json.load(f)

    output = args.output or str(Path(args.cv_json).with_suffix(".docx"))
    render_docx(cv, output)
    print(json.dumps({"status": "ok", "docx": output, "size": os.path.getsize(output)}))

    if args.pdf:
        pdf = convert_to_pdf(output)
        if pdf:
            print(json.dumps({"status": "ok", "pdf": pdf, "size": os.path.getsize(pdf)}))


if __name__ == "__main__":
    main()