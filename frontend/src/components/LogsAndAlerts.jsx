import React from 'react';
import { useStore } from '../store';

export default function LogsAndAlerts() {
  const alerts = useStore((state) => state.alerts);
  const faultLogs = useStore((state) => state.faultLogs);

  const formatTime = (isoString) => {
    if (!isoString) return '--:--:--';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return '--:--:--';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'text-rose-600 font-bold';
      case 'WARNING':
        return 'text-amber-500 font-bold';
      case 'INFO':
      default:
        return 'text-blue-500 font-semibold';
    }
  };

  const getStatusColor = (status) => {
    if (status?.toLowerCase() === 'active') {
      return 'text-rose-600 font-bold animate-pulse';
    }
    return 'text-emerald-600 font-medium';
  };

  // Safe slice to prevent huge arrays from breaking layout
  const visibleAlerts = alerts.slice(0, 5);
  const visibleFaults = faultLogs.slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Alerts & Events Section */}
      <div className="card-section">
        <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide mb-2">
          ALERTS & EVENTS
        </h2>
        
        <div className="overflow-y-auto max-h-40">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <th className="py-1 px-2">Time</th>
                <th className="py-1 px-2">Severity</th>
                <th className="py-1 px-2">Message</th>
                <th className="py-1 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {visibleAlerts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    No active alerts or events
                  </td>
                </tr>
              ) : (
                visibleAlerts.map((alert, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1 px-2 text-slate-500">{formatTime(alert.timestamp)}</td>
                    <td className={`py-1 px-2 ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </td>
                    <td className="py-1 px-2 text-slate-700">{alert.message}</td>
                    <td className={`py-1 px-2 ${getStatusColor(alert.status)}`}>
                      {alert.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Fault Log Section */}
      <div className="card-section">
        <h2 className="text-xs font-bold text-blue-heading uppercase tracking-wide mb-2">
          FAULT LOG
        </h2>
        
        <div className="overflow-y-auto max-h-40">
          <table className="w-full text-[9px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <th className="py-1 px-2">Time</th>
                <th className="py-1 px-2">Severity</th>
                <th className="py-1 px-2">Message</th>
                <th className="py-1 px-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {visibleFaults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    Fault log empty
                  </td>
                </tr>
              ) : (
                visibleFaults.map((fault, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-1 px-2 text-slate-500">{formatTime(fault.timestamp)}</td>
                    <td className={`py-1 px-2 ${fault.fault_type === 'LOW_FLOW' || fault.fault_type === 'OVERHEAT' ? 'text-rose-600 font-bold' : 'text-amber-500 font-bold'}`}>
                      {fault.fault_type === 'LOW_FLOW' || fault.fault_type === 'OVERHEAT' ? 'CRITICAL' : 'WARNING'}
                    </td>
                    <td className="py-1 px-2 text-slate-700">{fault.description}</td>
                    <td className="py-1 px-2 text-emerald-600 font-medium">
                      {fault.resolved ? 'Cleared' : 'Active'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
