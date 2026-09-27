"""
Malicious-content scanner for uploaded court-order PDFs.
Tuesday, Week 4 task: "scan uploaded PDFs for malformed/malicious content
before processing"

This goes beyond basic type/size validation (already handled in
upload_validation.py / pdf_extraction_pipeline.py). A PDF can be a
perfectly valid, readable PDF file and still be dangerous - PDFs support
embedded scripts and auto-actions that can execute when the file is opened.

This scanner looks for known PDF attack indicators:
    /JavaScript, /JS       - embedded scripts that can run automatically
    /OpenAction            - an action that triggers automatically on open
    /AA (Additional Actions) - triggers on events like closing/printing
    /Launch                - can launch external programs/files
    /EmbeddedFile          - files hidden inside the PDF (could be malware)

A legitimate scanned/e-filed court order should never need any of these.
Their presence is a strong red flag, not a false-positive-prone check.
"""

import re
import sys

# Each pattern is checked against the raw PDF bytes. PDF internal syntax
# uses these exact keywords regardless of how the PDF was generated, so
# this works even without fully parsing the PDF structure.
SUSPICIOUS_PATTERNS = {
    rb"/JavaScript": "Embedded JavaScript (can execute code automatically)",
    rb"/JS\b": "Embedded JavaScript action",
    rb"/OpenAction": "Auto-trigger action on file open",
    rb"/AA\b": "Additional actions (can trigger on close/print/etc.)",
    rb"/Launch": "Launch action (can run external programs/files)",
    rb"/EmbeddedFile": "Embedded file hidden inside the PDF",
}


class PDFSecurityError(Exception):
    """Raised when a PDF contains suspicious/malicious content indicators."""
    pass


def scan_pdf_for_malicious_content(file_bytes: bytes) -> list:
    """
    Scans raw PDF bytes for known malicious-content indicators.
    Returns a list of (pattern_description) strings for anything found.
    An empty list means nothing suspicious was detected.
    """
    findings = []
    for pattern, description in SUSPICIOUS_PATTERNS.items():
        if re.search(pattern, file_bytes):
            findings.append(description)
    return findings


def secure_validate_pdf(file_bytes: bytes) -> None:
    """
    Full security check: raises PDFSecurityError if anything suspicious
    is found. Call this IN ADDITION TO validate_pdf() from
    pdf_extraction_pipeline.py - this checks content safety, not
    type/size/readability (which the other function already handles).
    """
    findings = scan_pdf_for_malicious_content(file_bytes)
    if findings:
        # Log the specific findings server-side for debugging/audit purposes
        print(f"[SECURITY] PDF rejected - findings: {findings}")
        # But raise a generic, safe message - never expose the specific
        # attack indicators to the end user (that would help an attacker
        # learn what our scanner checks for)
        raise PDFSecurityError(
            "This PDF could not be accepted for security reasons. "
            "Please upload a standard, unmodified court document."
        )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pdf_security_scan.py <pdf_path>")
        sys.exit(1)

    path = sys.argv[1]
    with open(path, "rb") as f:
        data = f.read()

    findings = scan_pdf_for_malicious_content(data)

    if findings:
        print(f"SUSPICIOUS: '{path}' contains {len(findings)} red flag(s):")
        for f_desc in findings:
            print(f"  - {f_desc}")
    else:
        print(f"CLEAN: '{path}' shows no known malicious-content indicators.")
