
import { getJson, postJson, requestJson } from '../../shared/api/apiClient.js';

export const customService = {
  parseDescription: (description) => postJson('/api/custom/parse-description', { description }),
  listJobs: () => getJson('/api/custom/jobs'),
  getStatus: (key) => getJson(`/api/custom/status?key=${encodeURIComponent(key)}`),
  async promote(payload) {
    const { response, body } = await requestJson('/api/custom/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { status: response.status, ok: response.ok, body };
  },
};
