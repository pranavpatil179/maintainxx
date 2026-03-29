"""
Maintenance Cost Optimizer Router
Calculates optimal maintenance timing based on cost trade-offs between
planned maintenance (Cp) vs. unplanned failure cost (Cf) and current RUL.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import math

from ..database import get_db
from ..models import Prediction, Machine

router = APIRouter(prefix="/cost-optimizer", tags=["cost-optimizer"])


class CostOptimizerInput(BaseModel):
    machine_id: str
    cp: float  # Cost of planned maintenance
    cf: float  # Cost of failure / unplanned downtime
    rul_override: Optional[float] = None  # Optional manual RUL override


class CostOptimizerResult(BaseModel):
    machine_id: str
    rul: float
    health_score: float
    risk_level: str
    cp: float
    cf: float
    failure_probability: float
    expected_failure_cost: float
    cost_of_delay: float
    savings_if_repair_now: float
    recommendation: str          # "Repair Now" / "Monitor Closely" / "Delay Maintenance"
    recommendation_color: str    # hex color for UI
    recommendation_icon: str     # emoji
    reason: str
    break_even_rul: float        # RUL at which costs break even


@router.post("/calculate", response_model=CostOptimizerResult)
async def calculate_optimal_maintenance(
    data: CostOptimizerInput,
    db: AsyncSession = Depends(get_db)
):
    """Calculate the optimal maintenance decision based on cost trade-offs."""
    # Fetch latest prediction and machine info
    sub_q = (
        select(Prediction, Machine)
        .where(Prediction.machine_id == data.machine_id)
        .join(Machine, Prediction.machine_id == Machine.id)
        .order_by(Prediction.predicted_at.desc())
        .limit(1)
    )
    result = await db.execute(sub_q)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"No data found for machine {data.machine_id}")

    pred, machine = row
    
    # Use machine-specific costs if provided
    final_cp = data.cp if data.cp > 0 else (machine.preventive_cost or 5000.0)
    final_cf = data.cf if data.cf > 0 else (machine.failure_cost or 50000.0)

    # Hybrid Logic: Blend AI RUL with Manual observations if they exist
    manual_score = machine.manual_health_score
    if manual_score is not None:
        hybrid_rul = (pred.rul * 0.6) + (pred.rul * (manual_score / 100.0) * 0.4)
        health = (pred.health_score * 0.6) + (manual_score * 0.4)
        rul_to_use = data.rul_override if data.rul_override is not None else hybrid_rul
    else:
        rul_to_use = data.rul_override if data.rul_override is not None else pred.rul
        health = pred.health_score

    # Simple Exponential Probability Model (Previous Version)
    # Failure probability grows as RUL decreases
    # Lambda = 45 is a common calibration for CMAPSS FD001 scale
    p_fail = math.exp(-rul_to_use / 45.0)
    
    expected_failure_cost = p_fail * final_cf
    savings = expected_failure_cost - final_cp
    
    # Cost of delay is simply the potential loss if we wait
    # If savings are positive, meaning expected failure cost > planned cost
    if savings > 0:
        rec = "Repair Now"
        color = "#ef4444"
        icon = "🔧"
        reason = f"Failure risk cost ({expected_failure_cost:,.0f}₹) exceeds planned repair cost ({final_cp:,.0f}₹). Immediate action saves money."
    elif rul_to_use < 50:
        rec = "Monitor Closely"
        color = "#f59e0b"
        icon = "👁️"
        reason = "RUL is low. Failure risk is increasing rapidly. Prepare for maintenance window soon."
    else:
        rec = "Delay Maintenance"
        color = "#10b981"
        icon = "⏳"
        reason = f"Current failure risk ({p_fail*100:.1f}%) is low. Premature repair would waste {abs(savings):,.0f}₹ of asset life."

    # Break-even RUL: RUL where P_fail * Cf = Cp
    # math.exp(-rul / 45) = Cp / Cf
    # -rul / 45 = ln(Cp / Cf)
    # rul = -45 * ln(Cp / Cf)
    try:
        break_even = -45.0 * math.log(final_cp / final_cf)
    except:
        break_even = 10.0

    return CostOptimizerResult(
        machine_id=data.machine_id,
        rul=round(rul_to_use, 1),
        health_score=round(health, 1),
        risk_level=pred.risk_level,
        cp=final_cp,
        cf=final_cf,
        failure_probability=round(p_fail, 4),
        expected_failure_cost=round(expected_failure_cost, 2),
        cost_of_delay=round(max(0.0, savings), 2),
        savings_if_repair_now=round(savings, 2),
        recommendation=rec,
        recommendation_color=color,
        recommendation_icon=icon,
        reason=reason,
        break_even_rul=round(max(0.0, break_even), 1),
    )


@router.get("/fleet-summary")
async def fleet_cost_summary(
    cp: float = 5000.0,
    cf: float = 50000.0,
    db: AsyncSession = Depends(get_db)
):
    """Get cost optimization summary across entire fleet using the simplified model."""
    from sqlalchemy import func
    sub = (
        select(Prediction.machine_id, func.max(Prediction.predicted_at).label("max_at"))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    result = await db.execute(
        select(Prediction, Machine).join(
            sub,
            (Prediction.machine_id == sub.c.machine_id)
            & (Prediction.predicted_at == sub.c.max_at),
        ).join(Machine, Prediction.machine_id == Machine.id)
    )
    rows = result.all()

    fleet = []
    total_savings = 0.0
    for p, m in rows:
        m_cp = m.preventive_cost if m.preventive_cost else cp
        m_cf = m.failure_cost if m.failure_cost else cf
        
        p_fail = math.exp(-p.rul / 45.0)
        savings = (p_fail * m_cf) - m_cp
        
        if savings > 0:
            total_savings += savings
            rec = "Repair Now"
        elif p.rul < 50:
            rec = "Monitor Closely"
        else:
            rec = "Delay Maintenance"
            
        fleet.append({
            "machine_id": p.machine_id,
            "rul": round(p.rul, 1),
            "health_score": round(p.health_score, 1),
            "risk_level": p.risk_level,
            "failure_probability": round(p_fail, 4),
            "expected_failure_cost": round(p_fail * m_cf, 2),
            "savings": round(savings, 2),
            "recommendation": rec,
        })

    fleet.sort(key=lambda x: x["savings"], reverse=True)

    return {
        "fleet": fleet,
        "total_potential_savings": round(total_savings, 2),
        "repair_now_count": sum(1 for f in fleet if f["recommendation"] == "Repair Now"),
        "monitor_count": sum(1 for f in fleet if f["recommendation"] == "Monitor Closely"),
        "delay_count": sum(1 for f in fleet if f["recommendation"] == "Delay Maintenance"),
        "cp": cp,
        "cf": cf,
    }
