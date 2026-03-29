from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..database import get_db
from ..models import MaintenanceTask
from ..schemas import TaskOut, TaskUpdate, TaskCreate

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=List[TaskOut])
async def list_tasks(status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(MaintenanceTask).order_by(MaintenanceTask.created_at.desc())
    if status:
        q = q.where(MaintenanceTask.status == status)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=TaskOut)
async def create_task(payload: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = MaintenanceTask(
        **payload.model_dump(),
        status="pending",
        auto_generated=False
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, payload: TaskUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    if "assigned_to" in update_data:
        task.technician_id = update_data.pop("assigned_to")
    
    for key, value in update_data.items():
        setattr(task, key, value)
        
    await db.commit()
    await db.refresh(task)
    return task
@router.delete("/{task_id}")
async def delete_task(task_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaintenanceTask).where(MaintenanceTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return {"status": "success"}
