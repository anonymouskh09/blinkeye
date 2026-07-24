from types import SimpleNamespace

from app.services.candidate_import_service import (
    duplicate_info,
    normalize_linkedin_url,
)


def test_strips_query_fragment_and_trailing_slash():
    assert (
        normalize_linkedin_url("https://www.linkedin.com/in/john-doe/?trk=x#exp")
        == "https://www.linkedin.com/in/john-doe"
    )


def test_adds_protocol_and_lowercases_host():
    assert (
        normalize_linkedin_url("LinkedIn.com/in/Jane-Smith")
        == "https://www.linkedin.com/in/jane-smith"
    )


def test_regional_subdomain_canonicalised():
    assert (
        normalize_linkedin_url("https://uk.linkedin.com/in/someone")
        == "https://www.linkedin.com/in/someone"
    )


def test_decodes_percent_encoded_unicode_to_match_extension():
    url = "https://www.linkedin.com/in/%D9%85%D8%AD%D9%85%D8%AF"
    assert normalize_linkedin_url(url) == "https://www.linkedin.com/in/محمد"


def test_rejects_non_profile_and_non_linkedin():
    assert normalize_linkedin_url("https://www.linkedin.com/feed/") is None
    assert normalize_linkedin_url("https://example.com/in/john") is None
    assert normalize_linkedin_url("") is None
    assert normalize_linkedin_url(None) is None


def test_duplicate_info_shape_is_safe():
    candidate = SimpleNamespace(
        id=7,
        name="Jane Doe",
        email="jane@example.com",
        linkedin_url="https://www.linkedin.com/in/jane-doe",
        created_at=None,
    )
    info = duplicate_info(candidate)
    assert info == {
        "id": 7,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "linkedinUrl": "https://www.linkedin.com/in/jane-doe",
        "createdAt": None,
    }
