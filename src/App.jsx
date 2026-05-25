import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link } from 'react-router-dom';
import html2canvas from 'html2canvas';

// ============= PROMPTS =============

const CHAT_SYSTEM_PROMPT = `너는 "결"이라는 AI 친구야. 사용자의 연애·끌림 패턴을 들여다보는 따뜻한 친구이자, 디지털 신탁 같은 존재.

== 첫 응답 규칙 (매우 중요) ==
사용자의 첫 메시지가 뭐든 ("안녕", "하이", "응" 등), 너의 첫 답변은 반드시 아래 4가지를 모두 포함해야 해:
1) 자기소개: "안녕! 나는 결이야"
2) 뭐 하는 곳인지: "너의 연애 결을 읽어주는 친구야" 또는 비슷한 설명
3) 진행 방식: "카톡하듯이 편하게 얘기해주면 돼"
4) 첫 질문: "근데 너는 뭐라고 부르면 될까?"

예시 첫 답변:
"안녕! 나는 결이야.
너의 연애 결을 읽어주는 친구야. 카톡하듯이 편하게 얘기해주면 돼.
근데 너는 뭐라고 부르면 될까?"

== 말투 ==
- 친근한 반말. 친한 친구처럼 편하게.
- 한 메시지 1-2문장. 짧게.
- 사용자 답변에 진심으로 반응해. "아 그랬구나", "오 그런 사람이구나", "정말?", "그래서 어떻게 됐어?"
- 한번에 질문 하나만. 절대 여러 개 X.
- 이모지 거의 안 써. 가끔만.

== 절대 하지 말 것 ==
- 사용자가 좋아했던 사람을 비웃거나 평가하지 마 ("그 사람 별로네", "왜 그런 사람을?" X)
- 호들갑 떨지 마 ("헐 대박!" "미쳤다 ㅋㅋㅋ" 같은 거 X)
- 사용자 답변을 가볍게 여기지 마. 진지하게 들어줘.
- 판단하는 톤 X. 그냥 호기심 있는 친구처럼.
- 너무 형식적이거나 거리 두는 말투 X

== 흐름 ==
1. 첫 답변 (위 자기소개)
2. 이름 받으면: 반갑게 받고 가볍게 나이대 묻기 ("[이름]아, 반가워! 나이대가 어떻게 돼?")
3. 본격 진입 전 안내:
   "그럼 천천히 시작해볼게. 살면서 좋아했거나 끌렸던 사람들 얘기를 들어볼 거야.
    꼭 연인 아니어도 돼. 짝사랑, 썸, 잠깐 끌렸던 사람, 뭐든 좋아."
4. 부드럽게 첫 질문: "처음 떠오르는 사람 있어?"
5. 있다고 하면 한 명씩 자연스럽게 깊이 파기 (만남/끌린 포인트/성격/관계/끝/지금 회상)
6. 사용자가 "연애 경험 없어" "남자친구 없었어" 류 답변하면:
   "괜찮아. 짝사랑이라도, 잠깐 마음 갔던 사람이라도 떠올려봐. 
    좋아한 연예인이나 캐릭터도 좋아. 누구든 떠오르는 사람 있어?"
7. 그래도 정말 없다고 하면: 1-2명 정보만으로도 분석 시작
8. 충분히 모이면 마지막 답변 끝에 정확히 "[READY_FOR_REPORT]" 토큰 붙이기. 사용자에게는 안 보임.

== 깊이 파는 방법 ==
- 짧은 답에 더 물어볼 때: "그래서?", "어떻게?", "왜 그 사람이었어?", "그때 너는 어땠어?"
- 한번에 여러 개 묻지 말고 하나씩
- 사용자가 머뭇거리면 가볍게 다음 주제로

== 최종 목표 ==
2-3명에 대한 정보 (만남/끌림/성격/관계/끝/회상)가 모이면 [READY_FOR_REPORT] 추가. 그 전엔 안 됨.`;

const REPORT_PROMPT = `다음은 사용자와 "결"이 나눈 대화야:

===
[대화내역]
===

이 대화를 바탕으로 사용자의 연애·끌림 패턴 분석 보고서를 작성해줘.

반드시 아래 JSON 형식으로만 답변. 다른 텍스트 절대 X. 코드 블록 표시 X.

{
  "headline": "한 줄 강렬 카피. 인스타 공유용. 15-25자.",
  "real_type": {
    "title": "5-10자 핵심 표현",
    "keywords": ["키워드", "키워드", "키워드"],
    "content": "본인이 의식한 이상형 vs 실제 끌리는 패턴 격차. 구체적 디테일 인용. 2-3문장."
  },
  "patterns": [
    {"title": "10자 내외 제목", "content": "구체적 근거와 함께 2-3문장. 대화에서 인용."},
    {"title": "...", "content": "..."},
    {"title": "...", "content": "..."}
  ],
  "attachment_style": {
    "type": "안정형/불안형/회피형/혼란형 중 하나",
    "percentage": 65,
    "reason": "왜 이렇게 추정했는지 근거 2-3문장"
  },
  "next_person": {
    "title": "10자 내외 한 줄 요약",
    "traits": ["특징 키워드", "특징 키워드", "특징 키워드", "특징 키워드"],
    "content": "왜 이런 사람이 좋은지 1-2문장 부연"
  },
  "avoid": {
    "title": "10자 내외 경고",
    "warnings": ["위험 신호", "위험 신호", "위험 신호"],
    "content": "왜 위험한지 1-2문장 부연"
  },
  "closing": "마무리 한마디. 따뜻하지만 직설적. 1-2문장."
}

원칙:
- 사주처럼 두루뭉술 X. 사용자가 말한 구체적 디테일 인용
- "와 어떻게 알았어" 소리 나올 만큼 통찰력
- 본인도 몰랐던 패턴 짚어주기
- keywords/traits/warnings는 한 단어~짧은 구로 짧게
- percentage는 30-95 사이 의미있는 숫자
- 따뜻하되 정직하게. 비하/평가절하 X
- content/reason은 짧게 (2문장 이내). 핵심만.

JSON 형식 규칙 (매우 중요):
- JSON 외 어떤 텍스트도 X
- string 안에 따옴표(") 절대 쓰지 마. 강조하고 싶으면 그냥 쓰거나 단어로 풀어써.
- string 안에 줄바꿈(\\n) 절대 X. 한 줄로 작성.
- 마지막 항목 뒤에 쉼표(,) X (trailing comma 금지)
- 모든 string은 큰따옴표(")로 감싸기. 한국어 따옴표(""'') 사용 X`;

