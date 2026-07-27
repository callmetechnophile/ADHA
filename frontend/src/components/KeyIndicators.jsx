import React from 'react';
import { useStore } from '../store';

function Gauge({ value, max, unit, title, colorClass, strokeColor }) {
  // Semi-circle math
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = 50;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // 157.08
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center flex-1">
      <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider text-center h-8 flex items-center justify-center">
        {title}
      </span>
      
      <div className="relative w-28 h-16">
        <svg className="w-full h-full" viewBox="0 0 120 70">
          {/* Background Track */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active Value Track */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Metric Label */}
        <div className="absolute inset-0 flex flex-col justify-end items-center mb-1">
          <span className="text-sm font-bold font-mono text-slate-800">
            {value.toFixed(value % 1 === 0 ? 0 : 1)}
            <span className="text-[10px] font-medium ml-0.5 text-slate-500">{unit}</span>
          </span>
        </div>
      </div>
      
      {/* Min/Max indicators */}
      <div className="w-24 flex justify-between text-[8px] font-bold text-slate-400 font-mono px-1">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function KeyIndicators() {
  const telemetry = useStore((state) => state.telemetry);
  const history = useStore((state) => state.telemetryHistory);

  // 1. Thermal Efficiency calculation
  // Scales with (Loop 1 Temp - Loop 2 Temp) relative to Sphere Temp
  const dt1 = Math.max(1, telemetry.sphere_temp - 27.6);
  const dt2 = Math.max(0.5, telemetry.loop1_temp - telemetry.loop2_temp);
  let thermalEfficiency = (dt2 / dt1) * 230; // Scale factor to hit ~81% at normal levels
  thermalEfficiency = Math.max(10, Math.min(99, thermalEfficiency));

  // 2. Heat Removal Rate (Watts)
  // Q = flow_rate * constant * (loop1_temp - loop2_temp)
  // At 2.8 L/min and 32.6 dT, we scale to match ~156.3 W
  const heatRemovalRate = telemetry.flow_rate * 1.5 * Math.max(0.5, telemetry.loop1_temp - telemetry.loop2_temp);

  // 3. Flow Stability %
  // Evaluated from flow variance of the last 10 points in history
  let flowStability = 92.0; // Default
  if (history.length >= 5) {
    const lastPoints = history.slice(-10).map(h => h.flow_rate);
    const mean = lastPoints.reduce((s, v) => s + v, 0) / lastPoints.length;
    const variance = lastPoints.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / lastPoints.length;
    const stdDev = Math.sqrt(variance);
    
    // Scale standard deviation: stdDev of 0.05 yields ~95%, stdDev of 0.5 (anomaly) yields ~20%
    flowStability = 100 - (stdDev * 150);
    flowStability = Math.max(5, Math.min(98, flowStability));
  }

  return (
    <div className="card-section">
      <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide mb-3">
        KEY PERFORMANCE INDICATORS
      </h2>
      
      <div className="flex justify-between items-center gap-2">
        <Gauge
          title="Thermal Efficiency"
          value={thermalEfficiency}
          max={100}
          unit="%"
          strokeColor="#10b981" // Green
        />
        <Gauge
          title="Heat Removal Rate"
          value={heatRemovalRate}
          max={300}
          unit="W"
          strokeColor="#f97316" // Orange
        />
        <Gauge
          title="Flow Stability"
          value={flowStability}
          max={100}
          unit="%"
          strokeColor="#2563eb" // Blue
        />
      </div>
    </div>
  );
}
