// src/lib/analytics.js
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

// 주요 이벤트 헬퍼
export const events = {
  // 랜딩에서 "결 보러가기" 버튼 클릭
  startConversation: () => trackEvent('start_conversation'),
  
  // 채팅 메시지 전송
  sendMessage: (messageCount) => trackEvent('send_message', { message_count: messageCount }),
  
  // 보고서 생성 완료
  reportGenerated: (attachmentType) => trackEvent('report_generated', { attachment_type: attachmentType }),
  
  // 결과 저장 완료 (Firestore)
  reportSaved: () => trackEvent('report_saved'),
  
  // 공유 모달 열기
  openShareModal: () => trackEvent('open_share_modal'),
  
  // 카톡으로 링크 공유
  shareKakao: () => trackEvent('share_kakao'),
  
  // 인스타 스토리/게시글 다운로드
  downloadImage: (type) => trackEvent('download_image', { image_type: type }),
  
  // 전체 결과 이미지 다운로드
  downloadFullReport: () => trackEvent('download_full_report'),
  
  // 텍스트 복사
  copyText: () => trackEvent('copy_text'),
  
  // 카카오 채널 친구추가 클릭
  clickKakaoChannel: (source) => trackEvent('click_kakao_channel', { source }),
  
  // 인스타 팔로우 클릭
  clickInstagram: (source) => trackEvent('click_instagram', { source }),
  
  // 친구가 공유받은 페이지 열람
  viewSharedReport: () => trackEvent('view_shared_report'),
  
  // 공유받은 페이지에서 "나의 결 보러가기" 클릭
  clickCTAFromShared: () => trackEvent('click_cta_from_shared'),
  
  // 에러 발생
  reportError: (errorType) => trackEvent('report_error', { error_type: errorType }),
};

