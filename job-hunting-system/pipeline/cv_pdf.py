#!/usr/bin/env python3
"""Render tailored CV JSON to a PDF matching the uploaded CV template style."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from fpdf import FPDF
except ImportError:
    print("fpdf2 required. pip install fpdf2", file=sys.stderr)
    sys.exit(1)

TEXT_COLOR = (17, 17, 17)
MUTED_COLOR = (40, 40, 40)
FONT_REGULAR = Path("/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf")
FONT_BOLD = Path("/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf")
FONT_ITALIC = Path("/usr/share/fonts/truetype/croscore/Arimo-Italic.ttf")

MONTHS = {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
}


def _text(value: object) -> str:
    return str(value or "").replace("\u00a0", " ").strip()


def _items(values: object) -> list[str]:
    if not isinstance(values, list):
        return []
    return [_text(value) for value in values if _text(value)]


def _format_date(value: object) -> str:
    raw = _text(value)
    if not raw:
        return ""
    lowered = raw.lower()
    if lowered in {"present", "current", "now"}:
        return "Present"
    if len(raw) >= 7 and raw[4] == "-":
        year, month = raw[:4], raw[5:7]
        if year.isdigit() and month in MONTHS:
            return f"{MONTHS[month]} {year}"
    return raw


def _date_range(start: object, end: object) -> str:
    parts = [_format_date(start), _format_date(end)]
    parts = [part for part in parts if part]
    return " - ".join(parts)


def _contact_line(contact: object) -> str:
    if not isinstance(contact, dict):
        return ""
    values = []
    for key in ("phone", "email", "linkedin", "location"):
        value = _text(contact.get(key))
        if value:
            values.append(value)
    return " - ".join(values)


def _split_experience(experiences: object) -> tuple[list[dict], list[dict]]:
    detailed: list[dict] = []
    earlier: list[dict] = []
    if not isinstance(experiences, list):
        return detailed, earlier
    for item in experiences:
        if not isinstance(item, dict):
            continue
        if _items(item.get("bullets")):
            detailed.append(item)
        else:
            earlier.append(item)
    return detailed, earlier


def _experience_header(exp: dict) -> tuple[str, str]:
    company = _text(exp.get("company"))
    location = _text(exp.get("location"))
    role = _text(exp.get("role"))
    dates = _date_range(exp.get("start"), exp.get("end"))

    company_line = company
    if company and location:
        company_line = f"{company} - {location}"
    elif location:
        company_line = location

    role_line = role
    if role and dates:
        role_line = f"{role} | {dates}"
    elif dates:
        role_line = dates
    return company_line, role_line


def _latin_fallback(text: str) -> str:
    replacements = {
        "\u2022": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text.encode("latin-1", errors="replace").decode("latin-1")


class CVPDF(FPDF):
    def header(self) -> None:
        return None

    def footer(self) -> None:
        return None


def _register_fonts(pdf: FPDF) -> tuple[str, bool]:
    if FONT_REGULAR.exists() and FONT_BOLD.exists():
        pdf.add_font("Arimo", "", str(FONT_REGULAR))
        pdf.add_font("Arimo", "B", str(FONT_BOLD))
        if FONT_ITALIC.exists():
            pdf.add_font("Arimo", "I", str(FONT_ITALIC))
        return "Arimo", True
    return "Helvetica", False


def render_pdf(cv: dict, output_path: str) -> str:
    pdf = CVPDF(format="Letter", unit="mm")
    pdf.set_margins(14, 11.5, 14)
    pdf.set_auto_page_break(True, margin=11.5)
    font_name, unicode_font = _register_fonts(pdf)
    pdf.add_page()
    content_width = pdf.w - pdf.l_margin - pdf.r_margin

    def safe(value: str) -> str:
        return value if unicode_font else _latin_fallback(value)

    def line_height(size: float) -> float:
        return size * 0.46

    def add_text(text: str, *, size: float = 8.8, style: str = "", before: float = 0,
                 after: float = 0, color: tuple[int, int, int] = TEXT_COLOR) -> None:
        if not text:
            return
        if before:
            pdf.ln(before)
        pdf.set_font(font_name, style, size)
        pdf.set_text_color(*color)
        pdf.multi_cell(content_width, line_height(size), safe(text), align="L")
        if after:
            pdf.ln(after)

    def add_section(title: str) -> None:
        if pdf.get_y() > pdf.t_margin + 1:
            pdf.ln(2.8)
        add_text(title.upper(), size=9.4, style="B", after=1.2)

    def add_bullet(text: str) -> None:
        pdf.set_font(font_name, "", 8.35)
        pdf.set_text_color(*TEXT_COLOR)
        pdf.set_x(pdf.l_margin + 4)
        pdf.multi_cell(content_width - 4, line_height(8.35), safe("\u2022 " + text), align="L")
        pdf.ln(0.2)

    name = _text(cv.get("name")) or "Your Name"
    headline = _text(cv.get("headline"))
    contact = _contact_line(cv.get("contact"))

    add_text(name, size=13.5, style="B", after=0.4)
    add_text(headline, size=8.8, after=0.4)
    add_text(contact, size=8.4, after=2.8)

    summary = _text(cv.get("summary"))
    if summary:
        add_section("Professional Summary")
        add_text(summary, size=8.8, after=0.6)

    detailed, earlier = _split_experience(cv.get("experience"))
    if detailed:
        add_section("Professional Experience")
        for index, exp in enumerate(detailed):
            if index and pdf.get_y() > 242:
                pdf.add_page()
            company_line, role_line = _experience_header(exp)
            add_text(company_line, size=8.8, style="B", before=0.8 if index else 0, after=0.1)
            add_text(role_line, size=8.35, after=0.7, color=MUTED_COLOR)
            for bullet in _items(exp.get("bullets")):
                add_bullet(bullet)

    if earlier:
        add_section("Earlier Experience")
        add_text("Delivered multiple enterprise and financial system solutions across the following roles:", size=8.6, after=0.5)
        for exp in earlier:
            company = _text(exp.get("company"))
            role = _text(exp.get("role"))
            dates = _date_range(exp.get("start"), exp.get("end"))
            line = company
            if company and role:
                line = f"{company} - {role}"
            elif role:
                line = role
            if dates:
                line = f"{line} ({dates})" if line else dates
            add_text(line, size=8.5, after=0.1)

    education = cv.get("education")
    if isinstance(education, list) and education:
        add_section("Education")
        for edu in education:
            if not isinstance(edu, dict):
                continue
            degree = _text(edu.get("degree"))
            field = _text(edu.get("field"))
            institution = _text(edu.get("institution"))
            year = _text(edu.get("year") or edu.get("end"))
            credential = degree
            if degree and field:
                credential = f"{degree} in {field}"
            elif field:
                credential = field
            line = credential or institution
            if institution and institution != line:
                line = f"{line} - {institution}" if line else institution
            if year:
                line = f"{line} ({year})" if line else year
            add_text(line, size=8.6, after=0.2)

    skills = cv.get("skills")
    if isinstance(skills, list) and skills:
        add_section("Technical Skills")
        for group in skills:
            if not isinstance(group, dict):
                continue
            category = _text(group.get("category"))
            items = _items(group.get("items"))
            if not category and not items:
                continue
            label = f"{category}: " if category else ""
            add_text(label + ", ".join(items), size=8.5, after=0.1)

    additional_lines: list[tuple[str, str]] = []
    languages = cv.get("languages")
    if isinstance(languages, list):
        parts = []
        for language in languages:
            if not isinstance(language, dict):
                continue
            lang = _text(language.get("lang"))
            level = _text(language.get("level"))
            if lang and level:
                parts.append(f"{lang} ({level})")
            elif lang:
                parts.append(lang)
        if parts:
            additional_lines.append(("Languages", ", ".join(parts)))

    competencies = _items(cv.get("competencies"))
    if competencies:
        additional_lines.append(("Core Competencies", ", ".join(competencies)))

    additional = cv.get("additional_information") or cv.get("additionalInfo")
    if isinstance(additional, dict):
        for key, value in additional.items():
            label = str(key).replace("_", " ").title()
            rendered_value = ", ".join(_items(value)) if isinstance(value, list) else _text(value)
            if rendered_value:
                additional_lines.append((label, rendered_value))

    if additional_lines:
        add_section("Additional Information")
        for label, value in additional_lines:
            add_text(f"{label}: {value}", size=8.5, after=0.1)

    pdf.output(str(output_path))
    return str(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a template-aligned PDF from tailored CV JSON")
    parser.add_argument("cv_json", help="Path to the tailored CV JSON")
    parser.add_argument("--output", default=None, help="Output PDF path")
    args = parser.parse_args()

    json_path = Path(args.cv_json)
    if not json_path.exists():
        print(f"ERROR: {json_path} not found", file=sys.stderr)
        sys.exit(1)

    cv = json.loads(json_path.read_text(encoding="utf-8"))
    print(render_pdf(cv, args.output or str(json_path.with_suffix(".pdf"))))


if __name__ == "__main__":
    main()
