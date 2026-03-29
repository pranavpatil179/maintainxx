import asyncio
import random
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Machine, Prediction

async def randomize_fleet():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Machine))
        machines = result.scalars().all()
        print(f"Randomizing {len(machines)} machines...")
        
        for m in machines:
            # Randomize RUL between 10 and 600
            new_rul = random.uniform(10.0, 600.0)
            # Health is (RUL / max_cycles) * 100
            new_health = round(min(100.0, (new_rul / 375.0) * 100.0), 1)
            
            # Map health to status
            if new_health < 30: new_status = "critical"
            elif new_health < 60: new_status = "warning"
            else: new_status = "operational"
            
            # Map RUL to risk
            if new_rul < 50: new_risk = "High"
            elif new_rul < 150: new_risk = "Medium"
            else: new_risk = "Low"
            
            m.current_health = new_health
            m.status = new_status
            
            # Update prediction
            new_pred = Prediction(
                machine_id=m.id,
                rul=new_rul,
                health_score=new_health,
                risk_level=new_risk,
                confidence=round(random.uniform(0.85, 0.99), 2),
                model_version="v2-randomized"
            )
            db.add(new_pred)
            print(f"Machine {m.id}: RUL={new_rul:.1f}, Health={new_health}%, Risk={new_risk}")
            
        await db.commit()
        print("✅ Fleet randomized successfully!")

if __name__ == "__main__":
    asyncio.run(randomize_fleet())
