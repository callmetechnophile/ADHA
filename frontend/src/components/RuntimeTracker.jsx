import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Clock, Calendar, ShieldCheck, Activity } from 'lucide-react';

export default function RuntimeTracker() {
  const runtimeSeconds = useStore((state) => state.runtimeSeconds);
  const uptimePercent = useStore((state) => state.uptimePercent);
  
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRuntime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return [hours, minutes, seconds]
      .map(v => v < 10 ? "0" + v : v)
      .join(":");
  };

  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`; // DD-MM-YYYY format matching mockup
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const rows = [
    {
      label: 'System Runtime',
      value: formatRuntime(runtimeSeconds),
      icon: <Clock className="w-4 h-4 text-slate-500" />,
    },
    {
      label: 'Date',
      value: formatDate(currentDateTime),
      icon: <Calendar className="w-4 h-4 text-slate-500" />,
    },
    {
      label: 'Time',
      value: formatTime(currentDateTime),
      icon: <Activity className="w-4 h-4 text-slate-500" />,
    },
    {
      label: 'Uptime',
      value: `${uptimePercent.toFixed(1)} %`,
      icon: <ShieldCheck className="w-4 h-4 text-slate-500" />,
    },
  ];

  return (
    <div className="card-section">
      <h2 className="text-sm font-bold text-blue-heading uppercase tracking-wide mb-3">RUNTIME & TIMESTAMP</h2>
      
      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-2">
              {row.icon}
              <span className="text-xs font-semibold text-slate-500">{row.label}</span>
            </div>
            <span className="text-xs font-bold font-mono text-slate-800">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
