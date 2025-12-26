import logging
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from docx import Document
import fitz

from .diff import compute_diff

logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {'.pdf', '.docx'}


@ensure_csrf_cookie
def index(request):
    return render(request, "index.html")


def compare_documents(request):
    if request.method != "POST":
        return JsonResponse({"error": "Only POST method allowed"}, status=405)

    file_a = request.FILES.get("file_a")
    file_b = request.FILES.get("file_b")

    if not file_a or not file_b:
        return JsonResponse({"error": "Please upload both files"}, status=400)

    if file_a.size > MAX_FILE_SIZE or file_b.size > MAX_FILE_SIZE:
        return JsonResponse({"error": f"Files must be under {MAX_FILE_SIZE // (1024*1024)}MB"}, status=400)

    if not _valid_file(file_a) or not _valid_file(file_b):
        return JsonResponse({"error": "Only PDF and DOCX files are allowed"}, status=400)

    try:
        paras_a = _extract_text(file_a)
        paras_b = _extract_text(file_b)
        diff = compute_diff(paras_a, paras_b)

        return JsonResponse({
            "document_a": {"name": file_a.name},
            "document_b": {"name": file_b.name},
            "diff": diff,
        })
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        logger.exception("Failed to process documents: %s", e)
        return JsonResponse({"error": "Failed to process documents. Please try again."}, status=500)


def _valid_file(file):
    return any(file.name.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)


def _extract_text(file):
    name = file.name.lower()
    if name.endswith(".pdf"):
        return _extract_pdf(file)
    elif name.endswith(".docx"):
        return _extract_docx(file)
    raise ValueError(f"Unsupported format: {name}")


def _extract_pdf(file):
    paragraphs = []
    try:
        doc = fitz.open(stream=file.read(), filetype="pdf")
        try:
            if doc.is_encrypted:
                raise ValueError("PDF is password-protected. Please provide an unprotected file.")

            for page_num, page in enumerate(doc, 1):
                for para in page.get_text().split("\n\n"):
                    text = para.strip()
                    if text:
                        paragraphs.append({"page": page_num, "text": text})
        finally:
            doc.close()
        return paragraphs
    except ValueError:
        raise
    except Exception as e:
        logger.error("PDF extraction failed: %s", e)
        raise ValueError("Could not read PDF. The file may be corrupted.")


def _extract_docx(file):
    paragraphs = []
    try:
        doc = Document(file)
        para_num = 0
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                para_num += 1
                paragraphs.append({"page": para_num, "text": text})
        return paragraphs
    except Exception as e:
        logger.error("DOCX extraction failed: %s", e)
        raise ValueError("Could not read DOCX. The file may be corrupted.")
