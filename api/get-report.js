// /api/get-report.js?id=xxx
// id로 결과 조회. 만료된 거면 410 반환.

import { getFirestore } from './_lib/firebase-admin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string' || id.length > 50) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const db = getFirestore();
    const docRef = db.collection('reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'not_found' });
    }

    const data = doc.data();
    const now = Date.now();

    // 만료 체크
    if (data.expiresAt && data.expiresAt < now) {
      return res.status(410).json({ error: 'expired' });
    }

    // viewCount 증가 (비동기, 실패해도 OK)
    docRef.update({ viewCount: (data.viewCount || 0) + 1 }).catch(() => {});

    return res.status(200).json({
      report: data.report,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    });
  } catch (err) {
    console.error('get-report error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
