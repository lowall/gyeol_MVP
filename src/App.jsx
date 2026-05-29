import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { events } from './lib/analytics';
import { CATEGORIES, PACKAGES, CATEGORY_ORDER } from './lib/categories';
import { getChatPrompt, getReportPrompt } from './prompts';

// ============= API HELPERS =============

async function callClaude(messages, system, max_tokens = 1500) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens }),
  });
  if (!res.ok) throw new Error(`API error: ${await res.text()}`);
  const data = await res.json();
  // 여러 응답 형식 호환
  return data.text || data.content?.[0]?.text || data.message || '';
}

async function saveReport(report, category) {
  try {
    const res = await fetch('/api/save-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report, category }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch (err) {
    console.error('Save failed:', err);
    return null;
  }
}

async function saveToVault(email, reportId, category) {
  try {
    const res = await fetch('/api/save-to-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, reportId, category }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed');
    }
    return await res.json();
  } catch (err) {
    console.error('Vault save failed:', err);
    throw err;
  }
}

// ============= LOCAL STORAGE =============

const STORAGE_KEY = 'gyeol_purchased';
const COMPLETED_KEY = 'gyeol_completed';
const VAULT_KEY = 'gyeol_vault'; // 사용자 vault 정보 (email, userId)

function getPurchased() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function addPurchased(category) {
  const list = getPurchased();
  if (!list.includes(category)) list.push(category);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getCompleted() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]'); } catch { return []; }
}

function addCompleted(category, reportId) {
  const list = getCompleted();
  const existing = list.find(c => c.category === category);
  if (existing) {
    existing.reportId = reportId;
    existing.completedAt = Date.now();
  } else {
    list.push({ category, reportId, completedAt: Date.now() });
  }
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(list));
}

function getVaultInfo() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch { return null; }
}

function saveVaultInfo(info) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(info));
}

function canAccess(category) {
  const cat = CATEGORIES[category];
  if (!cat) return false;
  if (cat.free) return true;
  return getPurchased().includes(category);
}

// 사용자 프로필 (이름, 나이대) - 카테고리 간 공유
const PROFILE_KEY = 'gyeol_profile';

function getUserProfile() {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; }
}

function saveUserProfile(profile) {
  const existing = getUserProfile();
  const merged = { ...existing, ...profile };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
}

// AI 응답에서 이름/나이대 추출 (간단한 휴리스틱)
function extractProfileFromMessages(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  const profile = {};
  
  // 첫 2-3개 사용자 메시지에서 이름과 나이대 추출 시도
  for (let i = 0; i < Math.min(userMessages.length, 4); i++) {
    const content = userMessages[i].content.trim();
    
    // 이름: 2-5글자 한글, 다른 패턴 적게 (정확한 매칭 어려우니 짧은 첫 답변에서 추출)
    if (!profile.name && content.length <= 10) {
      // 단순 이름 패턴 (예: "수민", "여수민", "수민이야" 등)
      const nameMatch = content.match(/^([가-힣]{2,5})(이?야|입니다|이에요|예요)?$/);
      if (nameMatch) profile.name = nameMatch[1];
    }
    
    // 나이대 추출
    if (!profile.ageGroup) {
      const ageMatch = content.match(/(\d{2})\s*살|(\d{2})대|이?십\s*대|이?십\s*초|이?십\s*중|이?십\s*후|삼십\s*대/);
      if (ageMatch) {
        const num = parseInt(ageMatch[1] || ageMatch[2]);
        if (num >= 15 && num <= 60) {
          if (num < 25) profile.ageGroup = '20대 초반';
          else if (num < 30) profile.ageGroup = '20대 후반';
          else if (num < 35) profile.ageGroup = '30대 초반';
          else if (num < 40) profile.ageGroup = '30대 후반';
          else profile.ageGroup = '40대';
        } else if (content.includes('이십')) profile.ageGroup = '20대';
        else if (content.includes('삼십')) profile.ageGroup = '30대';
      }
    }
  }
  
  return profile;
}

// ============= STYLES =============

