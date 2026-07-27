import asyncio
import datetime
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler

from database import get_db, SessionLocal
from models import (
    DBTelemetryData, DBAlert, DBFaultLog, 
    TelemetryPayload, AlertSchema, FaultLogSchema, 
    FullPredictionResponse, init_db
)
from mqtt_client import start_mqtt_client, ws_callbacks
from alert_engine import compute_health_index, process_alerts_and_faults
from ai_pipeline import ai_model, generate_predictions_and_reasoning

app = FastAPI(title="Dual Loop Controlled Cooling System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections list
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Gather all tasks to run concurrently
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Global cache for AI prediction results
cached_prediction = {
    "trends": [
        {"time_offset": 0, "predicted_sphere_temp": 128.4, "predicted_loop1_temp": 74.8, "predicted_loop2_temp": 42.2},
        {"time_offset": 2, "predicted_sphere_temp": 135.0, "predicted_loop1_temp": 78.0, "predicted_loop2_temp": 43.5},
        {"time_offset": 4, "predicted_sphere_temp": 142.5, "predicted_loop1_temp": 81.0, "predicted_loop2_temp": 44.2},
        {"time_offset": 6, "predicted_sphere_temp": 151.0, "predicted_loop1_temp": 83.2, "predicted_loop2_temp": 45.0},
        {"time_offset": 8, "predicted_sphere_temp": 160.5, "predicted_loop1_temp": 85.5, "predicted_loop2_temp": 45.8},
        {"time_offset": 10, "predicted_sphere_temp": 172.8, "predicted_loop1_temp": 88.0, "predicted_loop2_temp": 46.5}
    ],
    "summary": {
        "predicted_sphere_temp": 172.8,
        "predicted_loop1_temp": 88.0,
        "predicted_loop2_temp": 46.5,
        "time_to_180": "07:36 min",
        "overheat_risk": 72.4,
        "flow_drop_prob": 18.7,
        "system_health_index": 81,
        "recommendation": "Increase Flow / Reduce Heater Load"
    }
}

# Update predictions cache function
def update_predictions_cache():
    global cached_prediction
    db = SessionLocal()
    try:
        latest = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).first()
        if latest:
            latest_dict = {
                "sphere_temp": latest.sphere_temp,
                "loop1_temp": latest.loop1_temp,
                "loop2_temp": latest.loop2_temp,
                "flow_rate": latest.flow_rate,
                "pressure": latest.pressure,
                "heater_duty": latest.heater_duty,
                "fan_rpm": latest.fan_rpm
            }
            cached_prediction = generate_predictions_and_reasoning(db, latest_dict)
            print("AI Prediction cache updated.")
    except Exception as e:
        print(f"Error updating AI cache: {e}")
    finally:
        db.close()

# Retrain LSTM task
def retrain_model_task():
    db = SessionLocal()
    try:
        data = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).limit(1000).all()
        data.reverse()
        if len(data) >= 50:
            success = ai_model.train(data)
            print(f"LSTM retraining. Success: {success}")
        else:
            print("LSTM retraining skipped. Not enough data (minimum 50 samples required).")
    except Exception as e:
        print(f"Error retraining LSTM: {e}")
    finally:
        db.close()

# Forward telemetry payload to all WS connections
def handle_mqtt_telemetry(payload: dict):
    # Enrich the telemetry message with latest cached predictions and status
    message = {
        "type": "telemetry",
        "data": payload,
        "prediction": cached_prediction
    }
    # Run async broadcast in current thread event loop
    loop = asyncio.get_event_loop()
    if loop.is_running():
        loop.create_task(manager.broadcast(message))

# Register MQTT WS forwarder callback
ws_callbacks.append(handle_mqtt_telemetry)

@app.on_event("startup")
async def startup_event():
    # Initialize database
    init_db()

    # Start MQTT consumer
    start_mqtt_client()
    
    # Start APScheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(update_predictions_cache, 'interval', seconds=6) # update predictions every 6s
    scheduler.add_job(retrain_model_task, 'interval', minutes=5)       # retrain model every 5 min
    scheduler.start()
    
    # Run initial retrain & prediction update in background thread
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, retrain_model_task)
    loop.run_in_executor(None, update_predictions_cache)

# REST Routes
@app.post("/telemetry")
async def post_telemetry(payload: TelemetryPayload, db: Session = Depends(get_db)):
    """
    HTTP endpoint to manually post telemetry. Emulates MQTT ingestion.
    """
    timestamp = datetime.datetime.now(datetime.timezone.utc)
    if payload.timestamp:
        try:
            timestamp = datetime.datetime.fromisoformat(payload.timestamp.replace("Z", "+00:00"))
        except ValueError:
            pass
            
    db_telemetry = DBTelemetryData(
        timestamp=timestamp,
        sphere_temp=payload.sphere_temp,
        loop1_temp=payload.loop1_temp,
        loop2_temp=payload.loop2_temp,
        flow_rate=payload.flow_rate,
        pressure=payload.pressure,
        heater_state=payload.heater_state,
        pump1_state=payload.pump1_state,
        pump2_state=payload.pump2_state,
        fan_state=payload.fan_state,
        heater_duty=payload.heater_duty,
        fan_rpm=payload.fan_rpm
    )
    
    db.add(db_telemetry)
    db.flush()
    
    status, active_alerts = process_alerts_and_faults(
        db, 
        payload.sphere_temp, 
        payload.flow_rate, 
        payload.pressure
    )
    db.commit()
    
    enriched = {
        **payload.dict(),
        "timestamp": timestamp.isoformat(),
        "system_status": status,
        "active_alerts_count": active_alerts
    }
    
    handle_mqtt_telemetry(enriched)
    return {"status": "success", "data": enriched}

