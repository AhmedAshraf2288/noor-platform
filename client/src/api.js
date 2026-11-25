import { sget, sset, sdel } from './secureStore.js';
// API client with CSRF double-submit handling
let csrfToken = null;

export async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const r = await fetch('/api/auth/csrf', { credentials: 'include' });
  const d = await r.json();
  csrfToken = d.csrfToken;
  return csrfToken;
}

export function deviceId() {
  let d = sget('noor-device');
  if (!d) { d = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); sset('noor-device', d); }
  return d;
}

async function request(path, { method = 'GET', body, formData } = {}) {
  if (method === 'POST' && body && /^\/api\/auth\/(login|register)$/.test(path)) body = { ...body, deviceId: deviceId() };
  const headers = {};
  if (method !== 'GET') {
    await ensureCsrf();
    headers['x-csrf-token'] = csrfToken;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  if (!r.ok) {
    const err = new Error((data && data.error) || 'حدث خطأ');
    err.status = r.status;
    throw err;
  }
  if (data && data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

// XMLHttpRequest is used here (not fetch) so we get real upload progress events
function requestWithProgress(path, formData, onProgress) {
  return (async () => {
    await ensureCsrf();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.withCredentials = true;
      xhr.setRequestHeader('x-csrf-token', csrfToken);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* empty */ }
        if (data && data.csrfToken) csrfToken = data.csrfToken;
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          const err = new Error((data && data.error) || 'فشل الرفع');
          err.status = xhr.status;
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('فشل الاتصال أثناء الرفع'));
      xhr.send(formData);
    });
  })();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  postForm: (p, formData) => request(p, { method: 'POST', formData }),
  postFormProgress: requestWithProgress,
  logout: async () => { await request('/api/auth/logout', { method: 'POST', body: {} }); csrfToken = null; },
};