// ============= STYLES =============

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
    
    .font-display { font-family: 'Cormorant Garamond', 'Nanum Myeongjo', serif; }
    .font-myeongjo { font-family: 'Nanum Myeongjo', serif; }
    .font-body { font-family: 'Inter', 'Nanum Myeongjo', sans-serif; }
    
    .grain::before {
      content: '';
      position: fixed; inset: 0; pointer-events: none;
      opacity: 0.05; z-index: 100; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .anim-fade-up { animation: fadeUp 0.4s ease-out forwards; }
    
    @keyframes pulseGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    .anim-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
    
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .shimmer {
      background: linear-gradient(90deg, transparent, rgba(212, 163, 116, 0.4), transparent);
      background-size: 200% 100%; animation: shimmer 2.5s linear infinite;
    }
    
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(212, 163, 116, 0.25); border-radius: 2px; }
    
    .blur-content { filter: blur(8px); user-select: none; pointer-events: none; }
  `}</style>
);

// ============= ROOT =============

export default function App() {
  return (
    <>
      <FontStyles />
      <BrowserRouter>
        <div className="min-h-screen bg-gradient-to-b from-[#3a2840] via-[#453050] to-[#4d3656] text-[#f5ebd7] font-body grain relative overflow-hidden">
          <Routes>
            <Route path="/" element={<HomeContainer />} />
            <Route path="/r/:id" element={<SharedReportPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </>
  );
}

// ============= HOME CONTAINER (생성 흐름) =============

function HomeContainer() {
  const [stage, setStage] = useState('landing'); // landing | chat | generating | report
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [report, setReport] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [error, setError] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // AI 응답 끝나면 자동으로 입력창 포커스 (사용자가 다시 클릭 안 하게)
  useEffect(() => {
    if (!isAiTyping && stage === 'chat') {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isAiTyping, stage]);

  const callClaude = async (msgs, systemPrompt = CHAT_SYSTEM_PROMPT, maxTokens = 1000) => {
    const body = { messages: msgs, max_tokens: maxTokens };
    if (systemPrompt) body.system = systemPrompt;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    return data.text || '';
  };

  const saveReport = async (reportData) => {
    try {
      const response = await fetch('/api/save-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: reportData }),
      });
      if (!response.ok) throw new Error('save failed');
      const data = await response.json();
      return data.id;
    } catch (err) {
      console.error('save error:', err);
      return null;
    }
  };

  const startConversation = async () => {
    setStage('chat');
    setIsAiTyping(true);
    try {
      const firstReply = await callClaude([{ role: 'user', content: '안녕' }]);
      setMessages([{ role: 'assistant', content: firstReply }]);
    } catch (err) {
      setError('연결에 문제가 생겼어. 다시 시도해줘.');
    }
    setIsAiTyping(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || isAiTyping) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsAiTyping(true);
    setError(null);

    try {
      const reply = await callClaude(newMessages);
      const isReady = reply.includes('[READY_FOR_REPORT]');
      const cleanReply = reply.replace('[READY_FOR_REPORT]', '').trim();
      const finalMessages = [...newMessages, { role: 'assistant', content: cleanReply }];
      setMessages(finalMessages);
      setIsAiTyping(false);
      if (isReady) {
        setTimeout(() => generateReport(finalMessages), 1500);
      }
    } catch (err) {
      setError('답변을 받지 못했어. 다시 보내봐.');
      setIsAiTyping(false);
    }
  };

  const generateReport = async (history) => {
    setStage('generating');
    setReportReady(false);
    const convoText = history.map(m => 
      `${m.role === 'user' ? '사용자' : '결'}: ${m.content}`
    ).join('\n\n');

    // JSON 정리 헬퍼
    const cleanAndParse = (text) => {
      let cleaned = text.replace(/```json|```/g, '').trim();
      // 첫 { 부터 마지막 } 까지만
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleaned = cleaned.substring(start, end + 1);
      }
      // trailing comma 제거
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      // 한국어 따옴표를 일반 따옴표로 (안전하게)
      // 위험할 수 있으니 string value 내부만 처리하는 건 어려워서 일단 skip
      return JSON.parse(cleaned);
    };

    // Prefilled assistant response로 안정성 ↑
    const tryGenerate = async () => {
      const userMessage = REPORT_PROMPT.replace('[대화내역]', convoText);
      const reportText = await callClaude(
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '{' }  // Claude가 무조건 JSON으로 시작
        ],
        null, 2500
      );
      // prefill 한 '{' 다시 붙이기
      const fullText = '{' + reportText;
      return cleanAndParse(fullText);
    };

    try {
      let parsed;
      try {
        parsed = await tryGenerate();
      } catch (err) {
        console.warn('First attempt failed, retrying:', err);
        // 1회 자동 재시도
        parsed = await tryGenerate();
      }
      setReport(parsed);
      saveReport(parsed).then(id => { if (id) setReportId(id); });
      setReportReady(true);
    } catch (err) {
      console.error('Report generation failed:', err);
      setStage('error_report');
    }
  };

  const resetAll = () => {
    setStage('landing');
    setMessages([]);
    setReport(null);
    setReportId(null);
    setError(null);
    setReportReady(false);
  };

  if (stage === 'landing') return <Landing onStart={startConversation} />;
  if (stage === 'chat') return (
    <ChatView
      messages={messages} input={input} setInput={setInput}
      isAiTyping={isAiTyping} sendMessage={sendMessage}
      scrollRef={scrollRef} inputRef={inputRef} error={error} onReset={resetAll}
    />
  );
  if (stage === 'generating') return (
    <GeneratingView reportReady={reportReady} onComplete={() => setStage('report')} />
  );
  if (stage === 'error_report') return (
    <ErrorReportView 
      onRetry={() => generateReport(messages)} 
      onReset={resetAll}
    />
  );
  if (stage === 'report' && report) return (
    <OwnerReportView report={report} reportId={reportId} onReset={resetAll} />
  );
  return null;
}

// ============= LANDING =============

function Landing({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-[#d4a374]/8 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-[#e8c192]/6 blur-3xl" />
      </div>
      <div className="relative z-10 anim-fade-up">
        <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-6 font-body">GYEOL · 結</div>
        <div className="font-myeongjo text-[120px] leading-none text-[#f5ebd7] mb-2 font-bold">결</div>
        <div className="my-12 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-[#d4a374]/50" />
          <div className="text-[#d4a374] text-xs tracking-[0.3em]">너의 결을 읽다</div>
          <div className="h-px w-12 bg-[#d4a374]/50" />
        </div>
        <h1 className="font-display text-3xl text-[#f5ebd7] mb-6 leading-relaxed italic">
          사주보다 정확한<br/>너의 연애 패턴
        </h1>
        <p className="text-[#f5ebd7]/70 text-sm leading-relaxed max-w-xs mx-auto mb-12 font-myeongjo">
          살면서 좋아했던 사람들의 이야기 속에<br/>너만의 결이 있어요
        </p>
        <button onClick={onStart}
          className="group relative bg-[#d4a374] text-[#3a2840] px-12 py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-all duration-300">
          <span className="relative z-10">결 보러가기</span>
          <span className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100" />
        </button>
        <div className="mt-16 text-[#f5ebd7]/40 text-[10px] tracking-widest font-body">
          무료 · 회원가입 없음 · 약 5–10분
        </div>
      </div>
    </div>
  );
}

// ============= CHAT =============

function ChatView({ messages, input, setInput, isAiTyping, sendMessage, scrollRef, inputRef, error, onReset }) {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <div className="border-b border-[#d4a374]/20 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
        <button onClick={onReset} className="text-[#f5ebd7]/50 text-xs hover:text-[#f5ebd7]/80 transition">← 처음</button>
        <div className="text-center">
          <div className="font-myeongjo text-[#d4a374] text-2xl font-bold leading-none">결</div>
          <div className="text-[#d4a374]/50 text-[9px] tracking-[0.3em] mt-1">GYEOL</div>
        </div>
        <div className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
        {isAiTyping && <TypingIndicator />}
        {error && <div className="text-center text-red-300/70 text-xs py-2">{error}</div>}
        <div ref={scrollRef} />
      </div>
      <div className="border-t border-[#d4a374]/20 px-4 py-3 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={isAiTyping ? "결이 답하는 중... 미리 답 적어둬도 돼" : "편하게 얘기해줘"}
            rows={1}
            className="flex-1 bg-[#f5ebd7] text-[#1a1a1a] placeholder-[#888] px-4 py-3 text-sm outline-none border border-[#d4a374]/40 focus:border-[#d4a374] transition-colors resize-none font-myeongjo caret-[#d4a374]"
            style={{ maxHeight: '120px' }} />
          <button onClick={sendMessage} disabled={isAiTyping || !input.trim()}
            className="bg-[#d4a374] text-[#3a2840] w-12 h-12 flex items-center justify-center disabled:opacity-30 hover:bg-[#e8c192] transition-colors flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L8 15M8 1L3 6M8 1L13 6" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex anim-fade-up ${isUser ? 'justify-end' : 'justify-start'} gap-2`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-[#d4a374]/20 border border-[#d4a374]/40 flex items-center justify-center text-[#d4a374] text-xs font-myeongjo font-bold flex-shrink-0 mt-1">결</div>
      )}
      <div className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words font-myeongjo ${
        isUser ? 'bg-[#d4a374] text-[#3a2840] rounded-2xl rounded-tr-sm' : 'bg-[#f5ebd7]/10 text-[#f5ebd7]/95 rounded-2xl rounded-tl-sm border border-[#d4a374]/15'
      }`}>
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2 anim-fade-up">
      <div className="w-8 h-8 rounded-full bg-[#d4a374]/20 border border-[#d4a374]/40 flex items-center justify-center text-[#d4a374] text-xs font-myeongjo font-bold flex-shrink-0 mt-1">결</div>
      <div className="bg-[#f5ebd7]/10 px-4 py-3 rounded-2xl rounded-tl-sm border border-[#d4a374]/15">
        <div className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 bg-[#d4a374]/80 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-[#d4a374]/80 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
          <span className="w-1.5 h-1.5 bg-[#d4a374]/80 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}

// ============= GENERATING =============

function GeneratingView({ reportReady, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const phases = ['너의 얘기를 모으는 중', '결을 읽고 있어', '패턴이 보여', '거의 다 됐어'];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (reportReady) {
          if (p >= 100) {
            clearInterval(interval);
            setTimeout(onComplete, 500);
            return 100;
          }
          return Math.min(100, p + 4);
        }
        if (p >= 95) return 95;
        return p + (95 - p) * 0.03 + 0.3;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [reportReady, onComplete]);

  useEffect(() => {
    const interval = setInterval(() => setPhase(p => (p + 1) % phases.length), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-[#d4a374]/25 blur-2xl rounded-full anim-pulse-glow" />
        <div className="relative font-myeongjo text-8xl text-[#d4a374] font-bold anim-pulse-glow">結</div>
      </div>
      <div className="h-6 mb-8">
        <p className="text-[#f5ebd7] text-base font-myeongjo anim-fade-up" key={phase}>{phases[phase]}...</p>
      </div>
      <div className="w-64 max-w-[80vw]">
        <div className="h-[2px] bg-[#d4a374]/20 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-[#d4a374] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }} />
          <div className="absolute inset-y-0 shimmer"
            style={{ left: `${Math.max(0, progress - 20)}%`, width: '20%', opacity: progress < 100 ? 1 : 0 }} />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-[#f5ebd7]/40 text-[10px] tracking-widest">PROGRESS</span>
          <span className="text-[#d4a374]/80 text-[10px] tracking-wider font-body">{Math.floor(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

// ============= ERROR REPORT VIEW =============

function ErrorReportView({ onRetry, onReset }) {
  const [retrying, setRetrying] = useState(false);
  
  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="font-myeongjo text-7xl text-[#d4a374]/50 font-bold mb-6">結</div>
      <h1 className="font-display italic text-2xl text-[#f5ebd7] mb-3">잠깐 결을 못 읽었어</h1>
      <p className="text-[#f5ebd7]/70 text-sm font-myeongjo mb-10 max-w-xs leading-relaxed">
        보고서 생성 중에 작은 문제가 생겼어.<br/>
        다시 시도하면 잘 될 거야.
      </p>
      <button 
        onClick={handleRetry}
        disabled={retrying}
        className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors mb-3 disabled:opacity-50"
      >
        {retrying ? '다시 시도하는 중...' : '다시 시도하기'}
      </button>
      <button 
        onClick={onReset}
        className="text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 transition text-xs tracking-wider py-2"
      >
        처음으로 돌아가기
      </button>
    </div>
  );
}

// ============= REPORT (본인용 — 전체 정보 + 공유/저장) =============

function OwnerReportView({ report, reportId, onReset }) {
  const [showShareModal, setShowShareModal] = useState(false);
  const reportContentRef = useRef(null);

  return (
    <div className="min-h-screen overflow-y-auto">
      <div ref={reportContentRef} className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <ReportHeader />
        <HeadlineCard headline={report.headline} />
        <RealTypeSection data={report.real_type} />
        <PatternsSection patterns={report.patterns} />
        <AttachmentSection data={report.attachment_style} />
        <NextPersonSection data={report.next_person} />
        <AvoidSection data={report.avoid} />
        <ClosingCard closing={report.closing} />
        <NewServicesCard />
      </div>
      
      <div className="max-w-xl mx-auto px-6 pb-12 space-y-3">
        <button onClick={() => setShowShareModal(true)}
          className="w-full bg-[#d4a374] text-[#3a2840] py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
          저장하고 공유하기
        </button>
        <button onClick={onReset}
          className="w-full text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 transition text-xs tracking-wider py-2">
          처음으로 돌아가기
        </button>
      </div>

      {showShareModal && (
        <ShareModal 
          report={report} reportId={reportId}
          reportContentRef={reportContentRef}
          onClose={() => setShowShareModal(false)} 
        />
      )}
    </div>
  );
}

// ============= REPORT 공통 컴포넌트 =============

function ReportHeader() {
  return (
    <div className="text-center anim-fade-up">
      <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-3">YOUR REPORT</div>
      <div className="font-myeongjo text-5xl text-[#d4a374] font-bold mb-2">結</div>
      <div className="flex items-center justify-center gap-3 mt-4">
        <div className="h-px w-8 bg-[#d4a374]/50" />
        <div className="text-[#d4a374] text-[10px] tracking-[0.3em]">너의 결</div>
        <div className="h-px w-8 bg-[#d4a374]/50" />
      </div>
    </div>
  );
}

function HeadlineCard({ headline }) {
  return (
    <div className="bg-gradient-to-br from-[#d4a374]/20 via-[#d4a374]/8 to-transparent border border-[#d4a374]/30 p-10 text-center anim-fade-up" style={{ animationDelay: '100ms' }}>
      <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-5">HEADLINE</div>
      <div className="font-display italic text-3xl text-[#f5ebd7] leading-relaxed">"{headline}"</div>
    </div>
  );
}

function RealTypeSection({ data }) {
  return (
    <Section title="진짜 끌리는 타입" subtitle="REAL TYPE" delay={200}>
      <h3 className="font-myeongjo text-[#d4a374] text-lg mb-4 font-bold">{data.title}</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        {data.keywords?.map((kw, i) => (
          <span key={i} className="bg-[#d4a374]/20 text-[#d4a374] px-3 py-1 text-xs font-myeongjo border border-[#d4a374]/40">{kw}</span>
        ))}
      </div>
      <p className="font-myeongjo text-[#f5ebd7]/90 leading-loose text-sm">{data.content}</p>
    </Section>
  );
}

function PatternsSection({ patterns }) {
  return (
    <Section title="반복되는 패턴" subtitle="PATTERN" delay={300}>
      <div className="space-y-6">
        {patterns.map((p, i) => (
          <div key={i} className="relative">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-display italic text-[#d4a374] text-2xl">0{i+1}</span>
              <h3 className="font-myeongjo text-[#d4a374] font-bold">{p.title}</h3>
            </div>
            <p className="font-myeongjo text-[#f5ebd7]/90 text-sm leading-loose pl-10">{p.content}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AttachmentSection({ data }) {
  return (
    <Section title="애착 유형" subtitle="ATTACHMENT" delay={400}>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {['안정형', '불안형', '회피형', '혼란형'].map(type => {
          const active = data.type === type;
          return (
            <div key={type} className={`text-center py-3 border transition-all ${
              active ? 'bg-[#d4a374] text-[#3a2840] border-[#d4a374] font-bold' : 'border-[#d4a374]/20 text-[#f5ebd7]/50'
            }`}>
              <div className="font-myeongjo text-sm">{type}</div>
            </div>
          );
        })}
      </div>
      <div className="mb-5">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[#d4a374] text-xs font-body tracking-wider">강도</span>
          <span className="font-display italic text-[#d4a374] text-2xl">{data.percentage}%</span>
        </div>
        <div className="h-[3px] bg-[#d4a374]/20 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-[#d4a374] transition-all duration-1000" style={{ width: `${data.percentage}%` }} />
        </div>
      </div>
      <p className="font-myeongjo text-[#f5ebd7]/90 text-sm leading-loose">{data.reason}</p>
    </Section>
  );
}

function NextPersonSection({ data }) {
  return (
    <Section title="다음에 만날 사람" subtitle="NEXT" delay={500}>
      <h3 className="font-myeongjo text-[#d4a374] text-lg mb-4 font-bold">{data.title}</h3>
      <div className="space-y-2.5 mb-5">
        {data.traits?.map((trait, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 border border-[#d4a374] flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 5L4 8L9 1.5" stroke="#d4a374" strokeWidth="1.5"/>
              </svg>
            </div>
            <span className="font-myeongjo text-[#f5ebd7]/95 text-sm">{trait}</span>
          </div>
        ))}
      </div>
      <p className="font-myeongjo text-[#f5ebd7]/75 leading-loose text-sm italic">{data.content}</p>
    </Section>
  );
}

function AvoidSection({ data }) {
  return (
    <Section title="조심해야 할 사람" subtitle="AVOID" delay={600} variant="danger">
      <h3 className="font-myeongjo text-[#d99a9a] text-lg mb-4 font-bold">{data.title}</h3>
      <div className="space-y-2 mb-5">
        {data.warnings?.map((w, i) => (
          <div key={i} className="flex items-center gap-3 bg-[#d99a9a]/12 border border-[#d99a9a]/25 px-3 py-2">
            <div className="text-[#d99a9a] text-sm">✕</div>
            <span className="font-myeongjo text-[#f5ebd7]/95 text-sm">{w}</span>
          </div>
        ))}
      </div>
      <p className="font-myeongjo text-[#f5ebd7]/75 leading-loose text-sm italic">{data.content}</p>
    </Section>
  );
}

function ClosingCard({ closing }) {
  return (
    <div className="bg-[#d4a374]/12 border-l-2 border-[#d4a374] py-8 px-6 anim-fade-up" style={{ animationDelay: '700ms' }}>
      <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-4">CLOSING</div>
      <p className="font-display italic text-xl text-[#f5ebd7] leading-relaxed">{closing}</p>
    </div>
  );
}

// 카카오 채널 + 인스타 친구추가 블록
const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_xkUQbX';
const INSTAGRAM_URL = 'https://instagram.com/gyeol_ur'; // TODO: 실제 핸들로 교체

function NewServicesCard() {
  return (
    <div className="bg-gradient-to-br from-[#d4a374]/15 via-[#d4a374]/8 to-transparent border border-[#d4a374]/30 p-8 anim-fade-up" style={{ animationDelay: '750ms' }}>
      <div className="text-center mb-6">
        <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3">COMING SOON</div>
        <h2 className="font-display italic text-2xl text-[#f5ebd7] mb-4 leading-relaxed">
          곧 새 결이 나와요
        </h2>
        <p className="font-myeongjo text-[#f5ebd7]/80 text-sm leading-relaxed">
          곧 너의 직업 성향, 취미, 마음 결까지<br/>
          새로운 결이 차례로 열려요.<br/>
          가장 먼저 알고 싶으시다면,<br/>
          친구추가해주세요. 서비스 나오면 알려드릴게요.
        </p>
      </div>

      <div className="space-y-3">
        {/* 카카오 채널 */}
        <a 
          href={KAKAO_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#FEE500] hover:bg-[#FFD700] transition-colors p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#3C1E1E">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.79l-1.2 4.4c-.11.39.32.7.65.48l5.27-3.49c.2.01.41.02.62.02 5.52 0 10-3.58 10-8s-4.48-7.2-10-7.2z"/>
            </svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-myeongjo text-[#3C1E1E] font-bold text-sm">카카오 채널 친구 추가</div>
            <div className="text-[#3C1E1E]/70 text-xs font-myeongjo mt-0.5">새 결 출시되면 카톡으로 알림</div>
          </div>
          <div className="text-[#3C1E1E] group-hover:translate-x-1 transition-transform">→</div>
        </a>

        {/* 인스타그램 */}
        <a 
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-gradient-to-r from-purple-500/25 via-pink-500/25 to-orange-500/25 border border-[#d4a374]/40 hover:border-[#d4a374]/70 transition p-4 flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="white"/>
            </svg>
          </div>
          <div className="text-left flex-1">
            <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타그램 팔로우</div>
            <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">@gyeol_kr · 결의 이야기 더 보기</div>
          </div>
          <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">→</div>
        </a>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children, delay = 0, variant = 'default' }) {
  const borderColor = variant === 'danger' ? 'border-[#d99a9a]/25' : 'border-[#d4a374]/20';
  const subtitleColor = variant === 'danger' ? 'text-[#d99a9a]/60' : 'text-[#d4a374]/60';
  return (
    <div className={`bg-[#f5ebd7]/[0.05] border ${borderColor} p-7 anim-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between mb-6 pb-4 border-b border-[#d4a374]/15">
        <h2 className="font-myeongjo text-[#f5ebd7] font-bold">{title}</h2>
        <span className={`${subtitleColor} text-[9px] tracking-[0.3em]`}>{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

// ============= SHARED REPORT PAGE (티저, /r/:id) =============

function SharedReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/get-report?id=${encodeURIComponent(id)}`)
      .then(async r => {
        if (r.status === 404) throw new Error('not_found');
        if (r.status === 410) throw new Error('expired');
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(data => {
        setReport(data.report);
        setLoading(false);
        // 헤드라인을 페이지 title에 반영 (카톡 공유시 미리보기에도 영향)
        document.title = `"${data.report.headline}" · 결`;
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="font-myeongjo text-6xl text-[#d4a374] font-bold anim-pulse-glow mb-4">結</div>
        <p className="text-[#f5ebd7]/60 text-sm font-myeongjo">결을 불러오는 중...</p>
      </div>
    );
  }

  if (error === 'not_found') {
    return <ExpiredOrNotFound title="결을 찾을 수 없어요" subtitle="잘못된 링크이거나, 삭제된 결이에요" />;
  }
  if (error === 'expired') {
    return <ExpiredOrNotFound title="기간이 만료된 결이에요" subtitle="결은 30일 동안만 보관돼요" />;
  }
  if (error || !report) {
    return <ExpiredOrNotFound title="문제가 생겼어요" subtitle="잠시 후 다시 시도해주세요" />;
  }

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <ReportHeader />

        {/* 헤드라인 - 공개 */}
        <HeadlineCard headline={report.headline} />

        {/* 친구 안내 배너 */}
        <div className="text-center py-4 anim-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#d4a374]/10 border border-[#d4a374]/25 text-[#d4a374]/80 text-xs font-myeongjo">
            <span className="text-[#d4a374]">•</span>
            친구의 결을 보고 있어요
            <span className="text-[#d4a374]">•</span>
          </div>
        </div>

        {/* Real Type 키워드 - 공개 */}
        <Section title="진짜 끌리는 타입" subtitle="REAL TYPE" delay={200}>
          <div className="flex flex-wrap gap-2">
            {report.real_type.keywords?.map((kw, i) => (
              <span key={i} className="bg-[#d4a374]/20 text-[#d4a374] px-3 py-1 text-xs font-myeongjo border border-[#d4a374]/40">{kw}</span>
            ))}
          </div>
        </Section>

        {/* Attachment - 공개 */}
        <Section title="애착 유형" subtitle="ATTACHMENT" delay={300}>
          <div className="text-center py-4">
            <div className="font-myeongjo text-[#d4a374] text-4xl font-bold mb-3">{report.attachment_style.type}</div>
            <div className="font-display italic text-[#d4a374]/80 text-xl">{report.attachment_style.percentage}%</div>
          </div>
        </Section>

        {/* CTA - 자기 결 만들기 */}
        <div className="bg-gradient-to-br from-[#d4a374]/15 to-[#d4a374]/5 border border-[#d4a374]/30 p-8 text-center space-y-4 anim-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="text-[#d4a374] text-[10px] tracking-[0.4em]">YOUR TURN</div>
          <p className="font-display italic text-2xl text-[#f5ebd7] leading-relaxed">
            너의 결은<br/>어떤 모양일까?
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors mt-4"
          >
            나의 결 보러가기
          </button>
        </div>

        {/* 가려진 섹션들 (티저) */}
        <div className="relative anim-fade-up" style={{ animationDelay: '500ms' }}>
          <div className="blur-content space-y-8">
            <Section title="반복되는 패턴" subtitle="PATTERN">
              <div className="space-y-6">
                {[1,2,3].map(i => (
                  <div key={i}>
                    <div className="font-myeongjo text-[#d4a374] font-bold mb-2">패턴 {i}</div>
                    <p className="font-myeongjo text-[#f5ebd7]/90 text-sm leading-loose">
                      여기에는 더 깊은 분석이 들어있어요. 본인만 볼 수 있도록 가려져 있습니다.
                      구체적인 패턴과 인사이트가 담겨 있어요.
                    </p>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="다음에 만날 사람" subtitle="NEXT">
              <p className="font-myeongjo text-[#f5ebd7]/90 text-sm leading-loose">
                미래의 이상형에 대한 상세한 분석이 여기 들어있어요.
              </p>
            </Section>
          </div>
          
          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="bg-[#3a2840]/80 backdrop-blur-sm border border-[#d4a374]/30 px-8 py-6 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4a374" strokeWidth="1.5" className="mx-auto mb-3">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <div className="text-[#d4a374] text-xs tracking-widest mb-1">PRIVATE</div>
              <p className="font-myeongjo text-[#f5ebd7]/90 text-sm">본인만 볼 수 있어요</p>
            </div>
          </div>
        </div>

        {/* 다시 한 번 CTA */}
        <div className="pt-4 anim-fade-up" style={{ animationDelay: '600ms' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-[#d4a374] text-[#3a2840] py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors"
          >
            나의 결 만들러 가기
          </button>
        </div>

        {/* 카카오 채널 + 인스타 */}
        <NewServicesCard />
        
        <div className="pb-12" />
      </div>
    </div>
  );
}

function ExpiredOrNotFound({ title, subtitle }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <div className="font-myeongjo text-7xl text-[#d4a374]/40 font-bold mb-6">結</div>
      <h1 className="font-display italic text-2xl text-[#f5ebd7] mb-3">{title}</h1>
      <p className="text-[#f5ebd7]/60 text-sm font-myeongjo mb-10">{subtitle}</p>
      <button
        onClick={() => navigate('/')}
        className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors"
      >
        나의 결 보러가기
      </button>
    </div>
  );
}

function NotFound() {
  return <ExpiredOrNotFound title="페이지를 찾을 수 없어요" subtitle="" />;
}

// ============= SHARE MODAL =============

function ShareModal({ report, reportId, reportContentRef, onClose }) {
  const [busy, setBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const shareUrl = reportId ? `${window.location.origin}/r/${reportId}` : null;

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareLinkNative = () => {
    if (!shareUrl) return;
    if (navigator.share) {
      // 모바일: native share sheet (카톡 직접 선택 가능)
      navigator.share({
        title: `"${report.headline}" · 결`,
        text: `나의 결을 읽어봤어`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      // PC: 링크 자동 복사 + 안내
      navigator.clipboard.writeText(shareUrl);
      alert('링크가 복사됐어!\n\n카톡 열어서 친구한테 붙여넣어줘.');
    }
  };

  const copyText = () => {
    const text = `[ 결 - 너의 결을 읽다 ]

"${report.headline}"

▎ 진짜 끌리는 타입 — ${report.real_type.title}
   ${report.real_type.keywords?.join(' · ')}
   ${report.real_type.content}

▎ 반복되는 패턴
${report.patterns.map((p, i) => `   0${i+1} ${p.title}\n      ${p.content}`).join('\n\n')}

▎ 애착 유형 — ${report.attachment_style.type} (${report.attachment_style.percentage}%)
   ${report.attachment_style.reason}

▎ 다음에 만날 사람 — ${report.next_person.title}
   ${report.next_person.traits?.join(' · ')}
   ${report.next_person.content}

▎ 조심해야 할 사람 — ${report.avoid.title}
   ${report.avoid.warnings?.join(' · ')}
   ${report.avoid.content}

— ${report.closing}

${shareUrl || ''}`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const downloadFullImage = async () => {
    if (!reportContentRef?.current) return;
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(reportContentRef.current, {
        backgroundColor: '#3a2840',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      // 무조건 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '나의-결.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('이미지 생성에 실패했어. 다시 시도해줘');
    }
    setBusy(false);
  };

  const downloadCardImage = async (type) => {
    setBusy(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = type === 'story' ? renderStoryImage(report, shareUrl) : renderPostImage(report, shareUrl);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 1));
      // 무조건 다운로드 (사용자가 직접 인스타에 올리는 게 명확)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `결-${type === 'story' ? '스토리' : '게시글'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('이미지 생성에 실패했어');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center overflow-y-auto" onClick={onClose}>
      <div className="bg-[#4d3656] border border-[#d4a374]/40 w-full max-w-md p-6 anim-fade-up my-auto" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-myeongjo text-[#d4a374] text-xl font-bold">결 저장 · 공유</div>
            <div className="text-[#f5ebd7]/50 text-xs mt-1 font-myeongjo">
              {shareUrl ? '30일간 이 링크로 다시 볼 수 있어요' : '저장 중...'}
            </div>
          </div>
          <button onClick={onClose} className="text-[#f5ebd7]/50 hover:text-[#f5ebd7]/90 text-2xl leading-none">×</button>
        </div>

        {/* Share URL */}
        {shareUrl && (
          <div className="mb-5 bg-[#f5ebd7]/8 border border-[#d4a374]/30 p-3 flex items-center gap-2">
            <div className="flex-1 overflow-hidden">
              <div className="text-[10px] text-[#d4a374] tracking-widest mb-1">MY LINK</div>
              <div className="text-[#f5ebd7]/90 text-xs font-body truncate">{shareUrl}</div>
            </div>
            <button onClick={copyLink} className="bg-[#d4a374] text-[#3a2840] px-3 py-2 text-xs font-medium tracking-wider hover:bg-[#e8c192] transition flex-shrink-0">
              {copiedLink ? '✓' : '복사'}
            </button>
          </div>
        )}

        <div className="text-[#d4a374]/60 text-[10px] tracking-widest mb-3">SHARE</div>

        {/* 카톡 / 친구한테 링크 보내기 */}
        <div className="space-y-2 mb-5">
          <button onClick={shareLinkNative} disabled={!shareUrl}
            className="w-full bg-[#FEE500]/20 border border-[#FEE500]/40 hover:border-[#FEE500]/70 transition p-3.5 flex items-center gap-3 group disabled:opacity-50">
            <div className="w-10 h-10 bg-[#FEE500] flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.79l-1.2 4.4c-.11.39.32.7.65.48l5.27-3.49c.2.01.41.02.62.02 5.52 0 10-3.58 10-8s-4.48-7.2-10-7.2z"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">친구한테 보내기</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">카톡으로 결 페이지 링크 공유</div>
            </div>
            <div className="text-[#FEE500] group-hover:translate-x-1 transition-transform">→</div>
          </button>
        </div>

        <div className="text-[#d4a374]/60 text-[10px] tracking-widest mb-3">DOWNLOAD</div>
        <div className="space-y-2 mb-5">
          <button onClick={() => downloadCardImage('story')} disabled={busy}
            className="w-full bg-gradient-to-r from-purple-500/25 via-pink-500/25 to-orange-500/25 border border-[#d4a374]/40 hover:border-[#d4a374]/70 transition p-3.5 flex items-center gap-3 group disabled:opacity-50">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="white"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타 스토리</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">9:16 세로 이미지</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">→</div>
          </button>

          <button onClick={() => downloadCardImage('post')} disabled={busy}
            className="w-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-[#d4a374]/40 hover:border-[#d4a374]/70 transition p-3.5 flex items-center gap-3 group disabled:opacity-50">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타 게시글</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">1:1 정사각형</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">→</div>
          </button>

          <button onClick={downloadFullImage} disabled={busy}
            className="w-full bg-[#f5ebd7]/8 border border-[#d4a374]/40 hover:border-[#d4a374]/70 transition p-3.5 flex items-center gap-3 group disabled:opacity-50">
            <div className="w-10 h-10 bg-[#d4a374]/30 border border-[#d4a374] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a374" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">전체 결과 이미지</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">보고서 전체를 한 장 PNG로</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">↓</div>
          </button>

          <button onClick={copyText}
            className="w-full bg-[#f5ebd7]/8 border border-[#d4a374]/40 hover:border-[#d4a374]/70 transition p-3.5 flex items-center gap-3 group">
            <div className="w-10 h-10 bg-[#d4a374]/30 border border-[#d4a374] flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a374" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">{copiedText ? '복사됐어' : '글로 복사하기'}</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-0.5">메모장·노션 등에 붙여넣기</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">{copiedText ? '✓' : '⧉'}</div>
          </button>
        </div>

        {busy && (
          <div className="mt-3 text-center text-[#d4a374] text-xs font-myeongjo anim-pulse-glow">처리 중...</div>
        )}
      </div>
    </div>
  );
}

// ============= CANVAS IMAGE GENERATORS =============

function renderStoryImage(report, shareUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, '#3a2840'); bg.addColorStop(0.5, '#453050'); bg.addColorStop(1, '#5a3f66');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);

  const glow = ctx.createRadialGradient(540, 600, 0, 540, 600, 700);
  glow.addColorStop(0, 'rgba(212, 163, 116, 0.15)'); glow.addColorStop(1, 'rgba(212, 163, 116, 0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1920);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212, 163, 116, 0.6)';
  ctx.font = '300 24px "Inter", sans-serif';
  ctx.fillText('G Y E O L · 結', 540, 220);

  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 280px "Nanum Myeongjo", serif';
  ctx.fillText('結', 540, 600);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(420, 720); ctx.lineTo(660, 720); ctx.stroke();

  ctx.fillStyle = '#d4a374';
  ctx.font = '300 26px "Inter", sans-serif';
  ctx.fillText('너의 결', 540, 770);

  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'italic 600 56px "Cormorant Garamond", "Nanum Myeongjo", serif';
  const wrapped = wrapText(ctx, `"${report.headline}"`, 900);
  let y = 950;
  wrapped.forEach(line => { ctx.fillText(line, 540, y); y += 80; });

  ctx.fillStyle = 'rgba(212, 163, 116, 0.8)';
  ctx.font = '300 22px "Inter", sans-serif';
  ctx.fillText('A T T A C H M E N T', 540, 1280);
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 80px "Nanum Myeongjo", serif';
  ctx.fillText(report.attachment_style.type, 540, 1380);

  if (report.real_type.keywords?.length > 0) {
    ctx.fillStyle = 'rgba(212, 163, 116, 0.8)';
    ctx.font = '300 22px "Inter", sans-serif';
    ctx.fillText('R E A L   T Y P E', 540, 1520);
    const kws = report.real_type.keywords.slice(0, 3).join('  ·  ');
    ctx.fillStyle = '#f5ebd7';
    ctx.font = '500 36px "Nanum Myeongjo", serif';
    ctx.fillText(kws, 540, 1590);
  }

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.beginPath(); ctx.moveTo(420, 1750); ctx.lineTo(660, 1750); ctx.stroke();
  ctx.fillStyle = 'rgba(245, 235, 215, 0.6)';
  ctx.font = '300 24px "Nanum Myeongjo", serif';
  ctx.fillText(shareUrl ? '나의 결 보러가기' : 'gyeol.app', 540, 1810);

  return canvas;
}

function renderPostImage(report, shareUrl) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, '#3a2840'); bg.addColorStop(1, '#4d3656');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 500);
  glow.addColorStop(0, 'rgba(212, 163, 116, 0.12)'); glow.addColorStop(1, 'rgba(212, 163, 116, 0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.35)'; ctx.lineWidth = 1;
  ctx.strokeRect(80, 80, 920, 920);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 140px "Nanum Myeongjo", serif';
  ctx.fillText('結', 540, 280);

  ctx.fillStyle = 'rgba(212, 163, 116, 0.7)';
  ctx.font = '300 22px "Inter", sans-serif';
  ctx.fillText('G Y E O L', 540, 340);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.beginPath(); ctx.moveTo(440, 390); ctx.lineTo(640, 390); ctx.stroke();

  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'italic 600 52px "Cormorant Garamond", "Nanum Myeongjo", serif';
  const wrapped = wrapText(ctx, `"${report.headline}"`, 800);
  let y = 500;
  wrapped.forEach(line => { ctx.fillText(line, 540, y); y += 70; });

  ctx.fillStyle = 'rgba(212, 163, 116, 0.8)';
  ctx.font = '300 20px "Inter", sans-serif';
  ctx.fillText('A T T A C H M E N T', 540, 780);
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 60px "Nanum Myeongjo", serif';
  ctx.fillText(report.attachment_style.type, 540, 850);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.beginPath(); ctx.moveTo(440, 920); ctx.lineTo(640, 920); ctx.stroke();
  ctx.fillStyle = 'rgba(245, 235, 215, 0.6)';
  ctx.font = '300 22px "Nanum Myeongjo", serif';
  ctx.fillText('나의 결을 읽어봤어', 540, 970);

  return canvas;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let currentLine = '';
  for (const char of text.split('')) {
    const test = currentLine + char;
    if (ctx.measureText(test).width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
