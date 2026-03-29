"""
Data Ingestor – seeds database with REAL NASA CMAPSS machine data.
Parses train_FD001.txt and test_FD001.txt for realistic base values.
"""
import os
import json
import logging
import random
from datetime import datetime, UTC, timedelta

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from .models import Machine, SensorLog, Prediction, MaintenanceTask, DailyLog, User, EquipmentCategory, WorkCenter
from .ml_engine import ml_engine, SENSOR_COLS, OP_COLS, COLUMN_NAMES
from .auth import get_password_hash

import pandas as pd
import glob

logger = logging.getLogger(__name__)

# Primary location of dataset
CMAPS_DIR = "../../CMaps"

def _resolve_cmaps_dir() -> str:
    """Find the CMaps directory based on common project structures."""
    # Try env var first (set in render.yaml)
    env_dir = os.environ.get("CMAPS_DATA_DIR", "")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    # Try relative to app/
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidate = os.path.join(base, CMAPS_DIR)
    if os.path.isdir(candidate):
        return candidate
    # Try persistent data dir (Render)
    data_candidate = os.path.join(base, "data", "CMaps")
    if os.path.isdir(data_candidate):
        return data_candidate
    # Try in project root
    project_root = os.path.dirname(base)
    candidate2 = os.path.join(project_root, "CMaps")
    if os.path.isdir(candidate2):
        return candidate2
    return CMAPS_DIR


def _risk_level(rul: float) -> str:
    if rul < 50:
        return "High"
    elif rul < 150:
        return "Medium"
    return "Low"


def _health_to_status(health: float) -> str:
    if health < 30:
        return "critical"
    elif health < 60:
        return "warning"
    return "operational"


def _make_task(machine_id: str, risk: str, rul: float, tech_id: Optional[int] = None) -> MaintenanceTask:
    """Utility to create a maintenance task based on risk/RUL."""
    priority_map = {"High": "critical", "Medium": "high", "Low": "medium"}
    title_map = {
        "High": "Urgent Inspection Required",
        "Medium": "Scheduled Maintenance Due",
        "Low": "Routine Check",
    }
    due_offset = {"High": 3, "Medium": 14, "Low": 30}
    due_date = (datetime.now(UTC) + timedelta(days=due_offset.get(risk, 14))).strftime("%Y-%m-%d")

    return MaintenanceTask(
        machine_id=machine_id,
        technician_id=tech_id,
        subject="Maintenance Request",
        title=f"{title_map.get(risk, 'Service Req')}: {machine_id}",
        description=(
            f"Predicted RUL is {rul:.0f} cycles. Risk level: {risk}. "
            "Inspect sensors and verify calibration."
        ),
        priority=priority_map.get(risk, "medium"),
        status="requested",
        due_date=due_date,
        scheduled_date=due_date,
        auto_generated=True,
    )


