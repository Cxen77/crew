import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

export async function fetchAgentStatus() {
  const { data } = await api.get('/agent/status');
  return data;
}

export async function runAgentSync() {
  const { data } = await api.post('/agent/run');
  return data;
}

export async function resetDemoScenario() {
  const { data } = await api.post('/agent/reset-demo');
  return data;
}

export async function fetchDecisions(params = {}) {
  const { data } = await api.get('/agent/decisions', { params });
  return data;
}

export async function submitDecision(id, action, decidedBy = 'Campus Coordinator') {
  const { data } = await api.post(`/agent/decisions/${id}/decide`, { action, decidedBy });
  return data;
}

export async function askAgentChat(message) {
  const { data } = await api.post('/agent/chat', { message });
  return data;
}

export async function fetchEvents() {
  const { data } = await api.get('/events');
  return data;
}

export async function fetchVenues() {
  const { data } = await api.get('/events/venues');
  return data;
}

export async function createEvent(payload) {
  const { data } = await api.post('/events', payload);
  return data;
}

export async function fetchClubs() {
  const { data } = await api.get('/clubs');
  return data;
}

export async function fetchVolunteers() {
  const { data } = await api.get('/volunteers');
  return data;
}

export async function fetchReportEvents() {
  const { data } = await api.get('/reports/events');
  return data;
}

export async function fetchEventReportData(eventId) {
  const { data } = await api.get(`/reports/${eventId}`);
  return data;
}

export async function generateEventReport(eventId) {
  const { data } = await api.post(`/reports/${eventId}/generate`);
  return data;
}

export default api;
