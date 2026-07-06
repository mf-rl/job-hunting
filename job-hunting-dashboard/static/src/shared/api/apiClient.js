
async function readError(response) {
  try {
    const body = await response.json();
    return body.detail || body.error || response.statusText;
  } catch (_) {
    return response.statusText;
  }
}

export async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

export async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(await readError(response) || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(await readError(response) || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function postForm(url, formData) {
  const response = await fetch(url, { method: 'POST', body: formData });
  if (!response.ok) {
    const error = new Error(await readError(response) || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}
