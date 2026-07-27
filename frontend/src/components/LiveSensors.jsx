import React from 'react';
import { useStore } from '../store';
import { Thermometer, Droplets } from 'lucide-react';

export default function LiveSensors() {
  const telemetry = useStore((state) => state.telemetry);
  const peaks = useStore((state) => state.peaks);

  const formatTime = (isoString) => {
    if (!isoString) return '--:--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  const sensorCards = [
    {
      title: 'SPHERE / HEATER TEMP',
      value: telemetry.sphere_temp.toFixed(1),
      unit: '°C',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      icon: <Thermometer className="w-8 h-8 text-red-500" />,
      min: peaks.sphere_temp.min.toFixed(1),
      max: peaks.sphere_temp.max.toFixed(1),
    },
    {
      title: 'LOOP 1 TEMP (PRIMARY)',
      value: telemetry.loop1_temp.toFixed(1),
      unit: '°C',
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-50',
      icon: <Thermometer className="w-8 h-8 text-orange-400" />,
      min: peaks.loop1_temp.min.toFixed(1),
      max: peaks.loop1_temp.max.toFixed(1),
    },
    {
      title: 'LOOP 2 TEMP (SECONDARY)',
      value: telemetry.loop2_temp.toFixed(1),
      unit: '°C',
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
      icon: <Thermometer className="w-8 h-8 text-emerald-500" />,
      min: peaks.loop2_temp.min.toFixed(1),
      max: peaks.loop2_temp.max.toFixed(1),
    },
    {
      title: 'FLOW RATE',
      value: telemetry.flow_rate.toFixed(2),
      unit: 'L/min',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
      icon: <Droplets className="w-8 h-8 text-blue-500" />,
      min: peaks.flow_rate.min.toFixed(2),
      max: peaks.flow_rate.max.toFixed(2),
    },
  ];

  return (
    <div className="card-section">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-blue-heading uppercase tracking-wide">LIVE SENSOR READINGS</h2>
        <span className="text-[10px] text-slate-500 font-medium font-mono">
          Last Update : {formatTime(telemetry.timestamp)}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {sensorCards.map((card, idx) => (
          <div key={idx} className="flex items-center justify-between border border-slate-100 rounded-lg p-3 hover:shadow-sm transition-all bg-slate-50/30">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgClass} flex items-center justify-center`}>
                {card.icon}
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 tracking-wider block">{card.title}</span>
                <span className={`text-xl font-bold font-mono ${card.colorClass}`}>
                  {card.value} <span className="text-sm font-medium">{card.unit}</span>
                </span>
              </div>
            </div>
            
            <div className="text-right text-[10px] font-medium text-slate-500 flex flex-col justify-center">
              <div>Min : {card.min} {card.unit}</div>
              <div className="mt-1">Max : {card.max} {card.unit}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
