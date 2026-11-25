import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  GitMerge,
  HeartPulse,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';

const MODULE_META = {
  clash: {
    label: 'Clash',
    icon: AlertTriangle,
    tagClass: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1a1a1a] dark:text-gray-200 dark:border-[#2e2e2e]',
  },
  collaborate: {
    label: 'Collab',
    icon: GitMerge,
    tagClass: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1a1a1a] dark:text-gray-200 dark:border-[#2e2e2e]',
  },
  health: {
    label: 'Revival',
    icon: HeartPulse,
    tagClass: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1a1a1a] dark:text-gray-200 dark:border-[#2e2e2e]',
  },
  match: {
    label: 'Volunteer',
    icon: Users,
    tagClass: 'bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1a1a1a] dark:text-gray-200 dark:border-[#2e2e2e]',
  },
};

function extractConfidenceBadge(scoreBreakdown = []) {
  if (!Array.isArray(scoreBreakdown)) return null;
  const aiItem = scoreBreakdown.find((b) => String(b.label || '').toLowerCase().includes('ai '));
  return aiItem ? String(aiItem.points) : null;
}

function cleanLabel(label = '') {
  return String(label).replace(/\s*\(perplexity\/[^)]+\)/i, '');
}

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
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showBrief, setShowBrief] = useState(false);

  const allPending = useMemo(() => decisions.filter((d) => d.status === 'proposed'), [decisions]);

  const pendingDecisions = useMemo(() => {
    return allPending.filter((d) => (moduleFilter === 'all' ? true : d.agentModule === moduleFilter));
  }, [allPending, moduleFilter]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Compact Toolbar Header */}
      <div className="rounded-2xl border border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-900 dark:bg-[#1f1f1f] border border-gray-800 dark:border-[#2e2e2e] text-white flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Pending Proposals ({pendingDecisions.length})
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2e2e2e]">
                {llmInfo?.configured ? llmInfo.model : 'Tool-Grounded'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Review proposed actions below. Use Details to inspect evidence and scores.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {brief && (
            <button
              onClick={() => setShowBrief((v) => !v)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#111111] text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 transition"
            >
              Summary {showBrief ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Dropdown Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#111111] text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            <option value="all">All Modules ({allPending.length})</option>
            <option value="clash">Clashes</option>
            <option value="collaborate">Collaborations</option>
            <option value="health">Revival Plans</option>
            <option value="match">Volunteer Matches</option>
          </select>

          <button
            onClick={onRunAgent}
            disabled={runningAgent}
            className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-[#222222] dark:hover:bg-[#2c2c2c] border border-gray-800 dark:border-[#333333] disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} />
            {runningAgent ? 'Sensing...' : 'Re-Run Agent'}
          </button>
        </div>
      </div>

      {/* Optional Collapsible Coordinator Summary */}
      {showBrief && brief && (
        <div className="rounded-xl border border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a] px-4 py-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          {brief}
        </div>
      )}

      {/* Compact Proposal Cards with Expandable Dropdown */}
      {pendingDecisions.length === 0 ? (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-10 text-center">
          <Check className="w-9 h-9 text-gray-500 dark:text-gray-400 mx-auto mb-2.5" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">All proposals resolved</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            No pending items in this view. Check the Decision Log for the full audit trail.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendingDecisions.map((item) => {
            const meta = MODULE_META[item.agentModule] || MODULE_META.clash;
            const Icon = meta.icon;
            const isBusy = busyDecisionId === item._id;
            const isExpanded = expandedIds.has(item._id);
            const confidence = extractConfidenceBadge(item.scoreBreakdown);

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl overflow-hidden transition-colors hover:border-gray-300 dark:hover:border-[#2a2a2a]"
              >
                {/* Compact Primary Row */}
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${meta.tagClass}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {confidence && (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                          {confidence} confidence
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{item.decision}</p>
                  </div>

                  {/* Action Cluster + Dropdown Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleExpand(item._id)}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1 transition"
                    >
                      Details
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => onDecide(item._id, 'approved')}
                      disabled={isBusy}
                      className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-[#222222] dark:hover:bg-[#2e2e2e] border border-gray-800 dark:border-[#363636] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isBusy ? 'Applying...' : 'Approve'}
                    </button>

                    <button
                      onClick={() => onDecide(item._id, 'rejected')}
                      disabled={isBusy}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>

                {/* Expandable Dropdown Details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-[#1c1c1c] bg-gray-50/70 dark:bg-[#0f0f0f] px-4 py-3.5 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Full Proposed Action
                      </p>
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{item.decision}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Agent Reasoning & Evidence
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{item.reason}</p>
                    </div>

                    {item.actionPayload?.recruitmentDraft && (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#242424]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                          Drafted Recruitment Post
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                          "{item.actionPayload.recruitmentDraft}"
                        </p>
                      </div>
                    )}

                    {Array.isArray(item.scoreBreakdown) && item.scoreBreakdown.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                          Score & Model Breakdown
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {item.scoreBreakdown.map((b, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-2 rounded-lg bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#222222] flex items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="text-gray-600 dark:text-gray-300 truncate">{cleanLabel(b.label)}</span>
                              <span className="font-bold text-gray-900 dark:text-white tabular-nums shrink-0">
                                {typeof b.points === 'number' && b.points > 0 ? `+${b.points}` : b.points}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
