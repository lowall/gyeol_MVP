import React, { useState, useRef, useEffect } from 'react';

// ============= PROMPTS =============

const CHAT_SYSTEM_PROMPT = `너는 "결"이라는 AI 친구야. 사용자의 연애·끌림 패턴을 들여다보는 친한 친구이자, 디지털 신탁 같은 존재.

말투:
- 카톡 친구처럼 반말. 친근하지만 약간 무게감 있게.
- 한 메시지 1-2문장. 짧게.
- 진심으로 반응. "아 그랬구나", "오 좀 특이하네", "헐 어떡해", "그래서?"
- 한번에 질문 하나만. 절대 여러 개 X.
- 이모지 거의 안 써. 가끔 ㅋㅋ 정도.

흐름:
1. 첫 메시지: 가벼운 인사 + "뭐라고 부르면 될까?" 만 묻기. 분석 얘기는 아직 X.
2. 이름 받으면: 반갑게 받고 + 나이대 정도 가볍게 (예: "[이름]아 반가워! 너 몇살이야?")
3. 본격 진입 전 setup: 갑자기 질문 X. 이렇게 말해줘:
   "그럼 천천히 가볼게. 살면서 좋아했거나 끌렸던 사람들 얘기를 들어볼 거야. 꼭 연인 아니어도 돼. 짝사랑, 썸, 잠깐 끌렸던 사람, 뭐든."
4. 잠깐 텀 두고: "처음 떠오르는 사람 있어?"
5. 있다고 하면 한 명씩 깊이 파기 (만남/끌린 포인트/성격/관계종류/끝/지금 회상)
6. 사용자가 "연애 경험 없어" "남자친구 없었어" "끌린 사람 없어" 류 답변하면:
   "괜찮아. 그럼 짝사랑이라도, 잠깐이라도 마음 갔던 사람 떠올려봐. 좋아한 연예인이나 캐릭터도 ok야. 누구든 떠오르는 사람 있어?"
7. 그래도 정말 없다고 하면: 1-2명 정도 정보만으로도 분석 시작
8. 충분히 모이면 마지막 답변 끝에 정확히 "[READY_FOR_REPORT]" 토큰 붙이기. 사용자에게는 안 보임.

규칙:
- 첫 질문에서 절대 갑자기 본격 분석 들어가지 마. 천천히.
- 한번에 여러 질문 X
- 짧은 답변에는 더 깊이 파 ("그래서?", "어떻게?", "왜 그 사람이었어?")
- 3명 정보 충분 모일 때까지 [READY_FOR_REPORT] 안 붙임
- 가능한 2-3명까지는 모으려고 노력. 정 안 되면 1명도 ok
- 사용자가 머뭇거리면 가볍게 넘어가도 돼`;

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
- "와 미쳤다 어떻게 알았어" 소리 나올 만큼 통찰력
- 본인도 몰랐던 패턴 짚어주기
- keywords/traits/warnings는 한 단어~짧은 구로 짧게 (예: "지적인", "감정 표현 적은", "리드하는")
- percentage는 30-95 사이 의미있는 숫자
- JSON 외 어떤 텍스트도 X`;

// ============= FONTS & STYLES =============

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
    
    .font-display { font-family: 'Cormorant Garamond', 'Nanum Myeongjo', serif; }
    .font-myeongjo { font-family: 'Nanum Myeongjo', serif; }
    .font-body { font-family: 'Inter', 'Nanum Myeongjo', sans-serif; }
    
    .grain::before {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.06;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      z-index: 100;
      mix-blend-mode: overlay;
    }
    
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .anim-fade-up { animation: fadeUp 0.4s ease-out forwards; }
    
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    .anim-pulse-glow { animation: pulseGlow 2s ease-in-out infinite; }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .shimmer {
      background: linear-gradient(90deg, transparent, rgba(212, 163, 116, 0.4), transparent);
      background-size: 200% 100%;
      animation: shimmer 2.5s linear infinite;
    }
    
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(212, 163, 116, 0.2); border-radius: 2px; }
  `}</style>
);

// ============= MAIN APP =============

