import React, { useState } from 'react';
import { CheckCircle2, Clock, History, XCircle } from 'lucide-react';

export default function DecisionLogView({ decisions = [] }) {
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = decisions.filter((d) => (statusFilter === 'all' ? true : d.status === statusFilter));

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Agent Audit Trail & Decision Log ({filtered.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Every observation, reasoning score, proposal, and human approval decision recorded chronologically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {['all', 'proposed', 'approved', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition ${
                statusFilter === st
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 dark:bg-[#111111] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#262626]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((entry) => {
          const isApproved = entry.status === 'approved';
          const isRejected = entry.status === 'rejected';

          return (
            <div
              key={entry._id}
              className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300">
                    {entry.agentModule}
                  </span>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">{entry.title}</h4>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 capitalize ${
                    isApproved
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : isRejected
                      ? 'bg-gray-100 dark:bg-[#1f1f1f] text-gray-600 dark:text-gray-400'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {isApproved ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isRejected ? (
                    <XCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Clock className="w-3.5 h-3.5" />
                  )}
                  {entry.status}
                </span>
              </div>

              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{entry.decision}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{entry.reason}</p>

              <div className="pt-2 border-t border-gray-100 dark:border-[#1c1c1c] flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400">
                <span>
                  {entry.executionNote || 'Awaiting coordinator review'}
                  {entry.decidedBy ? ` · Decided by ${entry.decidedBy}` : ''}
                </span>
                <span>{new Date(entry.decidedAt || entry.createdAt).toLocaleString('en-IN')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
