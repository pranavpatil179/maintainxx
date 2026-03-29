import json
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..database import get_db
from ..models import DailyLog, Machine, Prediction, MaintenanceTask, SensorLog
from ..schemas import DailyLogIn, DailyLogOut
from ..ml_engine import ml_engine
from ..ingestor import _make_task

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=DailyLogOut, status_code=201)
async def submit_log(payload: DailyLogIn, db: AsyncSession = Depends(get_db)):
    # Verify machine exists
    result = await db.execute(select(Machine).where(Machine.id == payload.machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine '{payload.machine_id}' not found")

    # Save daily log
    log = DailyLog(
        machine_id=payload.machine_id,
        session=payload.session,
        notes=payload.notes or "",
        technician=payload.technician or "Unknown",
        sensor_snapshot=json.dumps(payload.sensor_snapshot or {}),
        timestamp=datetime.now(UTC),
    )
    db.add(log)
    await db.flush()

    # If sensor values submitted, add a SensorLog and re-predict
    sensor_vals = payload.sensor_snapshot or {}
    if sensor_vals:
        new_cycle = (machine.max_cycles or 0) + 1
        machine.max_cycles = new_cycle
        db.add(SensorLog(
            machine_id=payload.machine_id,
            cycle=new_cycle,
            op_setting_1=sensor_vals.get("op_setting_1"),
            op_setting_2=sensor_vals.get("op_setting_2"),
            op_setting_3=sensor_vals.get("op_setting_3"),
            **{f"s{i}": sensor_vals.get(f"s{i}") for i in range(1, 22)},
        ))

        # Re-predict
        pred_result = ml_engine.predict_from_sensor_row(sensor_vals)
        rul = pred_result["rul"]
        health = pred_result["health_score"]
        risk = pred_result["risk_level"]
    else:
        # Predict from last sensor history
        history_result = await db.execute(
            select(SensorLog)
            .where(SensorLog.machine_id == payload.machine_id)
            .order_by(SensorLog.cycle.asc())
        )
        history = history_result.scalars().all()
        if history:
            import pandas as pd
            from ..ml_engine import SENSOR_COLS, OP_COLS
            rows = [
                {
                    "cycle": h.cycle,
                    "op_setting_1": h.op_setting_1, "op_setting_2": h.op_setting_2, "op_setting_3": h.op_setting_3,
                    **{f"s{i}": getattr(h, f"s{i}") for i in range(1, 22)},
                }
                for h in history
            ]
            df = pd.DataFrame(rows)
            pred_result = ml_engine.predict_from_last_cycles(df)
        else:
            pred_result = {"rul": 100.0, "health_score": 75.0, "risk_level": "Medium"}
        rul = pred_result["rul"]
        health = pred_result["health_score"]
        risk = pred_result["risk_level"]

    # Save prediction
    new_pred = Prediction(
        machine_id=payload.machine_id,
        rul=rul,
        health_score=health,
        risk_level=risk,
        confidence=0.87,
        predicted_failure_date=ml_engine.failure_date_estimate(rul, payload.machine_id),
    )
    db.add(new_pred)

    # Update machine health & status
    machine.current_health = health
    machine.status = ml_engine.health_to_status(health)

    # Auto-create task if at risk (no duplicate within 7 days)
    if risk in ("High", "Medium"):
        task = _make_task(payload.machine_id, risk, rul)
        db.add(task)

    await db.commit()
    await db.refresh(log)
    return log


@router.get("/{machine_id}", response_model=List[DailyLogOut])
async def get_logs(machine_id: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DailyLog)
        .where(DailyLog.machine_id == machine_id)
        .order_by(DailyLog.timestamp.desc())
        .limit(limit)
    )
    return result.scalars().all()
