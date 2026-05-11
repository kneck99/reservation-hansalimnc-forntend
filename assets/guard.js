window.HSGuard = (function () {
  const cfg = window.HS_CONFIG || {};

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

    const userNameEls = document.querySelectorAll('[data-user-name]');
    userNameEls.forEach(el => {
      el.textContent = user.name || '';
    });

    const userAffiliationEls = document.querySelectorAll('[data-user-affiliation]');
    userAffiliationEls.forEach(el => {
      el.textContent = user.affiliation || '';
    });
  }

  async function renderAuthStatus(containerSelector = '[data-auth-status]') {
    const box = document.querySelector(containerSelector);
    if (!box) return;

    if (!window.HSAuth.isLoggedIn()) {
      box.innerHTML = `
        <a href="./login.html" class="btn btn-secondary">로그인</a>
        <a href="./signup.html" class="btn btn-primary">회원가입</a>
      `;
      return;
    }

    try {
      const result = await window.HSAuth.getMe();
      const user = result.user || {};

      box.innerHTML = `
        <div class="auth-status-box">
          <span><strong>${user.name || ''}</strong>${user.affiliation ? ` · ${user.affiliation}` : ''}</span>
          <button type="button" class="btn btn-secondary" id="btnLogout">로그아웃</button>
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
        <a href="./login.html" class="btn btn-secondary">로그인</a>
        <a href="./signup.html" class="btn btn-primary">회원가입</a>
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
