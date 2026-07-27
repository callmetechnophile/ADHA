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

export default function AiPredictions() {
  const prediction = useStore((state) => state.aiPrediction);

  const chartData = prediction.trends.map(pt => {
    let label = `+${pt.time_offset} min`;
    if (pt.time_offset === 0) label = 'Now';
    return {
      ...pt,
      label
    };
  });

  const {
    predicted_sphere_temp,
    predicted_loop1_temp,
    predicted_loop2_temp,
    time_to_180,
    overheat_risk,
    flow_drop_prob,
    system_health_index,
    recommendation
  } = prediction.summary;

  return (
    <div className="card-section">
      <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide mb-3">
        AI PREDICTION – FUTURE EXPECTANCY (Next 10 Minutes)
      </h2>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Side: Prediction Line Chart */}
        <div className="w-full md:w-1/2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
            PREDICTED TRENDS
          </span>
          <div className="h-44 text-[8px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <YAxis domain={[0, 200]} tick={{ fontSize: 8 }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: '9px' }} />
                <Line
                  type="monotone"
                  dataKey="predicted_sphere_temp"
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  name="Pred Sphere Temp"
                />
                <Line
                  type="monotone"
                  dataKey="predicted_loop1_temp"
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  name="Pred Loop 1 Temp"
                />
                <Line
                  type="monotone"
                  dataKey="predicted_loop2_temp"
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  name="Pred Loop 2 Temp"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Side: Prediction Summary */}
        <div className="w-full md:w-1/2 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">
              PREDICTION SUMMARY
            </span>

            <div className="flex flex-col gap-1.5 text-[10px]">
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-semibold">Sphere Temp (10 min)</span>
                <span className="font-bold text-red-600 font-mono">{predicted_sphere_temp.toFixed(1)} °C</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-semibold">Time to reach 180 °C</span>
                <span className={`font-bold font-mono ${time_to_180 !== 'N/A' ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
                  {time_to_180}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-semibold">Overheat Risk</span>
                <span className={`font-bold font-mono ${overheat_risk > 50 ? 'text-red-600' : 'text-slate-700'}`}>
                  {overheat_risk.toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-slate-50">
                <span className="text-slate-500 font-semibold">Flow Drop Probability</span>
                <span className={`font-bold font-mono ${flow_drop_prob > 50 ? 'text-red-500 font-semibold' : 'text-emerald-600'}`}>
                  {flow_drop_prob.toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500 font-semibold">System Health Index</span>
                <span className={`font-bold font-mono ${system_health_index < 70 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {system_health_index} / 100
                </span>
              </div>
            </div>
          </div>

          {/* Recommendation Box */}
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded p-2 flex flex-col justify-center">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              AI Recommendation
            </span>
            <p className="text-[10px] font-bold text-slate-700 leading-tight">
              {recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
