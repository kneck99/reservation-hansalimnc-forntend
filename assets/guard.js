window.HSGuard = (function () {
  function redirectToLogin(nextUrl) {
    const next = encodeURIComponent(nextUrl || window.location.pathname);
    window.location.href = `./login.html?next=${next}`;
  }

  async function protectPage() {
    if (!window.HSAuth) {
      throw new Error('HSAuth가 로드되지 않았습니다.');
    }

    if (!window.HSAuth.isLoggedIn()) {
      redirectToLogin(window.location.pathname);
      return null;
    }

    try {
      const result = await window.HSAuth.getMe();
      return result.user;
    } catch (err) {
      window.HSAuth.clearToken();
      redirectToLogin(window.location.pathname);
      return null;
    }
  }

  function fillUserFields(user) {
    if (!user) return;

    const nameInput = document.getElementById('contactName');
    const phoneInput = document.getElementById('phone');
    const affiliationInput = document.getElementById('affiliation');

    if (nameInput && !nameInput.value) {
      nameInput.value = user.name || '';
    }

    if (phoneInput && !phoneInput.value) {
      phoneInput.value = user.phone || '';
    }

    if (affiliationInput && !affiliationInput.value) {
      affiliationInput.value = user.affiliation || '';
    }

    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = user.name || '';
    });

    document.querySelectorAll('[data-user-affiliation]').forEach(el => {
      el.textContent = user.affiliation || '';
    });
  }

  async function renderAuthStatus(containerSelector = '[data-auth-status]') {
    const box = document.querySelector(containerSelector);
    if (!box) return;

    if (!window.HSAuth.isLoggedIn()) {
      box.innerHTML = `
        <div class="auth-mini-actions">
          <a href="./login.html" class="mini-link-btn">로그인</a>
          <a href="./signup.html" class="mini-link-btn primary">회원가입</a>
        </div>
      `;
      return;
    }

    try {
      const result = await window.HSAuth.getMe();
      const user = result.user || {};
      const isAdmin = user.role === 'admin';

      box.innerHTML = `
        <div class="auth-status-box">
          <div class="auth-status-user">
            <strong>${user.name || ''}</strong>
            <span>${user.affiliation ? `${user.affiliation}` : ''}</span>
          </div>
          <div class="auth-status-actions">
            ${isAdmin ? `<a href="./admin-users.html" class="mini-link-btn">관리자 페이지</a>` : ''}
            <button type="button" class="mini-link-btn" id="btnLogout">로그아웃</button>
          </div>
        </div>
      `;

      const btnLogout = document.getElementById('btnLogout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          await window.HSAuth.logout();
          window.location.href = './login.html';
        });
      }
    } catch (err) {
      window.HSAuth.clearToken();
      box.innerHTML = `
        <div class="auth-mini-actions">
          <a href="./login.html" class="mini-link-btn">로그인</a>
          <a href="./signup.html" class="mini-link-btn primary">회원가입</a>
        </div>
      `;
    }
  }

  return {
    protectPage,
    fillUserFields,
    renderAuthStatus,
    redirectToLogin
  };
})();
