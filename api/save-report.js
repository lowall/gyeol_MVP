// /api/save-report.js
// 결과를 Firestore에 저장하고 짧은 ID 반환
// 30일 후 만료

import { getFirestore } from './_lib/firebase-admin.js';
import { nanoid } from 'nanoid';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { report, category } = req.body;

    if (!report || !report.headline) {
      return res.status(400).json({ error: 'Invalid report data' });
    }

    const db = getFirestore();

    // 짧은 ID 생성 (10자, URL-safe)
    const id = nanoid(10);

    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30일

    await db.collection('reports').doc(id).set({
      report,
      category: category || 'love',
      createdAt: now,
      expiresAt,
      viewCount: 0,
    });

    return res.status(200).json({ id, expiresAt });
  } catch (err) {
    console.error('save-report error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
