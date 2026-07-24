from datetime import timedelta

from app.core.security import create_access_token, decode_access_token
from app.services.extension_auth_service import _hash


def test_hash_is_deterministic_and_distinct():
    assert _hash("abc") == _hash("abc")
    assert _hash("abc") != _hash("abd")
    assert len(_hash("abc")) == 64  # sha256 hex


def test_access_token_roundtrip_carries_sub_and_type():
    token = create_access_token({"sub": "42", "typ": "ext"}, expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["typ"] == "ext"


def test_expired_token_is_rejected():
    token = create_access_token({"sub": "1"}, expires_delta=timedelta(minutes=-1))
    assert decode_access_token(token) is None
