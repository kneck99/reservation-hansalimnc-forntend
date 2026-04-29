(function () {
  const cfg = window.HS_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const logBox = $('#log');
  const amountEl = $('#quotedAmount');
  const btnPrepare = $('#btnPrepare');
  const btnPay = $('#btnPay');

  const meetingFields = $('#meeting-fields');
  const dormFields = $('#dorm-fields');
  const bookingTypeRadios = $$('input[name="bookingType"]');
  const bookingCards = $$('.booking-type-card');

  let preparedPayment = null;

  function log(message, data) {
    const now = new Date().toLocaleTimeString('ko-KR');
    const line = typeof data === 'undefined'
      ? `[${now}] ${message}`
      : `[${now}] ${message}\n${JSON.stringify(data, null, 2)}`;
    logBox.textContent = line + '\n\n' + logBox.textContent;
  }

  function formatPhone(value) {
    const onlyNum = value.replace(/\D/g, '').slice(0, 11);

    if (onlyNum.length < 4) return onlyNum;
    if (onlyNum.length < 8) return `${onlyNum.slice(0, 3)}-${onlyNum.slice(3)}`;
    return `${onlyNum.slice(0, 3)}-${onlyNum.slice(3, 7)}-${onlyNum.slice(7)}`;
  }

  function getBookingType() {
    const checked = $('input[name="bookingType"]:checked');
    return checked ? checked.value : 'meeting';
  }

  function updateBookingTypeUI() {
    const type = getBookingType();

    bookingCards.forEach(card => {
      const isActive = card.dataset.bookingCard === type;
      card.classList.toggle('active', isActive);
    });

    if (type === 'meeting') {
      meetingFields.classList.remove('is-hidden');
      dormFields.classList.add('is-hidden');
      amountEl.textContent = '0원';
    } else {
      meetingFields.classList.add('is-hidden');
      dormFields.classList.remove('is-hidden');
      autoQuoteDorm();
    }
  }

  function collectForm() {
    const bookingType = getBookingType();

    const common = {
      bookingType,
      contactName: $('#contactName').value.trim(),
      phone: $('#phone').value.trim(),
      email: $('#email').value.trim(),
      agree: $('#agree').checked
    };

    if (bookingType === 'meeting') {
      return {
        ...common,
        resourceName: $('#meetingRoom').value,
        startDate: $('#meetingDate').value,
        endDate: $('#meetingDate').value,
        headcount: 0,
        purpose: $('#meetingPurpose').value.trim(),
        settlementMethod: ''
      };
    }

    return {
      ...common,
      resourceName: '연수원',
      startDate: $('#checkInDate').value,
      endDate: $('#checkOutDate').value,
      headcount: Number($('#headcount').value || 0),
      purpose: $('#dormPurpose').value.trim(),
      settlementMethod: $('#settlementMethod').value
    };
  }

  function validateForm(payload, forPayment = false) {
    if (!payload.contactName) throw new Error('담당자 성함을 입력해 주세요.');
    if (!payload.phone) throw new Error('담당자 연락처를 입력해 주세요.');
    if (!payload.email) throw new Error('이메일주소를 입력해 주세요.');

    if (payload.bookingType === 'meeting') {
      if (!payload.startDate) throw new Error('사용신청일자를 입력해 주세요.');
      if (!payload.resourceName) throw new Error('회의실을 선택해 주세요.');
      if (!payload.purpose) throw new Error('사용신청목적을 입력해 주세요.');
    }

    if (payload.bookingType === 'dorm') {
      if (!payload.startDate) throw new Error('입실일을 입력해 주세요.');
      if (!payload.endDate) throw new Error('퇴실일을 입력해 주세요.');
      if (!payload.headcount || payload.headcount < 1) throw new Error('숙박인원을 1명 이상 입력해 주세요.');
      if (!payload.settlementMethod) throw new Error('정산방법을 선택해 주세요.');
      if (!payload.purpose) throw new Error('사용신청목적을 입력해 주세요.');
    }

    if (forPayment && !payload.agree) {
      throw new Error('이용약관 및 취소/환불정책 확인이 필요합니다.');
    }
  }

  async function postJSON(path, body) {
    const base = (cfg.apiBaseUrl || '').replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return data;
  }

  function setAmount(value) {
    amountEl.textContent = `${Number(value || 0).toLocaleString('ko-KR')}원`;
  }

  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function autoQuoteDorm() {
    const bookingType = getBookingType();

    if (bookingType !== 'dorm') {
      setAmount(0);
      return;
    }

    const headcountInput = $('#headcount');
    const headcountValue = (headcountInput?.value || '').trim();

    if (!headcountValue) {
      setAmount(0);
      return;
    }

    const headcount = Number(headcountValue);

    if (!Number.isFinite(headcount) || headcount < 1) {
      setAmount(0);
      return;
    }

    try {
      const payload = collectForm();
      const data = await postJSON('/api/quote', {
        bookingType: 'dorm',
        headcount: payload.headcount,
        startDate: payload.startDate || '',
        endDate: payload.endDate || ''
      });

      setAmount(data.totalAmount);
    } catch (err) {
      log(`금액 자동 계산 실패: ${err.message}`);
      setAmount(0);
    }
  }

  const debouncedAutoQuoteDorm = debounce(autoQuoteDorm, 250);

  async function preparePayment() {
    const payload = collectForm();
    validateForm(payload, false);

    const data = await postJSON('/api/create-payment', payload);
    preparedPayment = data;

    setAmount(data.totalAmount);
    log('예약 검증 완료', data);
    return data;
  }

  async function mockPayAndComplete() {
    const payment = preparedPayment || await preparePayment();

    const verifyResult = await postJSON('/api/verify-payment', {
      paymentId: payment.paymentId,
      amount: payment.totalAmount,
      mock: true
    });
    log('결제 검증 완료', verifyResult);

    const completeResult = await postJSON('/api/booking-complete', {
      paymentId: payment.paymentId,
      reservation: payment.reservation,
      verification: verifyResult
    });
    log('예약 완료 처리', completeResult);

    location.href = './success.html';
  }

  $('#phone')?.addEventListener('input', (e) => {
    e.target.value = formatPhone(e.target.value);
  });

  bookingTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      preparedPayment = null;
      updateBookingTypeUI();
    });
  });

  $('#headcount')?.addEventListener('input', () => {
    preparedPayment = null;
    debouncedAutoQuoteDorm();
  });

  $('#checkInDate')?.addEventListener('change', () => {
    preparedPayment = null;
    debouncedAutoQuoteDorm();
  });

  $('#checkOutDate')?.addEventListener('change', () => {
    preparedPayment = null;
    debouncedAutoQuoteDorm();
  });

  btnPrepare?.addEventListener('click', async () => {
    try {
      await preparePayment();
      alert('예약 검증이 완료되었습니다.');
    } catch (err) {
      log(`예약 검증 실패: ${err.message}`);
      alert(err.message);
    }
  });

  btnPay?.addEventListener('click', async () => {
    try {
      const payload = collectForm();
      validateForm(payload, true);
      await mockPayAndComplete();
    } catch (err) {
      log(`결제/예약 완료 실패: ${err.message}`);
      alert(err.message);
    }
  });

  updateBookingTypeUI();
})();
