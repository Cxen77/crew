import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Check,
  GitMerge,
  HeartPulse,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const MODULE_META = {
  clash: {
    label: 'Clash Resolution',
    icon: AlertTriangle,
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
  },
  collaborate: {
    label: 'Club Collaboration',
    icon: GitMerge,
    badgeClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60',
  },
  health: {
    label: 'Club Revival Plan',
    icon: HeartPulse,
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
  },
  match: {
    label: 'Volunteer Match',
    icon: Users,
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
  },
};

export default function AgentPanel({
  decisions = [],
  brief = '',
  llmInfo,
  onDecide,
  busyDecisionId,
  onRunAgent,
  runningAgent,
}) {
  const [moduleFilter, setModuleFilter] = useState('all');

  const pendingDecisions = useMemo(() => {
    return decisions
      .filter((d) => d.status === 'proposed')
      .filter((d) => (moduleFilter === 'all' ? true : d.agentModule === moduleFilter));
  }, [decisions, moduleFilter]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Sense -> Think -> Act Coordinator Brief */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50 to-white dark:from-[#0f172a] dark:to-[#0a0a0a] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Agent Reasoning Loop (Sense → Think → Act → Explain)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  {llmInfo?.configured ? `LLM: ${llmInfo.provider}` : 'Tool-Grounded Synthesizer'}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1.5 leading-relaxed">
                {brief ||
                  'Agent sensed live clubs, calendar windows, and volunteer skills. Review each explained proposal below and approve or reject to execute.'}
              </p>
            </div>
          </div>

          <button
            onClick={onRunAgent}
            disabled={runningAgent}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-2 shrink-0 shadow-sm transition"
          >
            <Sparkles className={`w-4 h-4 ${runningAgent ? 'animate-spin' : ''}`} />
            {runningAgent ? 'Sensing...' : 'Re-Run Agent Loop'}
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: 'All Pending' },
          { id: 'clash', label: 'Clashes' },
          { id: 'collaborate', label: 'Collaborations' },
          { id: 'health', label: 'Revival Plans' },
          { id: 'match', label: 'Volunteer Matches' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setModuleFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              moduleFilter === tab.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-[#0a0a0a] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-[#1c1c1c] hover:border-blue-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pending Proposals List */}
      {pendingDecisions.length === 0 ? (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-10 text-center">
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-base font-bold text-gray-900 dark:text-white">All proposals resolved!</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No pending agent proposals in this category. Check the Decision Log for the full audit trail.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pendingDecisions.map((item) => {
            const meta = MODULE_META[item.agentModule] || MODULE_META.clash;
            const Icon = meta.icon;
            const isBusy = busyDecisionId === item._id;

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/50 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    {/* Header badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1.5 ${meta.badgeClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 dark:bg-[#161616] text-gray-600 dark:text-gray-400">
                        Status: Proposed (Awaiting Human)
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-gray-900 dark:text-white">{item.title}</h4>

                    {/* Proposed Action */}
                    <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1c1c1c]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Proposed Action
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.decision}</p>
                    </div>

                    {/* Plain-Language Explainability */}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Agent Explanation & Evidence
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{item.reason}</p>
                    </div>

                    {/* Recruitment Draft if present */}
                    {item.actionPayload?.recruitmentDraft && (
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-1">
                          Drafted Recruitment Post
                        </p>
                        <p className="text-xs text-gray-800 dark:text-gray-200 italic">
                          "{item.actionPayload.recruitmentDraft}"
                        </p>
                      </div>
                    )}

                    {/* Score / Rule Breakdown */}
                    {Array.isArray(item.scoreBreakdown) && item.scoreBreakdown.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.scoreBreakdown.map((b, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] font-medium text-blue-800 dark:text-blue-200"
                          >
                            {b.label}:{' '}
                            <strong className="font-bold">
                              {typeof b.points === 'number' && b.points > 0 ? `+${b.points}` : b.points}
                            </strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Coordinator Controls */}
                  <div className="flex sm:flex-row lg:flex-col gap-2.5 shrink-0 lg:w-44">
                    <button
                      onClick={() => onDecide(item._id, 'approved')}
                      disabled={isBusy}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Check className="w-4 h-4" />
                      {isBusy ? 'Applying...' : 'Approve & Execute'}
                    </button>
                    <button
                      onClick={() => onDecide(item._id, 'rejected')}
                      disabled={isBusy}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#111111] hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-700 dark:text-gray-300 hover:text-red-600 border border-gray-200 dark:border-[#262626] hover:border-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
