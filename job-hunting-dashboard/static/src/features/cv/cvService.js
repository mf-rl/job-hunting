
import { getJson, postForm } from '../../shared/api/apiClient.js';

export const cvService = {
  getStatus: () => getJson('/api/cv'),
  upload(file) {
    const form = new FormData();
    form.append('file', file);
    return postForm('/api/cv', form);
  },
};
