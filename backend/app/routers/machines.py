from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..database import get_db
from ..models import Machine, SensorLog, Prediction
from ..schemas import MachineOut, SensorLogOut, PredictionOut, MachineUpdate

router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("/", response_model=List[MachineOut])
async def list_machines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).order_by(Machine.dataset, Machine.unit_number))
    return result.scalars().all()


@router.get("/{machine_id}", response_model=MachineOut)
async def get_machine(machine_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).where(Machine.id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return machine


@router.get("/{machine_id}/history", response_model=List[SensorLogOut])
async def machine_history(machine_id: str, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SensorLog)
        .where(SensorLog.machine_id == machine_id)
        .order_by(SensorLog.cycle.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    rows.reverse()
    return rows


@router.get("/{machine_id}/predictions", response_model=List[PredictionOut])
async def machine_predictions(machine_id: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Prediction)
        .where(Prediction.machine_id == machine_id)
        .order_by(Prediction.predicted_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.patch("/{machine_id}", response_model=MachineOut)
async def update_machine(
    machine_id: str,
    data: MachineUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Machine).where(Machine.id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    if data.manual_health_score is not None:
        machine.manual_health_score = data.manual_health_score
    if data.observation_notes is not None:
        machine.observation_notes = data.observation_notes
    if data.preventive_cost is not None:
        machine.preventive_cost = data.preventive_cost
    if data.failure_cost is not None:
        machine.failure_cost = data.failure_cost
    if data.status is not None:
        machine.status = data.status

    await db.commit()
    await db.refresh(machine)
    return machine
