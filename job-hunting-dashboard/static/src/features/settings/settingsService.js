
import { getJson, postJson } from '../../shared/api/apiClient.js';

export const settingsService = {
  getSettings: () => getJson('/api/settings'),
  saveSettings: (settings) => postJson('/api/settings', settings),
};
