#!/usr/bin/env python3
"""cv_pdf.py - Render tailored CV JSON to PDF using fpdf2. No LibreOffice needed."""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

try:
    from fpdf import FPDF
except ImportError:
    print("fpdf2 required. pip install fpdf2", file=sys.stderr)
    sys.exit(1)

C_HEADING  = (11, 17, 32)
C_ACCENT   = (191, 150, 60)
C_BAR_BG   = (18, 23, 36)
C_BAR_TEXT = (243, 245, 251)
C_BODY     = (70, 74, 79)
C_FAINT    = (140, 145, 155)
C_BULLET   = (50, 54, 64)


def _a(t: object) -> str:
    """Transliterate to ASCII so fpdf2 Helvetica can encode it."""
    s = str(t if t is not None else "")
    replacements = [
        ("\u2014", "--"), ("\u2013", "-"), ("\u2019", "'"), ("\u2018", "'"),
        ("\u201c", '"'),  ("\u201d", '"'), ("\u2022", "*"), ("\u00b7", "."),
        ("\u00e9", "e"),  ("\u00e1", "a"), ("\u00ed", "i"), ("\u00f3", "o"),
        ("\u00fa", "u"),  ("\u00f1", "n"), ("\u00e0", "a"), ("\u00e8", "e"),
        ("\u00ec", "i"),  ("\u00f2", "o"), ("\u00f9", "u"), ("\u00fc", "u"),
        ("\u00e4", "a"),  ("\u00f6", "o"), ("\u00c9", "E"), ("\u00c1", "A"),
        ("\u00d3", "O"),  ("\u00da", "U"), ("\u00c0", "A"), ("\u00c8", "E"),
        ("\u00cd", "I"),  ("\u00d1", "N"), ("\u00df", "ss"),
    ]
    for src, dst in replacements:
        s = s.replace(src, dst)
    return s.encode("ascii", errors="replace").decode("ascii")


class CVPDF(FPDF):
    def header(self): pass
    def footer(self): pass


def render_pdf(cv: dict, output_path: str) -> str:
    pdf = CVPDF(format="A4")
    pdf.set_margins(15, 14, 15)
    pdf.add_page()
    pdf.set_auto_page_break(True, 14)
    W = pdf.w - pdf.l_margin - pdf.r_margin

    # Name
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(*C_HEADING)
    pdf.cell(W, 10, _a(cv.get("name", "Your Name")), new_x="LMARGIN", new_y="NEXT", align="C")

    # Headline
    hl = _a(cv.get("headline", ""))
    if hl:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(*C_ACCENT)
        pdf.multi_cell(W, 5, hl, align="C")
    pdf.ln(2)

    # Contact
    ct = cv.get("contact", {})
    if isinstance(ct, dict):
        pts = [_a(ct[k]) for k in ("email", "phone", "location") if ct.get(k)]
        if pts:
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*C_FAINT)
            pdf.cell(W, 5, " | ".join(pts), new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(3)

    # Summary
    sm = _a(cv.get("summary", ""))
    if sm:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*C_BODY)
        pdf.multi_cell(W, 5, sm, align="J")
        pdf.ln(4)

    def section_bar(title: str) -> None:
        pdf.set_fill_color(*C_BAR_BG)
        pdf.set_text_color(*C_BAR_TEXT)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(W, 6, title.upper(), new_x="LMARGIN", new_y="NEXT", align="L", fill=True)
        pdf.ln(2)

    def bullet(text: str) -> None:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*C_BULLET)
        pdf.set_x(pdf.l_margin + 4)
        pdf.multi_cell(W - 6, 4.5, "- " + _a(text), align="L")

    # Experience
    exps = cv.get("experience", [])
    if exps:
        section_bar("Experience")
        for exp in exps:
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(*C_HEADING)
            pdf.cell(W, 5, _a(exp.get("role", "")), new_x="LMARGIN", new_y="NEXT")
            mp = [_a(exp[k]) for k in ("company", "location") if exp.get(k)]
            d  = _a(str(exp.get("start", "")) + " - " + str(exp.get("end", "")))
            ml = " | ".join(mp)
            pdf.set_font("Helvetica", "", 8)
            if ml:
                pdf.set_text_color(*C_ACCENT)
                pdf.cell(pdf.get_string_width(ml) + 2, 4.5, ml)
                pdf.set_text_color(*C_FAINT)
                pdf.cell(0, 4.5, "   " + d, new_x="LMARGIN", new_y="NEXT")
            else:
                pdf.set_text_color(*C_FAINT)
                pdf.cell(W, 4.5, d, new_x="LMARGIN", new_y="NEXT")
            for b in exp.get("bullets", []):
                bullet(b)
            pdf.ln(2)

    # Skills
    skills = cv.get("skills", [])
    if skills:
        section_bar("Skills")
        for sg in skills:
            cat   = _a(sg.get("category", ""))
            items = [_a(i) for i in sg.get("items", [])]
            if not items:
                continue
            pdf.set_x(pdf.l_margin)
            if cat:
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_text_color(*C_HEADING)
                lbl = cat + ":  "
                pdf.cell(pdf.get_string_width(lbl) + 1, 5, lbl)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*C_BODY)
            pdf.multi_cell(0, 5, ", ".join(items))
        pdf.ln(1)

    # Competencies
    comp = [_a(c) for c in cv.get("competencies", [])]
    if comp:
        section_bar("Competencies")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*C_BODY)
        for i in range(0, len(comp), 6):
            pdf.cell(W, 4.5, " | ".join(comp[i:i + 6]), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    # Education
    edu = cv.get("education", [])
    if edu:
        section_bar("Education")
        for e in edu:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*C_HEADING)
            pdf.cell(W, 5, _a(e.get("degree", "")), new_x="LMARGIN", new_y="NEXT")
            m = []
            if e.get("institution"):
                m.append(_a(e["institution"]))
            if e.get("year"):
                m.append(str(e["year"]))
            if m:
                pdf.set_font("Helvetica", "", 8)
                pdf.set_text_color(*C_FAINT)
                pdf.cell(W, 4.5, " | ".join(m), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    # Languages
    lng = cv.get("languages", [])
    if lng:
        section_bar("Languages")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*C_BODY)
        parts = [_a(str(l.get("lang", "")) + " (" + str(l.get("level", "")) + ")") for l in lng if l.get("lang")]
        pdf.cell(W, 4.5, " | ".join(parts), new_x="LMARGIN", new_y="NEXT")

    pdf.output(str(output_path))
    return str(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate PDF from tailored CV JSON")
    parser.add_argument("cv_json", help="Path to the tailored CV JSON")
    parser.add_argument("--output", default=None, help="Output PDF path")
    args = parser.parse_args()
    jp = Path(args.cv_json)
    if not jp.exists():
        print(f"ERROR: {jp} not found", file=sys.stderr)
        sys.exit(1)
    cv = json.loads(jp.read_text())
    print(render_pdf(cv, args.output or str(jp.with_suffix(".pdf"))))


if __name__ == "__main__":
    main()
