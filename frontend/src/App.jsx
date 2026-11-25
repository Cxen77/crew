import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import {
  Calendar,
  Cpu,
  FileText,
  History,
  LayoutGrid,
  Menu,
  MessageSquare,
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
import ChatView from './components/ChatView';
import AddEventModal from './components/AddEventModal';

export default function App() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarOpen((prev) => !prev);
    }
  };

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
    { id: 'chat', label: 'Agent Chat', icon: MessageSquare, badge: null },
  ];

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-[#f5f5f5] flex flex-col font-sans">
      <Toaster position="top-center" toastOptions={{ duration: 3500 }} />

      {/* Full-Width Top Navbar (Menu toggle + Crew Sync Logo + Name + Read-only Status) */}
      <header className="sticky top-0 z-30 h-14 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-[#1c1c1c] px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleSidebar}
            className="p-1.5 -ml-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition"
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-4 h-4 text-white"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8.5" cy="12" r="4.5" />
              <circle cx="15.5" cy="12" r="4.5" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="font-bold text-base text-gray-900 dark:text-white tracking-tight">
              Crew Sync
            </span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-medium">
              Campus Club Coordinator
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
          <span>
            Events <strong className="text-gray-900 dark:text-white ml-1">{counts.scheduledEvents}</strong>
          </span>
          <span>
            Clashes <strong className="text-gray-900 dark:text-white ml-1">{counts.clashes}</strong>
          </span>
          <span>
            Quiet <strong className="text-gray-900 dark:text-white ml-1">{counts.quietClubs}</strong>
          </span>
          <span>
            Open Roles <strong className="text-gray-900 dark:text-white ml-1">{counts.openVolunteerRoles}</strong>
          </span>
          <span>
            Pending <strong className="text-gray-900 dark:text-white ml-1">{pendingCount}</strong>
          </span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
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

        {/* Sidebar (All navigation + action buttons live here only) */}
        <aside
          className={`fixed lg:sticky top-0 lg:top-14 h-screen lg:h-[calc(100vh-3.5rem)] bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#1c1c1c] flex flex-col z-40 transition-all duration-200 shrink-0 ${
            isSidebarOpen ? 'translate-x-0 w-64 border-r' : '-translate-x-full w-64 lg:translate-x-0'
          } ${
            isDesktopSidebarOpen
              ? 'lg:w-64 lg:border-r'
              : 'lg:w-0 lg:overflow-hidden lg:border-r-0'
          }`}
        >
          {/* Mobile Drawer Close */}
          <div className="lg:hidden p-4 border-b border-gray-200 dark:border-[#1c1c1c] flex items-center justify-between shrink-0">
            <span className="font-bold text-sm text-gray-900 dark:text-white">Menu</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            <p className="px-3 pt-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Workspace
            </p>

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

          {/* Sidebar Action Buttons */}
          <div className="p-4 border-t border-gray-200 dark:border-[#1c1c1c] space-y-2 shrink-0">
            <button
              onClick={handleRunAgent}
              disabled={runningAgent}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningAgent ? 'animate-spin' : ''}`} />
              {runningAgent ? 'Running Agent...' : 'Run Agent Sync'}
            </button>

            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#141414] border border-gray-200 dark:border-[#1c1c1c] transition"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun className="w-4 h-4 text-gray-300" /> : <Moon className="w-4 h-4 text-gray-700" />}
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

        {/* Main Workspace */}
        <main className="flex-1 min-w-0">
          <div className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-5">
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

                {activeTab === 'chat' && <ChatView />}
              </>
            )}
          </div>
        </main>
      </div>

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
