// /api/get-vault.js?userId=xxx
// 사용자의 보관함 + 모든 리포트 가져오기

import { getFirestore } from './_lib/firebase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string' || userId.length > 50) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const db = getFirestore();
    const vaultDoc = await db.collection('vaults').doc(userId).get();
    
    if (!vaultDoc.exists) {
      return res.status(404).json({ error: 'not_found' });
    }

    const vault = vaultDoc.data();
    
    // 각 리포트 데이터 가져오기 (병렬)
    const reportPromises = (vault.reports || []).map(async (item) => {
      try {
        const reportDoc = await db.collection('reports').doc(item.reportId).get();
        if (!reportDoc.exists) return null;
        const data = reportDoc.data();
        // 만료 체크 (vault에 저장된 건 만료 무시 — 본인 자료라)
        return {
          reportId: item.reportId,
          category: item.category,
          savedAt: item.savedAt,
          report: data.report,
          createdAt: data.createdAt,
        };
      } catch (err) {
        console.error('Failed to fetch report:', item.reportId, err);
        return null;
      }
    });
    
    const reports = (await Promise.all(reportPromises))
      .filter(r => r !== null)
      .sort((a, b) => b.savedAt - a.savedAt); // 최신순

    // 마지막 접근 시간 업데이트 (비동기)
    vaultDoc.ref.update({ lastAccessedAt: Date.now() }).catch(() => {});

    return res.status(200).json({
      userId,
      email: vault.email,
      reports,
      createdAt: vault.createdAt,
    });
  } catch (err) {
    console.error('get-vault error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
