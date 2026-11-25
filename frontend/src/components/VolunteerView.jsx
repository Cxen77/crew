import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Search,
  Users,
} from 'lucide-react';

function CandidateRow({ candidate, rank, expanded, onToggle }) {
  return (
    <div
      className={`rounded-xl border transition-colors ${
        candidate.hasConflict
          ? 'border-gray-300 dark:border-[#2e2e2e] bg-gray-100/70 dark:bg-[#141414]'
          : rank === 1
          ? 'border-gray-300 dark:border-[#323232] bg-gray-50 dark:bg-[#141414]'
          : 'border-gray-200 dark:border-[#202020] bg-white dark:bg-[#0f0f0f]'
      }`}
    >
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              #{rank} {candidate.name}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {candidate.department} · {candidate.year}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
            {candidate.hasConflict
              ? `Conflict: assigned to "${candidate.conflictingEventTitle}"`
              : `Skills: ${candidate.matchedSkills.join(', ')}${candidate.isAvailable ? ' · Available' : ''}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {candidate.hasConflict ? (
            <span className="px-2 py-0.5 rounded-md bg-gray-200 dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#333333] text-gray-800 dark:text-gray-200 font-bold text-[10px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overloaded
            </span>
          ) : rank === 1 ? (
            <span className="px-2 py-0.5 rounded-md bg-gray-900 dark:bg-[#262626] border border-gray-800 dark:border-[#3a3a3a] text-white font-bold text-[10px] flex items-center gap-1">
              <Award className="w-3 h-3" /> Best Fit
            </span>
          ) : null}

          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] text-xs font-bold text-gray-900 dark:text-white tabular-nums">
            {candidate.score} pts
          </span>

          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-[#222222] transition"
            title="Score breakdown"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200/80 dark:border-[#242424] px-3.5 py-3 space-y-2 text-[11px]">
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{candidate.reason}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
            {candidate.breakdown.map((b, idx) => (
              <div
                key={idx}
                className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#181818] border border-gray-200 dark:border-[#262626] flex items-center justify-between gap-2"
              >
                <span className="text-gray-600 dark:text-gray-300 truncate">{b.label}</span>
                <span className="font-bold text-gray-900 dark:text-white tabular-nums shrink-0">
                  {b.points > 0 ? `+${b.points}` : b.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VolunteerView({ roleMatches = [], volunteers = [], onNavigateTab }) {
  const [subTab, setSubTab] = useState('roles'); // 'roles' | 'directory'
  const [search, setSearch] = useState('');
  const [expandedOthers, setExpandedOthers] = useState(() => new Set());
  const [expandedCandidates, setExpandedCandidates] = useState(() => new Set());

  const toggleOtherList = (key) => {
    setExpandedOthers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCandidate = (key) => {
    setExpandedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredVolunteers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return volunteers;
    return volunteers.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        (v.skills || []).some((s) => s.toLowerCase().includes(q))
    );
  }, [volunteers, search]);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Clean Top Bar */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-[#141414] border border-gray-200 dark:border-[#242424] rounded-xl p-1 w-fit">
          <button
            onClick={() => setSubTab('roles')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              subTab === 'roles'
                ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Open Roles ({roleMatches.length})
          </button>
          <button
            onClick={() => setSubTab('directory')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              subTab === 'directory'
                ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Volunteer Pool ({volunteers.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {subTab === 'roles' && (
            <span className="hidden md:inline text-[11px] text-gray-500 dark:text-gray-400">
              Scoring: +5 skill · +15 availability · -40 clash overload
            </span>
          )}
          {roleMatches.length > 0 && (
            <button
              onClick={() => onNavigateTab('agent')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shrink-0"
            >
              Review in Agent Proposals →
            </button>
          )}
        </div>
      </div>

      {/* Sub-view 1: Open Event Roles (Breathable Cards) */}
      {subTab === 'roles' && (
        <>
          {roleMatches.length === 0 ? (
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-12 text-center">
              <CheckCircle2 className="w-9 h-9 text-gray-500 mx-auto mb-2.5" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">All event volunteer roles filled</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                No unfilled vacancies remain across scheduled events.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {roleMatches.map((rm) => {
                const roleKey = `${rm.eventId}_${rm.roleId}`;
                const topCandidate = rm.candidates[0];
                const otherCandidates = rm.candidates.slice(1);
                const showOthers = expandedOthers.has(roleKey);

                return (
                  <div
                    key={roleKey}
                    className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-6 space-y-5"
                  >
                    {/* Role Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a2a]">
                            {rm.clubName}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400">{rm.eventTitle}</span>
                        </div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                          {rm.roleTitle}
                        </h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {rm.windowLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {rm.venue}
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a2a] text-xs font-semibold shrink-0">
                        {rm.vacanciesRemaining} Open
                      </span>
                    </div>

                    {/* Required Skills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-gray-400 mr-1">Required:</span>
                      {rm.requiredSkills.map((sk) => (
                        <span
                          key={sk}
                          className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-[#161616] text-gray-700 dark:text-gray-300 border border-gray-200/70 dark:border-[#242424]"
                        >
                          {sk}
                        </span>
                      ))}
                    </div>

                    {/* Top Recommended Match */}
                    <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-[#1c1c1c]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Recommended Match
                      </p>

                      {topCandidate && (
                        <CandidateRow
                          candidate={topCandidate}
                          rank={1}
                          expanded={expandedCandidates.has(`${roleKey}_${topCandidate.volunteerId}`)}
                          onToggle={() => toggleCandidate(`${roleKey}_${topCandidate.volunteerId}`)}
                        />
                      )}

                      {/* Collapsible Other Candidates */}
                      {otherCandidates.length > 0 && (
                        <div className="space-y-2.5 pt-1">
                          <button
                            onClick={() => toggleOtherList(roleKey)}
                            className="w-full py-2 px-3 rounded-xl border border-gray-200 dark:border-[#222222] bg-gray-50 dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#181818] text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center justify-between transition"
                          >
                            <span>Other Ranked Candidates ({otherCandidates.length})</span>
                            {showOthers ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>

                          {showOthers && (
                            <div className="space-y-2 pt-1">
                              {otherCandidates.map((cand, idx) => (
                                <CandidateRow
                                  key={cand.volunteerId}
                                  candidate={cand}
                                  rank={idx + 2}
                                  expanded={expandedCandidates.has(`${roleKey}_${cand.volunteerId}`)}
                                  onToggle={() => toggleCandidate(`${roleKey}_${cand.volunteerId}`)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sub-view 2: Searchable Volunteer Pool */}
      {subTab === 'directory' && (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Campus Volunteer Pool ({filteredVolunteers.length})
              </h3>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, skill, or dept..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#111111] text-xs text-gray-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVolunteers.map((v) => (
              <div
                key={v._id}
                className="p-4 rounded-xl border border-gray-200/80 dark:border-[#1f1f1f] bg-gray-50/70 dark:bg-[#111111] space-y-2.5"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{v.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {v.department} · {v.year}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {v.skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] text-[11px] text-gray-700 dark:text-gray-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {v.assignedEventIds?.length > 0 && (
                  <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200/70 dark:border-[#222222]">
                    Assigned: {v.assignedEventIds.map((e) => e.title || 'Event').join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
