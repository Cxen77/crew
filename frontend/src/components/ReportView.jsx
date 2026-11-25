import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Layers,
  MapPin,
  Search,
  UserCheck,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchEventReportData, fetchReportEvents, generateEventReport } from '../api/client';

function renderInlineBold(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-gray-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedReport({ markdown }) {
  const lines = String(markdown || '').split('\n');

  return (
    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
      {lines.map((raw, idx) => {
        const line = raw.trim();
        if (!line) return <div key={idx} className="h-1" />;

        if (line.startsWith('# ')) {
          return (
            <h4 key={idx} className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
              {line.slice(2)}
            </h4>
          );
        }

        if (line.startsWith('## ')) {
          return (
            <h5
              key={idx}
              className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-[#1c1c1c]"
            >
              {line.slice(3)}
            </h5>
          );
        }

        if (line.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1 text-xs sm:text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 mt-2 shrink-0" />
              <span>{renderInlineBold(line.slice(2))}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-xs sm:text-sm">
            {renderInlineBold(line)}
          </p>
        );
      })}
    </div>
  );
}

export default function ReportView({ onReportGenerated }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [metaProvider, setMetaProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [rightTab, setRightTab] = useState('teams'); // 'teams' | 'participants'
  const [participantSearch, setParticipantSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchReportEvents();
        setEvents(list);
        const preferred = list.find((e) => e.status === 'completed') || list[0];
        if (preferred) setSelectedEventId(preferred._id);
      } catch (err) {
        toast.error('Failed to load events for report');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    (async () => {
      try {
        const data = await fetchEventReportData(selectedEventId);
        setReportData(data);
        setReportMarkdown(data.event?.generatedReport || '');
      } catch (err) {
        toast.error('Failed to load participant metrics');
      }
    })();
  }, [selectedEventId]);

  const handleGenerate = async () => {
    if (!selectedEventId) return;
    setGenerating(true);
    try {
      const res = await generateEventReport(selectedEventId);
      setReportData(res);
      setReportMarkdown(res.reportMarkdown);
      setMetaProvider(res.provider || 'deterministic-fallback');
      toast.success('Verified event report generated');
      if (onReportGenerated) onReportGenerated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!reportMarkdown || !reportData) return;
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.event.title.replace(/[^a-z0-9]/gi, '_')}_Report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredParticipants = useMemo(() => {
    const list = reportData?.participants || [];
    const q = participantSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.participantName?.toLowerCase().includes(q) ||
        p.department?.toLowerCase().includes(q) ||
        p.teamName?.toLowerCase().includes(q)
    );
  }, [reportData, participantSearch]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-10 text-center text-sm text-gray-500">
        Loading event report data...
      </div>
    );
  }

  const totals = reportData?.totals || {
    totalRegistered: 0,
    attended: 0,
    absent: 0,
    attendanceRate: 0,
    solo: 0,
    preTeamParticipants: 0,
    autoTeamParticipants: 0,
    teams: 0,
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Selector & Actions Header */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[320px] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111111] text-sm font-semibold text-gray-900 dark:text-white focus:outline-none"
            >
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title} ({ev.status.toUpperCase()} · {ev.clubId?.name || 'Club'})
                </option>
              ))}
            </select>
          </div>

          {reportData?.event && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{reportData.event.clubName}</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {reportData.event.venue}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {reportData.event.dateLabel}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={`/api/reports/${selectedEventId}/csv`}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedEventId}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <FileCheck2 className="w-4 h-4" />
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Verified Database Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.totalRegistered}</p>
          <p className="text-[11px] text-gray-400 mt-1">Verified participant rows</p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Attended</span>
            <UserCheck className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {totals.attended}{' '}
            <span className="text-sm font-semibold text-gray-500">({totals.attendanceRate}%)</span>
          </p>
          <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-[#1a1a1a] mt-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-700 dark:bg-gray-300"
              style={{ width: `${Math.min(100, totals.attendanceRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Teams & Auto-Teams</span>
            <Layers className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.teams}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {totals.preTeamParticipants} pre-team · {totals.autoTeamParticipants} auto-team
          </p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Solo Registrants</span>
            <CheckCircle2 className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.solo}</p>
          <p className="text-[11px] text-gray-400 mt-1">{totals.absent} total absent</p>
        </div>
      </div>

      {/* Main 2-Column Balanced Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Formatted Executive Report */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100 dark:border-[#1c1c1c]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Executive Event Report</h3>
              {metaProvider && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#2a2a2a]">
                  {metaProvider}
                </span>
              )}
            </div>
            {reportMarkdown && (
              <button
                onClick={handleDownloadMarkdown}
                className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#141414] text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1e1e1e] flex items-center gap-1 transition"
              >
                <Download className="w-3.5 h-3.5" /> Save .md
              </button>
            )}
          </div>

          {reportMarkdown ? (
            <FormattedReport markdown={reportMarkdown} />
          ) : (
            <div className="py-16 text-center space-y-3">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  No report generated for this event yet
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Click "Generate Report" above to synthesize the verified attendance counts into a structured summary.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Tabbed Team Turnout & Participant Roster */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#141414] border border-gray-200 dark:border-[#242424] rounded-xl p-1">
              <button
                onClick={() => setRightTab('teams')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  rightTab === 'teams'
                    ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Teams ({reportData?.teamsSummary?.length || 0})
              </button>
              <button
                onClick={() => setRightTab('participants')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  rightTab === 'participants'
                    ? 'bg-white dark:bg-[#222222] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                Roster ({reportData?.participants?.length || 0})
              </button>
            </div>
          </div>

          {rightTab === 'teams' ? (
            reportData?.teamsSummary?.length > 0 ? (
              <div className="space-y-2 max-h-[460px] overflow-y-auto custom-scrollbar pr-0.5">
                {reportData.teamsSummary.map((team) => {
                  const pct = team.size > 0 ? Math.round((team.attended / team.size) * 100) : 0;
                  return (
                    <div
                      key={team.teamName}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1f1f1f] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{team.teamName}</p>
                          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                            {team.type === 'auto' ? 'Auto-Matched' : 'Pre-Formed'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] text-xs font-bold text-gray-900 dark:text-white tabular-nums shrink-0">
                          {team.attended}/{team.size}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-gray-200 dark:bg-[#222222] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gray-600 dark:bg-gray-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
                No team-based participant rows recorded for this event.
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  placeholder="Search attendee, dept, or team..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 dark:border-[#242424] bg-gray-50 dark:bg-[#111111] text-xs text-gray-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-0.5">
                {filteredParticipants.length === 0 ? (
                  <p className="py-8 text-center text-xs text-gray-500">No matching participants</p>
                ) : (
                  filteredParticipants.map((p) => (
                    <div
                      key={p._id}
                      className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1f1f1f] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{p.participantName}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {p.department} · {p.teamName || 'Solo'}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                          p.attended
                            ? 'bg-gray-200 dark:bg-[#222222] text-gray-900 dark:text-white'
                            : 'bg-gray-100 dark:bg-[#161616] text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {p.attended ? 'Attended' : 'Absent'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