const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
    .font-myeongjo { font-family: 'Nanum Myeongjo', serif; }
    .font-display { font-family: 'Cormorant Garamond', serif; }
    .font-body { font-family: 'Inter', sans-serif; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    .anim-fade-up { animation: fadeUp 0.8s ease-out backwards; }
    .shimmer { background: linear-gradient(90deg, transparent 20%, rgba(245,235,215,0.3) 50%, transparent 80%); background-size: 200% 100%; animation: shimmer 3s infinite; }
  `}</style>
);

// ============= ROOT =============

export default function App() {
  return (
    <BrowserRouter>
      <FontStyles />
      <div className="min-h-screen bg-gradient-to-br from-[#3a2840] via-[#3a2840] to-[#4d3656] text-[#f5ebd7] font-body">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/c/:category" element={<CategoryFlow />} />
          <Route path="/r/:id" element={<SharedReportPage />} />
          <Route path="/my/:userId" element={<VaultPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund" element={<RefundPage />} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

// ============= LANDING =============

function Landing() {
  const navigate = useNavigate();
  const completed = getCompleted();
  const completedMap = {};
  completed.forEach(c => { completedMap[c.category] = c.reportId; });
  const vault = getVaultInfo();
  const [packageModal, setPackageModal] = useState(null);
  
  useEffect(() => { events.viewLanding(); }, []);

  const handleCategoryClick = (categoryId) => {
    events.clickCategory(categoryId);
    navigate(`/c/${categoryId}`);
  };

  const handlePackageClick = (pkg) => {
    events.clickPackage(pkg.id);
    setPackageModal(pkg);
  };

  const handlePackageConfirm = (pkg) => {
    // 패키지에 포함된 모든 유료 카테고리 해제
    pkg.includes.forEach(catId => {
      const cat = CATEGORIES[catId];
      if (cat && !cat.free) addPurchased(catId);
    });
    setPackageModal(null);
    // 패키지 첫 카테고리로 이동 (또는 랜딩에 머무름)
    navigate(`/c/${pkg.includes[0] || 'love'}`);
  };

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12 anim-fade-up">
          <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-6 font-body">GYEOL · 結</div>
          <div className="font-myeongjo text-[100px] leading-none text-[#f5ebd7] mb-2 font-bold">결</div>
          <div className="my-10 flex items-center justify-center gap-3">
            <div className="h-px w-12 bg-[#d4a374]/50" />
            <div className="text-[#d4a374] text-xs tracking-[0.3em]">너의 결을 읽다</div>
            <div className="h-px w-12 bg-[#d4a374]/50" />
          </div>
          <h1 className="font-display text-2xl text-[#f5ebd7] mb-4 leading-relaxed italic">
            사주보다 정확한<br/>너의 진짜 패턴
          </h1>
          <p className="text-[#f5ebd7]/70 text-sm leading-relaxed font-myeongjo">
            연애, 관계, 진로, 일, 마음까지<br/>너에 대한 모든 결을 읽어드려요
          </p>
        </div>

        {/* 보관함 바로가기 */}
        {vault?.userId && (
          <div className="mb-8 anim-fade-up" style={{ animationDelay: '50ms' }}>
            <button onClick={() => navigate(`/my/${vault.userId}`)}
              className="w-full bg-[#d4a374]/10 hover:bg-[#d4a374]/20 border border-[#d4a374]/30 transition p-4 flex items-center justify-between">
              <div className="text-left">
                <div className="text-[#d4a374] text-[10px] tracking-[0.3em] mb-1">MY VAULT</div>
                <div className="font-myeongjo text-[#f5ebd7] text-sm font-bold">내 결 보관함</div>
              </div>
              <div className="text-[#d4a374]">→</div>
            </button>
          </div>
        )}

        {/* 🌟 연애 결 - 무료 후크 (가장 위) */}
        <div className="mb-6 anim-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3 text-center">FREE</div>
          <FeaturedCategoryCard 
            category={CATEGORIES.love}
            reportId={completedMap.love}
            onClick={() => handleCategoryClick('love')}
            onViewResult={(rid) => navigate(`/r/${rid}`)}
          />
        </div>

        {/* 패키지 추천 */}
        <div className="mb-12 anim-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3 text-center">PACKAGE</div>
          <PackageCard pkg={PACKAGES.all} highlighted onClick={() => handlePackageClick(PACKAGES.all)} />
        </div>

        {/* 나머지 카테고리 */}
        <div className="space-y-3 anim-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3 text-center">INDIVIDUAL</div>
          {CATEGORY_ORDER.filter(id => id !== 'love').map((catId, idx) => {
            const cat = CATEGORIES[catId];
            const reportId = completedMap[catId];
            return (
              <CategoryCard 
                key={catId} 
                category={cat} 
                reportId={reportId}
                onClick={() => handleCategoryClick(catId)}
                onViewResult={(rid) => navigate(`/r/${rid}`)}
                delay={300 + idx * 50}
              />
            );
          })}
        </div>

        {/* 취준생 패키지 */}
        <div className="mt-8 anim-fade-up" style={{ animationDelay: '700ms' }}>
          <PackageCard pkg={PACKAGES.career_pack} onClick={() => handlePackageClick(PACKAGES.career_pack)} />
        </div>

        <div className="text-center text-[#f5ebd7]/40 text-xs mt-12 font-myeongjo">
          연애 결은 무료로 체험 가능해요
        </div>
      </div>

      {packageModal && (
        <PackagePaymentModal 
          pkg={packageModal} 
          onConfirm={() => handlePackageConfirm(packageModal)} 
          onCancel={() => setPackageModal(null)} 
        />
      )}
    </div>
  );
}

// 연애 결 - 강조 카드
function FeaturedCategoryCard({ category, reportId, onClick, onViewResult }) {
  return (
    <div className="bg-gradient-to-br from-[#d4a374]/15 to-[#d4a374]/5 border-2 border-[#d4a374]/40 p-6 relative">
      <div className="absolute -top-2 left-6 bg-[#d4a374] text-[#3a2840] px-3 py-0.5 text-[10px] tracking-wider font-bold">
        무료 체험
      </div>
      <div className="flex items-start gap-4 mb-3">
        <div className="font-myeongjo text-5xl text-[#d4a374] font-bold">{category.hanja}</div>
        <div className="flex-1">
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.3em] mb-1">{category.nameEn}</div>
          <div className="font-myeongjo text-[#f5ebd7] text-xl font-bold mb-1">{category.name}</div>
          <div className="text-[#f5ebd7]/60 text-xs font-myeongjo">{category.tagline}</div>
        </div>
      </div>
      <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo mb-4">
        {category.description}
      </p>
      <div className="flex gap-2">
        <button onClick={onClick}
          className="flex-1 bg-[#d4a374] text-[#3a2840] py-3 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
          {reportId ? '다시 받기' : '바로 시작하기'} →
        </button>
        {reportId && (
          <button onClick={() => onViewResult(reportId)}
            className="px-4 py-3 bg-[#f5ebd7]/8 border border-[#d4a374]/30 text-[#d4a374] text-xs hover:bg-[#f5ebd7]/15 transition">
            내 결과 보기
          </button>
        )}
      </div>
    </div>
  );
}

function PackageCard({ pkg, highlighted, onClick }) {
  const bg = highlighted 
    ? 'bg-gradient-to-br from-[#d4a374]/20 to-[#d4a374]/5 border-[#d4a374]/40' 
    : 'bg-[#f5ebd7]/5 border-[#d4a374]/15';
  return (
    <button onClick={onClick} className={`${bg} border p-6 relative w-full text-left hover:border-[#d4a374]/70 transition`}>
      {pkg.badge && (
        <div className="absolute -top-2 left-6 bg-[#d4a374] text-[#3a2840] px-3 py-0.5 text-[10px] tracking-wider font-bold">
          {pkg.badge}
        </div>
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.3em] mb-1">{pkg.nameEn}</div>
          <div className="font-myeongjo text-[#f5ebd7] text-lg font-bold">{pkg.name}</div>
        </div>
        <div className="text-right">
          {pkg.originalPrice && (
            <div className="text-[#f5ebd7]/40 text-xs line-through">{pkg.originalPrice.toLocaleString()}원</div>
          )}
          <div className="font-myeongjo text-[#d4a374] text-xl font-bold">{pkg.priceLabel}</div>
          {pkg.discount && (
            <div className="text-[#d4a374]/80 text-[10px]">{pkg.discount}% OFF</div>
          )}
        </div>
      </div>
      <div className="text-[#f5ebd7]/60 text-xs leading-relaxed font-myeongjo mb-3">{pkg.description}</div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[#d4a374] text-xs font-bold">{pkg.includes.length}개 결 한번에</span>
        <span className="text-[#d4a374]">→</span>
      </div>
    </button>
  );
}

// 패키지 결제 모달
function PackagePaymentModal({ pkg, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  
  useEffect(() => { events.openPaymentModal(pkg.id, pkg.price); }, []);

  const handleConfirm = () => {
    events.confirmPayment(pkg.id, pkg.price);
    setConfirming(true);
    setTimeout(() => onConfirm(), 1500);
  };
  const handleCancel = () => { events.cancelPayment(pkg.id); onCancel(); };

  if (confirming) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-6">
      <div className="text-center anim-fade-up">
        <div className="text-[#d4a374] text-4xl mb-4">✓</div>
        <div className="font-display italic text-xl text-[#f5ebd7]">패키지 활성화 중...</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-6" onClick={handleCancel}>
      <div className="max-w-sm w-full bg-[#3a2840] border border-[#d4a374]/30 p-8 anim-fade-up" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.3em] mb-1">{pkg.nameEn}</div>
          <h2 className="font-display italic text-2xl text-[#f5ebd7] mb-2">{pkg.name}</h2>
          <p className="text-[#f5ebd7]/60 text-xs font-myeongjo">{pkg.description}</p>
        </div>
        
        <div className="bg-[#d4a374]/8 p-3 mb-4">
          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.3em] mb-2">포함된 결</div>
          <div className="space-y-1">
            {pkg.includes.map(catId => {
              const cat = CATEGORIES[catId];
              if (!cat) return null;
              return (
                <div key={catId} className="flex items-center justify-between text-xs">
                  <span className="font-myeongjo text-[#f5ebd7]/80">{cat.hanja} {cat.name}</span>
                  <span className="text-[#d4a374]/60">{cat.priceLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-b border-[#d4a374]/20 py-4 mb-6">
          {pkg.originalPrice && (
            <div className="flex justify-between items-center mb-1">
              <span className="text-[#f5ebd7]/50 text-xs font-myeongjo">개별 합계</span>
              <span className="text-[#f5ebd7]/40 text-sm line-through">{pkg.originalPrice.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-[#f5ebd7] text-sm font-myeongjo font-bold">패키지 가격</span>
            <span className="font-myeongjo text-[#d4a374] text-2xl font-bold">{pkg.priceLabel}</span>
          </div>
          {pkg.discount && (
            <div className="text-right text-[#d4a374]/80 text-[10px] mt-1">{pkg.discount}% 할인</div>
          )}
        </div>

        <div className="bg-[#d4a374]/8 border border-[#d4a374]/20 p-4 mb-6">
          <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">
            💛 <strong className="text-[#d4a374]">베타 무료 체험 중</strong><br/>
            결제 시스템 준비 중이라 지금은 무료로 진행돼요.<br/>
            정식 출시되면 카카오 채널로 알려드릴게요.
          </p>
        </div>

        <button onClick={handleConfirm}
          className="w-full bg-[#d4a374] text-[#3a2840] py-3 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors mb-2">
          무료로 모든 결 받기
        </button>
        <button onClick={handleCancel}
          className="w-full text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 py-2 text-xs tracking-wider">
          취소
        </button>
        
        <div className="text-center text-[#f5ebd7]/40 text-[10px] mt-6 font-myeongjo">
          <Link to="/terms" className="hover:text-[#f5ebd7]/60">이용약관</Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-[#f5ebd7]/60">개인정보처리방침</Link>
          <span className="mx-2">·</span>
          <Link to="/refund" className="hover:text-[#f5ebd7]/60">환불정책</Link>
        </div>
      </div>
    </div>
  );
}

// 일반 카테고리 카드 - 완료된 거 옆에 "내 결과 보기" 버튼
function CategoryCard({ category, reportId, onClick, onViewResult, delay }) {
  return (
    <div className="anim-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <div className="bg-[#f5ebd7]/5 border border-[#d4a374]/15 hover:border-[#d4a374]/40 transition-all flex">
        <button onClick={onClick}
          className="flex-1 text-left p-5 hover:bg-[#f5ebd7]/3 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="font-myeongjo text-3xl text-[#d4a374]/70">{category.hanja}</div>
              <div>
                <div className="text-[#d4a374]/50 text-[10px] tracking-[0.3em] mb-0.5">{category.nameEn}</div>
                <div className="font-myeongjo text-[#f5ebd7] font-bold flex items-center gap-2">
                  {category.name}
                  {reportId && <span className="text-[#d4a374] text-[10px] bg-[#d4a374]/15 px-2 py-0.5">완료</span>}
                </div>
                <div className="text-[#f5ebd7]/50 text-xs mt-1 font-myeongjo">{category.tagline}</div>
              </div>
            </div>
            <div className="text-right">
              {category.free ? (
                <div className="text-[#d4a374] text-sm font-bold">무료</div>
              ) : (
                <div className="font-myeongjo text-[#d4a374] text-sm font-bold">{category.priceLabel}</div>
              )}
            </div>
          </div>
        </button>
        {reportId && (
          <button onClick={() => onViewResult(reportId)}
            className="border-l border-[#d4a374]/15 px-4 text-[#d4a374] text-xs hover:bg-[#d4a374]/10 transition flex flex-col items-center justify-center gap-1 min-w-[60px]">
            <div className="text-base">📄</div>
            <div className="text-[9px]">보기</div>
          </button>
        )}
      </div>
    </div>
  );
}

// ============= CATEGORY FLOW =============

function CategoryFlow() {
  const { category } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cat = CATEGORIES[category];
  const isInvited = new URLSearchParams(location.search).get('invited') === category;
  
  const [stage, setStage] = useState('intro');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [report, setReport] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [reportReady, setReportReady] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!cat) { navigate('/'); return; }
    if (!canAccess(category)) {
      setStage('payment');
    } else {
      setStage('intro');
    }
  }, [category]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  if (!cat) return null;

  const startConversation = async () => {
    events.startConversation(category);
    setStage('chat');
    setIsAiTyping(true);
    try {
      // 기존 사용자 프로필 있으면 시스템 프롬프트에 주입
      const profile = getUserProfile();
      let systemPrompt = getChatPrompt(category);
      if (profile.name || profile.ageGroup) {
        const profileInfo = [];
        if (profile.name) profileInfo.push(`이름: ${profile.name}`);
        if (profile.ageGroup) profileInfo.push(`나이대: ${profile.ageGroup}`);
        systemPrompt += `\n\n== 알려진 사용자 정보 ==\n${profileInfo.join('\n')}\n위 정보는 이미 알고 있으니, 첫 인사부터 이름을 부르면서 자연스럽게 시작해. "안녕 ${profile.name || ''}!" 같이. 이름이나 나이 다시 묻지 마. 바로 본격적인 ${CATEGORIES[category].name} 주제로 진입해.`;
      }
      
      const greeting = await callClaude(
        [{ role: 'user', content: '안녕' }],
        systemPrompt,
        1000
      );
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch (err) {
      setError('연결에 문제가 있어. 잠시 후 다시 시도해줘.');
      console.error(err);
    }
    setIsAiTyping(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async () => {
    if (!input.trim() || isAiTyping) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    events.sendMessage(category, newMessages.length);
    setMessages(newMessages);
    setInput('');
    setIsAiTyping(true);
    setError(null);
    
    // 사용자 프로필 추출 시도 (이름, 나이대)
    const extractedProfile = extractProfileFromMessages(newMessages);
    if (extractedProfile.name || extractedProfile.ageGroup) {
      saveUserProfile(extractedProfile);
    }
    
    try {
      // 시스템 프롬프트에 프로필 주입
      const profile = getUserProfile();
      let systemPrompt = getChatPrompt(category);
      if (profile.name || profile.ageGroup) {
        const profileInfo = [];
        if (profile.name) profileInfo.push(`이름: ${profile.name}`);
        if (profile.ageGroup) profileInfo.push(`나이대: ${profile.ageGroup}`);
        systemPrompt += `\n\n== 알려진 사용자 정보 ==\n${profileInfo.join('\n')}\n위 정보는 이미 알고 있어. 다시 묻지 마.`;
      }
      
      const response = await callClaude(newMessages, systemPrompt);
      const hasReady = response.includes('[READY_FOR_REPORT]');
      const cleaned = response.replace('[READY_FOR_REPORT]', '').trim();
      const finalMessages = [...newMessages, { role: 'assistant', content: cleaned }];
      setMessages(finalMessages);
      if (hasReady) setTimeout(() => generateReport(finalMessages), 1500);
    } catch (err) {
      console.error(err);
      setError('잠시 문제가 있었어. 다시 보내줘.');
    }
    setIsAiTyping(false);
  };

  const generateReport = async (history) => {
    setStage('generating');
    setReportReady(false);
    const convoText = history.map(m => `${m.role === 'user' ? '사용자' : '결'}: ${m.content}`).join('\n\n');

    const cleanAndParse = (text) => {
      let cleaned = text.replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(cleaned);
    };

    const tryGenerate = async () => {
      let promptContext = {};
      if (category === 'integrated') {
        const completed = getCompleted();
        promptContext.previousReports = completed.map(c => ({ category: c.category, reportId: c.reportId }));
      }
      const userMessage = getReportPrompt(category, promptContext).replace('[대화내역]', convoText);
      const reportText = await callClaude(
        [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '{' }
        ],
        null, 3000
      );
      return cleanAndParse('{' + reportText);
    };

    try {
      let parsed;
      try { parsed = await tryGenerate(); }
      catch (err) {
        console.warn('Retry:', err);
        events.reportError(category, 'first_attempt_failed');
        parsed = await tryGenerate();
      }
      setReport(parsed);
      events.reportGenerated(category, parsed.attachment_style?.type || parsed.burnout_type?.type || 'unknown');
      saveReport(parsed, category).then(id => {
        if (id) {
          setReportId(id);
          addCompleted(category, id);
          events.reportSaved(category);
        }
      });
      setReportReady(true);
    } catch (err) {
      console.error('Final fail:', err);
      events.reportError(category, 'final_failed');
      setStage('error_report');
    }
  };

  const resetAll = () => navigate('/');

  if (stage === 'payment') return <PaymentModal category={cat} onConfirm={() => { addPurchased(category); setStage('intro'); }} onCancel={resetAll} />;
  if (stage === 'intro') return <CategoryIntro category={cat} isInvited={isInvited} onStart={startConversation} onBack={resetAll} />;
  if (stage === 'chat') return <ChatView category={cat} messages={messages} input={input} setInput={setInput} isAiTyping={isAiTyping} sendMessage={sendMessage} scrollRef={scrollRef} inputRef={inputRef} error={error} onReset={resetAll} />;
  if (stage === 'generating') return <GeneratingView category={cat} reportReady={reportReady} onComplete={() => setStage('report')} />;
  if (stage === 'error_report') return <ErrorReportView onRetry={() => generateReport(messages)} onReset={resetAll} />;
  if (stage === 'report' && report) return <ReportView category={cat} report={report} reportId={reportId} onReset={resetAll} />;
  return null;
}

function CategoryIntro({ category, isInvited, onStart, onBack }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative">
      <button onClick={onBack} className="absolute top-6 left-6 text-[#f5ebd7]/50 text-xs hover:text-[#f5ebd7]/80">← 처음</button>
      <div className="anim-fade-up">
        <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-4">{category.nameEn} · {category.hanja}</div>
        <div className="font-myeongjo text-7xl text-[#d4a374] mb-8 font-bold">{category.hanja}</div>
        {isInvited ? (
          <>
            <div className="inline-block bg-[#d4a374]/15 border border-[#d4a374]/40 px-4 py-1.5 mb-5">
              <span className="text-[#d4a374] text-xs font-myeongjo">친구가 너를 초대했어</span>
            </div>
            <h1 className="font-display italic text-3xl text-[#f5ebd7] mb-4">{category.name}</h1>
            <p className="text-[#f5ebd7]/70 text-sm leading-relaxed max-w-xs mx-auto mb-4 font-myeongjo">
              누군가 너의 {category.name}이 궁금했나봐.<br/>
              {category.description}
            </p>
            <p className="text-[#d4a374]/80 text-xs mb-12 font-myeongjo">무료로 받아볼 수 있어</p>
          </>
        ) : (
          <>
            <h1 className="font-display italic text-3xl text-[#f5ebd7] mb-4">{category.name}</h1>
            <p className="text-[#f5ebd7]/70 text-sm leading-relaxed max-w-xs mx-auto mb-12 font-myeongjo">
              {category.description}
            </p>
          </>
        )}
        <div className="text-[#f5ebd7]/50 text-xs mb-2 font-myeongjo">예상 소요 {category.estimatedMinutes}분</div>
        <button onClick={onStart}
          className="bg-[#d4a374] text-[#3a2840] px-12 py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
          시작하기
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ category, onConfirm, onCancel }) {
  const [confirming, setConfirming] = useState(false);
  
  useEffect(() => { events.openPaymentModal(category.id, category.price); }, []);

  const handleConfirm = () => {
    events.confirmPayment(category.id, category.price);
    setConfirming(true);
    setTimeout(() => onConfirm(), 1500);
  };
  const handleCancel = () => { events.cancelPayment(category.id); onCancel(); };

  if (confirming) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center anim-fade-up">
        <div className="text-[#d4a374] text-4xl mb-4">✓</div>
        <div className="font-display italic text-xl text-[#f5ebd7]">결제 준비 중...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-[#3a2840] border border-[#d4a374]/30 p-8 anim-fade-up">
        <div className="text-center mb-6">
          <div className="font-myeongjo text-5xl text-[#d4a374] mb-3">{category.hanja}</div>
          <div className="text-[#d4a374]/60 text-[10px] tracking-[0.3em] mb-1">{category.nameEn}</div>
          <h2 className="font-display italic text-2xl text-[#f5ebd7]">{category.name}</h2>
        </div>
        <div className="border-t border-b border-[#d4a374]/20 py-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-[#f5ebd7]/70 text-sm font-myeongjo">금액</span>
            <span className="font-myeongjo text-[#d4a374] text-2xl font-bold">{category.priceLabel}</span>
          </div>
        </div>
        <div className="bg-[#d4a374]/8 border border-[#d4a374]/20 p-4 mb-6">
          <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">
            💛 <strong className="text-[#d4a374]">베타 무료 체험 중</strong><br/>
            결제 시스템 준비 중이라 지금은 무료로 진행돼요.<br/>
            정식 출시되면 카카오 채널로 알려드릴게요.
          </p>
        </div>
        <button onClick={handleConfirm}
          className="w-full bg-[#d4a374] text-[#3a2840] py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors mb-2">
          무료로 체험하기
        </button>
        <button onClick={handleCancel}
          className="w-full text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 py-2 text-xs tracking-wider">
          취소
        </button>
        <div className="text-center text-[#f5ebd7]/40 text-[10px] mt-6 font-myeongjo">
          <Link to="/terms" className="hover:text-[#f5ebd7]/60">이용약관</Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-[#f5ebd7]/60">개인정보처리방침</Link>
          <span className="mx-2">·</span>
          <Link to="/refund" className="hover:text-[#f5ebd7]/60">환불정책</Link>
        </div>
      </div>
    </div>
  );
}

function ChatView({ category, messages, input, setInput, isAiTyping, sendMessage, scrollRef, inputRef, error, onReset }) {
  const userMessageCount = messages.filter(m => m.role === 'user').length;
  
  // 카테고리별 예상 메시지 수 (충분한 깊이 도달하려면 필요한 양)
  const TARGET_MESSAGES = {
    love: 22,
    friend: 18,
    career: 16,
    work: 16,
    burnout: 14,
    integrated: 10
  };
  const target = TARGET_MESSAGES[category.id] || 15;
  
  // 80%까지만 cap. 진짜 끝은 AI [READY_FOR_REPORT] 신호 기준.
  const rawProgress = (userMessageCount / target) * 100;
  const progressPercent = userMessageCount === 0 ? 0 : Math.min(80, Math.round(rawProgress));
  
  // 진행 단계
  let stageLabel = '';
  if (userMessageCount === 0) stageLabel = '';
  else if (progressPercent < 25) stageLabel = '도입';
  else if (progressPercent < 60) stageLabel = '본격';
  else stageLabel = '마무리';
  
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <div className="border-b border-[#d4a374]/20 backdrop-blur-sm sticky top-0 z-10 bg-[#3a2840]/95">
        <div className="px-6 py-4 flex items-center justify-between">
          <button onClick={onReset} className="text-[#f5ebd7]/50 text-xs hover:text-[#f5ebd7]/80 transition">← 처음</button>
          <div className="text-center">
            <div className="font-myeongjo text-[#d4a374] text-xl font-bold leading-none">{category.hanja}</div>
            <div className="text-[#d4a374]/50 text-[9px] tracking-[0.3em] mt-1">{category.nameEn}</div>
          </div>
          <div className="w-16 text-right">
            {stageLabel && (
              <span className="text-[#d4a374]/70 text-[10px] tracking-wider font-myeongjo">{stageLabel}</span>
            )}
          </div>
        </div>
        {userMessageCount > 0 && (
          <div className="h-[1.5px] bg-[#d4a374]/15 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[#d4a374] transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
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
            placeholder={isAiTyping ? "결이 답하는 중... 미리 답 적어둬도 돼" : "자세히 적어줄수록 결을 깊이 읽을 수 있어"}
            rows={1}
            className="flex-1 bg-[#f5ebd7] border border-[#d4a374]/40 px-4 py-3 text-[#3a2840] placeholder-[#3a2840]/40 text-sm focus:outline-none focus:border-[#d4a374] resize-none font-myeongjo" />
          <button onClick={sendMessage} disabled={!input.trim() || isAiTyping}
            className="bg-[#d4a374] text-[#3a2840] px-5 py-3 font-medium text-sm hover:bg-[#e8c192] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            보내기
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} anim-fade-up`}>
      <div className={`max-w-[80%] px-4 py-3 ${isUser ? 'bg-[#d4a374] text-[#3a2840]' : 'bg-[#f5ebd7]/8 text-[#f5ebd7] border border-[#d4a374]/15'} font-myeongjo text-sm leading-relaxed whitespace-pre-wrap`}>
        {message.content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start anim-fade-up">
      <div className="bg-[#f5ebd7]/8 border border-[#d4a374]/15 px-4 py-3">
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 bg-[#d4a374] rounded-full" style={{ animation: `pulse 1.4s ${i * 0.2}s infinite ease-in-out` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GeneratingView({ category, reportReady, onComplete }) {
  const [stage, setStage] = useState(0);
  const stages = ['결을 읽고 있어요', '패턴을 엮는 중이에요', '거의 다 됐어요'];
  
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 1800),
      setTimeout(() => setStage(2), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (reportReady && stage >= 2) {
      const t = setTimeout(onComplete, 800);
      return () => clearTimeout(t);
    }
  }, [reportReady, stage, onComplete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-center anim-fade-up">
        <div className="font-myeongjo text-6xl text-[#d4a374] mb-8 font-bold animate-pulse">{category.hanja}</div>
        <div className="font-display italic text-2xl text-[#f5ebd7] mb-3 transition-all">{stages[stage]}</div>
        <div className="flex gap-2 justify-center mt-6">
          {[0,1,2].map(i => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i <= stage ? 'bg-[#d4a374]' : 'bg-[#d4a374]/30'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorReportView({ onRetry, onReset }) {
  const [retrying, setRetrying] = useState(false);
  const handleRetry = async () => { setRetrying(true); await onRetry(); setRetrying(false); };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="font-myeongjo text-7xl text-[#d4a374]/50 font-bold mb-6">結</div>
      <h1 className="font-display italic text-2xl text-[#f5ebd7] mb-3">잠깐 결을 못 읽었어</h1>
      <p className="text-[#f5ebd7]/70 text-sm font-myeongjo mb-10 max-w-xs">보고서 생성 중 작은 문제가 생겼어.<br/>다시 시도하면 잘 될 거야.</p>
      <button onClick={handleRetry} disabled={retrying}
        className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors mb-3 disabled:opacity-50">
        {retrying ? '다시 시도하는 중...' : '다시 시도하기'}
      </button>
      <button onClick={onReset} className="text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 transition text-xs tracking-wider py-2">처음으로 돌아가기</button>
    </div>
  );
}

// ============= REPORT VIEW =============

function ReportView({ category, report, reportId, onReset }) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const reportContentRef = useRef(null);

  return (
    <div className="min-h-screen overflow-y-auto">
      <div ref={reportContentRef} className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <ReportHeader category={category} />
        <HeadlineCard headline={report.headline} />
        
        {category.id === 'love' && <LoveReportSections report={report} />}
        {category.id === 'friend' && <FriendReportSections report={report} />}
        {category.id === 'career' && <CareerReportSections report={report} />}
        {category.id === 'work' && <WorkReportSections report={report} />}
        {category.id === 'burnout' && <BurnoutReportSections report={report} />}
        {category.id === 'integrated' && <IntegratedReportSections report={report} />}
        
        <ClosingCard closing={report.closing} />
        <InviteCard category={category} />
        <CrossSellCard currentCategory={category.id} />
        <NewServicesCard source="owner" />
      </div>

      <div className="max-w-xl mx-auto px-6 pb-12 space-y-3">
        <button onClick={() => { events.openShareModal(category.id); setShowShareModal(true); }}
          className="w-full bg-[#d4a374] text-[#3a2840] py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
          결과 저장 · 공유하기
        </button>
        <button onClick={onReset}
          className="w-full text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 py-3 text-xs tracking-wider transition">
          다른 결 보기
        </button>
      </div>

      {showShareModal && (
        <ShareModal category={category} report={report} reportId={reportId} reportContentRef={reportContentRef} onClose={() => setShowShareModal(false)} />
      )}
      {showVaultModal && (
        <VaultModal category={category} reportId={reportId} onClose={() => setShowVaultModal(false)} />
      )}
    </div>
  );
}

function ReportHeader({ category }) {
  return (
    <div className="text-center pt-4 anim-fade-up">
      <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-2">{category.nameEn} · 結</div>
      <div className="font-myeongjo text-4xl text-[#d4a374] font-bold mb-1">{category.hanja}</div>
      <div className="text-[#f5ebd7]/60 text-xs font-myeongjo">{category.name}</div>
    </div>
  );
}

function HeadlineCard({ headline }) {
  return (
    <div className="text-center py-8 anim-fade-up" style={{ animationDelay: '100ms' }}>
      <div className="text-[#d4a374] text-[10px] tracking-[0.5em] mb-4">HEADLINE</div>
      <h1 className="font-myeongjo text-2xl text-[#f5ebd7] leading-relaxed font-bold">"{headline}"</h1>
    </div>
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

// 친구/연인 초대 카드
function InviteCard({ category }) {
  const [copied, setCopied] = useState(false);
  // inviteLabel 있는 카테고리만 (연애, 친구)
  if (!category.inviteLabel) return null;

  const inviteUrl = `${window.location.origin}/c/${category.id}?invited=${category.id}`;
  const inviteText = category.id === 'love'
    ? `나 "결"에서 연애 패턴 분석받았는데 신기해. 너도 해봐!\n${inviteUrl}`
    : `나 "결"에서 친구관계 분석받았어. 너도 해볼래?\n${inviteUrl}`;

  const handleInvite = () => {
    events.clickInvite(category.id);
    if (navigator.share) {
      navigator.share({ title: `결 - ${category.name}`, text: inviteText, url: inviteUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#d4a374]/15 to-transparent border border-[#d4a374]/30 p-6 anim-fade-up" style={{ animationDelay: '710ms' }}>
      <div className="text-center mb-4">
        <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-2">INVITE</div>
        <h2 className="font-display italic text-xl text-[#f5ebd7] mb-2">{category.inviteDesc}</h2>
        <p className="text-[#f5ebd7]/60 text-xs font-myeongjo">
          {category.id === 'love' ? '연인에게' : '친구에게'} 링크를 보내고 결을 받아보게 해요
        </p>
      </div>
      <button onClick={handleInvite}
        className="w-full bg-[#d4a374] text-[#3a2840] py-3 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors flex items-center justify-center gap-2">
        {copied ? '링크 복사됐어! ✓' : (
          <>
            <span>{category.inviteLabel}</span>
            <span>→</span>
          </>
        )}
      </button>
    </div>
  );
}

// 친구/연인 초대 카드
function VaultCTA({ onClick }) {
  const vault = getVaultInfo();
  return (
    <div className="bg-gradient-to-br from-[#d4a374]/15 to-transparent border border-[#d4a374]/30 p-6 anim-fade-up" style={{ animationDelay: '720ms' }}>
      <div className="text-center mb-4">
        <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-2">MY VAULT</div>
        <h2 className="font-display italic text-xl text-[#f5ebd7] mb-2">결을 영구히 보관하세요</h2>
        <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo">
          {vault?.userId 
            ? '이미 보관함이 있어요. 다음 결도 자동으로 저장돼요.'
            : '이메일만 입력하면 모든 결을 영구히 다시 볼 수 있어요'}
        </p>
      </div>
      {!vault?.userId && (
        <button onClick={onClick}
          className="w-full bg-[#d4a374]/20 border border-[#d4a374]/50 hover:bg-[#d4a374]/30 transition py-3 text-[#d4a374] text-sm font-bold font-myeongjo">
          내 결 보관함 만들기 →
        </button>
      )}
    </div>
  );
}

// 보관함 모달 (이메일 입력)
function VaultModal({ category, reportId, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [vaultUrl, setVaultUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!email.trim() || !reportId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('올바른 이메일을 입력해줘');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await saveToVault(email.trim(), reportId, category.id);
      saveVaultInfo({ email: email.trim(), userId: data.userId });
      setVaultUrl(data.vaultUrl);
      setSuccess(true);
    } catch (err) {
      setError(err.message || '저장 실패. 잠시 후 다시 시도해줘');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="bg-[#3a2840] border border-[#d4a374]/30 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        {!success ? (
          <>
            <div className="flex justify-between items-start mb-5">
              <div>
                <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-1">MY VAULT</div>
                <h2 className="font-myeongjo text-xl text-[#f5ebd7] font-bold">내 결 보관함</h2>
              </div>
              <button onClick={onClose} className="text-[#f5ebd7]/50 hover:text-[#f5ebd7]/90 text-2xl">×</button>
            </div>
            <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo mb-5">
              이메일을 입력하면 보관함 링크를 이메일로 보내드려요.<br/>
              앞으로 받는 모든 결이 자동으로 저장돼요.
            </p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full bg-[#f5ebd7] border border-[#d4a374]/40 px-4 py-3 text-[#3a2840] placeholder-[#3a2840]/40 text-sm focus:outline-none focus:border-[#d4a374] mb-3 font-body" />
            {error && <div className="text-red-300/80 text-xs mb-3 font-myeongjo">{error}</div>}
            <button onClick={handleSubmit} disabled={loading || !email.trim()}
              className="w-full bg-[#d4a374] text-[#3a2840] py-3 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors disabled:opacity-50">
              {loading ? '저장 중...' : '보관함 만들기'}
            </button>
            <div className="text-[#f5ebd7]/40 text-[10px] mt-4 leading-relaxed font-myeongjo">
              ※ 이메일은 보관함 알림 발송 외 용도로 사용되지 않아요.<br/>
              자세한 내용은 <Link to="/privacy" className="underline" onClick={onClose}>개인정보처리방침</Link> 참고.
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="font-myeongjo text-xl text-[#f5ebd7] font-bold mb-3">보관함이 만들어졌어요</h2>
            <p className="text-[#f5ebd7]/70 text-sm font-myeongjo mb-5 leading-relaxed">
              <strong className="text-[#d4a374]">{email}</strong> 로<br/>
              보관함 링크를 보냈어요. 이메일 확인해줘!
            </p>
            <div className="bg-[#d4a374]/10 border border-[#d4a374]/30 p-3 mb-5">
              <div className="text-[#d4a374]/60 text-[10px] tracking-wider mb-1">VAULT URL</div>
              <a href={vaultUrl} className="text-[#d4a374] text-xs break-all hover:underline font-mono">{vaultUrl}</a>
            </div>
            <button onClick={onClose}
              className="w-full bg-[#d4a374] text-[#3a2840] py-3 font-bold tracking-wider text-sm">
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 보고서 섹션 컴포넌트들 =====

function LoveReportSections({ report }) {
  return (
    <>
      <SectionCard title="REAL TYPE" subtitle={report.real_type?.title} delay={200}>
        <KeywordPills items={report.real_type?.keywords} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.real_type?.content}</p>
      </SectionCard>
      <SectionCard title="PATTERNS" delay={300}>
        <div className="space-y-4">
          {report.patterns?.map((p, i) => (
            <div key={i}>
              <div className="text-[#d4a374] text-sm font-bold mb-1 font-myeongjo">{p.title}</div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">{p.content}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="ATTACHMENT STYLE" subtitle={report.attachment_style?.type} delay={400}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-myeongjo text-3xl text-[#d4a374] font-bold">{report.attachment_style?.percentage}%</span>
        </div>
        <div className="h-1.5 bg-[#d4a374]/15 mb-3">
          <div className="h-full bg-[#d4a374] transition-all" style={{ width: `${report.attachment_style?.percentage}%` }} />
        </div>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.attachment_style?.reason}</p>
      </SectionCard>
      <SectionCard title="NEXT PERSON" subtitle={report.next_person?.title} delay={500}>
        <KeywordPills items={report.next_person?.traits} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.next_person?.content}</p>
      </SectionCard>
      <SectionCard title="AVOID" subtitle={report.avoid?.title} delay={600} variant="warning">
        <KeywordPills items={report.avoid?.warnings} variant="warning" />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.avoid?.content}</p>
      </SectionCard>
    </>
  );
}

function FriendReportSections({ report }) {
  return (
    <>
      <SectionCard title="YOUR ROLE" subtitle={report.role_type?.title} delay={200}>
        <KeywordPills items={report.role_type?.keywords} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.role_type?.content}</p>
      </SectionCard>
      <SectionCard title="PATTERNS" delay={300}>
        <div className="space-y-4">
          {report.patterns?.map((p, i) => (
            <div key={i}>
              <div className="text-[#d4a374] text-sm font-bold mb-1 font-myeongjo">{p.title}</div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">{p.content}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="WOUND PATTERN" subtitle={report.wound_pattern?.title} delay={400} variant="warning">
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.wound_pattern?.content}</p>
      </SectionCard>
      <SectionCard title="REAL NEED" subtitle={report.real_need?.title} delay={500}>
        <KeywordPills items={report.real_need?.keywords} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.real_need?.content}</p>
      </SectionCard>
      <SectionCard title="COMPATIBLE FRIENDS" subtitle={report.compatible?.title} delay={550}>
        <KeywordPills items={report.compatible?.traits} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.compatible?.content}</p>
      </SectionCard>
      <SectionCard title="AVOID" subtitle={report.avoid?.title} delay={600} variant="warning">
        <KeywordPills items={report.avoid?.warnings} variant="warning" />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.avoid?.content}</p>
      </SectionCard>
      <SectionCard title="ACTION" subtitle={report.action?.title} delay={650}>
        <ol className="space-y-2">
          {report.action?.steps?.map((step, i) => (
            <li key={i} className="flex gap-3 text-[#f5ebd7]/80 text-sm font-myeongjo">
              <span className="text-[#d4a374] font-bold">{i+1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
    </>
  );
}

function CareerReportSections({ report }) {
  return (
    <>
      <SectionCard title="CURRENT STATE" subtitle={report.current_state?.title} delay={200}>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#f5ebd7]/60 font-myeongjo">진로 에너지</span>
            <span className="text-[#d4a374] font-bold">{report.current_state?.energy_level}%</span>
          </div>
          <div className="h-1.5 bg-[#d4a374]/15">
            <div className="h-full bg-[#d4a374]" style={{ width: `${report.current_state?.energy_level}%` }} />
          </div>
        </div>
        <p className="text-[#d4a374] text-sm mb-2 font-myeongjo italic">{report.current_state?.diagnosis}</p>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.current_state?.content}</p>
      </SectionCard>
      <SectionCard title="REAL BLOCK" subtitle={report.real_block?.title} delay={300} variant="warning">
        <div className="text-[#d4a374] text-xs mb-2 font-myeongjo tracking-wider">{report.real_block?.type}</div>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.real_block?.content}</p>
      </SectionCard>
      <SectionCard title="HIDDEN DESIRE" subtitle={report.hidden_desire?.title} delay={400}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.hidden_desire?.content}</p>
      </SectionCard>
      <SectionCard title="COMPATIBILITY" subtitle={report.compatibility?.title} delay={500}>
        <KeywordPills items={report.compatibility?.fit_types} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.compatibility?.content}</p>
      </SectionCard>
      <SectionCard title="NEXT STEP" subtitle={report.next_step?.title} delay={600}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mb-4 font-myeongjo">{report.next_step?.content}</p>
        <div className="space-y-3">
          {['이번 주', '이번 달', '올해'].map((label, i) => (
            <div key={i} className="border-l-2 border-[#d4a374]/50 pl-3">
              <div className="text-[#d4a374]/70 text-[10px] tracking-wider mb-1">{label}</div>
              <div className="text-[#f5ebd7] text-sm font-myeongjo">{report.next_step?.concrete_actions?.[i]}</div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="WARNING" subtitle={report.warning?.title} delay={650} variant="warning">
        <KeywordPills items={report.warning?.warnings} variant="warning" />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.warning?.content}</p>
      </SectionCard>
    </>
  );
}

function WorkReportSections({ report }) {
  return (
    <>
      <SectionCard title="CORE STRENGTH" subtitle={report.core_strength?.title} delay={200}>
        <KeywordPills items={report.core_strength?.evidence} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.core_strength?.content}</p>
      </SectionCard>
      <SectionCard title="WORK STYLE" subtitle={report.work_style?.title} delay={300}>
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs">
            <span className="text-[#f5ebd7]/60 font-myeongjo">선호 환경</span>
            <span className="text-[#d4a374] font-myeongjo">{report.work_style?.preferred_env}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#f5ebd7]/60 font-myeongjo">결정 방식</span>
            <span className="text-[#d4a374] font-myeongjo">{report.work_style?.decision_style}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#f5ebd7]/60 font-myeongjo">에너지 원천</span>
            <span className="text-[#d4a374] font-myeongjo">{report.work_style?.energy_source}</span>
          </div>
        </div>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.work_style?.content}</p>
      </SectionCard>
      <SectionCard title="STRENGTHS" delay={400}>
        <div className="space-y-4">
          {report.strengths?.map((s, i) => (
            <div key={i}>
              <div className="text-[#d4a374] text-sm font-bold mb-1 font-myeongjo">{s.title}</div>
              <div className="text-[#f5ebd7]/60 text-[10px] mb-1 tracking-wider">{s.context}</div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">{s.evidence}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="BLIND SPOTS" delay={500} variant="warning">
        <div className="space-y-4">
          {report.blind_spots?.map((b, i) => (
            <div key={i}>
              <div className="text-[#d4a374]/80 text-sm font-bold mb-1 font-myeongjo">{b.title}</div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo mb-1">영향: {b.impact}</p>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">보완: {b.improvement}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="FIT ROLES" subtitle={report.fit_roles?.title} delay={550}>
        <KeywordPills items={report.fit_roles?.roles} />
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed mt-3 font-myeongjo">{report.fit_roles?.content}</p>
      </SectionCard>
      <SectionCard title="TEAM FIT" subtitle={report.team_fit?.title} delay={600}>
        <div className="mb-3">
          <div className="text-[#d4a374] text-xs mb-2 tracking-wider">잘 맞는 사람</div>
          <KeywordPills items={report.team_fit?.good_traits} />
        </div>
        <div>
          <div className="text-[#d4a374]/70 text-xs mb-2 tracking-wider">조심해야 할 사람</div>
          <KeywordPills items={report.team_fit?.bad_traits} variant="warning" />
        </div>
      </SectionCard>
      <SectionCard title="COVER LETTER HOOKS" subtitle="자소서 핵심 후크" delay={650}>
        <div className="space-y-5">
          {report.cover_letter_hooks?.items?.map((item, i) => (
            <div key={i} className="bg-[#d4a374]/8 p-4 border-l-2 border-[#d4a374]">
              <div className="text-[#d4a374] text-[10px] tracking-[0.3em] mb-2">{item.topic}</div>
              <div className="text-[#f5ebd7] text-sm font-bold mb-2 font-myeongjo">{item.key_phrase}</div>
              <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo italic">"{item.example}"</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

function BurnoutReportSections({ report }) {
  const levelColor = {
    '낮음': 'text-green-300', '보통': 'text-yellow-300',
    '주의': 'text-orange-300', '심각': 'text-red-300'
  };
  return (
    <>
      <SectionCard title="BURNOUT LEVEL" subtitle={report.burnout_level?.level} delay={200}>
        <div className="flex items-center justify-between mb-3">
          <span className={`font-display italic text-2xl ${levelColor[report.burnout_level?.level] || 'text-[#d4a374]'}`}>
            {report.burnout_level?.level}
          </span>
          <span className="font-myeongjo text-3xl text-[#d4a374] font-bold">{report.burnout_level?.score}</span>
        </div>
        <div className="h-1.5 bg-[#d4a374]/15 mb-3">
          <div className="h-full bg-[#d4a374]" style={{ width: `${report.burnout_level?.score}%` }} />
        </div>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.burnout_level?.content}</p>
      </SectionCard>
      <SectionCard title="BURNOUT TYPE" subtitle={report.burnout_type?.type} delay={300}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.burnout_type?.content}</p>
      </SectionCard>
      <SectionCard title="THREE AXES" subtitle="MBI 3축 분석" delay={400}>
        <div className="space-y-4">
          {[
            { key: 'emotional_exhaustion', data: report.three_axes?.emotional_exhaustion },
            { key: 'depersonalization', data: report.three_axes?.depersonalization },
            { key: 'reduced_accomplishment', data: report.three_axes?.reduced_accomplishment }
          ].map(({ key, data }) => data && (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <span className="text-[#d4a374] text-sm font-myeongjo">{data.label}</span>
                <span className="text-[#d4a374] text-sm font-bold">{data.score}</span>
              </div>
              <div className="h-1 bg-[#d4a374]/15 mb-2">
                <div className="h-full bg-[#d4a374]" style={{ width: `${data.score}%` }} />
              </div>
              <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo">{data.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="TIMELINE" subtitle={report.timeline?.title} delay={500}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.timeline?.content}</p>
      </SectionCard>
      <SectionCard title="TRIGGER" subtitle={report.trigger?.title} delay={550} variant="warning">
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.trigger?.content}</p>
      </SectionCard>
      <SectionCard title="IMMEDIATE NEEDS" subtitle="지금 당장 필요한 것" delay={600}>
        <div className="space-y-3">
          {report.immediate_needs?.items?.map((item, i) => (
            <div key={i} className="border-l-2 border-[#d4a374]/50 pl-3">
              <div className="text-[#d4a374]/70 text-[10px] tracking-wider mb-1">{item.area}</div>
              <div className="text-[#f5ebd7] text-sm font-myeongjo font-bold">{item.action}</div>
              <div className="text-[#f5ebd7]/60 text-xs font-myeongjo mt-1">{item.why}</div>
            </div>
          ))}
        </div>
      </SectionCard>
      {report.professional_help?.recommended && (
        <div className="bg-red-300/10 border border-red-300/30 p-6 anim-fade-up" style={{ animationDelay: '700ms' }}>
          <div className="text-red-300/80 text-[10px] tracking-[0.4em] mb-3">⚠ PROFESSIONAL HELP</div>
          <p className="text-[#f5ebd7]/90 text-sm leading-relaxed font-myeongjo mb-3">{report.professional_help?.content}</p>
          <div className="text-[#f5ebd7]/70 text-xs font-myeongjo space-y-1">
            <div>· 자살예방상담전화: <strong className="text-[#d4a374]">1393</strong> (24시간)</div>
            <div>· 정신건강위기상담전화: <strong className="text-[#d4a374]">1577-0199</strong></div>
          </div>
        </div>
      )}
    </>
  );
}

function IntegratedReportSections({ report }) {
  return (
    <>
      <SectionCard title="CORE IDENTITY" subtitle={report.core_identity?.title} delay={200}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.core_identity?.content}</p>
      </SectionCard>
      <SectionCard title="THREAD" subtitle={report.thread?.title} delay={300}>
        <div className="text-[#d4a374] text-sm mb-2 font-myeongjo italic">"{report.thread?.pattern}"</div>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.thread?.content}</p>
      </SectionCard>
      <SectionCard title="WOVEN STRENGTHS" delay={400}>
        <div className="space-y-4">
          {report.strengths_woven?.items?.map((item, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-[#d4a374] text-sm font-bold font-myeongjo">{item.title}</div>
                <div className="text-[#f5ebd7]/40 text-[10px] tracking-wider">{item.appears_in}</div>
              </div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">{item.content}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="WATCH POINTS" delay={500} variant="warning">
        <div className="space-y-4">
          {report.watch_points?.items?.map((item, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-[#d4a374]/80 text-sm font-bold font-myeongjo">{item.title}</div>
                <div className="text-[#f5ebd7]/40 text-[10px] tracking-wider">{item.appears_in}</div>
              </div>
              <p className="text-[#f5ebd7]/80 text-xs leading-relaxed font-myeongjo">{item.content}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="LIFE COMPASS" subtitle={report.life_compass?.title} delay={600}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#d4a374]/8 p-3 border-l-2 border-[#d4a374]">
            <div className="text-[#d4a374] text-[10px] tracking-wider mb-1">↑ NORTH (지향)</div>
            <div className="text-[#f5ebd7] text-xs font-myeongjo">{report.life_compass?.north}</div>
          </div>
          <div className="bg-[#d4a374]/8 p-3 border-l-2 border-[#d4a374]/50">
            <div className="text-[#d4a374]/70 text-[10px] tracking-wider mb-1">↓ SOUTH (회피)</div>
            <div className="text-[#f5ebd7] text-xs font-myeongjo">{report.life_compass?.south}</div>
          </div>
          <div className="bg-[#d4a374]/8 p-3 border-l-2 border-[#d4a374]">
            <div className="text-[#d4a374] text-[10px] tracking-wider mb-1">→ EAST (쌓기)</div>
            <div className="text-[#f5ebd7] text-xs font-myeongjo">{report.life_compass?.east}</div>
          </div>
          <div className="bg-[#d4a374]/8 p-3 border-l-2 border-[#d4a374]/50">
            <div className="text-[#d4a374]/70 text-[10px] tracking-wider mb-1">← WEST (내려놓기)</div>
            <div className="text-[#f5ebd7] text-xs font-myeongjo">{report.life_compass?.west}</div>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="NEXT CHAPTER" subtitle={report.next_chapter?.title} delay={700}>
        <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo">{report.next_chapter?.content}</p>
      </SectionCard>
    </>
  );
}

function SectionCard({ title, subtitle, children, delay = 0, variant }) {
  const borderColor = variant === 'warning' ? 'border-[#d4a374]/30' : 'border-[#d4a374]/20';
  return (
    <div className={`bg-[#f5ebd7]/4 border ${borderColor} p-6 anim-fade-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-2">{title}</div>
      {subtitle && <div className="font-display italic text-xl text-[#f5ebd7] mb-4">{subtitle}</div>}
      {children}
    </div>
  );
}

function KeywordPills({ items, variant }) {
  if (!items) return null;
  const baseClass = variant === 'warning' 
    ? 'bg-[#d4a374]/8 border-[#d4a374]/30 text-[#d4a374]/80'
    : 'bg-[#d4a374]/12 border-[#d4a374]/30 text-[#d4a374]';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className={`px-3 py-1 text-xs border font-myeongjo ${baseClass}`}>{item}</span>
      ))}
    </div>
  );
}

// ============= CROSS SELL =============

function CrossSellCard({ currentCategory }) {
  const navigate = useNavigate();
  const completed = getCompleted().map(c => c.category);
  if (currentCategory === 'integrated') return null;
  
  const recommendations = CATEGORY_ORDER
    .filter(id => id !== currentCategory && !completed.includes(id) && id !== 'integrated')
    .slice(0, 3);
  
  const integratedAvailable = !completed.includes('integrated');
  
  if (recommendations.length === 0 && !integratedAvailable) return null;

  return (
    <div className="bg-gradient-to-br from-[#d4a374]/12 to-transparent border border-[#d4a374]/30 p-6 anim-fade-up" style={{ animationDelay: '650ms' }}>
      <div className="text-center mb-5">
        <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-2">MORE</div>
        <h2 className="font-display italic text-xl text-[#f5ebd7] mb-2">너의 결은 더 깊어요</h2>
        <p className="text-[#f5ebd7]/60 text-xs font-myeongjo">다른 결도 받아보면, 너의 진짜 모습이 보여요</p>
      </div>
      <div className="space-y-2 mb-3">
        {recommendations.map(catId => {
          const cat = CATEGORIES[catId];
          return (
            <button key={catId}
              onClick={() => { events.clickCrossSell(currentCategory, catId); navigate(`/c/${catId}`); }}
              className="w-full p-3 bg-[#f5ebd7]/5 border border-[#d4a374]/15 hover:bg-[#f5ebd7]/10 hover:border-[#d4a374]/40 transition text-left flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-myeongjo text-xl text-[#d4a374]">{cat.hanja}</div>
                <div>
                  <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">{cat.name}</div>
                  <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">{cat.tagline}</div>
                </div>
              </div>
              <div className="text-[#d4a374] text-sm font-bold">{cat.priceLabel}</div>
            </button>
          );
        })}
      </div>
      {integratedAvailable && (
        <button onClick={() => { events.clickCrossSell(currentCategory, 'integrated'); navigate('/c/integrated'); }}
          className="w-full p-3 bg-gradient-to-r from-[#d4a374]/20 to-[#d4a374]/10 border border-[#d4a374]/50 hover:border-[#d4a374] transition text-left flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-myeongjo text-xl text-[#d4a374]">結</div>
            <div>
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">종합 결</div>
              <div className="text-[#f5ebd7]/60 text-[10px] font-myeongjo">여러 결을 관통하는 본질</div>
            </div>
          </div>
          <div className="text-[#d4a374] text-sm font-bold">9,900원</div>
        </button>
      )}
    </div>
  );
}

// ============= NEW SERVICES =============

const KAKAO_CHANNEL_URL = 'http://pf.kakao.com/_xkUQbX';
const INSTAGRAM_URL = 'https://instagram.com/gyeol_ur';

function NewServicesCard({ source = 'owner' }) {
  return (
    <div className="bg-gradient-to-br from-[#d4a374]/12 via-[#d4a374]/6 to-transparent border border-[#d4a374]/25 p-6 anim-fade-up" style={{ animationDelay: '750ms' }}>
      <div className="text-center mb-5">
        <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-2">FOLLOW</div>
        <h2 className="font-display italic text-lg text-[#f5ebd7] mb-2">결과 결을 잇다</h2>
        <p className="text-[#f5ebd7]/70 text-xs leading-relaxed font-myeongjo">새 결, 새 소식, 가장 먼저 알려드릴게요</p>
      </div>
      <div className="space-y-2">
        <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer"
          onClick={() => events.clickKakaoChannel(source)}
          className="block w-full bg-[#FEE500] hover:bg-[#FFD700] transition-colors p-3 flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#3C1E1E">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.79l-1.2 4.4c-.11.39.32.7.65.48l5.27-3.49c.2.01.41.02.62.02 5.52 0 10-3.58 10-8s-4.48-7.2-10-7.2z"/>
          </svg>
          <div className="flex-1 text-left">
            <div className="font-myeongjo text-[#3C1E1E] font-bold text-sm">카카오 채널 친구 추가</div>
            <div className="text-[#3C1E1E]/70 text-[10px] font-myeongjo">새 결 출시되면 카톡으로</div>
          </div>
          <div className="text-[#3C1E1E]">→</div>
        </a>
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
          onClick={() => events.clickInstagram(source)}
          className="block w-full bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-[#d4a374]/30 hover:border-[#d4a374]/60 transition p-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="white"/>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm">인스타그램 팔로우</div>
            <div className="text-[#f5ebd7]/60 text-[10px] font-myeongjo">@gyeol_ur</div>
          </div>
          <div className="text-[#d4a374]">→</div>
        </a>
      </div>
    </div>
  );
}

// ============= 인스타 카드 Canvas 생성 =============

// 카테고리별 핵심 키워드 추출 (카드에 표시할 1-3개)
function getCardKeywords(category, report) {
  switch (category.id) {
    case 'love':
      return report.attachment_style?.type ? [report.attachment_style.type] : (report.real_type?.keywords || []).slice(0, 3);
    case 'friend':
      return report.role_type?.keywords?.slice(0, 3) || [];
    case 'career':
      return report.real_block?.type ? [report.real_block.type] : [];
    case 'work':
      return report.core_strength?.evidence?.slice(0, 3) || [];
    case 'burnout':
      return report.burnout_type?.type ? [report.burnout_type.type] : [];
    case 'integrated':
      return report.core_identity?.title ? [report.core_identity.title] : [];
    default:
      return [];
  }
}

function drawCardBase(ctx, w, h) {
  // 배경 그라데이션
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#3a2840');
  grad.addColorStop(1, '#4d3656');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // 미묘한 텍스처 점들
  ctx.fillStyle = 'rgba(212, 163, 116, 0.04)';
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function wrapText(ctx, text, maxWidth) {
  const chars = text.split('');
  const lines = [];
  let line = '';
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function renderStoryCard(category, report) {
  const w = 1080, h = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCardBase(ctx, w, h);

  const cx = w / 2;
  
  // 상단 GYEOL · 結
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212, 163, 116, 0.5)';
  ctx.font = '32px Inter, sans-serif';
  ctx.fillText('G Y E O L  ·  結', cx, 220);

  // 큰 한자
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 360px "Nanum Myeongjo", serif';
  ctx.fillText(category.hanja, cx, 700);

  // 카테고리명
  ctx.fillStyle = 'rgba(245, 235, 215, 0.6)';
  ctx.font = '40px "Nanum Myeongjo", serif';
  ctx.fillText(category.name, cx, 800);

  // 구분선
  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 120, 880);
  ctx.lineTo(cx + 120, 880);
  ctx.stroke();

  // 헤드라인 (큰 텍스트, 줄바꿈)
  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'bold 64px "Nanum Myeongjo", serif';
  const headline = report.headline || '';
  const lines = wrapText(ctx, headline, w - 200);
  let y = 1050;
  lines.forEach(ln => {
    ctx.fillText(ln, cx, y);
    y += 90;
  });

  // 키워드 pills
  const keywords = getCardKeywords(category, report);
  if (keywords.length) {
    y += 60;
    ctx.font = '36px "Nanum Myeongjo", serif';
    const gap = 30;
    const pillH = 80;
    const widths = keywords.map(k => ctx.measureText(k).width + 80);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (keywords.length - 1);
    let x = cx - totalW / 2;
    keywords.forEach((k, i) => {
      const pw = widths[i];
      ctx.fillStyle = 'rgba(212, 163, 116, 0.15)';
      ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y - pillH / 2, pw, pillH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d4a374';
      ctx.textAlign = 'center';
      ctx.fillText(k, x + pw / 2, y + 13);
      x += pw + gap;
    });
  }

  // 하단 CTA
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(245, 235, 215, 0.5)';
  ctx.font = '38px "Nanum Myeongjo", serif';
  ctx.fillText('나의 결을 읽다', cx, h - 280);
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 44px Inter, sans-serif';
  ctx.fillText('gyeol-mvp.vercel.app', cx, h - 200);

  return canvas;
}

function renderPostCard(category, report) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawCardBase(ctx, size, size);

  const cx = size / 2;
  
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(212, 163, 116, 0.5)';
  ctx.font = '28px Inter, sans-serif';
  ctx.fillText('G Y E O L  ·  結', cx, 130);

  // 한자
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 200px "Nanum Myeongjo", serif';
  ctx.fillText(category.hanja, cx, 380);

  ctx.fillStyle = 'rgba(245, 235, 215, 0.6)';
  ctx.font = '34px "Nanum Myeongjo", serif';
  ctx.fillText(category.name, cx, 450);

  ctx.strokeStyle = 'rgba(212, 163, 116, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 100, 510);
  ctx.lineTo(cx + 100, 510);
  ctx.stroke();

  // 헤드라인
  ctx.fillStyle = '#f5ebd7';
  ctx.font = 'bold 52px "Nanum Myeongjo", serif';
  const lines = wrapText(ctx, report.headline || '', size - 160);
  let y = 640;
  lines.forEach(ln => {
    ctx.fillText(ln, cx, y);
    y += 72;
  });

  // 하단
  ctx.fillStyle = 'rgba(245, 235, 215, 0.5)';
  ctx.font = '30px "Nanum Myeongjo", serif';
  ctx.fillText('나의 결을 읽다', cx, size - 130);
  ctx.fillStyle = '#d4a374';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.fillText('gyeol-mvp.vercel.app', cx, size - 75);

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 카테고리별 전체 보고서를 텍스트로 빌드 (복사용)
function buildReportText(category, report) {
  const lines = [];
  lines.push(`결 GYEOL · ${category.name}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push(`"${report.headline}"`);
  lines.push('');
  
  if (category.id === 'love') {
    if (report.real_type) {
      lines.push(`▸ ${report.real_type.title || '진짜 유형'}`);
      if (report.real_type.keywords) lines.push(`  ${report.real_type.keywords.join(' · ')}`);
      if (report.real_type.content) lines.push(`  ${report.real_type.content}`);
      lines.push('');
    }
    if (report.patterns?.length) {
      lines.push('▸ 패턴');
      report.patterns.forEach(p => {
        lines.push(`  · ${p.title}: ${p.content}`);
      });
      lines.push('');
    }
    if (report.attachment_style) {
      lines.push(`▸ 애착 유형: ${report.attachment_style.type} (${report.attachment_style.percentage}%)`);
      if (report.attachment_style.reason) lines.push(`  ${report.attachment_style.reason}`);
      lines.push('');
    }
    if (report.next_person) {
      lines.push(`▸ ${report.next_person.title || '다음 사람'}`);
      if (report.next_person.traits) lines.push(`  ${report.next_person.traits.join(' · ')}`);
      if (report.next_person.content) lines.push(`  ${report.next_person.content}`);
      lines.push('');
    }
    if (report.avoid) {
      lines.push(`▸ ${report.avoid.title || '피해야 할 사람'}`);
      if (report.avoid.warnings) lines.push(`  ${report.avoid.warnings.join(' · ')}`);
      if (report.avoid.content) lines.push(`  ${report.avoid.content}`);
      lines.push('');
    }
  } else if (category.id === 'friend') {
    if (report.role_type) {
      lines.push(`▸ ${report.role_type.title || '너의 역할'}`);
      if (report.role_type.keywords) lines.push(`  ${report.role_type.keywords.join(' · ')}`);
      if (report.role_type.content) lines.push(`  ${report.role_type.content}`);
      lines.push('');
    }
    if (report.patterns?.length) {
      lines.push('▸ 패턴');
      report.patterns.forEach(p => lines.push(`  · ${p.title}: ${p.content}`));
      lines.push('');
    }
    if (report.wound_pattern) {
      lines.push(`▸ 상처 패턴: ${report.wound_pattern.title || ''}`);
      if (report.wound_pattern.content) lines.push(`  ${report.wound_pattern.content}`);
      lines.push('');
    }
    if (report.real_need) {
      lines.push(`▸ 진짜 필요: ${report.real_need.title || ''}`);
      if (report.real_need.keywords) lines.push(`  ${report.real_need.keywords.join(' · ')}`);
      if (report.real_need.content) lines.push(`  ${report.real_need.content}`);
      lines.push('');
    }
    if (report.action?.steps?.length) {
      lines.push('▸ 행동');
      report.action.steps.forEach((s, i) => lines.push(`  ${i+1}. ${s}`));
      lines.push('');
    }
  } else if (category.id === 'career') {
    if (report.current_state) {
      lines.push(`▸ 현재 상태: ${report.current_state.title || ''} (에너지 ${report.current_state.energy_level}%)`);
      if (report.current_state.diagnosis) lines.push(`  ${report.current_state.diagnosis}`);
      if (report.current_state.content) lines.push(`  ${report.current_state.content}`);
      lines.push('');
    }
    if (report.real_block) {
      lines.push(`▸ 진짜 막힘: ${report.real_block.title || ''}`);
      if (report.real_block.type) lines.push(`  유형: ${report.real_block.type}`);
      if (report.real_block.content) lines.push(`  ${report.real_block.content}`);
      lines.push('');
    }
    if (report.hidden_desire) {
      lines.push(`▸ 숨은 욕망: ${report.hidden_desire.title || ''}`);
      if (report.hidden_desire.content) lines.push(`  ${report.hidden_desire.content}`);
      lines.push('');
    }
    if (report.next_step) {
      lines.push(`▸ 다음 한 걸음: ${report.next_step.title || ''}`);
      if (report.next_step.content) lines.push(`  ${report.next_step.content}`);
      if (report.next_step.concrete_actions) {
        ['이번 주', '이번 달', '올해'].forEach((label, i) => {
          if (report.next_step.concrete_actions[i]) {
            lines.push(`  · ${label}: ${report.next_step.concrete_actions[i]}`);
          }
        });
      }
      lines.push('');
    }
  } else if (category.id === 'work') {
    if (report.core_strength) {
      lines.push(`▸ 핵심 강점: ${report.core_strength.title || ''}`);
      if (report.core_strength.evidence) lines.push(`  ${report.core_strength.evidence.join(' · ')}`);
      if (report.core_strength.content) lines.push(`  ${report.core_strength.content}`);
      lines.push('');
    }
    if (report.work_style) {
      lines.push(`▸ 일 스타일: ${report.work_style.title || ''}`);
      if (report.work_style.preferred_env) lines.push(`  선호 환경: ${report.work_style.preferred_env}`);
      if (report.work_style.decision_style) lines.push(`  결정 방식: ${report.work_style.decision_style}`);
      if (report.work_style.energy_source) lines.push(`  에너지: ${report.work_style.energy_source}`);
      if (report.work_style.content) lines.push(`  ${report.work_style.content}`);
      lines.push('');
    }
    if (report.fit_roles) {
      lines.push(`▸ 맞는 직무: ${report.fit_roles.title || ''}`);
      if (report.fit_roles.roles) lines.push(`  ${report.fit_roles.roles.join(' · ')}`);
      if (report.fit_roles.content) lines.push(`  ${report.fit_roles.content}`);
      lines.push('');
    }
    if (report.cover_letter_hooks?.items?.length) {
      lines.push('▸ 자소서 후크');
      report.cover_letter_hooks.items.forEach(item => {
        lines.push(`  · [${item.topic}] ${item.key_phrase}`);
        if (item.example) lines.push(`    "${item.example}"`);
      });
      lines.push('');
    }
  } else if (category.id === 'burnout') {
    if (report.burnout_level) {
      lines.push(`▸ 번아웃 수준: ${report.burnout_level.level} (${report.burnout_level.score}점)`);
      if (report.burnout_level.content) lines.push(`  ${report.burnout_level.content}`);
      lines.push('');
    }
    if (report.burnout_type) {
      lines.push(`▸ 유형: ${report.burnout_type.type || ''}`);
      if (report.burnout_type.content) lines.push(`  ${report.burnout_type.content}`);
      lines.push('');
    }
    if (report.three_axes) {
      lines.push('▸ MBI 3축');
      ['emotional_exhaustion', 'depersonalization', 'reduced_accomplishment'].forEach(k => {
        const a = report.three_axes[k];
        if (a) lines.push(`  · ${a.label}: ${a.score}점 — ${a.description}`);
      });
      lines.push('');
    }
    if (report.immediate_needs?.items?.length) {
      lines.push('▸ 지금 필요한 것');
      report.immediate_needs.items.forEach(item => {
        lines.push(`  · [${item.area}] ${item.action} — ${item.why}`);
      });
      lines.push('');
    }
  } else if (category.id === 'integrated') {
    if (report.core_identity) {
      lines.push(`▸ 핵심 정체성: ${report.core_identity.title || ''}`);
      if (report.core_identity.content) lines.push(`  ${report.core_identity.content}`);
      lines.push('');
    }
    if (report.thread) {
      lines.push(`▸ 관통하는 패턴: ${report.thread.title || ''}`);
      if (report.thread.pattern) lines.push(`  "${report.thread.pattern}"`);
      if (report.thread.content) lines.push(`  ${report.thread.content}`);
      lines.push('');
    }
    if (report.life_compass) {
      lines.push(`▸ 인생 나침반`);
      if (report.life_compass.north) lines.push(`  ↑ 지향: ${report.life_compass.north}`);
      if (report.life_compass.south) lines.push(`  ↓ 회피: ${report.life_compass.south}`);
      if (report.life_compass.east) lines.push(`  → 쌓기: ${report.life_compass.east}`);
      if (report.life_compass.west) lines.push(`  ← 내려놓기: ${report.life_compass.west}`);
      lines.push('');
    }
    if (report.next_chapter) {
      lines.push(`▸ 다음 챕터: ${report.next_chapter.title || ''}`);
      if (report.next_chapter.content) lines.push(`  ${report.next_chapter.content}`);
      lines.push('');
    }
  }
  
  // 클로징
  if (report.closing) {
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    lines.push(report.closing);
    lines.push('');
  }
  
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('나의 결을 읽다');
  lines.push('https://gyeol-mvp.vercel.app');
  lines.push(`#결 #GYEOL #${category.nameEn}`);
  
  return lines.join('\n');
}

// ============= SHARE MODAL =============

function ShareModal({ category, report, reportId, reportContentRef, onClose }) {
  const [busy, setBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showVaultForm, setShowVaultForm] = useState(false);
  const [vaultEmail, setVaultEmail] = useState('');
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultSuccess, setVaultSuccess] = useState(false);
  const [vaultError, setVaultError] = useState(null);
  const shareUrl = reportId ? `${window.location.origin}/r/${reportId}` : null;
  
  const existingVault = getVaultInfo();

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareLinkNative = () => {
    if (!shareUrl) return;
    events.shareKakao(category.id);
    if (navigator.share) {
      navigator.share({ title: `"${report.headline}" · 결`, text: '나의 결을 읽어봤어', url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('링크가 복사됐어!\n\n카톡 열어서 친구한테 붙여넣어줘.');
    }
  };

  const copyText = () => {
    const text = buildReportText(category, report);
    navigator.clipboard.writeText(text);
    events.copyText(category.id);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleVaultSubmit = async () => {
    if (!vaultEmail.trim() || !reportId) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vaultEmail)) {
      setVaultError('올바른 이메일을 입력해줘');
      return;
    }
    setVaultLoading(true);
    setVaultError(null);
    try {
      const data = await saveToVault(vaultEmail.trim(), reportId, category.id);
      saveVaultInfo({ email: vaultEmail.trim(), userId: data.userId });
      setVaultSuccess(true);
    } catch (err) {
      setVaultError(err.message || '저장 실패. 잠시 후 다시 시도해줘');
    }
    setVaultLoading(false);
  };

  const downloadFullImage = async () => {
    if (!reportContentRef?.current) return;
    setBusy(true);
    events.downloadFullReport(category.id);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = await html2canvas(reportContentRef.current, { backgroundColor: '#3a2840', scale: 2, useCORS: true, logging: false });
      const filename = `${category.name}-결과.png`;
      
      if (isInAppBrowser()) {
        const dataUrl = canvas.toDataURL('image/png');
        const win = window.open('');
        if (win) {
          win.document.write(`
            <html>
              <head><title>${filename}</title>
                <style>body{margin:0;background:#000;display:flex;justify-content:center;font-family:sans-serif}img{max-width:100%;height:auto}p{color:#fff;text-align:center;padding:20px;font-size:14px;position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.7)}</style>
              </head>
              <body>
                <p>📱 이미지를 길게 눌러 저장하세요</p>
                <img src="${dataUrl}" alt="${filename}" style="margin-top:60px" />
              </body>
            </html>
          `);
        } else {
          alert('카카오톡에서는 다운로드가 안 돼요. 우상단 ⋯ → "다른 브라우저로 열기"로 다시 시도해주세요.');
        }
      } else {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('이미지 생성 실패. 다시 시도해줘');
    }
    setBusy(false);
  };

  // 인앱브라우저 감지
  const isInAppBrowser = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /kakaotalk|instagram|fban|fbav|line/.test(ua);
  };

  const downloadCard = async (type) => {
    setBusy(true);
    events.downloadImage(category.id, type);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const canvas = type === 'story' ? renderStoryCard(category, report) : renderPostCard(category, report);
      const dataUrl = canvas.toDataURL('image/png', 1);
      const filename = `결-${category.name}-${type === 'story' ? '스토리' : '게시물'}.png`;
      
      if (isInAppBrowser()) {
        // 카톡/인스타 인앱브라우저: 새 탭에 이미지만 띄움 (사용자가 길게 눌러 저장)
        const win = window.open('');
        if (win) {
          win.document.write(`
            <html>
              <head><title>${filename}</title>
                <style>body{margin:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif}img{max-width:100%;height:auto}p{color:#fff;text-align:center;padding:20px;font-size:14px;position:fixed;top:10px;left:0;right:0;background:rgba(0,0,0,0.7)}</style>
              </head>
              <body>
                <p>📱 이미지를 길게 눌러 저장하세요</p>
                <img src="${dataUrl}" alt="${filename}" />
              </body>
            </html>
          `);
        } else {
          alert('카카오톡에서는 다운로드가 안 돼요. 우상단 ⋯ → "다른 브라우저로 열기"로 다시 시도해주세요.');
        }
      } else {
        // 일반 브라우저: 다운로드
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 1));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('이미지 생성 실패. 다시 시도해줘');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#3a2840] border-t sm:border border-[#d4a374]/30 w-full sm:max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-myeongjo text-xl text-[#f5ebd7] font-bold">결 저장 · 공유</h2>
              <p className="text-[#f5ebd7]/50 text-xs mt-1 font-myeongjo">{shareUrl ? '저장 완료' : '저장 중...'}</p>
            </div>
            <button onClick={onClose} className="text-[#f5ebd7]/50 hover:text-[#f5ebd7]/90 text-2xl">×</button>
          </div>

          {/* 🌟 보관함 섹션 - 가장 위에 강조 */}
          {!existingVault?.userId && !vaultSuccess && (
            <div className="bg-gradient-to-br from-[#d4a374]/20 to-[#d4a374]/5 border border-[#d4a374]/50 p-4 mb-5">
              <div className="text-[#d4a374] text-[10px] tracking-[0.4em] mb-2">SAVE FOREVER</div>
              <h3 className="font-myeongjo text-[#f5ebd7] font-bold text-base mb-2">
                이메일로 받기 + 영구 보관
              </h3>
              <p className="text-[#f5ebd7]/70 text-xs font-myeongjo mb-3 leading-relaxed">
                다른 기기에서도 볼 수 있고, 새 결도 자동으로 누적돼요.<br/>
                <span className="text-[#d4a374]/80">1개월 무료 보관</span>
              </p>
              {!showVaultForm ? (
                <button onClick={() => setShowVaultForm(true)}
                  className="w-full bg-[#d4a374] text-[#3a2840] py-2.5 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
                  이메일로 받기 →
                </button>
              ) : (
                <div>
                  <input type="email" value={vaultEmail} onChange={e => setVaultEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleVaultSubmit(); }}
                    placeholder="your@email.com"
                    disabled={vaultLoading}
                    autoFocus
                    className="w-full bg-[#f5ebd7] border border-[#d4a374]/40 px-3 py-2 text-[#3a2840] placeholder-[#3a2840]/40 text-sm focus:outline-none focus:border-[#d4a374] mb-2 font-body" />
                  {vaultError && <div className="text-red-300/80 text-xs mb-2 font-myeongjo">{vaultError}</div>}
                  <div className="flex gap-2">
                    <button onClick={handleVaultSubmit} disabled={vaultLoading || !vaultEmail.trim()}
                      className="flex-1 bg-[#d4a374] text-[#3a2840] py-2 font-bold tracking-wider text-sm hover:bg-[#e8c192] transition-colors disabled:opacity-50">
                      {vaultLoading ? '저장 중...' : '받기'}
                    </button>
                    <button onClick={() => { setShowVaultForm(false); setVaultEmail(''); setVaultError(null); }}
                      className="px-4 text-[#f5ebd7]/60 hover:text-[#f5ebd7]/90 text-xs">
                      취소
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 보관함 가입 완료 안내 */}
          {vaultSuccess && (
            <div className="bg-[#d4a374]/15 border border-[#d4a374]/50 p-4 mb-5 text-center">
              <div className="text-2xl mb-2">✨</div>
              <div className="font-myeongjo text-[#f5ebd7] font-bold text-sm mb-1">
                보관함이 만들어졌어요
              </div>
              <div className="text-[#f5ebd7]/70 text-xs font-myeongjo">
                <strong className="text-[#d4a374]">{vaultEmail}</strong> 로 링크를 보냈어요
              </div>
            </div>
          )}
          
          {/* 기존 보관함 있으면 */}
          {existingVault?.userId && !vaultSuccess && (
            <div className="bg-[#d4a374]/8 border border-[#d4a374]/30 p-3 mb-5 flex items-center justify-between">
              <div>
                <div className="text-[#d4a374] text-[10px] tracking-wider mb-0.5">MY VAULT</div>
                <div className="text-[#f5ebd7]/80 text-xs font-myeongjo">이 결도 보관함에 추가됐어요</div>
              </div>
              <a href={`/my/${existingVault.userId}`} className="text-[#d4a374] text-xs hover:underline">보러가기 →</a>
            </div>
          )}

          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3">SHARE</div>
          <button onClick={shareLinkNative} disabled={!shareUrl}
            className="w-full bg-[#FEE500]/15 border border-[#FEE500]/40 hover:bg-[#FEE500]/25 transition p-4 mb-2 flex items-center gap-3 disabled:opacity-30">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FEE500">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.79l-1.2 4.4c-.11.39.32.7.65.48l5.27-3.49c.2.01.41.02.62.02 5.52 0 10-3.58 10-8s-4.48-7.2-10-7.2z"/>
            </svg>
            <div className="flex-1 text-left">
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">친구한테 보내기</div>
              <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">카톡으로 결 페이지 링크 공유</div>
            </div>
            <div className="text-[#d4a374]">→</div>
          </button>
          {shareUrl && (
            <div className="flex gap-2 mb-6">
              <input value={shareUrl} readOnly className="flex-1 bg-[#f5ebd7]/5 border border-[#d4a374]/20 px-3 py-2 text-[#f5ebd7]/80 text-xs font-mono" />
              <button onClick={copyLink} className="bg-[#d4a374]/20 hover:bg-[#d4a374]/30 border border-[#d4a374]/40 px-3 text-[#d4a374] text-xs">
                {copiedLink ? '✓' : '복사'}
              </button>
            </div>
          )}
          <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3">DOWNLOAD</div>
          <button onClick={() => downloadCard('story')} disabled={busy}
            className="w-full bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-orange-500/15 border border-[#d4a374]/30 hover:border-[#d4a374]/50 transition p-4 mb-2 flex items-center gap-3 disabled:opacity-50">
            <div className="text-2xl">📱</div>
            <div className="flex-1 text-left">
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">인스타 스토리 카드</div>
              <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">{busy ? '생성 중...' : '9:16 세로 이미지'}</div>
            </div>
          </button>
          <button onClick={() => downloadCard('post')} disabled={busy}
            className="w-full bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-orange-500/15 border border-[#d4a374]/30 hover:border-[#d4a374]/50 transition p-4 mb-2 flex items-center gap-3 disabled:opacity-50">
            <div className="text-2xl">🖼️</div>
            <div className="flex-1 text-left">
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">인스타 게시물 카드</div>
              <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">{busy ? '생성 중...' : '1:1 정사각 이미지'}</div>
            </div>
          </button>
          <button onClick={downloadFullImage} disabled={busy}
            className="w-full bg-[#f5ebd7]/5 border border-[#d4a374]/20 hover:bg-[#f5ebd7]/10 transition p-4 mb-2 flex items-center gap-3 disabled:opacity-50">
            <div className="text-2xl">⬇</div>
            <div className="flex-1 text-left">
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">전체 결과 이미지</div>
              <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">{busy ? '생성 중...' : '보고서 전체를 한 장 PNG로'}</div>
            </div>
          </button>
          <button onClick={copyText}
            className="w-full bg-[#f5ebd7]/5 border border-[#d4a374]/20 hover:bg-[#f5ebd7]/10 transition p-4 flex items-center gap-3">
            <div className="text-2xl">📋</div>
            <div className="flex-1 text-left">
              <div className="text-[#f5ebd7] text-sm font-bold font-myeongjo">{copiedText ? '복사됐어 ✓' : '글로 복사하기'}</div>
              <div className="text-[#f5ebd7]/50 text-[10px] font-myeongjo">메모장·노션 등에 붙여넣기</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= SHARED REPORT PAGE =============

function SharedReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [category, setCategory] = useState(null);
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
        const catId = data.category || 'love';
        setCategory(CATEGORIES[catId]);
        setLoading(false);
        events.viewSharedReport(catId);
        document.title = `"${data.report.headline}" · 결`;
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-myeongjo text-5xl text-[#d4a374] animate-pulse">結</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="font-myeongjo text-7xl text-[#d4a374]/40 mb-6">結</div>
      <h1 className="font-display italic text-2xl text-[#f5ebd7] mb-3">
        {error === 'not_found' ? '결을 찾을 수 없어' : error === 'expired' ? '결이 만료됐어' : '에러가 났어'}
      </h1>
      <p className="text-[#f5ebd7]/60 text-sm mb-8 font-myeongjo">결은 30일 동안 보관돼요.</p>
      <button onClick={() => { events.clickCTAFromShared(); navigate('/'); }}
        className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
        나의 결 보러가기
      </button>
    </div>
  );

  if (!report || !category) return null;

  // 본인 결과인지 확인 (localStorage의 completed에 reportId 있으면 본인 것)
  const isOwner = getCompleted().some(c => c.reportId === id);

  // 본인 결과면 ReportView 재사용 (공유/저장/인스타카드/초대 전부 포함)
  if (isOwner) {
    return <ReportView category={category} report={report} reportId={id} onReset={() => navigate('/')} />;
  }

  // 공유받은 사람용 티저
  return (
    <div className="min-h-screen overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-12 space-y-8">
        <ReportHeader category={category} />
        <HeadlineCard headline={report.headline} />
        <div className="bg-[#d4a374]/8 border border-[#d4a374]/30 p-6 text-center anim-fade-up" style={{ animationDelay: '200ms' }}>
          <p className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo mb-4">
            친구가 너에게 자신의 결을 공유했어요.<br/>
            <span className="text-[#d4a374]">너의 결도 궁금하지 않아요?</span>
          </p>
          <button onClick={() => { events.clickCTAFromShared(); navigate('/'); }}
            className="bg-[#d4a374] text-[#3a2840] px-8 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
            나의 결 보러가기
          </button>
        </div>
        <div className="relative anim-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="bg-[#f5ebd7]/4 border border-[#d4a374]/20 p-6 filter blur-sm select-none pointer-events-none">
            <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-4">FULL REPORT</div>
            <div className="space-y-3">
              <div className="h-2 bg-[#d4a374]/20 w-full" />
              <div className="h-2 bg-[#d4a374]/20 w-5/6" />
              <div className="h-2 bg-[#d4a374]/20 w-4/6" />
              <div className="h-2 bg-[#d4a374]/20 w-full" />
              <div className="h-2 bg-[#d4a374]/20 w-5/6" />
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#3a2840]/90 border border-[#d4a374]/40 px-6 py-3 text-center">
              <div className="text-[#d4a374] text-sm font-bold font-myeongjo mb-1">친구의 결 더 자세히</div>
              <div className="text-[#f5ebd7]/60 text-[10px] font-myeongjo">너의 결을 받으면 모두 볼 수 있어요</div>
            </div>
          </div>
        </div>
        <div className="pt-4 anim-fade-up" style={{ animationDelay: '500ms' }}>
          <button onClick={() => { events.clickCTAFromShared(); navigate('/'); }}
            className="w-full bg-[#d4a374] text-[#3a2840] py-4 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
            나의 결 만들러 가기
          </button>
        </div>
        <NewServicesCard source="shared" />
        <div className="pb-12" />
      </div>
    </div>
  );
}

// ============= VAULT PAGE (보관함) =============

function VaultPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [vault, setVault] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/get-vault?userId=${encodeURIComponent(userId)}`)
      .then(async r => {
        if (r.status === 404) throw new Error('not_found');
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(data => {
        setVault(data);
        // 로컬 스토리지에도 캐시
        saveVaultInfo({ email: data.email, userId });
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-myeongjo text-5xl text-[#d4a374] animate-pulse">結</div>
    </div>
  );

  if (error || !vault) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="font-myeongjo text-7xl text-[#d4a374]/40 mb-6">結</div>
      <h1 className="font-display italic text-2xl text-[#f5ebd7] mb-3">보관함을 찾을 수 없어</h1>
      <p className="text-[#f5ebd7]/60 text-sm mb-8 font-myeongjo">링크가 잘못되었거나 만료됐어요.</p>
      <button onClick={() => navigate('/')}
        className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
        처음으로
      </button>
    </div>
  );

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/')} className="text-[#f5ebd7]/50 text-xs hover:text-[#f5ebd7]/80 mb-6">← 처음</button>
        
        <div className="text-center mb-10 anim-fade-up">
          <div className="text-[#d4a374]/50 text-[10px] tracking-[0.5em] mb-3">MY VAULT</div>
          <div className="font-myeongjo text-6xl text-[#d4a374] font-bold mb-4">結</div>
          <h1 className="font-display italic text-3xl text-[#f5ebd7] mb-2">내 결 보관함</h1>
          <p className="text-[#f5ebd7]/60 text-xs font-myeongjo">{vault.email}</p>
        </div>

        {vault.reports.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#f5ebd7]/60 text-sm font-myeongjo mb-6">아직 저장된 결이 없어요.</p>
            <button onClick={() => navigate('/')}
              className="bg-[#d4a374] text-[#3a2840] px-10 py-3 font-medium tracking-wider text-sm hover:bg-[#e8c192] transition-colors">
              첫 결 받으러 가기
            </button>
          </div>
        ) : (
          <div className="space-y-3 anim-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="text-[#d4a374]/70 text-[10px] tracking-[0.4em] mb-3">RECEIVED REPORTS</div>
            {vault.reports.map((item, i) => {
              const cat = CATEGORIES[item.category] || CATEGORIES.love;
              return (
                <button key={item.reportId}
                  onClick={() => navigate(`/r/${item.reportId}`)}
                  className="w-full bg-[#f5ebd7]/5 border border-[#d4a374]/20 hover:border-[#d4a374]/50 hover:bg-[#f5ebd7]/8 transition p-5 text-left">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="font-myeongjo text-3xl text-[#d4a374]">{cat.hanja}</div>
                      <div>
                        <div className="text-[#d4a374]/60 text-[10px] tracking-[0.3em] mb-0.5">{cat.nameEn}</div>
                        <div className="font-myeongjo text-[#f5ebd7] font-bold">{cat.name}</div>
                      </div>
                    </div>
                    <div className="text-[#f5ebd7]/40 text-[10px] font-myeongjo">
                      {new Date(item.savedAt).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  {item.report?.headline && (
                    <p className="text-[#f5ebd7]/80 text-sm font-myeongjo italic leading-relaxed">
                      "{item.report.headline}"
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-12">
          <NewServicesCard source="vault" />
        </div>
      </div>
    </div>
  );
}

// ============= LEGAL PAGES =============

function LegalPageWrapper({ title, children }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen max-w-2xl mx-auto px-6 py-12">
      <button onClick={() => navigate(-1)} className="text-[#f5ebd7]/50 text-xs hover:text-[#f5ebd7]/80 mb-8">← 뒤로</button>
      <h1 className="font-display italic text-3xl text-[#f5ebd7] mb-8">{title}</h1>
      <div className="text-[#f5ebd7]/80 text-sm leading-relaxed font-myeongjo space-y-4 pb-20">
        {children}
      </div>
    </div>
  );
}

function TermsPage() {
  return (
    <LegalPageWrapper title="이용약관">
      <h2 className="text-[#d4a374] font-bold mt-6">제1조 (목적)</h2>
      <p>이 약관은 주식회사 로월(이하 "회사")이 운영하는 "결(GYEOL)" 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제2조 (서비스 내용)</h2>
      <p>회사는 AI 기반 자기분석 서비스를 제공합니다: 연애·관계 / 친구관계 / 진로 / 직무 / 번아웃 / 종합 분석.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제3조 (서비스 이용)</h2>
      <p>이용자는 회사가 정한 절차에 따라 결제 후 서비스를 이용할 수 있습니다. 일부 서비스는 무료로 제공됩니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제4조 (결과의 성격)</h2>
      <p>본 서비스는 AI 기반의 참고용 자기분석 서비스이며, 의학적 진단·법률적 조언·심리치료를 대체할 수 없습니다. 특히 번아웃 분석 결과는 의학적 진단이 아니며, 심각한 정신건강 문제가 의심될 경우 반드시 전문가와 상담하시기 바랍니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제5조 (책임의 제한)</h2>
      <p>회사는 AI 분석 결과로 인한 이용자의 의사결정에 대해 법적 책임을 지지 않습니다. 결과는 참고용으로만 활용해주시기 바랍니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제6조 (지적재산권)</h2>
      <p>서비스에서 생성된 분석 결과는 이용자 본인을 위해 생성되었으며, 회사는 서비스 개선을 위해 익명화된 데이터를 활용할 수 있습니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">제7조 (서비스 변경 및 중단)</h2>
      <p>회사는 운영상·기술상 필요에 따라 서비스를 변경하거나 중단할 수 있습니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">부칙</h2>
      <p>본 약관은 2026년 5월 27일부터 시행됩니다.</p>
    </LegalPageWrapper>
  );
}

function PrivacyPage() {
  return (
    <LegalPageWrapper title="개인정보처리방침">
      <p>주식회사 로월(이하 "회사")은 이용자의 개인정보를 중요시하며, 「개인정보 보호법」을 준수합니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">1. 수집하는 개인정보</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>이용자가 AI 채팅에 입력한 답변 내용</li>
        <li>분석 결과 데이터</li>
        <li>이메일 주소 (보관함 기능 이용 시)</li>
        <li>서비스 이용 기록 (방문 시간, 클릭 등)</li>
        <li>결제 시 결제 정보 (결제 처리에 필요한 최소 정보)</li>
      </ul>
      <h2 className="text-[#d4a374] font-bold mt-6">2. 수집·이용 목적</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>AI 분석 서비스 제공</li>
        <li>분석 결과 저장 및 공유 (30일)</li>
        <li>보관함 기능 제공 (이메일 알림 발송)</li>
        <li>서비스 개선 및 통계 분석</li>
        <li>결제 처리 및 환불</li>
      </ul>
      <h2 className="text-[#d4a374] font-bold mt-6">3. 보유 기간</h2>
      <p>이용자의 채팅 내용 및 분석 결과는 생성일로부터 30일간 보관되며, 보관함에 저장된 경우 영구 보관됩니다. 결제 정보는 관련 법령에 따라 5년간 보관될 수 있습니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">4. 제3자 제공</h2>
      <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, AI 분석을 위해 Anthropic Inc. (Claude AI)에 답변 내용이 전달되며, 통계 분석을 위해 Google Analytics 4가 사용됩니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">5. 이용자의 권리</h2>
      <p>이용자는 언제든지 본인의 정보 조회, 수정, 삭제를 요청할 수 있습니다. lowwall.kr@gmail.com 으로 문의해주세요.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">6. 개인정보 보호책임자</h2>
      <p>· 이름: 여수민<br/>· 이메일: lowwall.kr@gmail.com</p>
      <h2 className="text-[#d4a374] font-bold mt-6">7. 시행일</h2>
      <p>본 방침은 2026년 5월 27일부터 시행됩니다.</p>
    </LegalPageWrapper>
  );
}

function RefundPage() {
  return (
    <LegalPageWrapper title="환불 정책">
      <h2 className="text-[#d4a374] font-bold mt-6">디지털 콘텐츠 특성상의 안내</h2>
      <p>본 서비스(결, GYEOL)는 AI 기반 디지털 콘텐츠로, 결제 후 즉시 분석이 제공됩니다. 「전자상거래법」 제17조 제2항에 따라 이미 제공이 시작된 디지털 콘텐츠는 청약철회가 제한됩니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">환불 가능한 경우</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>결제 완료 후 분석을 시작하지 않은 경우 (채팅 미시작 상태)</li>
        <li>시스템 오류로 분석이 완료되지 않은 경우</li>
        <li>결제 시점에 표시된 내용과 실제 제공 내용이 현저히 다른 경우</li>
      </ul>
      <h2 className="text-[#d4a374] font-bold mt-6">환불 불가능한 경우</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>분석 결과를 이미 확인한 경우</li>
        <li>분석 결과의 내용에 대한 단순 변심</li>
        <li>분석 채팅을 시작한 이후</li>
      </ul>
      <h2 className="text-[#d4a374] font-bold mt-6">환불 신청 방법</h2>
      <p>환불을 원하시는 경우 lowwall.kr@gmail.com 으로 다음 정보와 함께 문의해주세요: 주문번호 / 결제일 / 환불 사유. 접수일로부터 3영업일 이내 답변드리며, 환불 승인 시 영업일 기준 3-5일 내 처리됩니다.</p>
      <h2 className="text-[#d4a374] font-bold mt-6">시행일</h2>
      <p>본 정책은 2026년 5월 27일부터 시행됩니다.</p>
    </LegalPageWrapper>
  );
}

// ============= FOOTER =============

function Footer() {
  const location = useLocation();
  if (location.pathname.startsWith('/c/') && !location.pathname.includes('/intro')) return null;
  
  return (
    <footer className="border-t border-[#d4a374]/15 mt-20 py-8 px-6">
      <div className="max-w-2xl mx-auto text-[#f5ebd7]/50 text-[10px] leading-relaxed font-myeongjo space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
          <Link to="/terms" className="hover:text-[#f5ebd7]/80">이용약관</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-[#f5ebd7]/80">개인정보처리방침</Link>
          <span>·</span>
          <Link to="/refund" className="hover:text-[#f5ebd7]/80">환불정책</Link>
        </div>
        <div className="space-y-0.5">
          <div>주식회사 로월 (LOWALL) · 대표: 여수민</div>
          <div>사업자등록번호: 757-48-01029</div>
          <div>서울특별시 마포구 월드컵북로6길 36, 5층(동교동)</div>
          <div>이메일: lowwall.kr@gmail.com</div>
          <div>고객 문의: <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#f5ebd7]/80 underline">카카오 채널</a></div>
        </div>
        <div className="pt-3 text-[#f5ebd7]/30">© 2026 LOWALL Inc. All rights reserved.</div>
      </div>
    </footer>
  );
}
