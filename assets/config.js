window.HS_CONFIG = {
  siteTitle: '한살림 농업살림센터 예약',

  // Cloudflare Worker API
  apiBaseUrl: 'https://reservation-hansalimnc.chopsquid.workers.dev',

  // Apps Script 웹앱
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzYNboXx69-QRESKrRmU71cVFrp4jCS98slWTq0HQ3SOZ8tmQe6tXRhxpMoHUNoxW_v-A/exec',

  // 홈 주소
  homepageUrl: 'https://www.hansalimnc.co.kr',
  homeUrl: 'https://www.hansalimnc.co.kr',

  // 예약조회 페이지 주소
  // 아직 없으면 임시로 홈으로 두거나 추후 실제 조회 페이지로 변경
  lookupUrl: './lookup.html',

  // PortOne 실제 결제 연동용
  portone: {
    storeId: 'store-fe9f05a4-5611-4435-bcd2-7d409efd6ce2',
    channelKey: 'channel-key-feaf9e18-931f-4edd-9ac5-402cc0da754f'
  }
};
