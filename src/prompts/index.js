// 모든 카테고리 프롬프트 통합

import { LOVE_CHAT_PROMPT, LOVE_REPORT_PROMPT } from './love';
import { FRIEND_CHAT_PROMPT, FRIEND_REPORT_PROMPT } from './friend';
import { CAREER_CHAT_PROMPT, CAREER_REPORT_PROMPT } from './career';
import { WORK_CHAT_PROMPT, WORK_REPORT_PROMPT } from './work';
import { BURNOUT_CHAT_PROMPT, BURNOUT_REPORT_PROMPT } from './burnout';
import { INTEGRATED_CHAT_PROMPT, INTEGRATED_REPORT_PROMPT } from './integrated';

export const PROMPTS = {
  love: {
    chat: LOVE_CHAT_PROMPT,
    report: LOVE_REPORT_PROMPT,
  },
  friend: {
    chat: FRIEND_CHAT_PROMPT,
    report: FRIEND_REPORT_PROMPT,
  },
  career: {
    chat: CAREER_CHAT_PROMPT,
    report: CAREER_REPORT_PROMPT,
  },
  work: {
    chat: WORK_CHAT_PROMPT,
    report: WORK_REPORT_PROMPT,
  },
  burnout: {
    chat: BURNOUT_CHAT_PROMPT,
    report: BURNOUT_REPORT_PROMPT,
  },
  integrated: {
    chat: INTEGRATED_CHAT_PROMPT,
    report: INTEGRATED_REPORT_PROMPT,
  },
};

export function getChatPrompt(category) {
  return PROMPTS[category]?.chat || PROMPTS.love.chat;
}

export function getReportPrompt(category, context = {}) {
  let prompt = PROMPTS[category]?.report || PROMPTS.love.report;
  
  // 종합 결의 경우 기존 보고서 컨텍스트 주입
  if (category === 'integrated' && context.previousReports) {
    const reportsText = context.previousReports
      .map(r => `[${r.category} 결]\n${JSON.stringify(r.report, null, 2)}`)
      .join('\n\n---\n\n');
    prompt = prompt.replace('[기존 보고서들]', reportsText);
  }
  
  return prompt;
}
