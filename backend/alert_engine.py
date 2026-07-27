import datetime
from sqlalchemy.orm import Session
from models import DBAlert, DBFaultLog

def compute_health_index(sphere_temp: float, flow_rate: float, pressure: float, active_faults_count: int) -> int:
    # temp_risk: 0 at 100C, 100 at 180C
    if sphere_temp <= 100:
        temp_risk = 0.0
    elif sphere_temp >= 180:
        temp_risk = 100.0
    else:
        temp_risk = ((sphere_temp - 100.0) / 80.0) * 100.0

    # flow_risk: 0 at 2.0 L/min, 100 at 0.5 L/min
    if flow_rate >= 2.0:
        flow_risk = 0.0
    elif flow_rate <= 0.5:
        flow_risk = 100.0
    else:
        flow_risk = ((2.0 - flow_rate) / 1.5) * 100.0

    # pressure_risk: 0 at 500 kPa, 100 at 800 kPa
    if pressure <= 500:
        pressure_risk = 0.0
    elif pressure >= 800:
        pressure_risk = 100.0
    else:
        pressure_risk = ((pressure - 500.0) / 300.0) * 100.0

    # fault_weight: 100 if active_faults_count > 0, else 0
    fault_weight = min(100.0, active_faults_count * 50.0)

    # Formula: health_score = 100 - (temp_risk * 0.35) - (flow_risk * 0.25) - (pressure_risk * 0.20) - (fault_weight * 0.20)
    health_score = 100.0 - (temp_risk * 0.35) - (flow_risk * 0.25) - (pressure_risk * 0.20) - (fault_weight * 0.20)
    return max(0, min(100, int(health_score)))

def process_alerts_and_faults(db: Session, sphere_temp: float, flow_rate: float, pressure: float) -> tuple:
    """
    Evaluates safety rules and updates the DB.
    Returns: (system_status, active_alerts_list)
    """
    timestamp = datetime.datetime.now(datetime.timezone.utc)
    
    # 1. Sphere Temperature Alerts
    temp_alert_active = sphere_temp > 150
    temp_alert_critical = sphere_temp > 180
    
    # 2. Flow Rate Alerts
    flow_alert_critical = flow_rate < 0.5
    
    # 3. Pressure Alerts
    pressure_alert_active = pressure > 800

    # Check for active alerts in DB to prevent duplicates or clear them
    # For simplicity, we query active alerts
    active_db_alerts = db.query(DBAlert).filter(DBAlert.status == "Active").all()
    
    temp_alert_exists = any("Temperature" in a.message for a in active_db_alerts)
    flow_alert_exists = any("Flow" in a.message for a in active_db_alerts)
    pressure_alert_exists = any("Pressure" in a.message for a in active_db_alerts)
    
    # Process Sphere Temperature Alert
    if temp_alert_critical:
        # Update or create CRITICAL
        # Clear warning if exists
        clear_alert_type(db, "Temperature", "WARNING")
        if not any("Temperature" in a.message and a.severity == "CRITICAL" for a in active_db_alerts):
            create_alert(db, timestamp, "CRITICAL", f"Temperature > 180 °C ({sphere_temp:.1f} °C)")
            create_fault_log(db, timestamp, "OVERHEAT", f"Critical sphere temperature detected: {sphere_temp:.1f} °C")
    elif temp_alert_active:
        # Create or update WARNING
        clear_alert_type(db, "Temperature", "CRITICAL")
        if not any("Temperature" in a.message and a.severity == "WARNING" for a in active_db_alerts):
            create_alert(db, timestamp, "WARNING", f"Temperature > 150 °C ({sphere_temp:.1f} °C)")
            create_fault_log(db, timestamp, "TEMP_WARNING", f"High sphere temperature detected: {sphere_temp:.1f} °C")
    else:
        # Normal - Clear any Temperature alert
        clear_alert_type(db, "Temperature")

    # Process Flow Rate Alert
    if flow_alert_critical:
        if not any("Flow" in a.message and a.severity == "CRITICAL" for a in active_db_alerts):
            create_alert(db, timestamp, "CRITICAL", f"Flow < 0.5 L/min ({flow_rate:.2f} L/min)")
            create_fault_log(db, timestamp, "LOW_FLOW", f"Critical low flow rate: {flow_rate:.2f} L/min")
    else:
        clear_alert_type(db, "Flow")

    # Process Pressure Alert
    if pressure_alert_active:
        if not any("Pressure" in a.message and a.severity == "WARNING" for a in active_db_alerts):
            create_alert(db, timestamp, "WARNING", f"Pressure > 800 kPa ({pressure:.0f} kPa)")
            create_fault_log(db, timestamp, "HIGH_PRESSURE", f"High pressure warning: {pressure:.0f} kPa")
    else:
        clear_alert_type(db, "Pressure")

    db.commit()
    
    # Query updated list of alerts and resolve logs if necessary
    updated_alerts = db.query(DBAlert).filter(DBAlert.status == "Active").all()
    
    # Calculate status badge: NORMAL / WARNING / CRITICAL
    if any(a.severity == "CRITICAL" for a in updated_alerts):
        status = "CRITICAL"
    elif any(a.severity == "WARNING" for a in updated_alerts):
        status = "WARNING"
    else:
        status = "NORMAL"
        
    return status, len(updated_alerts)

def create_alert(db: Session, timestamp: datetime.datetime, severity: str, message: str):
    alert = DBAlert(timestamp=timestamp, severity=severity, message=message, status="Active")
    db.add(alert)
    db.flush()

def create_fault_log(db: Session, timestamp: datetime.datetime, fault_type: str, description: str):
    fault = DBFaultLog(timestamp=timestamp, fault_type=fault_type, description=description, resolved=False)
    db.add(fault)
    db.flush()

def clear_alert_type(db: Session, keyword: str, severity: str = None):
    # Find active alerts matching keyword
    query = db.query(DBAlert).filter(DBAlert.status == "Active", DBAlert.message.like(f"%{keyword}%"))
    if severity:
        query = query.filter(DBAlert.severity == severity)
    
    alerts_to_clear = query.all()
    for alert in alerts_to_clear:
        alert.status = "Cleared"
        # Log resolution in fault log
        fault = db.query(DBFaultLog).filter(DBFaultLog.fault_type.like(f"%{keyword.upper()}%"), DBFaultLog.resolved == False).first()
        if fault:
            fault.resolved = True
            fault.description += " (Resolved)"
    db.flush()