async def ingest_dataset(db: AsyncSession, max_engines_per_dataset: int = 25):
    """
    Seeds the database with REAL machines from CMaps files + predictions.
    """
    logger.info("🚀 Starting real dataset ingestion from CMaps files...")

    # 1. Seed Users
    admin_res = await db.execute(select(User).where(User.email == "admin@guardward.ai"))
    admin = admin_res.scalar_one_or_none()
    if not admin:
        admin = User(
            email="admin@guardward.ai",
            full_name="System Admin",
            password_hash=get_password_hash("admin123"),
            role="admin"
        )
        db.add(admin)
        await db.flush()

    technicians = ["Alice Johnson", "Bob Smith", "Carlos Ray", "Diana Prince"]
    tech_objs = []
    for tech in technicians:
        email = tech.lower().replace(" ", ".") + "@guardward.ai"
        tech_res = await db.execute(select(User).where(User.email == email))
        t = tech_res.scalar_one_or_none()
        if not t:
            t = User(
                email=email,
                full_name=tech,
                password_hash=get_password_hash("password123"),
                role="technician"
            )
            db.add(t)
        tech_objs.append(t)
    await db.flush()

    # 2. Check if already ingested
    result = await db.execute(select(Machine).limit(1))
    if result.scalars().first() is not None:
        logger.info("Database already seeded – skipping ingestion.")
        cmaps_dir = _resolve_cmaps_dir()
        if os.path.isdir(cmaps_dir):
            ml_engine.load_or_train(cmaps_dir)
        return

    # 3. Resolve and Load/Train ML model
    cmaps_dir = _resolve_cmaps_dir()
    logger.info("Looking for CMaps files in: %s", cmaps_dir)
    if not os.path.isdir(cmaps_dir):
        logger.error("❌ CMaps directory not found at %s", cmaps_dir)
        return

    ml_success = ml_engine.load_or_train(cmaps_dir)
    if not ml_success:
        logger.warning("ML model failed to train or load.")

    # 4. Parse test_FD001.txt for current state
    test_file = os.path.join(cmaps_dir, "test_FD001.txt")
    rul_file = os.path.join(cmaps_dir, "RUL_FD001.txt")

    if not os.path.exists(test_file) or not os.path.exists(rul_file):
        logger.error("Required FD001 files missing.")
        return

    df_test = _read_cmaps_file(test_file)
    rul_ground_truth = _read_rul_file(rul_file)
    last_cycles = df_test.groupby("unit").tail(1).reset_index(drop=True)
    units = last_cycles["unit"].unique()[:max_engines_per_dataset]
    
    models = ["Turbofan-Alpha", "Turbofan-Beta", "Turbofan-Gamma", "Turbofan-Delta"]

    for unit_id in units:
        machine_id = f"FD001-{int(unit_id)}"
        unit_history = df_test[df_test["unit"] == unit_id]
        pred_data = ml_engine.predict_from_last_cycles(unit_history)
        
        health = pred_data["health_score"]
        status = _health_to_status(health)
        risk = pred_data["risk_level"]

        machine = Machine(
            id=machine_id,
            dataset="FD001",
            unit_number=int(unit_id),
            max_cycles=350,
            current_health=health,
            status=status,
            serial_number=f"SN-FD001-{int(unit_id):03d}",
            model_name=random.choice(models),
            company="Skyline Dynamics",
            used_by="Internal Flight Ops",
            maintenance_team="Team Alpha",
            assigned_date=datetime.now(UTC).strftime("%Y-%m-%d"),
            description=f"Authentic NASA Turbofan unit #{int(unit_id)} from CMAPSS dataset.",
            preventive_cost=float(random.randint(2500, 7500)),
            failure_cost=float(random.randint(35000, 85000))
        )
        db.add(machine)
        await db.flush()

        # Seed latest cycles for history view
        for _, h_row in unit_history.tail(15).iterrows():
            db.add(SensorLog(
                machine_id=machine_id,
                cycle=int(h_row["cycle"]),
                op_setting_1=float(h_row["op_setting_1"]),
                op_setting_2=float(h_row["op_setting_2"]),
                op_setting_3=float(h_row["op_setting_3"]),
                **{f"s{i}": float(h_row[f"s{i}"]) for i in range(1, 22)},
            ))

        # Prediction
        db.add(Prediction(
            machine_id=machine_id,
            rul=pred_data["rul"],
            health_score=health,
            risk_level=risk,
            confidence=round(random.uniform(0.9, 0.98), 2),
            predicted_failure_date=ml_engine.failure_date_estimate(pred_data["rul"], machine_id),
            model_version="gb-nasa-v2",
        ))

        # Tasks
        if risk in ("High", "Medium") and tech_objs:
            tech = random.choice(tech_objs)
            db.add(_make_task(machine_id, risk, pred_data["rul"], tech.id))

    await db.commit()
    logger.info("✅ Dataset ingestion complete.")


def _read_rul_file(path: str) -> dict[int, float]:
    ruls = {}
    with open(path) as f:
        for i, line in enumerate(f, start=1):
            line = line.strip()
            if line: ruls[i] = float(line)
    return ruls


def _read_cmaps_file(path: str) -> pd.DataFrame:
    names = COLUMN_NAMES[:26]
    df = pd.read_csv(path, sep=r"\s+", header=None, names=names, engine="python")
    df = df.iloc[:, :26]
    df.columns = ["unit", "cycle"] + OP_COLS + SENSOR_COLS
    df.fillna(df.median(numeric_only=True), inplace=True)
    return df
