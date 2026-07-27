import React from 'react';
import { useStore } from '../store';

export default function LiveDataTable() {
  const history = useStore((state) => state.telemetryHistory);

  const formatTime = (isoString) => {
    if (!isoString) return '--:--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--:--';
    }
  };

  // Get latest 8 readings, sorted latest first
  const latestReadings = [...history].reverse().slice(0, 8);

  // Pad table with empty rows if history has fewer than 8 entries
  while (latestReadings.length < 8) {
    latestReadings.push({
      timestamp: null,
      sphere_temp: 0,
      loop1_temp: 0,
      loop2_temp: 0,
      flow_rate: 0,
      pressure: 0,
      heater_duty: 0,
      pump2_state: false,
      fan_rpm: 0,
      isEmpty: true
    });
  }

  return (
    <div className="card-section">
      <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide mb-2">
        LIVE DATA TABLE (LATEST 8 READINGS)
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-[10px] text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-2">Sphere Temp (°C)</th>
              <th className="py-2 px-2">Loop 1 Temp (°C)</th>
              <th className="py-2 px-2">Loop 2 Temp (°C)</th>
              <th className="py-2 px-2">Flow Rate (L/min)</th>
              <th className="py-2 px-2">Pressure (kPa)</th>
              <th className="py-2 px-2">Heater (%)</th>
              <th className="py-2 px-2">Pump 2</th>
              <th className="py-2 px-2 text-right">Fan (RPM)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {latestReadings.map((row, idx) => {
              if (row.isEmpty) {
                return (
                  <tr key={idx} className="h-7 text-slate-300">
                    <td className="py-1 px-3">--:--:--</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2">-</td>
                    <td className="py-1 px-2 text-right">-</td>
                  </tr>
                );
              }

              return (
                <tr key={idx} className="hover:bg-slate-50 text-slate-700 transition-colors">
                  <td className="py-1.5 px-3 font-semibold text-slate-500">
                    {formatTime(row.timestamp)}
                  </td>
                  <td className="py-1.5 px-2 text-rose-600 font-semibold">
                    {row.sphere_temp.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-orange-500 font-semibold">
                    {row.loop1_temp.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-emerald-600 font-semibold">
                    {row.loop2_temp.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-blue-600 font-semibold">
                    {row.flow_rate.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-blue-500">
                    {row.pressure}
                  </td>
                  <td className="py-1.5 px-2 text-purple-600 font-semibold">
                    {row.heater_duty}
                  </td>
                  <td className="py-1.5 px-2">
                    <span className={`font-bold ${row.pump2_state ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {row.pump2_state ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-emerald-600 font-semibold text-right">
                    {row.fan_rpm}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
