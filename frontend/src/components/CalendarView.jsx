import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Sparkles,
  Users,
  CheckCircle2,
  GitMerge,
  Moon,
} from 'lucide-react';

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function dayKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDayHeading(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function CalendarView({
  events = [],
  clashes = [],
  clubs = [],
  onOpenAddEvent,
  onNavigateTab,
}) {
  const [clubFilter, setClubFilter] = useState('all');
  const [onlyClashes, setOnlyClashes] = useState(false);

  const scheduledEvents = useMemo(() => {
    return events
      .filter((e) => e.status === 'scheduled')
      .filter((e) => {
        if (onlyClashes && !e.hasClash) return false;
        if (clubFilter !== 'all') {
          const primaryId = e.clubId?._id || e.clubId;
          const collabIds = (e.collaboratingClubIds || []).map((c) => c._id || c);
          return primaryId === clubFilter || collabIds.includes(clubFilter);
        }
        return true;
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }, [events, clubFilter, onlyClashes]);

  const groupedByDay = useMemo(() => {
    const map = new Map();
    for (const ev of scheduledEvents) {
      const k = dayKey(ev.startAt);
      if (!map.has(k)) map.set(k, { key: k, label: fmtDayHeading(ev.startAt), items: [] });
      map.get(k).items.push(ev);
    }
    return Array.from(map.values());
  }, [scheduledEvents]);

  const quietClubs = useMemo(() => clubs.filter((c) => c.health?.isQuiet || c.isQuiet), [clubs]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Quiet Club Alert Strip */}
      {quietClubs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Quiet Club Detected:{' '}
                <span className="text-amber-700 dark:text-amber-300">
                  {quietClubs.map((c) => c.name).join(', ')}
                </span>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {quietClubs[0]?.health?.daysSinceLastEvent || 75} days without an event and declining membership (
                {quietClubs[0]?.health?.memberTrendLabel}). Revival plan ready in Agent Proposals.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('agent')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition shrink-0"
          >
            Review Revival Plan
          </button>
        </div>
      )}

      {/* Active Clashes Strip */}
      {clashes.length > 0 ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                {clashes.length} Active Scheduling Clash{clashes.length > 1 ? 'es' : ''} Flagged
              </p>
              <p className="text-xs text-red-700 dark:text-red-300/80 mt-0.5">
                Events highlighted in red below share overlapping times & venues or double-book a club.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('agent')}
            className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition shrink-0"
          >
            Resolve in Agent Panel
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Zero venue or club double-booking clashes across the shared campus calendar.
          </p>
        </div>
      )}

      {/* Filter & Actions Bar */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111111] text-sm font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="all">All Clubs ({clubs.length})</option>
            {clubs.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.health?.isQuiet ? '(Quiet)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => setOnlyClashes((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              onlyClashes
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-gray-50 dark:bg-[#111111] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#262626] hover:border-red-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Clashes Only ({clashes.length})
          </button>
        </div>

        <button
          onClick={onOpenAddEvent}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Schedule Event
        </button>
      </div>

      {/* Club Status Chips Strip (shows Quiet clubs greyed out) */}
      <div className="flex flex-wrap gap-2">
        {clubs.map((c) => {
          const isQuiet = c.health?.isQuiet || c.isQuiet;
          return (
            <button
              key={c._id}
              onClick={() => setClubFilter(clubFilter === c._id ? 'all' : c._id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                isQuiet
                  ? 'bg-gray-100 dark:bg-[#141414] text-gray-400 dark:text-gray-500 border-dashed border-gray-300 dark:border-[#2b2b2b]'
                  : clubFilter === c._id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#1c1c1c] hover:border-blue-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isQuiet ? 'bg-gray-400' : 'bg-emerald-500'
                }`}
              />
              {c.name}
              {isQuiet && <span className="text-[10px] uppercase tracking-wider font-bold">(Quiet)</span>}
            </button>
          );
        })}
      </div>

      {/* Shared Multi-Day Timeline */}
      {groupedByDay.length === 0 ? (
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-10 text-center">
          <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No events match this filter</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedByDay.map((group) => (
            <div key={group.key} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  {group.label}
                </h3>
                <span className="text-xs text-gray-400">({group.items.length} events)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {group.items.map((ev) => {
                  const isQuietHost = ev.clubId?.isQuiet;
                  const isCollab = (ev.collaboratingClubIds || []).length > 0;
                  const openRolesCount = (ev.openRoles || []).filter((r) => r.isOpen).length;

                  return (
                    <div
                      key={ev._id}
                      className={`rounded-2xl border p-4 transition-all ${
                        ev.hasClash
                          ? 'border-red-400 dark:border-red-700 bg-red-50/70 dark:bg-red-950/20 shadow-sm'
                          : isQuietHost
                          ? 'border-gray-200 dark:border-[#1c1c1c] bg-gray-100/80 dark:bg-[#111111] opacity-75'
                          : 'border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a] hover:border-blue-200 dark:hover:border-blue-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                            {ev.clubId?.name || 'Club'}
                            {isCollab && ` × ${ev.collaboratingClubIds.map((c) => c.name).join(', ')}`}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-[#181818] text-gray-600 dark:text-gray-400">
                            {ev.category}
                          </span>
                          {isCollab && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                              <GitMerge className="w-3 h-3" /> Co-Hosted
                            </span>
                          )}
                        </div>

                        {ev.hasClash && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center gap-1 shrink-0">
                            <AlertTriangle className="w-3 h-3" /> CLASH
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                        {ev.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {ev.description}
                      </p>

                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1c1c1c] flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {fmtTime(ev.startAt)} – {fmtTime(ev.endAt)}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {ev.venue}
                          </span>
                        </div>

                        {openRolesCount > 0 && (
                          <button
                            onClick={() => onNavigateTab('volunteers')}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px] flex items-center gap-1 hover:bg-amber-100 transition"
                          >
                            <Users className="w-3 h-3" /> {openRolesCount} Open Role{openRolesCount > 1 ? 's' : ''}
                          </button>
                        )}
                      </div>

                      {ev.hasClash && ev.clashDetails?.[0] && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-red-100/80 dark:bg-red-900/30 text-[11px] text-red-800 dark:text-red-200 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{ev.clashDetails[0].reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
