from app.services.candidate_import_service import clean_multiline, clean_text


def test_collapses_whitespace_and_trims():
    assert clean_text("  John   Doe \n") == "John Doe"


def test_removes_zero_width_characters():
    assert clean_text("Jo\u200bhn") == "John"


def test_preserves_arabic_letters():
    assert clean_text("  محمد   خان ") == "محمد خان"


def test_returns_none_for_empty():
    assert clean_text(None) is None
    assert clean_text("   ") is None


def test_respects_max_length():
    assert clean_text("abcdef", max_length=3) == "abc"


def test_multiline_preserves_paragraphs_and_collapses_blank_lines():
    assert clean_multiline("Line 1\n\n\n\nLine 2   \n  Line 3") == "Line 1\n\nLine 2\nLine 3"
