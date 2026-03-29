import csv
import io
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models import Prediction, Machine

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
async def export_predictions_csv(db: AsyncSession = Depends(get_db)):
    """Download latest predictions as CSV."""
    sub = (
        select(Prediction.machine_id, func.max(Prediction.predicted_at).label("max_at"))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    result = await db.execute(
        select(Prediction, Machine)
        .join(Machine, Machine.id == Prediction.machine_id)
        .join(
            sub,
            (Prediction.machine_id == sub.c.machine_id)
            & (Prediction.predicted_at == sub.c.max_at),
        )
    )
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["machine_id", "dataset", "unit", "rul", "health_score",
                     "risk_level", "confidence", "predicted_failure_date",
                     "machine_status", "max_cycles"])
    for pred, machine in rows:
        writer.writerow([
            pred.machine_id, machine.dataset, machine.unit_number,
            round(pred.rul, 1), round(pred.health_score, 1),
            pred.risk_level, pred.confidence,
            pred.predicted_failure_date, machine.status, machine.max_cycles,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=maintainxx_predictions.csv"},
    )
