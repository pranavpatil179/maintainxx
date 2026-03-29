from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import datetime
import random

from ..database import get_db
from ..models import Prediction, Machine
from ..schemas import PredictionOut

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.get("/", response_model=List[PredictionOut])
async def list_predictions(db: AsyncSession = Depends(get_db)):
    """Return the latest prediction for every machine."""
    # Subquery: max predicted_at per machine
    sub = (
        select(Prediction.machine_id, func.max(Prediction.predicted_at).label("max_at"))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    result = await db.execute(
        select(
            Prediction.id,
            Prediction.machine_id,
            Prediction.rul,
            Prediction.health_score,
            Prediction.risk_level,
            Prediction.confidence,
            Prediction.predicted_failure_date,
            Prediction.model_version,
            Prediction.predicted_at,
            Machine.category_id
        ).join(
            sub,
            (Prediction.machine_id == sub.c.machine_id)
            & (Prediction.predicted_at == sub.c.max_at),
        ).join(Machine, Prediction.machine_id == Machine.id)
    )
    # Convert to objects manually since we're selecting individual columns
    # Actually, SQLAlchemy 2.0 returns Row objects which Pydantic can handle if configured
    return result.all()


@router.get("/summary")
async def predictions_summary(db: AsyncSession = Depends(get_db)):
    """Return aggregate KPIs for dashboard."""
    machines_result = await db.execute(select(Machine))
    machines = machines_result.scalars().all()

    sub = (
        select(Prediction.machine_id, func.max(Prediction.predicted_at).label("max_at"))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    preds_result = await db.execute(
        select(Prediction).join(
            sub,
            (Prediction.machine_id == sub.c.machine_id)
            & (Prediction.predicted_at == sub.c.max_at),
        )
    )
    preds = preds_result.scalars().all()

    total = len(machines)
    at_risk = sum(1 for p in preds if p.risk_level in ("High", "Medium"))
    high_risk = sum(1 for p in preds if p.risk_level == "High")
    avg_health = round(sum(p.health_score for p in preds) / len(preds), 1) if preds else 0.0
    avg_rul = round(sum(p.rul for p in preds) / len(preds), 1) if preds else 0.0

    # Calculate Fleet OEE (Simulated based on health and availability)
    # Average Health is a good proxy for OEE in this context
    oee = min(100.0, max(0.0, avg_health * 1.05)) # slightly higher than health 
    
    return {
        "total_machines": total,
        "at_risk_machines": at_risk,
        "high_risk_machines": high_risk,
        "avg_health_score": avg_health,
        "avg_rul": avg_rul,
        "fleet_oee": f"{oee:.1f}%",
        "risk_breakdown": {
            "High": sum(1 for p in preds if p.risk_level == "High"),
            "Medium": sum(1 for p in preds if p.risk_level == "Medium"),
            "Low": sum(1 for p in preds if p.risk_level == "Low"),
        },
    }

@router.get("/health-trend")
async def health_trend(db: AsyncSession = Depends(get_db)):
    """Returns the fleet average health trend from the database, grouped by second."""
    # We truncate the timestamp to seconds to group all machines from one 'tick' together
    # This prevents the 'sawtooth' jitter in the charts.
    from sqlalchemy import text
    
    # SQLite/Postgres/MySQL specific truncate. Assuming SQLite for now based on previous logs.
    # strftime for SQLite 
    result = await db.execute(
        select(
            func.avg(Prediction.health_score).label("avg_health"),
            func.strftime('%Y-%m-%dT%H:%M:%S', Prediction.predicted_at).label("tick")
        )
        .group_by("tick")
        .order_by(text("tick desc"))
        .limit(40)
    )
    rows = result.all()
    
    if not rows:
        now = datetime.datetime.utcnow()
        return [{"date": (now - datetime.timedelta(seconds=5*i)).isoformat() + "Z", "health_score": 85.0} for i in range(20)]

    data = []
    for avg_health, tick in reversed(rows):
        data.append({
            "date": tick + "Z",
            "health_score": round(avg_health, 1) if avg_health else 0.0
        })
    return data
