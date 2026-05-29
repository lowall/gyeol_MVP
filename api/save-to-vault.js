// /api/save-to-vault.js
// 이메일 받아서 사용자의 리포트 보관함에 추가
// 새 사용자면 vault 생성, 기존이면 추가
// Apps Script로 마법 링크 이메일 발송

import { getFirestore } from './_lib/firebase-admin.js';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, reportId, category, resendOnly } = req.body;

    // 이메일 유효성 검사
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    // 일반 모드는 reportId 필수, resendOnly는 불필요
    if (!resendOnly && !reportId) {
      return res.status(400).json({ error: 'Missing reportId' });
    }

    const db = getFirestore();
    const normalizedEmail = email.toLowerCase().trim();
    const vaultsRef = db.collection('vaults');
    
    // 이메일로 기존 vault 찾기
    const snapshot = await vaultsRef.where('email', '==', normalizedEmail).limit(1).get();
    
    let userId;
    let isNew = false;
    let isResend = false;
    
    if (resendOnly) {
      // 링크 재발송 모드 - vault가 반드시 있어야 함
      if (snapshot.empty) {
        return res.status(404).json({ error: 'Vault not found for this email' });
      }
      userId = snapshot.docs[0].id;
      isResend = true;
    } else if (snapshot.empty) {
      // 신규: 새 vault 생성
      userId = nanoid(12);
      isNew = true;
      await vaultsRef.doc(userId).set({
        userId,
        email: normalizedEmail,
        reports: [{ reportId, category: category || 'love', savedAt: Date.now() }],
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      });
    } else {
      // 기존: 리포트 추가
      const doc = snapshot.docs[0];
      userId = doc.id;
      const existing = doc.data();
      const reports = existing.reports || [];
      
      // 이미 같은 reportId 저장돼있으면 스킵
      const alreadyExists = reports.some(r => r.reportId === reportId);
      if (!alreadyExists) {
        reports.push({ reportId, category: category || 'love', savedAt: Date.now() });
        await doc.ref.update({ reports, lastAccessedAt: Date.now() });
      }
    }

    // 마법 링크 발송 (Apps Script 호출)
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://gyeol-mvp.vercel.app';
    const vaultUrl = `${baseUrl}/my/${userId}`;
    
    try {
      const emailHtml = generateEmailHTML(vaultUrl, isNew, isResend);
      const subject = isResend 
        ? '🌙 너의 결 보관함 링크' 
        : (isNew ? '🌙 너의 결 보관함이 만들어졌어' : '🌙 너의 결 보관함에 새 결이 추가됐어');
      await sendEmail(normalizedEmail, subject, emailHtml);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
      // 이메일 실패해도 vault는 생성됐으니 OK 반환
    }

    return res.status(200).json({ 
      userId, 
      vaultUrl,
      isNew,
      isResend,
      success: true,
    });
  } catch (err) {
    console.error('save-to-vault error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

async function sendEmail(to, subject, html) {
  const url = process.env.APPS_SCRIPT_EMAIL_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  
  if (!url || !secret) {
    throw new Error('Apps Script env not configured');
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, to, subject, html }),
  });
  
  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status}`);
  }
  
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

function generateEmailHTML(vaultUrl, isNew, isResend) {
  let title, subtitle;
  if (isResend) {
    title = '결 보관함 링크예요';
    subtitle = '요청하신 보관함 링크를 다시 보내드려요.<br/>이 링크를 북마크해두면 언제든 다시 와서 볼 수 있어요.';
  } else if (isNew) {
    title = '결 보관함이 만들어졌어요';
    subtitle = '너의 모든 결을 한 곳에서 영구히 볼 수 있어요.<br/>이 링크를 북마크해두면 언제든 다시 와서 볼 수 있어요.';
  } else {
    title = '새 결이 추가됐어요';
    subtitle = '새로 받은 결이 보관함에 저장됐어요.<br/>아래 링크로 모든 결을 볼 수 있어요.';
  }
  
  return `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Apple SD Gothic Neo', sans-serif; background: #3a2840; color: #f5ebd7; margin: 0; padding: 0; }
  .container { max-width: 480px; margin: 0 auto; padding: 40px 24px; text-align: center; }
  .hanja { font-size: 80px; color: #d4a374; font-weight: bold; margin-bottom: 16px; font-family: serif; }
  .title { font-size: 24px; color: #f5ebd7; margin-bottom: 12px; font-weight: 600; }
  .subtitle { color: #f5ebd7; opacity: 0.7; font-size: 14px; line-height: 1.6; margin-bottom: 32px; }
  .button { display: inline-block; background: #d4a374; color: #3a2840 !important; padding: 14px 36px; text-decoration: none; font-weight: 600; letter-spacing: 0.05em; font-size: 14px; margin-bottom: 24px; }
  .footer { color: #f5ebd7; opacity: 0.4; font-size: 11px; margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(212, 163, 116, 0.2); }
  .link { color: #d4a374; word-break: break-all; font-size: 12px; }
</style>
</head>
<body>
  <div class="container">
    <div class="hanja">結</div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <a href="${vaultUrl}" class="button">내 보관함 열기 →</a>
    <div class="subtitle" style="font-size: 12px; margin-top: 24px;">
      또는 아래 링크를 클릭하세요:<br/>
      <a href="${vaultUrl}" class="link">${vaultUrl}</a>
    </div>
    <div class="footer">
      결 (GYEOL) · 너의 결을 읽다<br/>
      주식회사 로월 · lowwall.kr@gmail.com<br/>
      이 이메일은 너가 직접 보관함을 만들 때 발송됐어요.
    </div>
  </div>
</body>
</html>`;
}
