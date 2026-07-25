"""Health-insurance cost analysis.

Given a person's expected annual out-of-pocket health spending, estimate the
total yearly cost (premiums + what they'd still pay) under several sample
extended-health plans, and rank them. Numbers are illustrative sample plans —
not real quotes.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..models import Patient
from ..security import get_current_user

router = APIRouter(prefix="/api/insurance", tags=["insurance"])

CATEGORIES = [
    ("prescriptions", "Prescriptions"),
    ("dental", "Dental"),
    ("vision", "Vision"),
    ("paramedical", "Physio / massage / chiro"),
]

# Sample extended-health plans (illustrative). coverage = {category: [rate, annual_max]}.
PLANS = [
    {
        "id": "none", "name": "No insurance", "monthly_premium": 0, "deductible": 0,
        "coverage": {"prescriptions": [0, 0], "dental": [0, 0], "vision": [0, 0], "paramedical": [0, 0]},
    },
    {
        "id": "basic", "name": "Basic Health", "monthly_premium": 45, "deductible": 100,
        "coverage": {"prescriptions": [0.70, 1000], "dental": [0.60, 750], "vision": [0.50, 150], "paramedical": [0.60, 300]},
    },
    {
        "id": "standard", "name": "Standard Plus", "monthly_premium": 85, "deductible": 50,
        "coverage": {"prescriptions": [0.80, 2000], "dental": [0.80, 1500], "vision": [0.70, 250], "paramedical": [0.80, 500]},
    },
    {
        "id": "premium", "name": "Premium Care", "monthly_premium": 135, "deductible": 0,
        "coverage": {"prescriptions": [0.90, 5000], "dental": [0.90, 3000], "vision": [0.80, 400], "paramedical": [0.90, 1000]},
    },
]


class InsuranceUsage(BaseModel):
    prescriptions: float = Field(default=0, ge=0, le=100000)
    dental: float = Field(default=0, ge=0, le=100000)
    vision: float = Field(default=0, ge=0, le=100000)
    paramedical: float = Field(default=0, ge=0, le=100000)


class PlanEstimate(BaseModel):
    id: str
    name: str
    monthly_premium: float
    annual_premium: float
    reimbursed: float
    out_of_pocket: float
    estimated_annual_cost: float
    savings_vs_none: float


class InsuranceResult(BaseModel):
    total_expected_spend: float
    estimates: list[PlanEstimate]
    best_id: str


def _estimate(plan: dict, usage: dict[str, float]) -> tuple[float, float, float]:
    """Return (annual_premium, reimbursed, out_of_pocket) for a plan."""
    annual_premium = plan["monthly_premium"] * 12
    total = sum(usage.values())
    reimbursed = 0.0
    for cat, expense in usage.items():
        rate, cap = plan["coverage"][cat]
        reimbursed += min(expense, cap) * rate
    # Member pays the deductible before reimbursement kicks in.
    reimbursed = max(0.0, reimbursed - plan["deductible"])
    out_of_pocket = total - reimbursed
    return round(annual_premium, 2), round(reimbursed, 2), round(out_of_pocket, 2)


@router.get("/plans")
def list_plans(_: Patient = Depends(get_current_user)) -> dict:
    return {"categories": [{"key": k, "label": v} for k, v in CATEGORIES], "plans": PLANS}


@router.post("/estimate", response_model=InsuranceResult)
def estimate(usage: InsuranceUsage, _: Patient = Depends(get_current_user)) -> InsuranceResult:
    data = usage.model_dump()
    total = round(sum(data.values()), 2)

    none_out = total  # "No insurance" = pay everything, no premium
    estimates: list[PlanEstimate] = []
    for plan in PLANS:
        annual_premium, reimbursed, out_of_pocket = _estimate(plan, data)
        estimated = round(annual_premium + out_of_pocket, 2)
        estimates.append(PlanEstimate(
            id=plan["id"], name=plan["name"],
            monthly_premium=plan["monthly_premium"], annual_premium=annual_premium,
            reimbursed=reimbursed, out_of_pocket=out_of_pocket,
            estimated_annual_cost=estimated,
            savings_vs_none=round(none_out - estimated, 2),
        ))

    estimates.sort(key=lambda e: e.estimated_annual_cost)
    return InsuranceResult(total_expected_spend=total, estimates=estimates, best_id=estimates[0].id)
