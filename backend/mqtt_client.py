import os
import json
import datetime
import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session
from database import SessionLocal
from models import DBTelemetryData
from alert_engine import process_alerts_and_faults

# Global list of callback functions to forward messages to WebSocket
ws_callbacks = []

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "thermal/telemetry"

def on_connect(client, userdata, flags, rc):
    print(f"MQTT connected with result code {rc}")
    client.subscribe(MQTT_TOPIC)

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        
        # Ensure timestamp is set
        if not payload.get("timestamp"):
            payload["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            
        timestamp_parsed = datetime.datetime.fromisoformat(payload["timestamp"].replace("Z", "+00:00"))
        
        # Save telemetry to Database
        db = SessionLocal()
        try:
            db_telemetry = DBTelemetryData(
                timestamp=timestamp_parsed,
                sphere_temp=payload["sphere_temp"],
                loop1_temp=payload["loop1_temp"],
                loop2_temp=payload["loop2_temp"],
                flow_rate=payload["flow_rate"],
                pressure=payload["pressure"],
                heater_state=payload["heater_state"],
                pump1_state=payload["pump1_state"],
                pump2_state=payload["pump2_state"],
                fan_state=payload["fan_state"],
                heater_duty=payload["heater_duty"],
                fan_rpm=payload["fan_rpm"]
            )
            db.add(db_telemetry)
            db.flush()
            
            # Run Alert Engine checks
            status, active_alerts = process_alerts_and_faults(
                db, 
                payload["sphere_temp"], 
                payload["flow_rate"], 
                payload["pressure"]
            )
            db.commit()
            
            # Enrich payload for WebSockets
            enriched_payload = {
                **payload,
                "system_status": status,
                "active_alerts_count": active_alerts
            }
            
            # Notify registered WebSocket callbacks
            for callback in ws_callbacks:
                try:
                    callback(enriched_payload)
                except Exception as cb_err:
                    print(f"Error in websocket callback: {cb_err}")
                    
        except Exception as db_err:
            db.rollback()
            print(f"Database insertion error inside MQTT consumer: {db_err}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"Error parsing MQTT message: {e}")

mqtt_client = mqtt.Client()
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

def start_mqtt_client():
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
        print(f"MQTT client started. Listening on {MQTT_BROKER}:{MQTT_PORT} topic '{MQTT_TOPIC}'")
    except Exception as e:
        print(f"Failed to connect MQTT broker at {MQTT_BROKER}:{MQTT_PORT}: {e}")
