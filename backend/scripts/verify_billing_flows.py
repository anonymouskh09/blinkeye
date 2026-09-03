"""E2E billing verification against local API (cookie auth).

Run: py -3.10 scripts/verify_billing_flows.py
Requires backend on http://127.0.0.1:8000
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from decimal import Decimal

import httpx

BASE = "http://127.0.0.1:8000"
EMAIL = "admin@agency.com"
PASSWORD = "Admin123!"


class Fail(Exception):
    pass


def assert_eq(actual, expected, label: str):
    # Numeric compare when both look numeric; otherwise string compare
    try:
        a = Decimal(str(actual))
        e = Decimal(str(expected))
        if a != e:
            raise Fail(f"{label}: expected {e}, got {a}")
        return
    except Exception:
        pass
    if str(actual) != str(expected):
        raise Fail(f"{label}: expected {expected!r}, got {actual!r}")


def assert_true(cond, label: str):
    if not cond:
        raise Fail(label)


def unwrap(resp: httpx.Response):
    if resp.status_code >= 400:
        raise Fail(f"{resp.request.method} {resp.request.url} -> {resp.status_code}: {resp.text}")
    body = resp.json()
    if not body.get("success", True):
        raise Fail(f"API success=false: {body}")
    return body.get("data")


def main() -> int:
    results = {}
    client = httpx.Client(base_url=BASE, timeout=30.0)
    try:
        # Health
        h = client.get("/health")
        assert_true(h.status_code == 200, "health check failed")

        # Login
        login = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        unwrap(login)
        assert_true("access_token" in client.cookies, "login cookie missing")

        stamp = date.today().isoformat().replace("-", "")

        # ------------------------------------------------------------------
        # 1) Success-based: Offer → Accept → Placement → Invoice → Payment
        # ------------------------------------------------------------------
        abc = unwrap(
            client.post(
                "/clients",
                json={
                    "company_name": f"ABC Company {stamp}",
                    "contact_person": "Finance Lead",
                    "email": f"billing-abc-{stamp}@example.com",
                    "stage": "active",
                    "status": "active",
                },
            )
        )
        eng = unwrap(
            client.post(
                "/engagements",
                json={
                    "client_id": abc["id"],
                    "engagement_name": "Full Cycle Recruiting",
                    "billing_model": "success_based",
                    "service_model": "full_cycle",
                    "placement_fee_percent": "20",
                    "currency": "USD",
                    "status": "active",
                },
            )
        )
        job = unwrap(
            client.post(
                "/jobs",
                json={
                    "title": f"Senior Engineer ABC {stamp}",
                    "engagement_id": eng["id"],
                    "job_type": "full-time",
                    "status": "active",
                    "number_of_positions": 1,
                },
            )
        )
        cand = unwrap(
            client.post(
                "/candidates",
                data={"name": "Ali", "email": f"ali-{stamp}@example.com"},
            )
        )
        assignment = unwrap(client.post(f"/candidates/{cand['id']}/assign-job", json={"job_id": job["id"]}))
        offer = unwrap(
            client.post(
                "/offers",
                json={
                    "candidate_id": cand["id"],
                    "job_id": job["id"],
                    "candidate_job_assignment_id": assignment["id"],
                    "salary": "120000",
                    "currency": "USD",
                    "status": "sent",
                },
            )
        )
        assert_true(offer["id"] and offer["status"] == "sent", "offer not created as DB record")

        accepted = unwrap(
            client.post(
                f"/offers/{offer['id']}/accept",
                json={"create_placement": True, "auto_invoice": True},
            )
        )
        assert_true(accepted.get("placement_id"), "accept did not create placement")
        assert_true(accepted.get("billable_item_id"), "accept did not create success-fee billable")
        assert_true(accepted.get("invoice_id"), "accept did not create invoice")

        placements = unwrap(client.get("/placements", params={"client_id": abc["id"]}))
        assert_eq(len(placements["items"]), 1, "exactly one placement")
        placement = placements["items"][0]
        assert_eq(placement["placement_fee"], "24000.00", "success fee 120k * 20%")
        assert_eq(placement["fee_percentage"], "20", "fee percentage from engagement")
        assert_eq(placement["engagement_id"], eng["id"], "placement engagement")

        invoice = unwrap(client.get(f"/invoices/{accepted['invoice_id']}"))
        assert_eq(invoice["total"], "24000.00", "invoice total")
        assert_eq(len(invoice["line_items"]), 1, "invoice line count")
        assert_eq(invoice["line_items"][0]["amount"], "24000.00", "invoice line amount")
        assert_eq(invoice["client_id"], abc["id"], "invoice client")
        assert_eq(invoice["engagement_id"], eng["id"], "invoice engagement")
        assert_eq(invoice["line_items"][0]["placement_id"], placement["id"], "invoice linked to placement")

        rev1 = unwrap(client.get("/revenue", params={"client_id": abc["id"]}))
        assert_eq(rev1["summary"]["expected"], "24000.00", "revenue expected after invoice")
        assert_eq(rev1["summary"]["invoiced"], "24000.00", "revenue invoiced")
        assert_eq(rev1["summary"]["paid"], "0.00", "revenue paid before payment")

        pay = unwrap(
            client.post(
                f"/invoices/{invoice['id']}/payments",
                json={"amount": "24000.00", "payment_method": "bank_transfer", "reference": "WIRE-ABC-1"},
            )
        )
        assert_eq(pay["invoice"]["payment_status"], "paid", "invoice paid")
        assert_eq(pay["invoice"]["amount_outstanding"], "0.00", "outstanding zero")

        rev2 = unwrap(client.get("/revenue", params={"client_id": abc["id"]}))
        assert_eq(rev2["summary"]["paid"], "24000.00", "revenue paid after payment")
        assert_eq(rev2["summary"]["outstanding"], "0.00", "revenue outstanding")

        # Accept again must fail / no double placement
        again = client.post(
            f"/offers/{offer['id']}/accept",
            json={"create_placement": True, "auto_invoice": True},
        )
        assert_true(again.status_code >= 400, "double-accept should fail")
        placements2 = unwrap(client.get("/placements", params={"client_id": abc["id"]}))
        assert_eq(len(placements2["items"]), 1, "no duplicate placement")

        results["success_based"] = "PASS ($24,000)"

        # ------------------------------------------------------------------
        # 2) Hourly via Timesheet → Approve → Billable → Invoice → Payment
        # ------------------------------------------------------------------
        hourly_client = unwrap(
            client.post(
                "/clients",
                json={
                    "company_name": f"Hourly Co {stamp}",
                    "contact_person": "Ops",
                    "email": f"hourly-{stamp}@example.com",
                    "stage": "active",
                    "status": "active",
                },
            )
        )
        hourly_eng = unwrap(
            client.post(
                "/engagements",
                json={
                    "client_id": hourly_client["id"],
                    "engagement_name": "Hourly Recruiting",
                    "billing_model": "hourly",
                    "service_model": "sourcing_outreach",
                    "hourly_rate": "25",
                    "currency": "USD",
                    "status": "active",
                },
            )
        )
        hourly_job = unwrap(
            client.post(
                "/jobs",
                json={
                    "title": f"Hourly Role {stamp}",
                    "engagement_id": hourly_eng["id"],
                    "job_type": "contract",
                    "status": "active",
                    "number_of_positions": 1,
                },
            )
        )
        # Also verify direct 40h billable = $1000
        direct = unwrap(
            client.post(
                "/billable-items",
                json={
                    "engagement_id": hourly_eng["id"],
                    "billable_type": "hourly",
                    "description": "Direct hourly smoke 40h",
                    "quantity": "40",
                    "job_id": hourly_job["id"],
                },
            )
        )
        assert_eq(direct["amount"], "1000.00", "40h * $25 direct billable")

        monday = date.today() - timedelta(days=date.today().weekday())
        days = [
            (monday, "8"),
            (monday + timedelta(days=1), "7"),
            (monday + timedelta(days=2), "8"),
            (monday + timedelta(days=3), "8"),
            (monday + timedelta(days=4), "7"),
        ]
        entry_ids = []
        for work_date, hours in days:
            e = unwrap(
                client.post(
                    "/timesheets",
                    json={
                        "engagement_id": hourly_eng["id"],
                        "job_id": hourly_job["id"],
                        "work_date": work_date.isoformat(),
                        "hours": hours,
                        "description": f"Recruiting {work_date.strftime('%A')}",
                        "submit": False,
                    },
                )
            )
            entry_ids.append(e["id"])
        submitted = unwrap(client.post("/timesheets/submit", json={"entry_ids": entry_ids}))
        assert_true(all(x["status"] == "submitted" for x in submitted), "timesheets submitted")

        approved = unwrap(
            client.post(
                "/timesheets/approve",
                json={"entry_ids": entry_ids, "description": "Week approved"},
            )
        )
        billable = approved["billable_item"]
        assert_eq(billable["quantity"], "38.00", "approved hours total 38")
        assert_eq(billable["unit_rate"], "25.00", "hourly rate from engagement")
        assert_eq(billable["amount"], "950.00", "38 * 25 = 950")
        assert_true(all(e["billable_item_id"] == billable["id"] for e in approved["entries"]), "entries linked")

        # Duplicate approve should be idempotent (same billable)
        approved2 = unwrap(client.post("/timesheets/approve", json={"entry_ids": entry_ids}))
        assert_eq(approved2["billable_item"]["id"], billable["id"], "duplicate approve idempotent")

        inv_h = unwrap(
            client.post(
                "/invoices",
                json={
                    "client_id": hourly_client["id"],
                    "engagement_id": hourly_eng["id"],
                    "billable_item_ids": [billable["id"]],
                },
            )
        )
        assert_eq(inv_h["total"], "950.00", "hourly invoice total")
        unwrap(
            client.post(
                f"/invoices/{inv_h['id']}/payments",
                json={"amount": "950.00", "payment_method": "bank_transfer"},
            )
        )
        rev_h = unwrap(client.get("/revenue", params={"engagement_id": hourly_eng["id"]}))
        # expected includes direct 1000 + timesheet 950 = 1950; paid only the invoiced 950
        assert_eq(rev_h["summary"]["invoiced"], "950.00", "hourly invoiced")
        assert_eq(rev_h["summary"]["paid"], "950.00", "hourly paid")
        results["hourly"] = "PASS (40×25=$1000 direct; 38×25=$950 timesheet)"

        # ------------------------------------------------------------------
        # 3) Monthly retainer $5000
        # ------------------------------------------------------------------
        ret_client = unwrap(
            client.post(
                "/clients",
                json={
                    "company_name": f"Retainer Co {stamp}",
                    "contact_person": "AP",
                    "email": f"retainer-{stamp}@example.com",
                    "stage": "active",
                    "status": "active",
                },
            )
        )
        ret_eng = unwrap(
            client.post(
                "/engagements",
                json={
                    "client_id": ret_client["id"],
                    "engagement_name": "Monthly Retainer",
                    "billing_model": "monthly_retainer",
                    "monthly_fee": "5000",
                    "currency": "USD",
                    "status": "active",
                },
            )
        )
        period_start = date.today().replace(day=1)
        period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        ret_item = unwrap(
            client.post(
                "/billable-items",
                json={
                    "engagement_id": ret_eng["id"],
                    "billable_type": "retainer",
                    "description": "September retainer",
                    "billing_period_start": period_start.isoformat(),
                    "billing_period_end": period_end.isoformat(),
                },
            )
        )
        assert_eq(ret_item["amount"], "5000.00", "retainer amount")
        ret_inv = unwrap(
            client.post(
                "/invoices",
                json={"client_id": ret_client["id"], "billable_item_ids": [ret_item["id"]]},
            )
        )
        assert_eq(ret_inv["total"], "5000.00", "retainer invoice")
        results["retainer"] = "PASS ($5,000)"

        # ------------------------------------------------------------------
        # 4) Fixed $10,000
        # ------------------------------------------------------------------
        fix_client = unwrap(
            client.post(
                "/clients",
                json={
                    "company_name": f"Fixed Co {stamp}",
                    "contact_person": "AP",
                    "email": f"fixed-{stamp}@example.com",
                    "stage": "active",
                    "status": "active",
                },
            )
        )
        fix_eng = unwrap(
            client.post(
                "/engagements",
                json={
                    "client_id": fix_client["id"],
                    "engagement_name": "Fixed Project",
                    "billing_model": "fixed",
                    "rate": "10000",
                    "currency": "USD",
                    "status": "active",
                },
            )
        )
        fix_item = unwrap(
            client.post(
                "/billable-items",
                json={
                    "engagement_id": fix_eng["id"],
                    "billable_type": "fixed",
                    "description": "Fixed engagement fee",
                    "amount": "10000",
                },
            )
        )
        assert_eq(fix_item["amount"], "10000.00", "fixed amount")
        fix_inv = unwrap(
            client.post(
                "/invoices",
                json={"client_id": fix_client["id"], "billable_item_ids": [fix_item["id"]]},
            )
        )
        assert_eq(fix_inv["total"], "10000.00", "fixed invoice")
        results["fixed"] = "PASS ($10,000)"

        # ------------------------------------------------------------------
        # 5) Hybrid: hourly $1000 + success $24000 = $25000
        # ------------------------------------------------------------------
        hy_client = unwrap(
            client.post(
                "/clients",
                json={
                    "company_name": f"Hybrid Co {stamp}",
                    "contact_person": "AP",
                    "email": f"hybrid-{stamp}@example.com",
                    "stage": "active",
                    "status": "active",
                },
            )
        )
        hy_eng = unwrap(
            client.post(
                "/engagements",
                json={
                    "client_id": hy_client["id"],
                    "engagement_name": "Hybrid Recruiting",
                    "billing_model": "hybrid",
                    "hourly_rate": "25",
                    "placement_fee_percent": "20",
                    "currency": "USD",
                    "status": "active",
                },
            )
        )
        hy_job = unwrap(
            client.post(
                "/jobs",
                json={
                    "title": f"Hybrid Role {stamp}",
                    "engagement_id": hy_eng["id"],
                    "job_type": "full-time",
                    "status": "active",
                    "number_of_positions": 1,
                },
            )
        )
        hy_hours = unwrap(
            client.post(
                "/billable-items",
                json={
                    "engagement_id": hy_eng["id"],
                    "billable_type": "hourly",
                    "description": "Hybrid hourly 40h",
                    "quantity": "40",
                    "job_id": hy_job["id"],
                },
            )
        )
        assert_eq(hy_hours["amount"], "1000.00", "hybrid hourly component")

        hy_cand = unwrap(
            client.post(
                "/candidates",
                data={"name": "Hybrid Ali", "email": f"hybrid-ali-{stamp}@example.com"},
            )
        )
        hy_asg = unwrap(client.post(f"/candidates/{hy_cand['id']}/assign-job", json={"job_id": hy_job["id"]}))
        hy_offer = unwrap(
            client.post(
                "/offers",
                json={
                    "candidate_id": hy_cand["id"],
                    "job_id": hy_job["id"],
                    "candidate_job_assignment_id": hy_asg["id"],
                    "salary": "120000",
                    "currency": "USD",
                },
            )
        )
        hy_acc = unwrap(
            client.post(
                f"/offers/{hy_offer['id']}/accept",
                json={"create_placement": True, "auto_invoice": False},
            )
        )
        assert_true(hy_acc.get("billable_item_id"), "hybrid success fee billable")
        hy_sf = unwrap(client.get("/billable-items", params={"engagement_id": hy_eng["id"], "billable_type": "success_fee"}))
        assert_eq(hy_sf["items"][0]["amount"], "24000.00", "hybrid success fee")

        hy_inv = unwrap(
            client.post(
                "/invoices",
                json={
                    "client_id": hy_client["id"],
                    "engagement_id": hy_eng["id"],
                    "billable_item_ids": [hy_hours["id"], hy_acc["billable_item_id"]],
                },
            )
        )
        assert_eq(hy_inv["total"], "25000.00", "hybrid total invoice 1000+24000")
        assert_eq(len(hy_inv["line_items"]), 2, "hybrid two line items")

        rev_hy = unwrap(client.get("/revenue", params={"engagement_id": hy_eng["id"]}))
        assert_eq(rev_hy["summary"]["invoiced"], "25000.00", "hybrid invoiced once")
        # Double invoice same billables must fail
        dup = client.post(
            "/invoices",
            json={
                "client_id": hy_client["id"],
                "billable_item_ids": [hy_hours["id"], hy_acc["billable_item_id"]],
            },
        )
        assert_true(dup.status_code >= 400, "duplicate invoice of same billables blocked")
        results["hybrid"] = "PASS ($25,000 = $1,000 + $24,000)"

        print("=== BILLING VERIFICATION RESULTS ===")
        for k, v in results.items():
            print(f"  {k}: {v}")
        print("ALL FLOWS PASSED")
        return 0
    except Fail as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        for k, v in results.items():
            print(f"  {k}: {v}")
        return 1
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
