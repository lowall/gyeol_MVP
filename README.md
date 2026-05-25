# 결 (GYEOL)

> 사주보다 정확한 너의 연애 패턴. AI가 너의 결을 읽어드립니다.

카톡 스타일 채팅으로 좋아했던 사람들 얘기를 듣고, AI가 너의 끌림 패턴을 분석. 결과는 30일 동안 보관되며, 친구한테 링크로 공유 가능.

---

## 핵심 기능

- **카톡 스타일 AI 채팅** — 자연스럽게 연애 이야기 수집
- **AI 분석 보고서** — 헤드라인, 패턴, 애착유형, 미래 매칭 등
- **결과 영구 URL** — `/r/{id}` (30일 유지)
- **티저 공유 페이지** — 친구는 헤드라인/애착유형만 봄, 나머지는 블러
- **다양한 공유 옵션** — 카톡 링크, 인스타 스토리/게시글 이미지, 전체 이미지 다운로드, 텍스트 복사

---

## 기술 스택

- **React 18** + **Vite** + **React Router 6**
- **Tailwind CSS**
- **Firestore** (결과 저장)
- **Vercel Serverless Functions** (Anthropic + Firebase 프록시)
- **Claude Sonnet 4.5** (대화 + 분석)
- **html2canvas** (전체 이미지 다운로드)

---

## 셋업

### 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com → **프로젝트 추가**
2. 프로젝트 이름: `gyeol` (별길과 별개로)
3. Google Analytics: No
4. 왼쪽 메뉴 → **Firestore Database** → **데이터베이스 만들기**
   - 모드: **프로덕션 모드**
   - 위치: **asia-northeast3 (서울)**

### 2. Firestore 보안 규칙

Firestore → 규칙 탭 → 아래로 갈아치우기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

(서버 API는 Admin SDK로 우회. 클라이언트 직접 접근 차단.)

### 3. Service Account 키 발급

- 프로젝트 설정 (⚙️) → **서비스 계정** 탭
- **새 비공개 키 생성** → JSON 파일 다운로드
- 이 JSON 안의 다음 3개 값을 환경변수로 등록할 거임:
  - `project_id`
  - `client_email`
  - `private_key`

### 4. Anthropic API 키 발급

- https://console.anthropic.com → API Keys → Create Key
- ⚠️ **결 프로덕션용 별도 계정 권장** (개인 개발 계정과 분리)

---

## 로컬 개발

### 설치

```bash
npm install
```

### 환경변수 설정

프로젝트 루트에 `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
FIREBASE_PROJECT_ID=gyeol-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@gyeol-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n....(여러 줄)....\n-----END PRIVATE KEY-----\n"
```

⚠️ `FIREBASE_PRIVATE_KEY`는 반드시 큰따옴표로 감싸고, 줄바꿈은 `\n`으로 escape 처리.

### 로컬 실행

```bash
npm install -g vercel
vercel dev
```

http://localhost:3000

`npm run dev`(vite만)은 `/api/*` 안 됨. `vercel dev` 필수.

---

## Vercel 배포

### 1. GitHub push

```bash
git init
git add .
git commit -m "Initial: 결 MVP v0.2 (Firestore 저장 + 공유)"
git branch -M main
git remote add origin https://github.com/본인계정/gyeol.git
git push -u origin main
```

### 2. Vercel 프로젝트 import

1. https://vercel.com → **Add New → Project**
2. GitHub 레포 선택 (gyeol)
3. **Framework Preset**: Vite (자동)
4. **Environment Variables** 추가 (총 4개):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| `FIREBASE_PROJECT_ID` | Firebase JSON의 `project_id` |
| `FIREBASE_CLIENT_EMAIL` | Firebase JSON의 `client_email` |
| `FIREBASE_PRIVATE_KEY` | Firebase JSON의 `private_key` (전체, BEGIN/END 포함) |

> `FIREBASE_PRIVATE_KEY` 입력 시: Vercel은 multi-line 값을 받음. JSON에서 복사한 그대로 (따옴표 빼고) 붙여넣기. 코드에서 `\\n` → `\n` 변환함.

5. **Deploy**

배포 완료 → `https://your-project.vercel.app`

### 3. OG 이미지 (선택, 카톡 미리보기용)

기본 OG 이미지가 없으면 카톡에 링크 공유시 미리보기 카드가 안 뜸 (텍스트는 뜸).

만들고 싶다면:
- 1200x630px PNG 이미지 만들기 (결 로고 + "너의 결을 읽다")
- 파일명: `og-image.png`
- 위치: 프로젝트 루트에 `public/` 폴더 만들고 그 안에 저장
- GitHub에 push → Vercel 자동 재배포

---

## 프로젝트 구조

```
gyeol/
├── api/
│   ├── chat.js              # Anthropic 프록시
│   ├── save-report.js       # 결과 Firestore 저장
│   ├── get-report.js        # id로 결과 조회
│   └── _lib/
│       └── firebase-admin.js  # Firebase Admin 초기화
├── src/
│   ├── App.jsx              # 메인 (라우팅 포함, 약 900줄)
│   ├── main.jsx
│   └── index.css
├── index.html               # OG 메타 포함
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json              # API timeout + SPA rewrites
├── .gitignore
└── .env.local               # (gitignore)
```

---

## 라우트

| Path | Description |
|---|---|
| `/` | 메인 (Landing → Chat → Report 흐름) |
| `/r/:id` | 친구가 공유받아서 보는 티저 페이지 |
| `/api/chat` | Anthropic API 프록시 |
| `/api/save-report` | 결과 저장, ID 반환 |
| `/api/get-report?id=xxx` | 결과 조회 |

---

## 데이터 모델 (Firestore)

```
reports/{id}
{
  report: {
    headline: "...",
    real_type: {...},
    patterns: [...],
    attachment_style: {...},
    next_person: {...},
    avoid: {...},
    closing: "..."
  },
  createdAt: 1700000000000,
  expiresAt: 1700000000000 + 30일,
  viewCount: 0
}
```

---

## 비용

**Claude Sonnet 4.5** 기준 사용자 1명 = 약 60-80원
**Firestore**: 무료 한도 충분 (하루 5만 read, 2만 write)

100명 테스트 = 약 6,000~8,000원. MVP 단계엔 부담 없음.

---

## 향후 로드맵 (Phase 2+)

- [ ] OG 이미지 동적 생성 (`@vercel/og`)
- [ ] 카카오 로그인 + 마이페이지 (결과 누적)
- [ ] 결과 본인이 삭제 가능
- [ ] 친구 결과 비교
- [ ] 유료 SKU (커리어편, 마음편)
- [ ] 도메인 (gyeol.ai)
