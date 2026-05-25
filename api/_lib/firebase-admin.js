// api/_lib/firebase-admin.js
// Vercel Serverless Function에서 Firebase Admin SDK 초기화
// 환경변수: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from 'firebase-admin';

let app;

export function getFirebaseAdmin() {
  if (app) return app;

  // 이미 초기화된 앱이 있는지 체크 (Vercel은 가끔 같은 인스턴스 재사용)
  if (admin.apps.length > 0) {
    app = admin.apps[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase 환경변수 누락: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  }

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  return app;
}

export function getFirestore() {
  getFirebaseAdmin();
  return admin.firestore();
}
