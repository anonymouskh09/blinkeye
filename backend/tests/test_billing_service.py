"""Unit tests for billing fee calculation (no DB required)."""

from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.models.enums import BillingModel
from app.services.billing_service import (
    billable_type_to_revenue_type,
    calculate_success_fee,
    engagement_supports_fixed,
    engagement_supports_hourly,
    engagement_supports_retainer,
    engagement_supports_success_fee,
    money,
)
from app.models.enums import BillableItemType, RevenueType
from app.core.exceptions import BadRequestException


def _eng(**kwargs):
    defaults = dict(
        billing_model=BillingModel.SUCCESS_BASED,
        placement_fee_percent=Decimal("20"),
        flat_placement_fee=None,
        rate=None,
        hourly_rate=None,
        monthly_fee=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_money_rounds():
    assert money("100.456") == Decimal("100.46")
    assert money(None) == Decimal("0.00")


def test_success_fee_percent():
    fee, pct, flat = calculate_success_fee(_eng(), Decimal("120000"))
    assert fee == Decimal("24000.00")
    assert pct == Decimal("20")
    assert flat is None


def test_success_fee_flat():
    fee, pct, flat = calculate_success_fee(
        _eng(placement_fee_percent=None, flat_placement_fee=Decimal("15000")),
        Decimal("100000"),
    )
    assert fee == Decimal("15000.00")
    assert pct is None
    assert flat == Decimal("15000.00")


def test_success_fee_missing_config_raises():
    with pytest.raises(BadRequestException):
        calculate_success_fee(
            _eng(placement_fee_percent=None, flat_placement_fee=None, rate=None),
            Decimal("100000"),
        )


def test_hybrid_supports_multiple_modes():
    eng = _eng(billing_model=BillingModel.HYBRID)
    assert engagement_supports_success_fee(eng)
    assert engagement_supports_hourly(eng)
    assert engagement_supports_retainer(eng)


def test_fixed_support():
    eng = _eng(billing_model=BillingModel.FIXED)
    assert engagement_supports_fixed(eng)
    assert not engagement_supports_success_fee(eng)


def test_revenue_type_hybrid_prefers_hybrid_label():
    assert (
        billable_type_to_revenue_type(BillableItemType.SUCCESS_FEE, BillingModel.HYBRID)
        == RevenueType.HYBRID
    )
    assert (
        billable_type_to_revenue_type(BillableItemType.SUCCESS_FEE, BillingModel.SUCCESS_BASED)
        == RevenueType.SUCCESS_FEE
    )


def test_abc_company_fee_example():
    """PRD example: $120,000 × 20% = $24,000."""
    fee, pct, _ = calculate_success_fee(
        _eng(placement_fee_percent=Decimal("20")),
        Decimal("120000"),
    )
    assert fee == Decimal("24000.00")
    assert pct == Decimal("20")


def test_hourly_and_hybrid_amount_math():
    """40×$25=$1000 and hybrid total $1000+$24000=$25000."""
    hours = Decimal("40")
    rate = Decimal("25")
    assert money(hours * rate) == Decimal("1000.00")
    success = calculate_success_fee(_eng(billing_model=BillingModel.HYBRID), Decimal("120000"))[0]
    assert money(Decimal("1000") + success) == Decimal("25000.00")


def test_timesheet_week_hours_example():
    """Mon–Fri 8+7+8+8+7 = 38 × $25 = $950."""
    total = money(sum(Decimal(h) for h in ("8", "7", "8", "8", "7")))
    assert total == Decimal("38.00")
    assert money(total * Decimal("25")) == Decimal("950.00")
