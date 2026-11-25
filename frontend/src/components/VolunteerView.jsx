import React from 'react';
import { AlertTriangle, Award, CheckCircle2, Clock, MapPin, Users } from 'lucide-react';

export default function VolunteerView({ roleMatches = [], volunteers = [], onNavigateTab }) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Open Roles & Ranked Candidates */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Open Event Volunteer Roles ({roleMatches.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Scored by +5 per matching skill, +15 availability window fit, and -40 clash/overload penalty.
            </p>
          </div>
          {roleMatches.length > 0 && (
            <button
              onClick={() => onNavigateTab('agent')}
              className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 dark:bg-[#222222] dark:hover:bg-[#2c2c2c] border border-gray-800 dark:border-[#333333] text-white text-xs font-semibold transition shrink-0"
            >
              Approve Assignments in Agent Panel
            </button>
          )}
        </div>

        {roleMatches.length === 0 ? (
          <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-9 h-9 text-gray-500 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-gray-900 dark:text-white">All event volunteer roles filled</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              No unfilled vacancies remain across scheduled events.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {roleMatches.map((rm) => (
              <div
                key={`${rm.eventId}_${rm.roleId}`}
                className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a2a]">
                      {rm.clubName}
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white mt-1.5">
                      {rm.roleTitle} — <span className="font-medium text-gray-600 dark:text-gray-300">{rm.eventTitle}</span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {rm.windowLabel}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {rm.venue}
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a2a] text-xs font-bold shrink-0">
                    {rm.vacanciesRemaining} Vacancy
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-400 mr-1">Required:</span>
                  {rm.requiredSkills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-[#161616] text-gray-700 dark:text-gray-300"
                    >
                      {sk}
                    </span>
                  ))}
                </div>

                {/* Ranked Candidates */}
                <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-[#1c1c1c]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Ranked Candidates
                  </p>
                  {rm.candidates.map((c, idx) => (
                    <div
                      key={c.volunteerId}
                      className={`p-3 rounded-xl border text-xs ${
                        c.hasConflict
                          ? 'border-gray-300 dark:border-[#2e2e2e] bg-gray-100 dark:bg-[#141414]'
                          : idx === 0
                          ? 'border-gray-300 dark:border-[#303030] bg-gray-50 dark:bg-[#141414]'
                          : 'border-gray-100 dark:border-[#1c1c1c] bg-gray-50 dark:bg-[#111111]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">
                            #{idx + 1} {c.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            ({c.department} · {c.year})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {c.hasConflict ? (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1c1c1c] dark:text-gray-200 dark:border-[#333333] font-bold text-[10px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> OVERLOADED
                            </span>
                          ) : idx === 0 ? (
                            <span className="px-2 py-0.5 rounded-md bg-gray-900 dark:bg-[#262626] border border-gray-800 dark:border-[#3a3a3a] text-white font-bold text-[10px] flex items-center gap-1">
                              <Award className="w-3 h-3" /> BEST FIT
                            </span>
                          ) : null}
                          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] font-bold text-gray-900 dark:text-white tabular-nums">
                            {c.score} pts
                          </span>
                        </div>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 mt-1.5">{c.reason}</p>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {c.breakdown.map((b, bIdx) => (
                          <span
                            key={bIdx}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              b.points < 0
                                ? 'bg-gray-200 dark:bg-[#222222] text-gray-900 dark:text-white'
                                : b.points > 0
                                ? 'bg-gray-100 dark:bg-[#1c1c1c] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-[#2c2c2c]'
                                : 'bg-gray-200 dark:bg-[#222] text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {b.label}: {b.points > 0 ? `+${b.points}` : b.points}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campus Volunteer Directory */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Campus Volunteer Pool ({volunteers.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {volunteers.map((v) => (
            <div
              key={v._id}
              className="p-3 rounded-xl border border-gray-100 dark:border-[#1c1c1c] bg-gray-50/70 dark:bg-[#111111]"
            >
              <p className="text-xs font-bold text-gray-900 dark:text-white">{v.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {v.department} · {v.year}
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {v.skills.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] text-[10px] text-gray-700 dark:text-gray-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
              {v.assignedEventIds?.length > 0 && (
                <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mt-2">
                  Assigned: {v.assignedEventIds.map((e) => e.title || 'Event').join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