export default function App() {
  const [stage, setStage] = useState('landing');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // === API call via Vercel Serverless Function ===
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

  const startConversation = async () => {
    setStage('chat');
    setIsAiTyping(true);

    try {
      const firstReply = await callClaude([
        { role: 'user', content: '안녕' }
      ]);
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

    try {
      const reportText = await callClaude(
        [{ role: 'user', content: REPORT_PROMPT.replace('[대화내역]', convoText) }],
        null,
        2500
      );
      const cleaned = reportText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      setReport(parsed);
      setReportReady(true);
    } catch (err) {
      console.error(err);
      setError('보고서 생성에 실패했어. 다시 시도해줘.');
      setStage('chat');
    }
  };

  const resetAll = () => {
    setStage('landing');
    setMessages([]);
    setReport(null);
    setError(null);
    setReportReady(false);
  };

  return (
    <>
      <FontStyles />
      <div className="min-h-screen bg-[#15101f] text-[#f5ebd7] font-body grain relative overflow-hidden">
        {stage === 'landing' && <Landing onStart={startConversation} />}
        {stage === 'chat' && (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            isAiTyping={isAiTyping}
            sendMessage={sendMessage}
            scrollRef={scrollRef}
            inputRef={inputRef}
            error={error}
            onReset={resetAll}
          />
        )}
        {stage === 'generating' && (
          <GeneratingView 
            reportReady={reportReady} 
            onComplete={() => setStage('report')}
          />
        )}
        {stage === 'report' && report && <ReportView report={report} onReset={resetAll} />}
      </div>
    </>
  );
}

// ============= LANDING =============

function Landing({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#d4a374]/5 blur-3xl" />
      </div>

      <div className="relative z-10 anim-fade-up">
        <div className="text-[#d4a374]/40 text-[10px] tracking-[0.5em] mb-6 font-body">GYEOL · 結</div>
        <div className="font-myeongjo text-[120px] leading-none text-[#f5ebd7] mb-2 font-bold">결</div>
        
        <div className="my-12 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-[#d4a374]/40" />
          <div className="text-[#d4a374] text-xs tracking-[0.3em]">너의 결을 읽다</div>
          <div className="h-px w-12 bg-[#d4a374]/40" />
        </div>

        <h1 className="font-display text-3xl text-[#f5ebd7] mb-6 leading-relaxed italic">
          사주보다 정확한<br/>너의 연애 패턴
        </h1>
        <p className="text-[#f5ebd7]/60 text-sm leading-relaxed max-w-xs mx-auto mb-12 font-myeongjo">
          살면서 좋아했던 사람들의 이야기 속에<br/>
          너만의 결이 있어요
        </p>

        <button
          onClick={onStart}
          className="group relative bg-[#d4a374] text-[#15101f] px-12 py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-all duration-300"
        >
          <span className="relative z-10">결 보러가기</span>
          <span className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100" />
        </button>

        <div className="mt-16 text-[#f5ebd7]/30 text-[10px] tracking-widest font-body">
          무료 · 회원가입 없음 · 약 5–10분
        </div>
      </div>
    </div>
  );
}

// ============= CHAT VIEW =============

function ChatView({ messages, input, setInput, isAiTyping, sendMessage, scrollRef, inputRef, error, onReset }) {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <div className="border-b border-[#d4a374]/15 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
        <button onClick={onReset} className="text-[#f5ebd7]/40 text-xs hover:text-[#f5ebd7]/70 transition">← 처음</button>
        <div className="text-center">
          <div className="font-myeongjo text-[#d4a374] text-2xl font-bold leading-none">결</div>
          <div className="text-[#d4a374]/40 text-[9px] tracking-[0.3em] mt-1">GYEOL</div>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {isAiTyping && <TypingIndicator />}
        {error && (
          <div className="text-center text-red-300/70 text-xs py-2">{error}</div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="border-t border-[#d4a374]/15 px-4 py-3 backdrop-blur-sm">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={isAiTyping ? "결이 생각하는 중..." : "편하게 얘기해줘"}
            disabled={isAiTyping}
            rows={1}
            className="flex-1 bg-[#f5ebd7]/5 text-[#f5ebd7] placeholder-[#f5ebd7]/30 px-4 py-3 text-sm outline-none border border-[#d4a374]/20 focus:border-[#d4a374]/50 transition-colors resize-none font-myeongjo"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={isAiTyping || !input.trim()}
            className="bg-[#d4a374] text-[#15101f] w-12 h-12 flex items-center justify-center disabled:opacity-20 hover:bg-[#e8c192] transition-colors flex-shrink-0"
          >
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
        <div className="w-8 h-8 rounded-full bg-[#d4a374]/15 border border-[#d4a374]/30 flex items-center justify-center text-[#d4a374] text-xs font-myeongjo font-bold flex-shrink-0 mt-1">
          결
        </div>
      )}
      <div className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words font-myeongjo ${
        isUser
          ? 'bg-[#d4a374] text-[#15101f] rounded-2xl rounded-tr-sm'
          : 'bg-[#f5ebd7]/8 text-[#f5ebd7]/95 rounded-2xl rounded-tl-sm border border-[#d4a374]/10'
      }`}>
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2 anim-fade-up">
      <div className="w-8 h-8 rounded-full bg-[#d4a374]/15 border border-[#d4a374]/30 flex items-center justify-center text-[#d4a374] text-xs font-myeongjo font-bold flex-shrink-0 mt-1">
        결
      </div>
      <div className="bg-[#f5ebd7]/8 px-4 py-3 rounded-2xl rounded-tl-sm border border-[#d4a374]/10">
        <div className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 bg-[#d4a374]/70 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-[#d4a374]/70 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
          <span className="w-1.5 h-1.5 bg-[#d4a374]/70 rounded-full" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
        </div>
      </div>
    </div>
  );
}

// ============= GENERATING with PROGRESS BAR =============

function GeneratingView({ reportReady, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);
  const phases = [
    '너의 얘기를 모으는 중',
    '결을 읽고 있어',
    '패턴이 보여',
    '거의 다 됐어',
  ];

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
        const increment = (95 - p) * 0.03 + 0.3;
        return p + increment;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [reportReady, onComplete]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(p => (p + 1) % phases.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-[#d4a374]/20 blur-2xl rounded-full anim-pulse-glow" />
        <div className="relative font-myeongjo text-8xl text-[#d4a374] font-bold anim-pulse-glow">
          結
        </div>
      </div>

      <div className="h-6 mb-8">
        <p className="text-[#f5ebd7] text-base font-myeongjo anim-fade-up" key={phase}>
          {phases[phase]}...
        </p>
      </div>

      <div className="w-64 max-w-[80vw]">
        <div className="h-[2px] bg-[#d4a374]/15 relative overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-[#d4a374] transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
          <div 
            className="absolute inset-y-0 shimmer"
            style={{ 
              left: `${Math.max(0, progress - 20)}%`,
              width: '20%',
              opacity: progress < 100 ? 1 : 0,
            }}
          />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-[#f5ebd7]/30 text-[10px] tracking-widest">PROGRESS</span>
          <span className="text-[#d4a374]/70 text-[10px] tracking-wider font-body">{Math.floor(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

// ============= REPORT =============

function ReportView({ report, onReset }) {
  const [showShareModal, setShowShareModal] = useState(false);

  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <div className="text-center anim-fade-up">
          <div className="text-[#d4a374]/40 text-[10px] tracking-[0.5em] mb-3">YOUR REPORT</div>
          <div className="font-myeongjo text-5xl text-[#d4a374] font-bold mb-2">結</div>
          <div className="flex items-center justify-center gap-3 mt-4">
            <div className="h-px w-8 bg-[#d4a374]/40" />
            <div className="text-[#d4a374] text-[10px] tracking-[0.3em]">너의 결</div>
            <div className="h-px w-8 bg-[#d4a374]/40" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#d4a374]/15 via-[#d4a374]/5 to-transparent border border-[#d4a374]/25 p-10 text-center anim-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.4em] mb-5">HEADLINE</div>
          <div className="font-display italic text-3xl text-[#f5ebd7] leading-relaxed">
            "{report.headline}"
          </div>
        </div>

        <Section title="진짜 끌리는 타입" subtitle="REAL TYPE" delay={200}>
          <h3 className="font-myeongjo text-[#d4a374] text-lg mb-4 font-bold">{report.real_type.title}</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {report.real_type.keywords?.map((kw, i) => (
              <span key={i} className="bg-[#d4a374]/15 text-[#d4a374] px-3 py-1 text-xs font-myeongjo border border-[#d4a374]/30">
                {kw}
              </span>
            ))}
          </div>
          <p className="font-myeongjo text-[#f5ebd7]/85 leading-loose text-sm">{report.real_type.content}</p>
        </Section>

        <Section title="반복되는 패턴" subtitle="PATTERN" delay={300}>
          <div className="space-y-6">
            {report.patterns.map((p, i) => (
              <div key={i} className="relative">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="font-display italic text-[#d4a374] text-2xl">0{i+1}</span>
                  <h3 className="font-myeongjo text-[#d4a374] font-bold">{p.title}</h3>
                </div>
                <p className="font-myeongjo text-[#f5ebd7]/85 text-sm leading-loose pl-10">{p.content}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="애착 유형" subtitle="ATTACHMENT" delay={400}>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {['안정형', '불안형', '회피형', '혼란형'].map((type) => {
              const active = report.attachment_style.type === type;
              return (
                <div 
                  key={type}
                  className={`text-center py-3 border transition-all ${
                    active 
                      ? 'bg-[#d4a374] text-[#15101f] border-[#d4a374] font-bold' 
                      : 'border-[#d4a374]/15 text-[#f5ebd7]/40'
                  }`}
                >
                  <div className="font-myeongjo text-sm">{type}</div>
                </div>
              );
            })}
          </div>
          
          <div className="mb-5">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[#d4a374] text-xs font-body tracking-wider">강도</span>
              <span className="font-display italic text-[#d4a374] text-2xl">{report.attachment_style.percentage}%</span>
            </div>
            <div className="h-[3px] bg-[#d4a374]/15 relative overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-[#d4a374] transition-all duration-1000"
                style={{ width: `${report.attachment_style.percentage}%` }}
              />
            </div>
          </div>
          
          <p className="font-myeongjo text-[#f5ebd7]/85 text-sm leading-loose">{report.attachment_style.reason}</p>
        </Section>

        <Section title="다음에 만날 사람" subtitle="NEXT" delay={500}>
          <h3 className="font-myeongjo text-[#d4a374] text-lg mb-4 font-bold">{report.next_person.title}</h3>
          <div className="space-y-2.5 mb-5">
            {report.next_person.traits?.map((trait, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 border border-[#d4a374] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 5L4 8L9 1.5" stroke="#d4a374" strokeWidth="1.5"/>
                  </svg>
                </div>
                <span className="font-myeongjo text-[#f5ebd7]/90 text-sm">{trait}</span>
              </div>
            ))}
          </div>
          <p className="font-myeongjo text-[#f5ebd7]/70 leading-loose text-sm italic">{report.next_person.content}</p>
        </Section>

        <Section title="조심해야 할 사람" subtitle="AVOID" delay={600} variant="danger">
          <h3 className="font-myeongjo text-[#c97f7f] text-lg mb-4 font-bold">{report.avoid.title}</h3>
          <div className="space-y-2 mb-5">
            {report.avoid.warnings?.map((w, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#c97f7f]/10 border border-[#c97f7f]/20 px-3 py-2">
                <div className="text-[#c97f7f] text-sm">✕</div>
                <span className="font-myeongjo text-[#f5ebd7]/90 text-sm">{w}</span>
              </div>
            ))}
          </div>
          <p className="font-myeongjo text-[#f5ebd7]/70 leading-loose text-sm italic">{report.avoid.content}</p>
        </Section>

        <div className="bg-[#d4a374]/10 border-l-2 border-[#d4a374] py-8 px-6 anim-fade-up" style={{ animationDelay: '700ms' }}>
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.4em] mb-4">CLOSING</div>
          <p className="font-display italic text-xl text-[#f5ebd7] leading-relaxed">
            {report.closing}
          </p>
        </div>

        <div className="space-y-3 pt-6 pb-12 anim-fade-up" style={{ animationDelay: '800ms' }}>
          <button
            onClick={() => setShowShareModal(true)}
            className="w-full bg-[#d4a374] text-[#15101f] py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors"
          >
            결과 공유하기
          </button>
          <button
            onClick={onReset}
            className="w-full text-[#f5ebd7]/50 hover:text-[#f5ebd7]/80 transition text-xs tracking-wider py-2"
          >
            처음으로 돌아가기
          </button>
        </div>
      </div>

      {showShareModal && (
        <ShareModal 
          report={report} 
          onClose={() => setShowShareModal(false)} 
        />
      )}
    </div>
  );
}

function Section({ title, subtitle, children, delay = 0, variant = 'default' }) {
  const borderColor = variant === 'danger' ? 'border-[#c97f7f]/20' : 'border-[#d4a374]/15';
  const subtitleColor = variant === 'danger' ? 'text-[#c97f7f]/50' : 'text-[#d4a374]/50';
  
  return (
    <div className={`bg-[#f5ebd7]/[0.03] border ${borderColor} p-7 anim-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between mb-6 pb-4 border-b border-[#d4a374]/10">
        <h2 className="font-myeongjo text-[#f5ebd7] font-bold">{title}</h2>
        <span className={`${subtitleColor} text-[9px] tracking-[0.3em]`}>{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

// ============= SHARE MODAL =============

function ShareModal({ report, onClose }) {
  const [generatingImage, setGeneratingImage] = useState(false);

  const shareKakao = () => {
    const text = `"${report.headline}"\n\n나의 결을 읽어봤어\n너의 결도 보러와\n\n#결 #GYEOL`;
    
    if (navigator.share) {
      navigator.share({ title: '나의 결', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('텍스트가 복사됐어. 카톡에 붙여넣어줘');
    }
  };

  const generateAndShareImage = async (type) => {
    setGeneratingImage(true);
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      
      const canvas = type === 'story' 
        ? renderStoryImage(report) 
        : renderPostImage(report);
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
      const file = new File([blob], `gyeol-${type}.png`, { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '나의 결',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gyeol-${type === 'story' ? '스토리' : '게시글'}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('이미지 생성에 실패했어. 다시 시도해줘');
    }
    setGeneratingImage(false);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-[#1c1530] border border-[#d4a374]/30 w-full max-w-md p-6 anim-fade-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="font-myeongjo text-[#d4a374] text-xl font-bold">공유하기</div>
            <div className="text-[#f5ebd7]/40 text-xs mt-1 font-myeongjo">결과를 어떻게 공유할까?</div>
          </div>
          <button onClick={onClose} className="text-[#f5ebd7]/40 hover:text-[#f5ebd7]/80 text-2xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => generateAndShareImage('story')}
            disabled={generatingImage}
            className="w-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-[#d4a374]/30 hover:border-[#d4a374]/60 transition p-4 flex items-center gap-4 group disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="white"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타 스토리</div>
              <div className="text-[#f5ebd7]/50 text-xs font-myeongjo mt-0.5">9:16 세로 이미지</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">→</div>
          </button>

          <button
            onClick={() => generateAndShareImage('post')}
            disabled={generatingImage}
            className="w-full bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-orange-500/15 border border-[#d4a374]/30 hover:border-[#d4a374]/60 transition p-4 flex items-center gap-4 group disabled:opacity-50"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타 게시글</div>
              <div className="text-[#f5ebd7]/50 text-xs font-myeongjo mt-0.5">1:1 정사각형 이미지</div>
            </div>
            <div className="text-[#d4a374] group-hover:translate-x-1 transition-transform">→</div>
          </button>

          <button
            onClick={shareKakao}
            className="w-full bg-[#FEE500]/15 border border-[#FEE500]/30 hover:border-[#FEE500]/60 transition p-4 flex items-center gap-4 group"
          >
            <div className="w-12 h-12 bg-[#FEE500] flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#3C1E1E">
                <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.79l-1.2 4.4c-.11.39.32.7.65.48l5.27-3.49c.2.01.41.02.62.02 5.52 0 10-3.58 10-8s-4.48-7.2-10-7.2z"/>
              </svg>
            </div>
            <div className="text-left flex-1">
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">카카오톡</div>
              <div className="text-[#f5ebd7]/50 text-xs font-myeongjo mt-0.5">텍스트로 친구에게</div>
            </div>
            <div className="text-[#FEE500] group-hover:translate-x-1 transition-transform">→</div>
          </button>
        </div>

        {generatingImage && (
          <div className="mt-4 text-center text-[#d4a374] text-xs font-myeongjo anim-pulse-glow">
            이미지 생성 중...
          </div>
        )}
      </div>
    </div>
  );
}

// ============= CANVAS IMAGE GENERATORS =============

function renderStoryImage(report) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, '#15101f');
  bg.addColorStop(0.5, '#1c1530');
  bg.addColorStop(1, '#2a1d3d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1920);

  const glow = ctx.createRadialGradient(540, 600, 0, 540, 600, 700);
  glow.addColorStop(0, 'rgba(212, 163, 116, 0.12)');
  glow.addColorStop(1, 'rgba(212, 163, 116, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = 'rgba(212, 163, 116, 0.5)';
  ctx.font = '300 24px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('G Y E O L · 結', 540, 220);

  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 280px "Nanum Myeongjo", serif';
  ctx.fillText('結', 540, 600);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(420, 720);
  ctx.lineTo(660, 720);
  ctx.stroke();

  ctx.fillStyle = '#d4a374';
  ctx.font = '300 26px "Inter", sans-serif';
  ctx.fillText('너의 결', 540, 770);

  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'italic 600 56px "Cormorant Garamond", "Nanum Myeongjo", serif';
  
  const headlineText = `"${report.headline}"`;
  const wrapped = wrapText(ctx, headlineText, 900);
  let y = 950;
  wrapped.forEach(line => {
    ctx.fillText(line, 540, y);
    y += 80;
  });

  ctx.fillStyle = 'rgba(212, 163, 116, 0.7)';
  ctx.font = '300 22px "Inter", sans-serif';
  ctx.fillText('A T T A C H M E N T', 540, 1280);

  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 80px "Nanum Myeongjo", serif';
  ctx.fillText(report.attachment_style.type, 540, 1380);

  if (report.real_type.keywords && report.real_type.keywords.length > 0) {
    ctx.fillStyle = 'rgba(212, 163, 116, 0.7)';
    ctx.font = '300 22px "Inter", sans-serif';
    ctx.fillText('R E A L   T Y P E', 540, 1520);

    const kws = report.real_type.keywords.slice(0, 3).join('  ·  ');
    ctx.fillStyle = '#f5ebd7';
    ctx.font = '500 36px "Nanum Myeongjo", serif';
    ctx.fillText(kws, 540, 1590);
  }

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.3)';
  ctx.beginPath();
  ctx.moveTo(420, 1750);
  ctx.lineTo(660, 1750);
  ctx.stroke();

  ctx.fillStyle = 'rgba(245, 235, 215, 0.5)';
  ctx.font = '300 24px "Nanum Myeongjo", serif';
  ctx.fillText('나의 결 보러가기', 540, 1810);

  return canvas;
}

function renderPostImage(report) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, 1080);
  bg.addColorStop(0, '#15101f');
  bg.addColorStop(1, '#1c1530');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  const glow = ctx.createRadialGradient(540, 540, 0, 540, 540, 500);
  glow.addColorStop(0, 'rgba(212, 163, 116, 0.1)');
  glow.addColorStop(1, 'rgba(212, 163, 116, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1080);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(80, 80, 920, 920);

  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 140px "Nanum Myeongjo", serif';
  ctx.textAlign = 'center';
  ctx.fillText('結', 540, 280);

  ctx.fillStyle = 'rgba(212, 163, 116, 0.6)';
  ctx.font = '300 22px "Inter", sans-serif';
  ctx.fillText('G Y E O L', 540, 340);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.3)';
  ctx.beginPath();
  ctx.moveTo(440, 390);
  ctx.lineTo(640, 390);
  ctx.stroke();

  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'italic 600 52px "Cormorant Garamond", "Nanum Myeongjo", serif';
  const wrapped = wrapText(ctx, `"${report.headline}"`, 800);
  let y = 500;
  wrapped.forEach(line => {
    ctx.fillText(line, 540, y);
    y += 70;
  });

  ctx.fillStyle = 'rgba(212, 163, 116, 0.7)';
  ctx.font = '300 20px "Inter", sans-serif';
  ctx.fillText('A T T A C H M E N T', 540, 780);

  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 60px "Nanum Myeongjo", serif';
  ctx.fillText(report.attachment_style.type, 540, 850);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.3)';
  ctx.beginPath();
  ctx.moveTo(440, 920);
  ctx.lineTo(640, 920);
  ctx.stroke();

  ctx.fillStyle = 'rgba(245, 235, 215, 0.5)';
  ctx.font = '300 22px "Nanum Myeongjo", serif';
  ctx.fillText('나의 결을 읽어봤어', 540, 970);

  return canvas;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (const char of words) {
    const test = currentLine + char;
    const width = ctx.measureText(test).width;
    if (width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
