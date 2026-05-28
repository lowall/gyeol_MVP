// GA4 이벤트 트래킹 헬퍼

export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', eventName, params);
  } catch (err) {
    console.warn('GA event failed:', err);
  }
}

export const events = {
  // 카테고리 관련
  viewLanding: () => trackEvent('view_landing'),
  clickCategory: (category) => trackEvent('click_category', { category }),
  clickPackage: (pkg) => trackEvent('click_package', { package: pkg }),
  
  // 결제 의지 측정 (mock 결제)
  openPaymentModal: (category, price) => trackEvent('open_payment_modal', { category, price }),
  confirmPayment: (category, price) => trackEvent('confirm_payment', { category, price }),
  cancelPayment: (category) => trackEvent('cancel_payment', { category }),
  
  // 채팅
  startConversation: (category) => trackEvent('start_conversation', { category }),
  sendMessage: (category, messageCount) => trackEvent('send_message', { category, message_count: messageCount }),
  
  // 보고서
  reportGenerated: (category, attachmentType) => trackEvent('report_generated', { category, attachment_type: attachmentType }),
  reportSaved: (category) => trackEvent('report_saved', { category }),
  reportError: (category, errorType) => trackEvent('report_error', { category, error_type: errorType }),
  
  // 공유
  openShareModal: (category) => trackEvent('open_share_modal', { category }),
  shareKakao: (category) => trackEvent('share_kakao', { category }),
  downloadImage: (category, type) => trackEvent('download_image', { category, image_type: type }),
  downloadFullReport: (category) => trackEvent('download_full_report', { category }),
  copyText: (category) => trackEvent('copy_text', { category }),
  
  // 친구추가
  clickKakaoChannel: (source) => trackEvent('click_kakao_channel', { source }),
  clickInstagram: (source) => trackEvent('click_instagram', { source }),
  
  // 공유받은 페이지
  viewSharedReport: (category) => trackEvent('view_shared_report', { category }),
  clickCTAFromShared: () => trackEvent('click_cta_from_shared'),
  
  // 크로스셀
  clickCrossSell: (from, to) => trackEvent('click_cross_sell', { from, to }),
  
  // 초대
  clickInvite: (category) => trackEvent('click_invite', { category }),
};
