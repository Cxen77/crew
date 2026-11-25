import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar,
  Command,
  Cpu,
  FileText,
  History,
  LayoutGrid,
  Menu,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import {
  fetchAgentStatus,
  fetchClubs,
  fetchDecisions,
  fetchEvents,
  fetchVenues,
  fetchVolunteers,
  resetDemoScenario,
  runAgentSync,
  submitDecision,
} from './api/client';
import CalendarView from './components/CalendarView';
import AgentPanel from './components/AgentPanel';
import ClubsView from './components/ClubsView';
import VolunteerView from './components/VolunteerView';
import ReportView from './components/ReportView';
import DecisionLogView from './components/DecisionLogView';
import AddEventModal from './components/AddEventModal';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [runningAgent, setRunningAgent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [busyDecisionId, setBusyDecisionId] = useState(null);

  const [agentStatus, setAgentStatus] = useState(null);
  const [brief, setBrief] = useState('');
  const [eventsData, setEventsData] = useState({ events: [], clashes: [] });
  const [clubs, setClubs] = useState([]);
  const [volunteersData, setVolunteersData] = useState({ volunteers: [], roleMatches: [] });
  const [decisions, setDecisions] = useState([]);
  const [venues, setVenues] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [statusRes, evRes, clubsRes, volRes, decRes, venRes] = await Promise.all([
        fetchAgentStatus(),
        fetchEvents(),
        fetchClubs(),
        fetchVolunteers(),
        fetchDecisions(),
        fetchVenues(),
      ]);

      setAgentStatus(statusRes);
      setEventsData(evRes);
      setClubs(clubsRes);
      setVolunteersData(volRes);
      setDecisions(decRes);
      setVenues(venRes);
    } catch (err) {
      toast.error('Unable to reach Crew Sync backend API (port 5001)');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      const res = await runAgentSync();
      setBrief(res.brief || '');
      await loadAll();
      toast.success('Agent cycle complete: sensed, analyzed & logged proposals');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Agent run failed');
    } finally {
      setRunningAgent(false);
    }
  };

  const handleDecide = async (decisionId, action) => {
    setBusyDecisionId(decisionId);
    try {
      const updated = await submitDecision(decisionId, action);
      toast.success(
        action === 'approved'
          ? `Approved: ${updated.executionNote || 'Changes applied'}`
          : 'Proposal rejected and logged'
      );
      await loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to apply decision');
    } finally {
      setBusyDecisionId(null);
    }
  };

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await resetDemoScenario();
      setBrief('');
      await loadAll();
      toast.success('Demo scenario reset to initial state');
    } catch (err) {
      toast.error('Failed to reset demo data');
    } finally {
      setResetting(false);
    }
  };

  const pendingCount = decisions.filter((d) => d.status === 'proposed').length;
  const counts = agentStatus?.counts || {
    clubs: clubs.length,
    scheduledEvents: 0,
    clashes: 0,
    quietClubs: 0,
    openVolunteerRoles: 0,
  };

  const navItems = [
    {
      id: 'calendar',
      label: 'Shared Calendar',
      icon: Calendar,
      badge: counts.clashes > 0 ? `${counts.clashes} clash` : null,
    },
    {
      id: 'agent',
      label: 'Agent Proposals',
      icon: Cpu,
      badge: pendingCount > 0 ? pendingCount : null,
    },
    {
      id: 'clubs',
      label: 'Clubs & Health',
      icon: LayoutGrid,
      badge: counts.quietClubs > 0 ? `${counts.quietClubs} quiet` : null,
    },
    {
      id: 'volunteers',
      label: 'Volunteer Match',
      icon: Users,
      badge: counts.openVolunteerRoles > 0 ? counts.openVolunteerRoles : null,
    },
    { id: 'reports', label: 'Event Reports', icon: FileText, badge: null },
    {
      id: 'decisions',
      label: 'Decision Log',
      icon: History,
      badge: decisions.length > 0 ? decisions.length : null,
    },
  ];

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-[#f5f5f5] flex font-sans">
      <Toaster position="top-center" toastOptions={{ duration: 3500 }} />

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 h-screen w-64 bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-[#1c1c1c] flex flex-col z-40 transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header (solid color, zero gradients) */}
        <div className="p-5 border-b border-gray-200 dark:border-[#1c1c1c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Command className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-gray-900 dark:text-white tracking-tight">
                Crew Sync
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Campus Operations</p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 mb-4">
            <p className="text-[11px] font-medium text-blue-800 dark:text-blue-300 leading-relaxed">
              Coordinator control active: every agent proposal requires manual approval.
            </p>
          </div>

          <p className="px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Workspace</p>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#141414] hover:text-gray-900 dark:hover:text-white border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  {item.label}
                </span>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Controls */}
        <div className="p-4 border-t border-gray-200 dark:border-[#1c1c1c] space-y-2 shrink-0">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#141414] border border-gray-200 dark:border-[#1c1c1c] transition"
          >
            <span className="flex items-center gap-2">
              {isDark ? <Sun className="w-4 h-4 text-gray-300" /> : <Moon className="w-4 h-4 text-blue-600" />}
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400">{isDark ? 'Dark' : 'Light'}</span>
          </button>

          <button
            onClick={handleResetDemo}
            disabled={resetting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#141414] border border-gray-200 dark:border-[#1c1c1c] disabled:opacity-50 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            {resetting ? 'Resetting Demo...' : 'Reset Demo Data'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#1c1c1c] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-gray-900 dark:text-white">Crew Sync</span>
          </div>
          <button
            onClick={handleRunAgent}
            disabled={runningAgent}
            className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} /> Sync
          </button>
        </div>

        <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
          {/* Compact Workspace Header (puts Shared Calendar right at the top) */}
          <div className="rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Campus Club Operations
                </span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {counts.clubs} Clubs Synchronized
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                Crew Sync Command Center
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 tabular-nums">
              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span className="text-gray-400 block">Events</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{counts.scheduledEvents}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Clashes</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{counts.clashes}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Quiet</span>
                  <span className="text-base font-bold text-gray-900 dark:text-white">{counts.quietClubs}</span>
                </div>
                <div>
                  <span className="text-gray-400 block">Open Roles</span>
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                    {counts.openVolunteerRoles}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block">Pending</span>
                  <span className="text-base font-bold text-blue-600 dark:text-blue-400">{pendingCount}</span>
                </div>
              </div>

              <button
                onClick={handleRunAgent}
                disabled={runningAgent}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-60 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${runningAgent ? 'animate-spin' : ''}`} />
                {runningAgent ? 'Running Agent...' : 'Run Agent Sync'}
              </button>
            </div>
          </div>

          {/* Active View */}
          {loading ? (
            <div className="bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#1c1c1c] rounded-2xl p-12 text-center text-sm text-gray-500">
              Connecting to campus telemetry...
            </div>
          ) : (
            <>
              {activeTab === 'calendar' && (
                <CalendarView
                  events={eventsData.events}
                  clashes={eventsData.clashes}
                  clubs={clubs}
                  onOpenAddEvent={() => setIsAddEventOpen(true)}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'agent' && (
                <AgentPanel
                  decisions={decisions}
                  brief={brief}
                  llmInfo={agentStatus?.llm}
                  onDecide={handleDecide}
                  busyDecisionId={busyDecisionId}
                  onRunAgent={handleRunAgent}
                  runningAgent={runningAgent}
                />
              )}

              {activeTab === 'clubs' && <ClubsView clubs={clubs} onNavigateTab={setActiveTab} />}

              {activeTab === 'volunteers' && (
                <VolunteerView
                  roleMatches={volunteersData.roleMatches}
                  volunteers={volunteersData.volunteers}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'reports' && <ReportView onReportGenerated={loadAll} />}

              {activeTab === 'decisions' && <DecisionLogView decisions={decisions} />}
            </>
          )}
        </div>
      </main>

      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        clubs={clubs}
        venues={venues}
        onCreated={loadAll}
      />
    </div>
  );
}
