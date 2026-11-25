import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  GitMerge,
  Info,
  List,
  MapPin,
  Moon,
  Plus,
  Users,
} from 'lucide-react';

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function dayKey(dateObj) {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDayHeading(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
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
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'agenda'
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState(() => dayKey(new Date()));

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

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of scheduledEvents) {
      const k = dayKey(ev.startAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    }
    return map;
  }, [scheduledEvents]);

  // 14-day (2-week) calendar grid starting from the Monday of the current week + weekOffset
  const gridDays = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({
        date: d,
        key: dayKey(d),
        dayNum: d.getDate(),
        monthShort: d.toLocaleDateString('en-IN', { month: 'short' }),
        isToday: dayKey(d) === dayKey(new Date()),
      });
    }
    return days;
  }, [weekOffset]);

  const rangeLabel = useMemo(() => {
    if (gridDays.length === 0) return '';
    const first = gridDays[0].date;
    const last = gridDays[gridDays.length - 1].date;
    const f = first.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const l = last.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${f} – ${l}`;
  }, [gridDays]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDay.get(selectedDayKey) || [];
  }, [eventsByDay, selectedDayKey]);

  const agendaGroups = useMemo(() => {
    return Array.from(eventsByDay.entries()).map(([key, items]) => ({
      key,
      label: fmtDayHeading(items[0].startAt),
      items,
    }));
  }, [eventsByDay]);

  const quietClubs = useMemo(() => clubs.filter((c) => c.health?.isQuiet || c.isQuiet), [clubs]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Toolbar: Shared Calendar Controls */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Navigation */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#111111] border border-gray-200 dark:border-[#242424] rounded-xl p-1">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#1c1c1c] transition"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setWeekOffset(0);
                setSelectedDayKey(dayKey(new Date()));
              }}
              className="px-2.5 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-white dark:hover:bg-[#1c1c1c] rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-[#1c1c1c] transition"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight px-1">
            {rangeLabel}
          </h3>

          {/* Club Filter */}
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#111111] text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none"
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
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
              onlyClashes
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 dark:bg-[#111111] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-[#242424] hover:border-gray-400'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Clashes ({clashes.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid vs Agenda Switcher */}
          <div className="flex items-center bg-gray-100 dark:bg-[#141414] border border-gray-200 dark:border-[#242424] rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>

          <button
            onClick={onOpenAddEvent}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Schedule Event
          </button>
        </div>
      </div>

      {/* Main Shared Calendar Grid (2-Week Matrix) */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* 7-column Calendar Matrix */}
          <div className="xl:col-span-8 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#1c1c1c] bg-gray-50 dark:bg-[#111111]">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div
                  key={d}
                  className="py-2.5 px-2 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 14 Day Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 dark:divide-[#1c1c1c]">
              {gridDays.map((cell) => {
                const dayEvents = eventsByDay.get(cell.key) || [];
                const isSelected = selectedDayKey === cell.key;
                const hasDayClash = dayEvents.some((e) => e.hasClash);

                return (
                  <div
                    key={cell.key}
                    onClick={() => setSelectedDayKey(cell.key)}
                    className={`min-h-[112px] p-2 cursor-pointer transition-colors flex flex-col ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-[#141923]'
                        : 'bg-white dark:bg-[#0a0a0a] hover:bg-gray-50 dark:hover:bg-[#111111]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold tabular-nums inline-flex items-center justify-center rounded-md px-1.5 py-0.5 ${
                          cell.isToday
                            ? 'bg-blue-600 text-white'
                            : isSelected
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {cell.dayNum === 1 || cell.isToday ? `${cell.monthShort} ${cell.dayNum}` : cell.dayNum}
                      </span>
                      {hasDayClash && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1c1c1c] dark:text-gray-200 dark:border-[#333333]"
                          title="Clash on this day"
                        >
                          Clash
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev._id}
                          className={`px-1.5 py-1 rounded-md text-[10px] leading-tight truncate border ${
                            ev.hasClash
                              ? 'bg-gray-100 text-gray-900 border-gray-300 dark:bg-[#1c1c1c] dark:text-gray-100 dark:border-[#383838] font-semibold'
                              : 'bg-blue-50 dark:bg-[#151b26] text-blue-900 dark:text-blue-200 border-blue-100 dark:border-[#243044] font-medium'
                          }`}
                          title={`${fmtTime(ev.startAt)} · ${ev.title} (${ev.venue})`}
                        >
                          {ev.clubId?.name}: {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] font-semibold text-gray-400 px-1">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Inspector Panel */}
          <div className="xl:col-span-4 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-[#1c1c1c]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Selected Day</p>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {fmtDayHeading(`${selectedDayKey}T12:00:00`)}
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#181818] text-gray-700 dark:text-gray-300 tabular-nums">
                {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarIcon className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  No events scheduled on this day.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-0.5">
                {selectedDayEvents.map((ev) => {
                  const isCollab = (ev.collaboratingClubIds || []).length > 0;
                  const openRolesCount = (ev.openRoles || []).filter((r) => r.isOpen).length;

                  return (
                    <div
                      key={ev._id}
                      className={`rounded-xl border p-3.5 space-y-2 ${
                        ev.hasClash
                          ? 'border-gray-900 dark:border-white/40 bg-gray-50 dark:bg-[#131313]'
                          : 'border-gray-200 dark:border-[#1f1f1f] bg-gray-50/50 dark:bg-[#111111]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
                          {ev.clubId?.name || 'Club'}
                          {isCollab && ` × ${ev.collaboratingClubIds.map((c) => c.name).join(', ')}`}
                        </span>
                        {ev.hasClash && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1c1c1c] dark:text-gray-200 dark:border-[#333333] flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> CLASH
                          </span>
                        )}
                      </div>

                      <h5 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{ev.title}</h5>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fmtTime(ev.startAt)} – {fmtTime(ev.endAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.venue}
                        </span>
                      </div>

                      {openRolesCount > 0 && (
                        <button
                          onClick={() => onNavigateTab('volunteers')}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <Users className="w-3 h-3" /> {openRolesCount} open volunteer role
                          {openRolesCount > 1 ? 's' : ''} →
                        </button>
                      )}

                      {ev.hasClash && ev.clashDetails?.[0] && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-[#191919] border border-gray-200 dark:border-[#2a2a2a] text-[11px] text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{ev.clashDetails[0].reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Agenda List View */
        <div className="space-y-4">
          {agendaGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 px-1">
                {group.label} ({group.items.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((ev) => {
                  const isCollab = (ev.collaboratingClubIds || []).length > 0;
                  return (
                    <div
                      key={ev._id}
                      className={`rounded-2xl border p-4 ${
                        ev.hasClash
                          ? 'border-gray-900 dark:border-white/40 bg-gray-50 dark:bg-[#121212]'
                          : 'border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                            {ev.clubId?.name}
                            {isCollab && ` × ${ev.collaboratingClubIds.map((c) => c.name).join(', ')}`}
                          </span>
                          {isCollab && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                              <GitMerge className="w-3 h-3" /> Co-Hosted
                            </span>
                          )}
                        </div>
                        {ev.hasClash && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-300 dark:bg-[#1c1c1c] dark:text-gray-200 dark:border-[#333333]">
                            CLASH
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white">{ev.title}</h5>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {fmtTime(ev.startAt)} – {fmtTime(ev.endAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {ev.venue}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compact Bottom Status Row (Quiet Club + Clashes Quick Actions) */}
      {(clashes.length > 0 || quietClubs.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clashes.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-[#1c1c1c] bg-white dark:bg-[#0a0a0a] px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-gray-700 dark:text-gray-300 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">{clashes.length} scheduling clashes</strong> ready
                  for resolution
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('agent')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Resolve →
              </button>
            </div>
          )}

          {quietClubs.length > 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-[#2a2a2a] bg-white dark:bg-[#0a0a0a] px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <Moon className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong className="text-gray-900 dark:text-white">
                    {quietClubs.map((c) => c.name).join(', ')}
                  </strong>{' '}
                  flagged Quiet ({quietClubs[0]?.health?.daysSinceLastEvent || 75}d inactive)
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('agent')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Revival Plan →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
