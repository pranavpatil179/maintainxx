from sqlalchemy import Column, String, Float, Integer, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, UTC
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="technician")  # admin, technician, manager
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))

    tasks_assigned = relationship("MaintenanceTask", back_populates="technician")
    categories_managed = relationship("EquipmentCategory", back_populates="responsible")


class EquipmentCategory(Base):
    __tablename__ = "equipment_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    color = Column(String, default="#3b82f6")
    responsible_id = Column(Integer, ForeignKey("users.id"))
    
    responsible = relationship("User", back_populates="categories_managed")
    machines = relationship("Machine", back_populates="category")


class WorkCenter(Base):
    __tablename__ = "work_centers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True)
    tag = Column(String)
    cost_per_hour = Column(Float, default=0.0)
    capacity = Column(Float, default=100.0)
    efficiency = Column(Float, default=1.0)
    oee_target = Column(Float, default=85.0)

    tasks = relationship("MaintenanceTask", back_populates="work_center")


class Machine(Base):
    __tablename__ = "machines"

    id = Column(String, primary_key=True)          # e.g. "FD001-1"
    dataset = Column(String, nullable=False)        # FD001/FD002/etc
    unit_number = Column(Integer, nullable=False)
    category_id = Column(Integer, ForeignKey("equipment_categories.id"))
    
    # Metadata from blueprint
    serial_number = Column(String, unique=True, index=True)
    model_name = Column(String)
    company = Column(String)
    used_by = Column(String)
    maintenance_team = Column(String)
    assigned_date = Column(String)
    description = Column(Text)
    
    # Financial parameters for cost optimization
    preventive_cost = Column(Float, default=5000.0)
    failure_cost = Column(Float, default=50000.0)

    max_cycles = Column(Integer, default=0)
    current_health = Column(Float, default=100.0)
    manual_health_score = Column(Float)            # Engineer-provided score (0-100)
    observation_notes = Column(Text)               # Manual notes for hybrid analysis
    status = Column(String, default="operational")  # operational/warning/critical
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    category = relationship("EquipmentCategory", back_populates="machines")
    sensor_logs = relationship("SensorLog", back_populates="machine", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="machine", cascade="all, delete-orphan")
    daily_logs = relationship("DailyLog", back_populates="machine", cascade="all, delete-orphan")
    tasks = relationship("MaintenanceTask", back_populates="machine", cascade="all, delete-orphan")


class SensorLog(Base):
    __tablename__ = "sensor_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"), nullable=False, index=True)
    cycle = Column(Integer, nullable=False, index=True)
    op_setting_1 = Column(Float)
    op_setting_2 = Column(Float)
    op_setting_3 = Column(Float)
    s1 = Column(Float); s2 = Column(Float); s3 = Column(Float)
    s4 = Column(Float); s5 = Column(Float); s6 = Column(Float)
    s7 = Column(Float); s8 = Column(Float); s9 = Column(Float)
    s10 = Column(Float); s11 = Column(Float); s12 = Column(Float)
    s13 = Column(Float); s14 = Column(Float); s15 = Column(Float)
    s16 = Column(Float); s17 = Column(Float); s18 = Column(Float)
    s19 = Column(Float); s20 = Column(Float); s21 = Column(Float)
    logged_at = Column(DateTime, default=lambda: datetime.now(UTC))

    machine = relationship("Machine", back_populates="sensor_logs")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"), nullable=False, index=True)
    rul = Column(Float, nullable=False)              # predicted remaining useful life
    health_score = Column(Float, nullable=False)     # 0-100
    risk_level = Column(String, nullable=False)      # Low / Medium / High
    confidence = Column(Float, default=0.85)
    predicted_failure_date = Column(String)          # ISO string
    model_version = Column(String, default="v1")
    predicted_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)

    machine = relationship("Machine", back_populates="predictions")


class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"), nullable=False, index=True)
    session = Column(String, nullable=False)         # "morning" / "evening"
    notes = Column(Text, default="")
    technician = Column(String, default="Unknown")
    sensor_snapshot = Column(Text)                   # JSON string of sensor values
    timestamp = Column(DateTime, default=lambda: datetime.now(UTC), index=True)

    machine = relationship("Machine", back_populates="daily_logs")


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String, ForeignKey("machines.id"), nullable=False, index=True)
    work_center_id = Column(Integer, ForeignKey("work_centers.id"))
    technician_id = Column(Integer, ForeignKey("users.id"))
    
    subject = Column(String)
    title = Column(String, nullable=False)
    description = Column(Text)
    priority = Column(String, default="medium")      # low / medium / high / critical
    status = Column(String, default="requested")     # requested / in_progress / resolved / done
    due_date = Column(String)
    scheduled_date = Column(String)
    duration = Column(Integer)                       # in minutes
    
    auto_generated = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC))

    machine = relationship("Machine", back_populates="tasks")
    technician = relationship("User", back_populates="tasks_assigned")
    work_center = relationship("WorkCenter", back_populates="tasks")
