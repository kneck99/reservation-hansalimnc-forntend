window.HSAuth = (function () {
  const cfg = window.HS_CONFIG || {};
  const API_BASE = (cfg.apiBaseUrl || '').replace(/\/$/, '');
  const TOKEN_KEY = 'hs_token';
  const LEGACY_TOKEN_KEY = 'hs_user_token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY) || '';
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }

  async function request(path, options = {}) {
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );

    const token = getToken();
    if (token && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body || undefined
    });

    let data = {};
    try {
      data = await response.json();
    } catch (err) {
      data = {};
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
  }

  async function signup(payload) {
    return request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async function login(payload) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (data.token) {
      setToken(data.token);
    }
    return data;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST'
      });
    } finally {
      clearToken();
    }
  }

  async function getMe() {
    return request('/api/auth/me');
  }

  async function authFetch(path, options = {}) {
    return request(path, options);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  return {
    getToken,
    setToken,
    clearToken,
    signup,
    login,
    logout,
    getMe,
    authFetch,
    isLoggedIn
  };
})();
