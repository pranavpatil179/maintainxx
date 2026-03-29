from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime


# ─── Auth / User ─────────────────────────────────────────────────────────────
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: Optional[str] = "technician"

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None


# ─── Equipment Category ──────────────────────────────────────────────────────
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#3b82f6"
    responsible_id: Optional[int] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int
    machine_count: Optional[int] = 0
    
    class Config:
        from_attributes = True


# ─── Work Center ─────────────────────────────────────────────────────────────
class WorkCenterBase(BaseModel):
    name: str
    code: str
    tag: Optional[str] = None
    cost_per_hour: float = 0.0
    capacity: float = 100.0
    efficiency: float = 1.0
    oee_target: float = 85.0

class WorkCenterCreate(WorkCenterBase):
    pass

class WorkCenterOut(WorkCenterBase):
    id: int
    
    class Config:
        from_attributes = True


# ─── Machine ────────────────────────────────────────────────────────────────
class MachineIn(BaseModel):
    id: str
    dataset: str
    unit_number: int
    category_id: Optional[int] = None
    serial_number: Optional[str] = None
    model_name: Optional[str] = None
    company: Optional[str] = None
    used_by: Optional[str] = None
    maintenance_team: Optional[str] = None
    assigned_date: Optional[str] = None
    description: Optional[str] = None

class MachineOut(BaseModel):
    id: str
    dataset: str
    unit_number: int
    category_id: Optional[int] = None
    serial_number: Optional[str] = None
    model_name: Optional[str] = None
    company: Optional[str] = None
    used_by: Optional[str] = None
    maintenance_team: Optional[str] = None
    assigned_date: Optional[str] = None
    description: Optional[str] = None
    current_health: float
    manual_health_score: Optional[float] = None
    observation_notes: Optional[str] = None
    preventive_cost: float = 5000.0
    failure_cost: float = 50000.0
    status: str
    updated_at: datetime

    class Config:
        from_attributes = True


class MachineUpdate(BaseModel):
    manual_health_score: Optional[float] = None
    observation_notes: Optional[str] = None
    preventive_cost: Optional[float] = None
    failure_cost: Optional[float] = None
    status: Optional[str] = None


# ─── Sensor Log ─────────────────────────────────────────────────────────────
class SensorLogOut(BaseModel):
    id: int
    machine_id: str
    cycle: int
    op_setting_1: Optional[float]
    op_setting_2: Optional[float]
    op_setting_3: Optional[float]
    s1: Optional[float]; s2: Optional[float]; s3: Optional[float]
    s4: Optional[float]; s5: Optional[float]; s6: Optional[float]
    s7: Optional[float]; s8: Optional[float]; s9: Optional[float]
    s10: Optional[float]; s11: Optional[float]; s12: Optional[float]
    s13: Optional[float]; s14: Optional[float]; s15: Optional[float]
    s16: Optional[float]; s17: Optional[float]; s18: Optional[float]
    s19: Optional[float]; s20: Optional[float]; s21: Optional[float]
    logged_at: datetime

    class Config:
        from_attributes = True


# ─── Prediction ──────────────────────────────────────────────────────────────
class PredictionOut(BaseModel):
    id: int
    machine_id: str
    rul: float
    health_score: float
    risk_level: str
    confidence: float
    predicted_failure_date: Optional[str]
    model_version: str
    category_id: Optional[int] = None
    predicted_at: datetime

    class Config:
        from_attributes = True


# ─── Daily Log ───────────────────────────────────────────────────────────────
class DailyLogIn(BaseModel):
    machine_id: str
    session: str = Field(..., pattern="^(morning|evening)$")
    notes: Optional[str] = ""
    technician: Optional[str] = "Unknown"
    sensor_snapshot: Optional[dict] = None


class DailyLogOut(BaseModel):
    id: int
    machine_id: str
    session: str
    notes: str
    technician: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Maintenance Task ─────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    machine_id: str
    title: str
    description: Optional[str] = None
    subject: Optional[str] = None
    priority: str = "medium"
    work_center_id: Optional[int] = None
    technician_id: Optional[int] = None
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    duration: Optional[int] = None

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None

class TaskOut(BaseModel):
    id: int
    machine_id: str
    work_center_id: Optional[int]
    technician_id: Optional[int]
    subject: Optional[str]
    title: str
    description: Optional[str]
    priority: str
    status: str
    due_date: Optional[str]
    scheduled_date: Optional[str]
    duration: Optional[int]
    auto_generated: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── AI Assistant ─────────────────────────────────────────────────────────────
class AssistantQuery(BaseModel):
    query: str
    context: Optional[dict] = None


class AssistantResponse(BaseModel):
    answer: str
    machines_referenced: Optional[List[str]] = []
    suggested_actions: Optional[List[str]] = []
