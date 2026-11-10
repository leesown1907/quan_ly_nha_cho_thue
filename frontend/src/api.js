const BASE = import.meta.env.VITE_API_URL || '/api';
let token = localStorage.getItem('token');
// null = chưa kiểm tra, false = có Backend API thật, true = chạy độc lập trên trình duyệt (GitHub Pages)
let standaloneMode = import.meta.env.VITE_STANDALONE === 'true' ? true : null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}
export const getToken = () => token;

async function detectMode() {
  if (standaloneMode !== null) return standaloneMode;
  if (token?.startsWith('local.')) {
    standaloneMode = true;
    return true;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    const r = await fetch(`${BASE}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    const ct = r.headers.get('content-type') || '';
    standaloneMode = !(r.ok && ct.includes('application/json'));
  } catch {
    standaloneMode = true;
  }
  return standaloneMode;
}

export async function api(path, { method = 'GET', body, params } = {}) {
  if (await detectMode()) {
    const { handleLocalApi } = await import('./localServer.js');
    try {
      return await handleLocalApi(path, { method, body, params, token });
    } catch (err) {
      if (err?.status === 401 && token) {
        setToken(null);
        window.dispatchEvent(new Event('auth:logout'));
      }
      throw new Error(err?.message || 'Lỗi xử lý');
    }
  }

  const url = new URL(BASE + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== false) url.searchParams.set(k, v);
    });
  }
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Không thể kết nối tới máy chủ');
  }
  let data = null;
  try { data = await res.json(); } catch { /* không có body */ }

  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
  }
  if (!res.ok) throw new Error(data?.message || `Lỗi ${res.status}`);
  return data;
}

api.get = (path, params) => api(path, { params });
api.post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
api.put = (path, body) => api(path, { method: 'PUT', body: body ?? {} });
api.del = (path) => api(path, { method: 'DELETE' });
