
import { getJson, postJson, requestJson } from '../../shared/api/apiClient.js';

export const jobsService = {
  getRunDetail: () => getJson('/api/run-detail'),
  updateStatus: (payload) => postJson('/api/job-status', payload),
  getSchedule: () => getJson('/api/schedule'),
  saveSchedule: (payload) => postJson('/api/schedule', payload),
  async getJobDescription(key) {
    const { response, body } = await requestJson(`/api/jd?key=${encodeURIComponent(key)}`);
    if (response.status === 404) return { notFound: true };
    if (!response.ok) return { errorStatus: response.status };
    return body;
  },
  async promote(payload) {
    const { response, body } = await requestJson('/api/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, ok: response.ok, body };
  },
};
