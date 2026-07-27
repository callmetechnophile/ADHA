import { create } from 'zustand';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws/live';

export const useStore = create((set, get) => ({
  // Connection states
  isConnected: false,
  systemStatus: 'NORMAL', // NORMAL, WARNING, CRITICAL
  
  // Real-time Telemetry
  telemetry: {
    sphere_temp: 128.4,
    loop1_temp: 74.8,
    loop2_temp: 42.2,
    flow_rate: 2.80,
    pressure: 412,
    heater_state: true,
    pump1_state: true,
    pump2_state: true,
    fan_state: true,
    heater_duty: 68,
    fan_rpm: 2850,
    timestamp: new Date().toISOString()
  },
  
  // Peak (Min/Max) tracking
  peaks: {
    sphere_temp: { min: 27.4, max: 164.2 },
    loop1_temp: { min: 26.8, max: 98.7 },
    loop2_temp: { min: 26.1, max: 63.4 },
    flow_rate: { min: 0.00, max: 3.45 }
  },

  // Runtime and system details
  runtimeSeconds: 807, // 00:13:27 equivalent
  uptimePercent: 100.0,
  
  // Historic logs
  telemetryHistory: [],
  alerts: [],
  faultLogs: [],
  
  // AI Predictions
  aiPrediction: {
    trends: [
      { time_offset: 0, predicted_sphere_temp: 128.4, predicted_loop1_temp: 74.8, predicted_loop2_temp: 42.2 },
      { time_offset: 2, predicted_sphere_temp: 135.0, predicted_loop1_temp: 78.0, predicted_loop2_temp: 43.5 },
      { time_offset: 4, predicted_sphere_temp: 142.5, predicted_loop1_temp: 81.0, predicted_loop2_temp: 44.2 },
      { time_offset: 6, predicted_sphere_temp: 151.0, predicted_loop1_temp: 83.2, predicted_loop2_temp: 45.0 },
      { time_offset: 8, predicted_sphere_temp: 160.5, predicted_loop1_temp: 85.5, predicted_loop2_temp: 45.8 },
      { time_offset: 10, predicted_sphere_temp: 172.8, predicted_loop1_temp: 88.0, predicted_loop2_temp: 46.5 }
    ],
    summary: {
      predicted_sphere_temp: 172.8,
      predicted_loop1_temp: 88.0,
      predicted_loop2_temp: 46.5,
      time_to_180: "07:36 min",
      overheat_risk: 72.4,
      flow_drop_prob: 18.7,
      system_health_index: 81,
      recommendation: "Increase Flow / Reduce Heater Load"
    }
  },

  // Actions
  setConnected: (status) => set({ isConnected: status }),
  
  fetchInitialData: async () => {
    try {
      // Fetch History
      const histRes = await fetch(`${API_BASE}/history?limit=50`);
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData && histData.length > 0) {
          set({ telemetryHistory: histData });
          // Update peaks based on fetched history
          const peaks = { ...get().peaks };
          histData.forEach(d => {
            peaks.sphere_temp.min = Math.min(peaks.sphere_temp.min, d.sphere_temp);
            peaks.sphere_temp.max = Math.max(peaks.sphere_temp.max, d.sphere_temp);
            peaks.loop1_temp.min = Math.min(peaks.loop1_temp.min, d.loop1_temp);
            peaks.loop1_temp.max = Math.max(peaks.loop1_temp.max, d.loop1_temp);
            peaks.loop2_temp.min = Math.min(peaks.loop2_temp.min, d.loop2_temp);
            peaks.loop2_temp.max = Math.max(peaks.loop2_temp.max, d.loop2_temp);
            peaks.flow_rate.min = Math.min(peaks.flow_rate.min, d.flow_rate);
            peaks.flow_rate.max = Math.max(peaks.flow_rate.max, d.flow_rate);
          });
          set({ peaks });
        }
      }
      
      // Fetch Alerts
      const alertsRes = await fetch(`${API_BASE}/alerts`);
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        set({ alerts: alertsData });
      }
      
      // Fetch Faults
      const faultsRes = await fetch(`${API_BASE}/faults`);
      if (faultsRes.ok) {
        const faultsData = await faultsRes.json();
        set({ faultLogs: faultsData });
      }
    } catch (e) {
      console.warn("Could not connect to FastAPI server. Working with mock data.", e);
    }
  },

  updateTelemetry: (data) => {
    const peaks = { ...get().peaks };
    
    // Update dynamic peaks
    peaks.sphere_temp.min = Math.min(peaks.sphere_temp.min, data.sphere_temp);
    peaks.sphere_temp.max = Math.max(peaks.sphere_temp.max, data.sphere_temp);
    peaks.loop1_temp.min = Math.min(peaks.loop1_temp.min, data.loop1_temp);
    peaks.loop1_temp.max = Math.max(peaks.loop1_temp.max, data.loop1_temp);
    peaks.loop2_temp.min = Math.min(peaks.loop2_temp.min, data.loop2_temp);
    peaks.loop2_temp.max = Math.max(peaks.loop2_temp.max, data.loop2_temp);
    peaks.flow_rate.min = Math.min(peaks.flow_rate.min, data.flow_rate);
    peaks.flow_rate.max = Math.max(peaks.flow_rate.max, data.flow_rate);

    set((state) => {
      // Append to history, keeping max 50 points
      const newHistory = [...state.telemetryHistory, data].slice(-50);
      return {
        telemetry: data,
        peaks,
        telemetryHistory: newHistory,
        systemStatus: data.system_status || 'NORMAL'
      };
    });
  },

  incrementRuntime: () => {
    set((state) => ({ runtimeSeconds: state.runtimeSeconds + 1 }));
  },

  connectWebSocket: () => {
    let ws = null;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log("WebSocket connected.");
        set({ isConnected: true });
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'init') {
            if (message.latest_data) {
              get().updateTelemetry(message.latest_data);
            }
            if (message.history && message.history.length > 0) {
              set({ telemetryHistory: message.history });
            }
            if (message.prediction) {
              set({ aiPrediction: message.prediction });
            }
          } else if (message.type === 'telemetry') {
            get().updateTelemetry(message.data);
            if (message.prediction) {
              set({ aiPrediction: message.prediction });
            }
            
            // Re-fetch alerts & faults occasionally on telemetry to keep logs in sync
            fetch(`${API_BASE}/alerts`)
              .then(r => r.json())
              .then(data => set({ alerts: data }))
              .catch(() => {});
              
            fetch(`${API_BASE}/faults`)
              .then(r => r.json())
              .then(data => set({ faultLogs: data }))
              .catch(() => {});
          }
        } catch (e) {
          console.error("Error processing websocket payload:", e);
        }
      };
      
      ws.onclose = () => {
        console.log("WebSocket disconnected. Retrying in 5 seconds...");
        set({ isConnected: false });
        setTimeout(connect, 5000);
      };
      
      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        ws.close();
      };
    };
    
    connect();
    
    // Increment runtime counter in background
    const interval = setInterval(() => {
      get().incrementRuntime();
    }, 1000);
    
    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }
}));
