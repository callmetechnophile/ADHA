from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import Optional, List
import datetime
import math
import random
from database import Base, engine, SessionLocal

# SQLAlchemy Models
class DBTelemetryData(Base):
    __tablename__ = "telemetry_data"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    sphere_temp = Column(Float, nullable=False)
    loop1_temp = Column(Float, nullable=False)
    loop2_temp = Column(Float, nullable=False)
    flow_rate = Column(Float, nullable=False)
    pressure = Column(Float, nullable=False)
    heater_state = Column(Boolean, nullable=False)
    pump1_state = Column(Boolean, nullable=False)
    pump2_state = Column(Boolean, nullable=False)
    fan_state = Column(Boolean, nullable=False)
    heater_duty = Column(Integer, nullable=False)
    fan_rpm = Column(Integer, nullable=False)

class DBAlert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    severity = Column(String, nullable=False) # NORMAL, WARNING, CRITICAL
    message = Column(String, nullable=False)
    status = Column(String, nullable=False) # Active, Cleared

class DBFaultLog(Base):
    __tablename__ = "fault_logs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    fault_type = Column(String, nullable=False)
    description = Column(String, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)

def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        if engine.url.drivername.startswith("postgresql"):
            with engine.connect() as conn:
                from sqlalchemy import text
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"))
                conn.execute(text("SELECT create_hypertable('telemetry_data', 'timestamp', if_not_exists => TRUE);"))
                conn.commit()
                print("TimescaleDB Hypertable initialized successfully.")
        else:
            print("SQLite Database initialized successfully.")
            
        # Seed initial 50 historical records under 80°C if database is empty
        db = SessionLocal()
        try:
            count = db.query(DBTelemetryData).count()
            if count == 0:
                print("Seeding initial 50 historical records under 80°C...")
                now = datetime.datetime.now(datetime.timezone.utc)
                for i in range(50):
                    # Space out records by 2 seconds
                    time_offset = (50 - i) * 2
                    ts = now - datetime.timedelta(seconds=time_offset)
                    
                    sphere = 64.2 + 4.5 * math.sin(i / 6.0) + random.uniform(-0.4, 0.4)
                    loop1 = 51.5 + 2.8 * math.sin(i / 6.0) + random.uniform(-0.3, 0.3)
                    loop2 = 34.2 + 1.8 * math.sin(i / 6.0) + random.uniform(-0.2, 0.2)
                    
                    seed = DBTelemetryData(
                        timestamp=ts,
                        sphere_temp=round(sphere, 1),
                        loop1_temp=round(loop1, 1),
                        loop2_temp=round(loop2, 1),
                        flow_rate=round(2.8 + 0.15 * math.cos(i / 8.0) + random.uniform(-0.02, 0.02), 2),
                        pressure=int(400 + 10 * math.sin(i / 6.0) + random.randint(-4, 4)),
                        heater_state=True,
                        pump1_state=True,
                        pump2_state=True,
                        fan_state=True,
                        heater_duty=int(50 + 8 * math.cos(i / 10.0)),
                        fan_rpm=int(2800 + 100 * math.sin(i / 7.0))
                    )
                    db.add(seed)
                db.commit()
                print("Seeding completed successfully.")
        except Exception as seed_err:
            db.rollback()
            print(f"Failed to seed initial data: {seed_err}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"Database initialization warning: {e}")

# Pydantic Schemas
class TelemetryPayload(BaseModel):
    timestamp: Optional[str] = None # Will set to current time if empty
    sphere_temp: float
    loop1_temp: float
    loop2_temp: float
    flow_rate: float
    pressure: float
    heater_state: bool
    pump1_state: bool
    pump2_state: bool
    fan_state: bool
    heater_duty: int
    fan_rpm: int

    class Config:
        from_attributes = True

class AlertSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    severity: str
    message: str
    status: str

    class Config:
        from_attributes = True

class FaultLogSchema(BaseModel):
    id: int
    timestamp: datetime.datetime
    fault_type: str
    description: str
    resolved: bool

    class Config:
        from_attributes = True

class PredictionSummary(BaseModel):
    predicted_sphere_temp: float
    predicted_loop1_temp: float
    predicted_loop2_temp: float
    time_to_180: str # e.g. "07:36 min" or "N/A"
    overheat_risk: float
    flow_drop_prob: float
    system_health_index: int
    recommendation: str

class PredictionPoint(BaseModel):
    time_offset: int # seconds or minutes offset
    predicted_sphere_temp: float
    predicted_loop1_temp: float
    predicted_loop2_temp: float

class FullPredictionResponse(BaseModel):
    trends: List[PredictionPoint]
    summary: PredictionSummary
