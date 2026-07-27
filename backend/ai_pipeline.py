import os
import datetime
import numpy as np
from sqlalchemy.orm import Session
from models import DBTelemetryData

# Try importing torch; if not available, we use the physics fallback gracefully
TORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    TORCH_AVAILABLE = True
except ImportError:
    pass

class LSTMModel:
    def __init__(self):
        self.input_dim = 4 # sphere_temp, flow_rate, heater_duty, pressure
        self.seq_len = 30  # use last 30 points (60 seconds)
        self.output_dim = 18 # 6 future steps (+0, +2, +4, +6, +8, +10 min) * 3 variables (sphere, loop1, loop2)
        self.model = None
        self.is_trained = False
        
        if TORCH_AVAILABLE:
            class TorchLSTM(nn.Module):
                def __init__(self, input_dim, hidden_dim, num_layers, output_dim):
                    super().__init__()
                    self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True)
                    self.fc = nn.Linear(hidden_dim, output_dim)
                    
                def forward(self, x):
                    out, _ = self.lstm(x)
                    out = self.fc(out[:, -1, :])
                    return out
            self.torch_lstm_class = TorchLSTM

    def train(self, data: list):
        if not TORCH_AVAILABLE or len(data) < (self.seq_len + 10):
            return False
        
        try:
            # Prepare training arrays
            inputs = []
            targets = []
            
            # Format: [sphere_temp, flow_rate, heater_duty, pressure]
            raw_inputs = np.array([[d.sphere_temp, d.flow_rate, d.heater_duty, d.pressure] for d in data])
            raw_targets = np.array([[d.sphere_temp, d.loop1_temp, d.loop2_temp] for d in data])
            
            # Simple scaling to 0-1
            self.in_min = raw_inputs.min(axis=0)
            self.in_max = raw_inputs.max(axis=0)
            self.in_max[self.in_max == self.in_min] += 1.0 # avoid div by zero
            
            self.out_min = raw_targets.min(axis=0)
            self.out_max = raw_targets.max(axis=0)
            self.out_max[self.out_max == self.out_min] += 1.0
            
            scaled_in = (raw_inputs - self.in_min) / (self.in_max - self.in_min)
            scaled_out = (raw_targets - self.out_min) / (self.out_max - self.out_min)
            
            # Sequence windowing
            # For each point i, target is the future 6 points at intervals of 30 steps (60 seconds)
            # Future steps: i, i+60, i+120, i+180, i+240, i+300 (roughly 0, 2, 4, 6, 8, 10 min)
            step_size = 30 # 60 seconds
            for i in range(len(data) - self.seq_len - (step_size * 5)):
                inputs.append(scaled_in[i : i + self.seq_len])
                
                fut_idx = [i + self.seq_len + (step * step_size) for step in range(6)]
                fut_vals = scaled_out[fut_idx].flatten() # len 18
                targets.append(fut_vals)
                
            if len(inputs) == 0:
                return False
                
            X = torch.tensor(np.array(inputs), dtype=torch.float32)
            y = torch.tensor(np.array(targets), dtype=torch.float32)
            
            # Initialize model
            self.model = self.torch_lstm_class(self.input_dim, 64, 2, self.output_dim)
            optimizer = optim.Adam(self.model.parameters(), lr=0.01)
            criterion = nn.MSELoss()
            
            # Train for 15 epochs (fast in-memory training)
            self.model.train()
            for epoch in range(15):
                optimizer.zero_grad()
                outputs = self.model(X)
                loss = criterion(outputs, y)
                loss.backward()
                optimizer.step()
                
            self.is_trained = True
            return True
        except Exception as e:
            print(f"Error training LSTM: {e}")
            return False

    def predict(self, recent_data: list, current_val: dict) -> list:
        # returns 6 points corresponding to +0, +2, +4, +6, +8, +10 minutes
        # each point: {time_offset, predicted_sphere_temp, predicted_loop1_temp, predicted_loop2_temp}
        
        # Check if we can use LSTM model
        if TORCH_AVAILABLE and self.is_trained and len(recent_data) >= self.seq_len:
            try:
                raw_in = np.array([[d.sphere_temp, d.flow_rate, d.heater_duty, d.pressure] for d in recent_data[-self.seq_len:]])
                scaled_in = (raw_in - self.in_min) / (self.in_max - self.in_min)
                
                X = torch.tensor(scaled_in, dtype=torch.float32).unsqueeze(0) # batch size 1
                
                self.model.eval()
                with torch.no_grad():
                    pred_scaled = self.model(X).numpy().flatten()
                    
                # Reshape and unscale
                pred_reshaped = pred_scaled.reshape(6, 3)
                pred_unscaled = pred_reshaped * (self.out_max - self.out_min) + self.out_min
                
                trends = []
                for i in range(6):
                    trends.append({
                        "time_offset": i * 2, # min
                        "predicted_sphere_temp": float(pred_unscaled[i, 0]),
                        "predicted_loop1_temp": float(pred_unscaled[i, 1]),
                        "predicted_loop2_temp": float(pred_unscaled[i, 2])
                    })
                return trends
            except Exception as e:
                print(f"LSTM prediction exception: {e}")
                
        # Physics fallback / Dynamic thermal forecasting
        # Simulates heat increase based on heater duty and cooling based on flow and fans
        sphere = current_val["sphere_temp"]
        loop1 = current_val["loop1_temp"]
        loop2 = current_val["loop2_temp"]
        duty = current_val["heater_duty"]
        flow = current_val["flow_rate"]
        fan_rpm = current_val["fan_rpm"]
        
        trends = []
        for i in range(6):
            minutes = i * 2
            # Simulate progressive thermal evolution
            # Heater adds thermal energy: duty is proportional to heating rate
            heating_rate = (duty / 100.0) * 8.5 # max heating rate in degrees per 2 minutes
            # Fan and liquid flow remove energy
            cooling_rate = (flow / 3.0) * 3.5 + (fan_rpm / 3000.0) * 2.5
            
            # Sphere Temp simulation
            sphere_delta = (heating_rate - cooling_rate) * (minutes / 2.0)
            pred_sphere = max(25.0, sphere + sphere_delta)
            
            # Loop 1 Temp simulation (Heats up with Sphere, cooled by Loop 2 exchange)
            loop1_delta = (0.5 * heating_rate - 0.7 * cooling_rate) * (minutes / 2.0)
            pred_loop1 = max(25.0, loop1 + loop1_delta)
            
            # Loop 2 Temp simulation (Mainly affected by cooling fan speed)
            loop2_delta = (0.2 * heating_rate - 0.9 * cooling_rate) * (minutes / 2.0)
            pred_loop2 = max(25.0, loop2 + loop2_delta)
            
            trends.append({
                "time_offset": minutes,
                "predicted_sphere_temp": round(float(pred_sphere), 1),
                "predicted_loop1_temp": round(float(pred_loop1), 1),
                "predicted_loop2_temp": round(float(pred_loop2), 1)
            })
            
        return trends

