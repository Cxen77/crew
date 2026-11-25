import React from 'react';
import {
  Activity,
  AlertCircle,
  CalendarClock,
  MessageSquare,
  Moon,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

export default function ClubsView({ clubs = [], onNavigateTab }) {
  const sorted = [...clubs].sort((a, b) => {
    const qa = a.health?.isQuiet ? 0 : 1;
    const qb = b.health?.isQuiet ? 0 : 1;
    if (qa !== qb) return qa - qb;
    return (a.health?.healthScore ?? 100) - (b.health?.healthScore ?? 100);
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((club) => {
          const h = club.health || {};
          const isQuiet = h.isQuiet || club.isQuiet;
          const score = h.healthScore ?? club.healthScore ?? 100;
          const isFalling = (h.memberDelta ?? 0) < 0;

          return (
            <div
              key={club._id}
              className={`rounded-2xl border p-5 transition-colors flex flex-col justify-between ${
                isQuiet
                  ? 'border-dashed border-gray-300 dark:border-[#2c2c2c] bg-gray-100/80 dark:bg-[#111111]'
                  : 'border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a] hover:border-gray-300 dark:hover:border-[#2e2e2e]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {club.category}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{club.name}</h3>
                  </div>

                  {isQuiet ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-200 dark:bg-[#1f1f1f] text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-[#2e2e2e] flex items-center gap-1">
                      <Moon className="w-3 h-3" /> Quiet
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2c2c2c] flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Healthy
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  {club.description}
                </p>

                {/* Health Score Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Club Health Score</span>
                    <span className="font-bold tabular-nums text-gray-900 dark:text-white">
                      {score}/100
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-[#1f1f1f] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score < 50 ? 'bg-gray-500' : 'bg-gray-700 dark:bg-gray-400'
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4 tabular-nums">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#1c1c1c]">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      <CalendarClock className="w-3 h-3" /> Last Event
                    </div>
                    <p className="text-xs font-bold mt-1 text-gray-900 dark:text-white">
                      {h.daysSinceLastEvent ?? 0}d ago
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#1c1c1c]">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      {isFalling ? (
                        <TrendingDown className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <TrendingUp className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      )}
                      Members
                    </div>
                    <p className="text-xs font-bold mt-1 text-gray-900 dark:text-white">
                      {h.startMemberCount ?? club.memberCount} → {h.currentMemberCount ?? club.memberCount}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#141414] border border-gray-100 dark:border-[#1c1c1c]">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      <MessageSquare className="w-3 h-3" /> 30d Posts
                    </div>
                    <p className="text-xs font-bold mt-1 text-gray-900 dark:text-white">
                      {h.postsLast30Days ?? club.postsLast30Days ?? 0}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(club.tags || []).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-[#161616] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#262626]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {isQuiet && (
                <div className="pt-3 border-t border-gray-200 dark:border-[#262626] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Revival suggested
                  </span>
                  <button
                    onClick={() => onNavigateTab('agent')}
                    className="text-xs font-semibold text-gray-700 dark:text-gray-200 hover:underline"
                  >
                    View Plan →
                  </button>
                </div>
              )}

              {!isQuiet && club.recruitmentDraft && (
                <div className="pt-3 border-t border-gray-100 dark:border-[#1c1c1c]">
                  <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Revival Recruitment Draft Active
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