@app.get("/history", response_model=List[TelemetryPayload])
def get_history(limit: int = 100, db: Session = Depends(get_db)):
    """
    Fetch telemetry log history.
    """
    history = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).limit(limit).all()
    history.reverse()
    return history

@app.get("/alerts", response_model=List[AlertSchema])
def get_alerts(db: Session = Depends(get_db)):
    """
    Retrieve all historical/active alerts.
    """
    alerts = db.query(DBAlert).order_by(DBAlert.timestamp.desc()).limit(50).all()
    return alerts

@app.get("/faults", response_model=List[FaultLogSchema])
def get_faults(db: Session = Depends(get_db)):
    """
    Retrieve all system fault logs.
    """
    faults = db.query(DBFaultLog).order_by(DBFaultLog.timestamp.desc()).limit(50).all()
    return faults

@app.post("/train")
def force_train(background_tasks: BackgroundTasks):
    """
    Trigger manual retraining of the LSTM model.
    """
    background_tasks.add_task(retrain_model_task)
    return {"status": "retraining started in background"}

@app.post("/predict", response_model=FullPredictionResponse)
def force_predict(db: Session = Depends(get_db)):
    """
    Request manual predictive inference run.
    """
    global cached_prediction
    latest = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).first()
    if not latest:
        # If DB is empty, return cached mock prediction
        return cached_prediction
        
    latest_dict = {
        "sphere_temp": latest.sphere_temp,
        "loop1_temp": latest.loop1_temp,
        "loop2_temp": latest.loop2_temp,
        "flow_rate": latest.flow_rate,
        "pressure": latest.pressure,
        "heater_duty": latest.heater_duty,
        "fan_rpm": latest.fan_rpm
    }
    prediction = generate_predictions_and_reasoning(db, latest_dict)
    
    cached_prediction = prediction
    return prediction

@app.get("/system-health")
def get_system_health(db: Session = Depends(get_db)):
    """
    Retrieve current system health parameters.
    """
    latest = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).first()
    active_alerts_count = db.query(DBAlert).filter(DBAlert.status == "Active").count()
    active_alerts = db.query(DBAlert).filter(DBAlert.status == "Active").all()
    
    # Calculate status badge: NORMAL / WARNING / CRITICAL
    if any(a.severity == "CRITICAL" for a in active_alerts):
        status = "CRITICAL"
    elif any(a.severity == "WARNING" for a in active_alerts):
        status = "WARNING"
    else:
        status = "NORMAL"

    if not latest:
        return {
            "health_score": 100,
            "status": "NORMAL",
            "active_alerts_count": 0,
            "details": "No telemetry data recorded."
        }
        
    health_score = compute_health_index(
        latest.sphere_temp, 
        latest.flow_rate, 
        latest.pressure, 
        active_alerts_count
    )
    
    return {
        "health_score": health_score,
        "status": status,
        "active_alerts_count": active_alerts_count,
        "details": {
            "sphere_temp": latest.sphere_temp,
            "flow_rate": latest.flow_rate,
            "pressure": latest.pressure
        }
    }

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send current cached prediction immediately upon connection
        db = SessionLocal()
        latest = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).first()
        history = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).limit(8).all()
        history.reverse()
        db.close()
        
        # Initial dump
        await websocket.send_json({
            "type": "init",
            "prediction": cached_prediction,
            "latest_data": {
                "sphere_temp": latest.sphere_temp,
                "loop1_temp": latest.loop1_temp,
                "loop2_temp": latest.loop2_temp,
                "flow_rate": latest.flow_rate,
                "pressure": latest.pressure,
                "heater_state": latest.heater_state,
                "pump1_state": latest.pump1_state,
                "pump2_state": latest.pump2_state,
                "fan_state": latest.fan_state,
                "heater_duty": latest.heater_duty,
                "fan_rpm": latest.fan_rpm,
                "timestamp": latest.timestamp.isoformat()
            } if latest else None,
            "history": [
                {
                    "sphere_temp": h.sphere_temp,
                    "loop1_temp": h.loop1_temp,
                    "loop2_temp": h.loop2_temp,
                    "flow_rate": h.flow_rate,
                    "pressure": h.pressure,
                    "heater_state": h.heater_state,
                    "pump1_state": h.pump1_state,
                    "pump2_state": h.pump2_state,
                    "fan_state": h.fan_state,
                    "heater_duty": h.heater_duty,
                    "fan_rpm": h.fan_rpm,
                    "timestamp": h.timestamp.isoformat()
                } for h in history
            ]
        })
        
        # Keep connection open
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket connection exception: {e}")
        manager.disconnect(websocket)
