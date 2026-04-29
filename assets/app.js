(function () {
  const cfg = window.HS_CONFIG || {};
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const logBox = $('#log');
  const amountEl = $('#quotedAmount');
  const btnPay = $('#btnPay');

  const meetingFields = $('#meeting-fields');
  const dormFields = $('#dorm-fields');
  const bookingTypeRadios = $$('input[name="bookingType"]');
  const bookingCards = $$('.booking-type-card');

  function log(message, data) {
    const now = new Date().toLocaleTimeString('ko-KR');
    const line = typeof data === 'undefined'
      ? `[${now}] ${message}`
      : `[${now}] ${message}\n${JSON.stringify(data, null, 2)}`;
    if (logBox) logBox.textContent = `${line}\n\n${logBox.textContent}`;
  }

  function setAmount(value) {
    if (!amountEl) return;
    amountEl.textContent = `${Number(value || 0).toLocaleString('ko-KR')}원`;
  }

  function formatPhone(value) {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function getBookingType() {
    return $('input[name="bookingType"]:checked')?.value || 'meeting';
  }

  function updateActionButton() {
    const type = getBookingType();
    if (!btnPay) return;
    btnPay.textContent = type === 'meeting' ? '예약 신청하기' : '결제하기';
  }

  function updateBookingTypeUI() {
    const type = getBookingType();

    bookingCards.forEach(card => {
      const isActive = card.dataset.bookingCard === type;
      card.classList.toggle('active', isActive);
    });

    if (type === 'meeting') {
      meetingFields?.classList.remove('is-hidden');
      dormFields?.classList.add('is-hidden');
      setAmount(0);
    } else {
      meetingFields?.classList.add('is-hidden');
      dormFields?.classList.remove('is-hidden');
      autoQuoteDorm();
    }

    updateActionButton();
  }

  function collectForm() {
    const bookingType = getBookingType();

    const common = {
      bookingType,
      contactName: $('#contactName')?.value.trim() || '',
      phone: $('#phone')?.value.trim() || '',
      email: $('#email')?.value.trim() || '',
      agree: $('#agree')?.checked || false
    };

    if (bookingType === 'meeting') {
      return {
        ...common,
        resourceName: $('#meetingRoom')?.value || '',
        startDate: $('#meetingDate')?.value || '',
        endDate: $('#meetingDate')?.value || '',
        headcount: 0,
        purpose: $('#meetingPurpose')?.value.trim() || '',
        settlementMethod: ''
      };
    }

    return {
      ...common,
      resourceName: '연수원',
      startDate: $('#checkInDate')?.value || '',
      endDate: $('#checkOutDate')?.value || '',
      headcount: Number($('#headcount')?.value || 0),
      purpose: $('#dormPurpose')?.value.trim() || '',
      settlementMethod: $('#settlementMethod')?.value || '카드결제'
    };
  }

  function validateForm(payload, forSubmit = false) {
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
      if (!payload.settlementMethod) throw new Error('정산방법을 확인해 주세요.');
      if (!payload.purpose) throw new Error('사용신청목적을 입력해 주세요.');
    }

    if (forSubmit && !payload.agree) {
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

  function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  async function autoQuoteDorm() {
    if (getBookingType() !== 'dorm') {
      setAmount(0);
      return;
    }

    const raw = ($('#headcount')?.value || '').trim();
    if (!raw) {
      setAmount(0);
      return;
    }

    const headcount = Number(raw);
    if (!Number.isFinite(headcount) || headcount < 1) {
      setAmount(0);
      return;
    }

    try {
      const data = await postJSON('/api/quote', {
        bookingType: 'dorm',
        headcount
      });
      setAmount(data.totalAmount);
    } catch (err) {
      log(`금액 자동 계산 실패: ${err.message}`);
      setAmount(0);
    }
  }

  const debouncedAutoQuoteDorm = debounce(autoQuoteDorm, 200);

  function saveSuccessPayload(payload) {
    sessionStorage.setItem('hs_last_reservation', JSON.stringify(payload));
  }

  async function submitMeetingReservation() {
    const payload = collectForm();
    validateForm(payload, true);

    const reservationDraft = await postJSON('/api/create-payment', payload);
    log('회의실 예약 데이터 생성 완료', reservationDraft);

    const completeResult = await postJSON('/api/booking-complete', {
      paymentId: reservationDraft.paymentId,
      reservation: reservationDraft.reservation,
      verification: {
        paymentRequired: false,
        status: 'NOT_REQUIRED'
      }
    });

    log('회의실 예약 완료 처리', completeResult);
    saveSuccessPayload(completeResult);
    location.href = './success.html';
  }

  async function submitDormPayment() {
    const payload = collectForm();
    validateForm(payload, true);

    const draft = await postJSON('/api/create-payment', payload);
    setAmount(draft.totalAmount);
    log('연수원 결제 사전 생성 완료', draft);

    if (!window.PortOne) {
      throw new Error('PortOne SDK가 로드되지 않았습니다.');
    }

    const response = await window.PortOne.requestPayment({
      storeId: cfg.portone.storeId,
      channelKey: cfg.portone.channelKey,
      paymentId: draft.paymentId,
      orderName: draft.orderName,
      totalAmount: draft.totalAmount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      customer: {
        fullName: draft.reservation.contactName,
        phoneNumber: draft.reservation.phone,
        email: draft.reservation.email
      }
    });

    log('PortOne 결제창 응답', response);

    if (response.code) {
      throw new Error(response.message || response.pgMessage || '결제가 취소되었거나 실패했습니다.');
    }

    const verified = await postJSON('/api/payment/complete', {
      paymentId: draft.paymentId,
      order: draft.reservation
    });
    log('서버 결제 검증 완료', verified);

    const completeResult = await postJSON('/api/booking-complete', {
      paymentId: draft.paymentId,
      reservation: draft.reservation,
      verification: verified
    });

    log('연수원 예약 완료 처리', completeResult);
    saveSuccessPayload(completeResult);
    location.href = './success.html';
  }

  $('#phone')?.addEventListener('input', (e) => {
    e.target.value = formatPhone(e.target.value);
  });

  bookingTypeRadios.forEach(radio => {
    radio.addEventListener('change', updateBookingTypeUI);
  });

  $('#headcount')?.addEventListener('input', debouncedAutoQuoteDorm);
  $('#headcount')?.addEventListener('change', debouncedAutoQuoteDorm);
  $('#checkInDate')?.addEventListener('change', debouncedAutoQuoteDorm);
  $('#checkOutDate')?.addEventListener('change', debouncedAutoQuoteDorm);

  btnPay?.addEventListener('click', async () => {
    try {
      if (getBookingType() === 'meeting') {
        await submitMeetingReservation();
      } else {
        await submitDormPayment();
      }
    } catch (err) {
      log(`예약 진행 실패: ${err.message}`);
      alert(err.message);
    }
  });

  updateBookingTypeUI();
})();
