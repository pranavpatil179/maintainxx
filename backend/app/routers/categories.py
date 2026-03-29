from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from ..database import get_db
from ..models import EquipmentCategory
from ..schemas import CategoryCreate, CategoryOut
from ..auth import get_current_user

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/", response_model=List[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    from ..models import Machine
    result = await db.execute(select(EquipmentCategory))
    categories = result.scalars().all()
    
    # Enrich with counts
    enriched = []
    for cat in categories:
        count_res = await db.execute(select(func.count(Machine.id)).where(Machine.category_id == cat.id))
        count = count_res.scalar_one()
        cat_dict = {
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "color": cat.color,
            "responsible_id": cat.responsible_id,
            "machine_count": count
        }
        enriched.append(cat_dict)
    
    return enriched

@router.post("/", response_model=CategoryOut)
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    new_cat = EquipmentCategory(**category.model_dump())
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return new_cat
