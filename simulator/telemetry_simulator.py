import os
import time
import json
import math
import random
import datetime
import urllib.request
import paho.mqtt.client as mqtt

# Configuration
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "thermal/telemetry"

print(f"Attempting to connect to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
client = mqtt.Client()

connected = False
try:
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()
    connected = True
    print("Connected to Mosquitto Broker successfully.")
except Exception as e:
    print(f"MQTT broker connection failed: {e}. Activating HTTP POST Ingestion fallback.")


# Physical state initialization (Initial values below 80°C)
sphere_temp = 68.0
loop1_temp = 50.0
loop2_temp = 32.0
ambient_temp = 27.6
flow_rate = 2.80
pressure = 412
heater_duty = 68
fan_rpm = 2850

heater_state = True
pump1_state = True
pump2_state = True
fan_state = True

t = 0
dt = 2.0 # 2 seconds simulation step

try:
    while True:
        t += dt
        
        # 1. Update control parameters cyclically to simulate real-world system behavior
        # Heater Duty cycle follows a wave: fluctuates between 55% and 82%
        heater_duty_target = int(68 + 10 * math.sin(t / 80.0) + random.uniform(-1, 1))
        heater_duty = max(10, min(100, heater_duty_target))
        
        # Fan RPM follows a wave: fluctuates around 2850
        fan_rpm_target = int(2850 + 250 * math.cos(t / 60.0) + random.randint(-50, 50))
        fan_rpm = max(1000, min(5000, fan_rpm_target))
        
        # Flow rate: fluctuates around 2.80 L/min
        flow_rate = round(2.80 + 0.25 * math.sin(t / 40.0) + random.uniform(-0.05, 0.05), 2)
        
        # Pressure: proportional to flow rate + pump state
        pressure = int(390 + 8 * flow_rate + random.randint(-5, 5))
        
        # 2. Temperature simulation equations (thermodynamics differential equations)
        # Sphere heats up from MOSFET duty cycle
        heating = (heater_duty / 100.0) * 2.2 * dt if heater_state else 0
        # Sphere cooled by Loop 1 flow
        cooling_sphere = (sphere_temp - loop1_temp) * flow_rate * 0.0055 * dt
        # Ambient cooling (convection)
        ambient_cooling_sphere = (sphere_temp - ambient_temp) * 0.0005 * dt
        
        sphere_temp += heating - cooling_sphere - ambient_cooling_sphere
        
        # Loop 1 absorbs sphere heat and loses heat to Loop 2
        gain_loop1 = (sphere_temp - loop1_temp) * flow_rate * 0.0050 * dt
        loss_loop1 = (loop1_temp - loop2_temp) * flow_rate * 0.0040 * dt
        # Ambient cooling
        ambient_cooling_loop1 = (loop1_temp - ambient_temp) * 0.0008 * dt
        
        loop1_temp += gain_loop1 - loss_loop1 - ambient_cooling_loop1
        
        # Loop 2 absorbs loop 1 heat and loses heat via active fan cooling
        gain_loop2 = (loop1_temp - loop2_temp) * flow_rate * 0.0035 * dt
        loss_loop2 = (loop2_temp - ambient_temp) * (fan_rpm / 3000.0) * 0.0075 * dt
        # Ambient cooling
        ambient_cooling_loop2 = (loop2_temp - ambient_temp) * 0.0005 * dt
        
        loop2_temp += gain_loop2 - loss_loop2 - ambient_cooling_loop2
        
        # Clamp temperatures to physical realities (capped strictly below 80°C)
        sphere_temp = max(20.0, min(79.0, sphere_temp))
        loop1_temp = max(20.0, min(65.0, loop1_temp))
        loop2_temp = max(20.0, min(45.0, loop2_temp))
        
        # 3. Handle anomalies occasionally to show warnings/critical status in UI
        # Every 250 seconds, simulate a temporary flow drop anomaly
        cycle_phase = int(t) % 300
        if 200 <= cycle_phase <= 220:
            flow_rate = round(0.42 + random.uniform(-0.02, 0.02), 2)
            pressure = int(120 + random.randint(-5, 5))
            # Temperature rises since cooling capacity drops
            sphere_temp += 1.8 * dt
            
        # Every 400 seconds, simulate a high temp anomaly (heater spike)
        if 340 <= cycle_phase <= 370:
            heater_duty = 95
            sphere_temp += 2.2 * dt
            
        # Format ISO timestamp
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        
        payload = {
            "timestamp": now_str,
            "sphere_temp": round(sphere_temp, 1),
            "loop1_temp": round(loop1_temp, 1),
            "loop2_temp": round(loop2_temp, 1),
            "flow_rate": flow_rate,
            "pressure": pressure,
            "heater_state": heater_state,
            "pump1_state": pump1_state,
            "pump2_state": pump2_state,
            "fan_state": fan_state,
            "heater_duty": heater_duty,
            "fan_rpm": fan_rpm
        }
        
        # Publish payload
        if connected:
            try:
                client.publish(MQTT_TOPIC, json.dumps(payload))
                print(f"Published Telemetry (MQTT): Temp={payload['sphere_temp']}°C, Flow={payload['flow_rate']} L/min")
            except Exception as mqtt_err:
                print(f"MQTT publish failed: {mqtt_err}. Switching to HTTP fallback.")
                connected = False

        if not connected:
            try:
                data_bytes = json.dumps(payload).encode('utf-8')
                req = urllib.request.Request(
                    "http://localhost:8000/telemetry",
                    data=data_bytes,
                    headers={'Content-Type': 'application/json'}
                )
                with urllib.request.urlopen(req, timeout=2) as response:
                    pass
                print(f"Published Telemetry (HTTP): Temp={payload['sphere_temp']}°C, Flow={payload['flow_rate']} L/min")
            except Exception as http_err:
                print(f"HTTP fallback delivery failed: {http_err}")
        
        time.sleep(dt)
except KeyboardInterrupt:
    print("Simulator stopped.")
finally:
    client.disconnect()
