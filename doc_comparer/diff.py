from difflib import SequenceMatcher
from html import escape


def compute_diff(paragraphs_a, paragraphs_b):
    """Compare two paragraph lists and return diff results."""
    results = []
    texts_a = [p["text"] for p in paragraphs_a]
    texts_b = [p["text"] for p in paragraphs_b]
    matcher = SequenceMatcher(None, texts_a, texts_b)

    for op, a1, a2, b1, b2 in matcher.get_opcodes():
        if op == "equal":
            for i in range(a2 - a1):
                pa, pb = paragraphs_a[a1 + i], paragraphs_b[b1 + i]
                results.append({
                    "status": "unchanged",
                    "text_a": escape(pa["text"]),
                    "text_b": escape(pb["text"]),
                    "page_a": pa["page"],
                    "page_b": pb["page"],
                })

        elif op == "replace":
            count_a, count_b = a2 - a1, b2 - b1
            paired = min(count_a, count_b)

            for i in range(paired):
                pa, pb = paragraphs_a[a1 + i], paragraphs_b[b1 + i]
                hl_a, hl_b = _word_diff(pa["text"], pb["text"])
                results.append({
                    "status": "modified",
                    "text_a": hl_a,
                    "text_b": hl_b,
                    "page_a": pa["page"],
                    "page_b": pb["page"],
                })

            for i in range(paired, count_a):
                pa = paragraphs_a[a1 + i]
                results.append({
                    "status": "removed",
                    "text_a": escape(pa["text"]),
                    "text_b": None,
                    "page_a": pa["page"],
                    "page_b": None,
                })

            for i in range(paired, count_b):
                pb = paragraphs_b[b1 + i]
                results.append({
                    "status": "added",
                    "text_a": None,
                    "text_b": escape(pb["text"]),
                    "page_a": None,
                    "page_b": pb["page"],
                })

        elif op == "delete":
            for i in range(a2 - a1):
                pa = paragraphs_a[a1 + i]
                results.append({
                    "status": "removed",
                    "text_a": escape(pa["text"]),
                    "text_b": None,
                    "page_a": pa["page"],
                    "page_b": None,
                })

        elif op == "insert":
            for i in range(b2 - b1):
                pb = paragraphs_b[b1 + i]
                results.append({
                    "status": "added",
                    "text_a": None,
                    "text_b": escape(pb["text"]),
                    "page_a": None,
                    "page_b": pb["page"],
                })

    return results


def _word_diff(text_a, text_b):
    """Return word-level diff with <mark> highlights."""
    words_a, words_b = text_a.split(), text_b.split()
    matcher = SequenceMatcher(None, words_a, words_b)
    result_a, result_b = [], []

    for op, a1, a2, b1, b2 in matcher.get_opcodes():
        if op == "equal":
            result_a.extend(escape(w) for w in words_a[a1:a2])
            result_b.extend(escape(w) for w in words_b[b1:b2])
        elif op == "replace":
            result_a.append("<mark>" + " ".join(escape(w) for w in words_a[a1:a2]) + "</mark>")
            result_b.append("<mark>" + " ".join(escape(w) for w in words_b[b1:b2]) + "</mark>")
        elif op == "delete":
            result_a.append("<mark>" + " ".join(escape(w) for w in words_a[a1:a2]) + "</mark>")
        elif op == "insert":
            result_b.append("<mark>" + " ".join(escape(w) for w in words_b[b1:b2]) + "</mark>")

    return " ".join(result_a), " ".join(result_b)
