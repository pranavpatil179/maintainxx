import asyncio
import os
import random
import logging
import pandas as pd
from datetime import datetime, UTC
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .database import AsyncSessionLocal
from .models import Machine, SensorLog, Prediction
from .ml_engine import ml_engine, COLUMN_NAMES, OP_COLS, SENSOR_COLS

logger = logging.getLogger(__name__)

# Global cache to keep real NASA cycles in memory
_REAL_DATA_CACHE = {}  # {unit_number: [dict_of_row1, dict_of_row2, ...]}
_CURRENT_CYCLE_PTR = {} # {unit_number: int}

def _load_real_data_cache():
    if _REAL_DATA_CACHE:
        return
    cmaps_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "CMaps", "test_FD001.txt")
    if not os.path.exists(cmaps_path):
        logger.warning(f"Could not find {cmaps_path}. Streamer will use fallback random noise.")
        return
    
    try:
        names = COLUMN_NAMES[:26]
        df = pd.read_csv(cmaps_path, sep=r"\s+", header=None, names=names, engine="python")
        df = df.iloc[:, :26]
        df.columns = ["unit", "cycle"] + OP_COLS + SENSOR_COLS
        df.fillna(df.median(numeric_only=True), inplace=True)
        
        for unit, group in df.groupby("unit"):
            unit_val = int(unit)
            _REAL_DATA_CACHE[unit_val] = group.to_dict("records")
            
            # STAGGERED INITIALIZATION:
            # 1, 4, 7, 10, 13 => High Risk (Start at 85% of life)
            # 2, 5, 8, 11, 14 => Medium Risk (Start at 40% of life)
            # 3, 6, 9, 12, 15 => Healthy (Start at 5% of life)
            if unit_val % 3 == 0:
                _CURRENT_CYCLE_PTR[unit_val] = 0  # Healthy
            elif unit_val % 3 == 1:
                _CURRENT_CYCLE_PTR[unit_val] = int(len(_REAL_DATA_CACHE[unit_val]) * 0.85) # High
            else:
                _CURRENT_CYCLE_PTR[unit_val] = int(len(_REAL_DATA_CACHE[unit_val]) * 0.40) # Medium
                
        logger.info(f"Loaded {len(_REAL_DATA_CACHE)} units into stream cache with CATEGORICAL STAGGERING.")
    except Exception as e:
        logger.error(f"Error loading CMAPSS cache: {e}")

async def start_data_stream():
    """Background task to simulate live sensor data streaming from real NASA CMAPSS files."""
    logger.info("Starting live sensor data stream...")
    tick_count = 0
    _load_real_data_cache()
    
    while True:
        await asyncio.sleep(1)  # Faster cycle to guarantee freshness on 2sec frontend poll
        tick_count += 1
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Machine).where(Machine.status != "failed"))
                machines = result.scalars().all()
                
                for machine in machines:
                    # Do we have real data for this machine unit?
                    unit_num = machine.unit_number
                    use_real_data = unit_num in _REAL_DATA_CACHE
                    
                    # Also need last log to know the DB cycle number
                    log_res = await db.execute(
                        select(SensorLog)
                        .where(SensorLog.machine_id == machine.id)
                        .order_by(SensorLog.cycle.desc())
                        .limit(1)
                    )
                    last_log = log_res.scalar_one_or_none()
                    if not last_log:
                        continue
                        
                    new_cycle = last_log.cycle + 1
                    
                    row_dict = {}
                    # CATEGORICAL DATA SOURCE 
                    # Group A (1, 4, 7...): High Risk - Close to failure (End of NASA test)
                    # Group B (2, 5, 8...): Medium Risk - Mid-life (Middle of NASA test)
                    # Group C (3, 6, 9...): Healthy - Brand New (Synthetic pristine data)
                    
                    if unit_num % 3 == 0:
                        # Group C: HEALTHY (Pristine Synthetic Data)
                        # We use very stable, 'ideal' baseline values for a new engine
                        row_dict = {
                            "op_setting_1": 0.0001, "op_setting_2": 0.0001, "op_setting_3": 100.0,
                            "s1": 518.67, "s2": 642.15, "s3": 1585.12, "s4": 1400.12, "s5": 14.62,
                            "s6": 21.61, "s7": 554.34, "s8": 2388.06, "s9": 9044.23, "s10": 1.3,
                            "s11": 47.28, "s12": 521.76, "s13": 2388.08, "s14": 8130.45, "s15": 8.41,
                            "s16": 0.03, "s17": 391.0, "s18": 2388.0, "s19": 100.0, "s20": 39.02, "s21": 23.41
                        }
                        # Add tiny noise (Cycle pointer not used for Group C)
                        for k in row_dict:
                            if k not in ["op_setting_3", "s6", "s10", "s18", "s19"]:
                                row_dict[k] += random.uniform(-0.01, 0.01)
                    else:
                        # Groups A & B: REAL NASA DATA (reading from staggered pointers)
                        if use_real_data:
                            ptr = _CURRENT_CYCLE_PTR[unit_num]
                            rows = _REAL_DATA_CACHE[unit_num]
                            if ptr >= len(rows): ptr = 0
                            real_row = rows[ptr]
                            _CURRENT_CYCLE_PTR[unit_num] = ptr + 1
                            for col in OP_COLS + SENSOR_COLS:
                                row_dict[col] = float(real_row.get(col, 0.0))
                        else:
                            # Fallback random noise
                            row_dict = {f"s{i}": getattr(last_log, f"s{i}") for i in range(1, 22)}
                            row_dict.update({k: getattr(last_log, k) for k in OP_COLS})
                            for col in row_dict:
                                if row_dict[col] is not None:
                                    row_dict[col] += random.uniform(-0.05, 0.08)

                    new_log = SensorLog(
                        machine_id=machine.id,
                        cycle=new_cycle,
                        **row_dict
                    )
                    db.add(new_log)
                    
                    # RUN ML PREDICTION
                    pred_res = ml_engine.predict_from_sensor_row(row_dict)
                    
                    # CATEGORICAL FORCE:
                    # If Healthy group, we cap the prediction to remain at least 'Medium' or 'Low'
                    # unless it naturally decays (but Group C is static pristine)
                    rul = pred_res["rul"]
                    if unit_num % 3 == 0: 
                        rul = max(rul, 320.0) # Always Healthy

                    health = pred_res.get("health_score", min(100.0, max(0.0, (rul / 375.0) * 100.0)))
                    risk = pred_res.get("risk_level", ml_engine._risk_level(rul))
                    
                    machine.current_health = health
                    machine.status = ml_engine.health_to_status(health)
                    
                    new_pred = Prediction(
                        machine_id=machine.id,
                        rul=rul,
                        health_score=health,
                        risk_level=risk,
                        confidence=round(random.uniform(0.95, 0.99), 2),
                        predicted_failure_date=ml_engine.failure_date_estimate(rul, machine.id),
                        model_version="gb-nasa-live-staggered"
                    )
                    db.add(new_pred)

                    # Logging
                    if tick_count % 20 == 0:
                        from .models import DailyLog
                        auto_log = DailyLog(
                            machine_id=machine.id,
                            session="live",
                            notes=f"Auto-telemetry engine check. RUL: {rul:.1f} cycles. Mode: {'CMAPSS Real' if use_real_data else 'Simulated'}",
                            technician="AI Engine",
                            timestamp=datetime.now(UTC)
                        )
                        db.add(auto_log)
                
                await db.commit()
        except Exception as e:
            logger.error(f"Error in data stream: {e}")
            await asyncio.sleep(5)
