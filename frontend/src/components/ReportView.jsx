import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileCheck2, FileText, Layers, UserCheck, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchEventReportData, fetchReportEvents, generateEventReport } from '../api/client';

export default function ReportView({ onReportGenerated }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [metaProvider, setMetaProvider] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-8 text-center text-sm text-gray-500">
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
    <div className="space-y-6 animate-fadeIn">
      {/* Selector & Actions */}
      <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Select Event for Post-Event Report
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full md:max-w-md px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#111111] text-sm font-semibold text-gray-900 dark:text-white"
          >
            {events.map((ev) => (
              <option key={ev._id} value={ev._id}>
                {ev.title} ({ev.status.toUpperCase()} · {ev.clubId?.name || 'Club'})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`/api/reports/${selectedEventId}/csv`}
            className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#111111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] text-xs font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            Export Attendance CSV
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
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.totalRegistered}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Verified participant rows</p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Attended</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {totals.attended}{' '}
            <span className="text-sm font-semibold text-gray-500">({totals.attendanceRate}%)</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">{totals.absent} absent / no-show</p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Teams & Auto-Teams</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.teams}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {totals.preTeamParticipants} pre-team · {totals.autoTeamParticipants} auto-team
          </p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Solo Registrants</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{totals.solo}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Individual participants</p>
        </div>
      </div>

      {/* Generated Report + Team Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-6">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-gray-100 dark:border-[#1c1c1c]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">One-Page Executive Event Report</h3>
              {metaProvider && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                  {metaProvider}
                </span>
              )}
            </div>
            {reportMarkdown && (
              <button
                onClick={handleDownloadMarkdown}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Save .md
              </button>
            )}
          </div>

          {reportMarkdown ? (
            <div className="mt-4 whitespace-pre-wrap font-sans text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {reportMarkdown}
            </div>
          ) : (
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Click "Generate Report" to compile the verified metrics above into a coordinator-ready summary.
              </p>
            </div>
          )}
        </div>

        {/* Team Turnout Table */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-5">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Verified Team Turnout</h4>
          {reportData?.teamsSummary?.length > 0 ? (
            <div className="space-y-2.5">
              {reportData.teamsSummary.map((team) => (
                <div
                  key={team.teamName}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-[#111111] border border-gray-100 dark:border-[#1c1c1c] flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{team.teamName}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                      {team.type === 'auto' ? 'Auto-Matched Team' : 'Pre-Formed Team'}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#262626] text-xs font-bold text-gray-900 dark:text-white tabular-nums">
                    {team.attended}/{team.size}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No team-based participant rows recorded for this event yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
