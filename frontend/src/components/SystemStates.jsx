import React from 'react';
import { useStore } from '../store';
import { Flame, Database, RotateCw, Wind } from 'lucide-react';

export default function SystemStates() {
  const telemetry = useStore((state) => state.telemetry);

  const states = [
    {
      name: 'Heater (MOSFET)',
      state: telemetry.heater_state,
      icon: <Flame className={`w-5 h-5 ${telemetry.heater_state ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />,
    },
    {
      name: 'Pump 1 (Primary Loop)',
      state: telemetry.pump1_state,
      icon: <RotateCw className={`w-5 h-5 ${telemetry.pump1_state ? 'text-blue-500 animate-spin [animation-duration:3s]' : 'text-slate-400'}`} />,
    },
    {
      name: 'Pump 2 (Secondary Loop)',
      state: telemetry.pump2_state,
      icon: <RotateCw className={`w-5 h-5 ${telemetry.pump2_state ? 'text-emerald-500 animate-spin [animation-duration:3s]' : 'text-slate-400'}`} />,
    },
    {
      name: 'Cooling Fan',
      state: telemetry.fan_state,
      icon: <Wind className={`w-5 h-5 ${telemetry.fan_state ? 'text-teal-500 animate-bounce' : 'text-slate-400'}`} />,
    },
  ];

  return (
    <div className="card-section">
      <h2 className="text-sm font-bold text-blue-heading uppercase tracking-wide mb-3">SYSTEM STATES</h2>
      
      <div className="flex flex-col gap-3">
        {states.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              {item.icon}
              <span className="text-xs font-semibold text-slate-700">{item.name}</span>
            </div>
            
            <span className={`text-xs font-bold font-mono ${item.state ? 'text-emerald-600' : 'text-red-600'}`}>
              {item.state ? 'ON' : 'OFF'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
