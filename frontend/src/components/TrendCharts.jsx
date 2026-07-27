import React from 'react';
import { useStore } from '../store';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export default function TrendCharts() {
  const history = useStore((state) => state.telemetryHistory);
  const telemetry = useStore((state) => state.telemetry);

  const formatXAxis = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  // Process data for Recharts, ensuring ambient temp is included
  const chartData = history.map(d => ({
    ...d,
    ambient_temp: 27.6, // Constant ambient reference matching image
    formattedTime: formatXAxis(d.timestamp)
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Temperature Trends (Large Top Chart) */}
      <div className="card-section">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide">
            TEMPERATURE TRENDS (°C)
          </h2>
          {/* Legend */}
          <div className="flex gap-4 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-red-600 inline-block"></span> Sphere Temp
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-orange-400 inline-block"></span> Loop 1 Temp
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span> Loop 2 Temp
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 border-t-2 border-dotted border-blue-500 inline-block"></span> Ambient Temp
            </span>
          </div>
        </div>

        <div className="flex">
          {/* Chart area */}
          <div className="w-[85%] h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 9 }} stroke="#94a3b8" minTickGap={40} />
                <YAxis domain={[0, 200]} tick={{ fontSize: 9 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
                <Line type="monotone" dataKey="sphere_temp" stroke="#e11d48" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="loop1_temp" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="loop2_temp" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ambient_temp" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-center text-[9px] font-bold text-slate-500 mt-1">Time</div>
          </div>

          {/* Current Values Sidebar */}
          <div className="w-[15%] flex flex-col justify-center pl-3 gap-3 border-l border-slate-100">
            <div>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Sphere</span>
              <span className="text-xs font-bold text-red-600 font-mono">{telemetry.sphere_temp.toFixed(1)} °C</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Loop 1</span>
              <span className="text-xs font-bold text-orange-400 font-mono">{telemetry.loop1_temp.toFixed(1)} °C</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Loop 2</span>
              <span className="text-xs font-bold text-emerald-500 font-mono">{telemetry.loop2_temp.toFixed(1)} °C</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 block uppercase">Ambient</span>
              <span className="text-xs font-bold text-blue-500 font-mono">27.6 °C</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Smaller Trend Charts (2x2 Grid) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Flow Rate Trend */}
        <div className="card-section">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold text-blue-heading uppercase">FLOW RATE TREND (L/min)</h3>
            <span className="text-xs font-bold text-blue-600 font-mono">{telemetry.flow_rate.toFixed(2)} L/min</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 8 }} stroke="#94a3b8" minTickGap={30} />
                <YAxis domain={[0.0, 4.0]} tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <Line type="monotone" dataKey="flow_rate" stroke="#2563eb" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[8px] font-bold text-slate-500 mt-0.5">Time</div>
        </div>

        {/* Heater Duty Cycle */}
        <div className="card-section">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold text-blue-heading uppercase">HEATER POWER (Duty Cycle %)</h3>
            <span className="text-xs font-bold text-purple-600 font-mono">{telemetry.heater_duty} %</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 8 }} stroke="#94a3b8" minTickGap={30} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <Line type="monotone" dataKey="heater_duty" stroke="#9333ea" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[8px] font-bold text-slate-500 mt-0.5">Time</div>
        </div>

        {/* Pressure Trend */}
        <div className="card-section">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold text-blue-heading uppercase">PRESSURE TREND (kPa)</h3>
            <span className="text-xs font-bold text-blue-600 font-mono">{telemetry.pressure} kPa</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 8 }} stroke="#94a3b8" minTickGap={30} />
                <YAxis domain={[0, 1000]} tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <Line type="monotone" dataKey="pressure" stroke="#0284c7" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[8px] font-bold text-slate-500 mt-0.5">Time</div>
        </div>

        {/* Fan Speed RPM */}
        <div className="card-section">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xs font-bold text-blue-heading uppercase">FAN SPEED (RPM)</h3>
            <span className="text-xs font-bold text-emerald-600 font-mono">{telemetry.fan_rpm} RPM</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="formattedTime" tick={{ fontSize: 8 }} stroke="#94a3b8" minTickGap={30} />
                <YAxis domain={[0, 5000]} tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <Line type="monotone" dataKey="fan_rpm" stroke="#059669" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center text-[8px] font-bold text-slate-500 mt-0.5">Time</div>
        </div>
      </div>
    </div>
  );
}
