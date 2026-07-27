import React, { useEffect } from 'react';
import { useStore } from './store';

// Import sub-components
import LiveSensors from './components/LiveSensors';
import SystemStates from './components/SystemStates';
import RuntimeTracker from './components/RuntimeTracker';
import TrendCharts from './components/TrendCharts';
import LiveDataTable from './components/LiveDataTable';
import KeyIndicators from './components/KeyIndicators';
import AiPredictions from './components/AiPredictions';
import LogsAndAlerts from './components/LogsAndAlerts';

export default function App() {
  const fetchInitialData = useStore((state) => state.fetchInitialData);
  const connectWebSocket = useStore((state) => state.connectWebSocket);
  const systemStatus = useStore((state) => state.systemStatus);
  const isConnected = useStore((state) => state.isConnected);

  useEffect(() => {
    // Load initial logs and establish live telemetry stream
    fetchInitialData();
    const disconnectWS = connectWebSocket();
    return () => {
      disconnectWS();
    };
  }, [fetchInitialData, connectWebSocket]);

  // Determine status badge classes
  const getStatusBadgeClass = () => {
    switch (systemStatus?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-600 text-white animate-pulse';
      case 'WARNING':
        return 'bg-amber-500 text-white';
      case 'NORMAL':
      default:
        return 'bg-emerald-600 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans select-none">
      {/* Top Header */}
      <header className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} title={isConnected ? "WebSocket Connected" : "WebSocket Reconnecting..."}></div>
          <h1 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">
            DUAL LOOP CONTROLLED COOLING SYSTEM – REAL TIME MONITORING DASHBOARD
          </h1>
        </div>
        
        <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-700">
          <span>System Status :</span>
          <span className={`px-3 py-1 rounded font-extrabold tracking-wide text-xs ${getStatusBadgeClass()}`}>
            {systemStatus}
          </span>
        </div>
      </header>

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left Column (Span 3 / 12) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <LiveSensors />
          <SystemStates />
          <RuntimeTracker />
        </div>

        {/* Center Main Column (Span 6 / 12) */}
        <div className="xl:col-span-6 flex flex-col gap-4">
          <TrendCharts />
          <LiveDataTable />
        </div>

        {/* Right Column (Span 3 / 12) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <KeyIndicators />
          {/* <AiPredictions /> */}
          <LogsAndAlerts />
        </div>
      </div>
    </div>
  );
}
