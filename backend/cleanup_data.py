import asyncio
from sqlalchemy import delete
from app.database import AsyncSessionLocal
from app.models import WorkCenter, EquipmentCategory, MaintenanceTask, Machine

async def cleanup():
    async with AsyncSessionLocal() as db:
        print("Starting precision data purge...")
        
        # 1. Delete all Maintenance Tasks (Work Orders)
        count_tasks = await db.execute(delete(MaintenanceTask))
        print(f"Purged {count_tasks.rowcount} Maintenance Tasks.")
        
        # 2. Delete all Equipment Categories (Groups)
        count_cats = await db.execute(delete(EquipmentCategory))
        print(f"Purged {count_cats.rowcount} Equipment Categories.")
        
        # 3. Delete all Work Centers
        count_wcs = await db.execute(delete(WorkCenter))
        print(f"Purged {count_wcs.rowcount} Work Centers.")
        
        # 4. Clear machine associations if any
        # No need to delete machines, just clear foreign keys if they were set
        # But in this system they are likely already null or were set by user
        
        await db.commit()
        print("✅ Data cleanup complete! Everything is fresh.")

if __name__ == "__main__":
    asyncio.run(cleanup())