# Instantiate global model
ai_model = LSTMModel()

def generate_predictions_and_reasoning(db: Session, current_val: dict) -> dict:
    """
    Retrieves history, runs LSTM model predictions, and generates LLM-style recommendations.
    """
    # 1. Fetch recent history for LSTM input
    history = db.query(DBTelemetryData).order_by(DBTelemetryData.timestamp.desc()).limit(100).all()
    history.reverse()
    
    # 2. Run prediction
    trends = ai_model.predict(history, current_val)
    
    # 3. Calculate risk parameters
    sphere_10min = trends[-1]["predicted_sphere_temp"]
    
    # Calculate time to reach 180°C
    time_to_180 = "N/A"
    overheat_risk = 0.0
    
    # Let's inspect trends to find when it crosses 180°C
    for idx, pt in enumerate(trends):
        temp = pt["predicted_sphere_temp"]
        if temp >= 180.0:
            # Interpolate minutes
            if idx == 0:
                time_to_180 = "00:00 min"
            else:
                prev_temp = trends[idx-1]["predicted_sphere_temp"]
                prev_time = trends[idx-1]["time_offset"]
                # Linear fraction
                frac = (180.0 - prev_temp) / (temp - prev_temp)
                total_min = prev_time + frac * 2.0
                minutes = int(total_min)
                seconds = int((total_min - minutes) * 60)
                time_to_180 = f"{minutes:02d}:{seconds:02d} min"
            overheat_risk = 100.0
            break
            
    if time_to_180 == "N/A":
        # Estimate risk based on final temperature
        if sphere_10min > 150:
            overheat_risk = round(float((sphere_10min - 150) / 30 * 100), 1)
        else:
            overheat_risk = 5.0
            
    # Flow drop probability
    flow_rate = current_val["flow_rate"]
    pressure = current_val["pressure"]
    # flow drop increases if pressure is high or flow rate is already low
    flow_drop_prob = 10.0
    if flow_rate < 1.5:
        flow_drop_prob += 40.0
    if pressure > 600:
        flow_drop_prob += 30.0
    flow_drop_prob = min(95.0, flow_drop_prob)

    # Compute overall health score
    # Query number of active alerts for the health formula
    from alert_engine import compute_health_index
    from models import DBAlert
    active_alerts_count = db.query(DBAlert).filter(DBAlert.status == "Active").count()
    health_index = compute_health_index(current_val["sphere_temp"], flow_rate, pressure, active_alerts_count)

    # 4. Generate Gemma/Nemotron Recommendation reasoning
    recommendation = "System operating within nominal thermal envelopes. Maintain current flow."
    
    if overheat_risk > 60.0:
        if time_to_180 != "N/A":
            recommendation = f"At current thermal rise, system may hit 180°C in {time_to_180}. Increase flow by 15% / Reduce heater load."
        else:
            recommendation = "Thermal trend indicates high probability of overheat. Increase secondary loop flow rate."
    elif flow_rate < 1.0:
        recommendation = "Primary loop flow rate is critical. Check pump 1 cavitation or pipeline blockages immediately."
    elif pressure > 700:
        recommendation = "Secondary loop pressure is elevated. Vent air pockets or throttle primary heater power."
    elif health_index < 75:
        recommendation = "General system degradation. Reduce MOSFET duty cycle to under 50% and activate full fan speeds."

    return {
        "trends": trends,
        "summary": {
            "predicted_sphere_temp": round(float(sphere_10min), 1),
            "predicted_loop1_temp": round(float(trends[-1]["predicted_loop1_temp"]), 1),
            "predicted_loop2_temp": round(float(trends[-1]["predicted_loop2_temp"]), 1),
            "time_to_180": time_to_180,
            "overheat_risk": round(float(overheat_risk), 1),
            "flow_drop_prob": round(float(flow_drop_prob), 1),
            "system_health_index": health_index,
            "recommendation": recommendation
        }
    }
