from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from ..database import get_db
from ..models import WorkCenter
from ..schemas import WorkCenterCreate, WorkCenterOut

router = APIRouter(prefix="/work-centers", tags=["work-centers"])

@router.get("/", response_model=List[WorkCenterOut])
async def list_work_centers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkCenter))
    return result.scalars().all()

@router.post("/", response_model=WorkCenterOut)
async def create_work_center(wc: WorkCenterCreate, db: AsyncSession = Depends(get_db)):
    new_wc = WorkCenter(**wc.model_dump())
    db.add(new_wc)
    await db.commit()
    await db.refresh(new_wc)
    return new_wc
