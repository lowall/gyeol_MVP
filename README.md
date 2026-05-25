# 결 (GYEOL)

> 사주보다 정확한 너의 연애 패턴. AI가 너의 결을 읽어드립니다.

카톡 스타일 채팅으로 좋아했던 사람들 얘기를 듣고, AI가 너의 끌림 패턴을 분석해주는 서비스.

---

## 기술 스택

- **React 18** + **Vite** (프론트엔드)
- **Tailwind CSS** (스타일링)
- **Vercel Serverless Functions** (Anthropic API 프록시)
- **Anthropic Claude Sonnet 4.5** (대화 + 분석)

---

## 로컬 개발

### 1. 설치

```bash
npm install
```

### 2. 환경변수 설정

프로젝트 루트에 `.env.local` 파일 만들기:

```
ANTHROPIC_API_KEY=sk-ant-api03-여기에본인키
```

API 키는 https://console.anthropic.com 에서 발급.

### 3. 로컬 실행

```bash
# Vercel CLI 설치 (serverless function 로컬 테스트용)
npm install -g vercel

# 로컬 dev 서버 실행
vercel dev
```

브라우저에서 http://localhost:3000

> **주의:** `npm run dev`(vite만 실행)으로 띄우면 `/api/chat`가 작동 안 함. 반드시 `vercel dev` 사용.

---

## Vercel 배포

### 1. GitHub에 push

```bash
git init
git add .
git commit -m "Initial commit: 결 MVP"
git branch -M main
git remote add origin https://github.com/본인계정/gyeol.git
git push -u origin main
```

### 2. Vercel 프로젝트 import

1. https://vercel.com 로그인
2. **Add New → Project**
3. GitHub 레포 선택 (gyeol)
4. **Framework Preset**: Vite (자동 감지됨)
5. **Environment Variables** 추가:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...`
6. **Deploy** 클릭

### 3. 완료

`https://your-project.vercel.app` 에서 작동.

---

## 프로젝트 구조

```
gyeol/
├── api/
│   └── chat.js          # Vercel Serverless: Anthropic API 프록시
├── src/
│   ├── App.jsx          # 메인 앱 (Landing/Chat/Generating/Report/Share)
│   ├── main.jsx         # 진입점
│   └── index.css        # Tailwind + 전역 스타일
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── vercel.json          # Function timeout 설정
└── .env.local           # ANTHROPIC_API_KEY (gitignore)
```

---

## 디자인 컨셉

- **컬러**: 딥 인디고(#15101f) + 워밍 골드(#d4a374) + 크림(#f5ebd7)
- **폰트**: 나눔명조 (한글) + Cormorant Garamond (영문)
- **무드**: 한지 + 신탁 + 잡지 에디토리얼

사주 보라색 클리셰 피하고, 한국적 + 신비로운 + 모던한 느낌으로.

---

## 비용 추산

Claude Sonnet 4.5 기준 사용자 1명 분석에 약:
- 대화 (10-15턴): 약 5,000~10,000 토큰
- 보고서 생성: 약 3,000~5,000 토큰
- **합계 약 13,000~15,000 토큰 → 약 ₩60-80**

100명 테스트 = 약 ₩6,000~8,000

---

## 향후 로드맵

- [ ] 결과 페이지 OG 이미지 자동 생성
- [ ] 사용자 결과 저장 (Firestore)
- [ ] 친구 결과 비교 기능
- [ ] 유료 확장 (커리어편, 마음편)
- [ ] 도메인 (gyeol.ai)
- [ ] 상표 등록
