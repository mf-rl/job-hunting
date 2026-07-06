
import { getJson, postJson } from '../../shared/api/apiClient.js';
import { runService } from '../../shared/services/runService.js';

export const overviewService = {
  getOverview: () => getJson('/api/overview'),
  getAgents: () => getJson('/api/agents'),
  getTelemetry: () => getJson('/api/telemetry'),
  getActivity: (limit = 30) => getJson(`/api/activity?limit=${encodeURIComponent(limit)}`),
  getRunDetail: () => getJson('/api/run-detail'),
  startFindRun: runService.startFindRun,
  promoteJob: (payload) => postJson('/api/promote', payload),
};
