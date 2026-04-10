// ── 전역 상태 ─────────────────────────────────
let token      = localStorage.getItem('token');      // 로그인 시 발급받은 JWT 토큰
let username   = localStorage.getItem('username');   // 로그인한 사용자 이름
let subscribed = [];    // 현재 구독 중인 카테고리 목록
let newsCache  = [];    // 전체 뉴스 캐시 (필터링할 때 서버 재요청 없이 사용)
let curFilter  = 'all'; // 현재 필터 상태: 'all' | 'corn' | ['corn','wheat',...]

// 페이지 로드 시 토큰이 있으면 로그인 유지
if (token) showFeed();

// ── 카테고리 한국어 라벨 ──────────────────────
const LABEL = {
  corn: '🌽 옥수수', wheat: '🌾 밀',      soybean: '🫘 대두',    oat:     '🌿 귀리',
  cattle: '🐄 생우', feeder: '🐂 비육우', pork:    '🐷 지육돼지',
  soyoil: '🫙 대두유', soymeal: '🟤 대두박',
  oil: '🛞 원유', gold: '🥇 금', silver: '🥈 은', copper: '🔶 구리',
  coffee: '☕ 커피', cocoa: '🍫 코코아', sugar: '🍬 설탕'
};

// 그룹 버튼 클릭 시 한 번에 처리할 카테고리 묶음
const GROUPS = {
  grain:     ['corn','wheat','soybean','oat'],
  livestock: ['cattle','feeder','pork'],
  soy:       ['soyoil','soymeal'],
  energy:    ['oil','gold','silver','copper'],
  soft:      ['coffee','cocoa','sugar']
};

// ── API 요청 공통 함수 ────────────────────────
// 모든 API 요청에 JWT 토큰을 헤더에 담아서 보냄
// 401(토큰 만료/없음) 응답이 오면 자동으로 로그아웃 처리
async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...options.headers
    }
  });
  if (res.status === 401) {
    alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
    logout();
    return null;
  }
  return res;
}

// ── 페이지 전환 ───────────────────────────────
function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('registerPage').classList.add('hidden');
  document.getElementById('feedPage').classList.add('hidden');
  // 저장된 아이디 있으면 자동으로 채워줌
  const savedId = localStorage.getItem('savedUsername');
  if (savedId) {
    document.getElementById('loginUsername').value = savedId;
    document.getElementById('rememberMe').checked = true;
  }
}

function showRegister() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('registerPage').classList.remove('hidden');
}

async function showFeed() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('registerPage').classList.add('hidden');
  document.getElementById('feedPage').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = username + '님';
  await loadSubscriptions(); // 구독 목록 먼저 불러오고
  await loadAllNews();        // 전체 뉴스 로드
  // 구독 중인 카테고리가 있으면 로그인 직후 구독 모음으로 시작
  if (subscribed.length > 0) {
    curFilter = [...subscribed];
    updateBtnStyles();
    rerender();
  }
}

// ── 회원가입 ──────────────────────────────────
// 프론트에서 먼저 입력값 검증 후 서버로 전송
// 중복 아이디면 서버에서 에러 메시지 반환
async function register() {
  const u = document.getElementById('regUsername').value.trim();
  const p = document.getElementById('regPassword').value.trim();
  if (!u || !p) return alert('아이디와 비밀번호를 입력해주세요.');
  if (p.length < 4) return alert('비밀번호는 4자 이상 입력해주세요.');
  const res  = await fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  });
  const data = await res.json();
  alert(data.message || data.error);
  if (data.message) showLogin();
}

// ── 로그인 ────────────────────────────────────
// 성공 시 JWT와 사용자 이름을 localStorage에 저장해서 로그인 상태 유지
async function login() {
  const user = document.getElementById('loginUsername').value.trim();
  const pw   = document.getElementById('loginPassword').value;
  if (!user || !pw) return alert('아이디와 비밀번호를 입력해주세요.');
  const remember = document.getElementById('rememberMe').checked;
  remember
    ? localStorage.setItem('savedUsername', user)
    : localStorage.removeItem('savedUsername');
  const res  = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pw })
  });
  const data = await res.json();
  if (data.token) {
    token = data.token; username = user;
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    showFeed();
  } else {
    alert(data.error);
  }
}

// ── 로그아웃 ──────────────────────────────────
// 토큰과 사용자 정보 전부 초기화 후 로그인 화면으로
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  token = null; username = null;
  subscribed = []; curFilter = 'all';
  showLogin();
}

// ── 뉴스 로드 ─────────────────────────────────
// 서버에서 전체 뉴스를 받아 캐시에 저장 후 렌더링
async function loadAllNews() {
  const res = await api('/api/news');
  if (!res) return;
  newsCache = await res.json();
  curFilter = 'all';
  updateBtnStyles();
  renderNews(newsCache);
}

// 서버에서 내 구독 카테고리 목록을 불러옴
async function loadSubscriptions() {
  const res = await api('/api/subscriptions');
  if (!res) return;
  subscribed = (await res.json()).map(row => row.category);
}

// ── 필터링 ────────────────────────────────────
// curFilter 기준으로 뉴스 목록을 다시 그림
function rerender() {
  if (curFilter === 'all')
    renderNews(newsCache);
  else if (Array.isArray(curFilter))
    // 배열이면 해당 카테고리들 전부 포함
    renderNews(newsCache.filter(item => curFilter.includes(item.category)));
  else
    // 단일 카테고리
    renderNews(newsCache.filter(item => item.category === curFilter));
}

// 전체 버튼 클릭: 전체보기 ↔ 구독 모음 토글
function filterCategory(category) {
  if (category === 'all') {
    curFilter = curFilter === 'all' && subscribed.length > 0
      ? [...subscribed]
      : 'all';
  } else {
    curFilter = category;
  }
  updateBtnStyles();
  rerender();
}

// ── 구독 토글 (개별 카테고리) ─────────────────
// 클릭한 카테고리를 구독/해지하고 필터를 구독 목록 전체로 변경
async function filterAndSub(category) {
  if (subscribed.includes(category)) {
    // 이미 구독 중 → 해지
    const res = await api('/api/subscriptions/' + category, { method: 'DELETE' });
    if (!res) return;
    subscribed = subscribed.filter(c => c !== category);
  } else {
    // 미구독 → 구독 추가
    const res = await api('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ category })
    });
    if (!res) return;
    subscribed.push(category);
  }
  curFilter = subscribed.length > 0 ? [...subscribed] : 'all';
  updateBtnStyles();
  rerender();
}

// ── 구독 토글 (그룹 전체) ─────────────────────
// 그룹 내 전체 구독 상태면 전체 해지, 아니면 전체 구독
// Promise.all로 API 요청을 병렬 처리해서 속도 최적화
async function toggleGroupSub(categories) {
  const allSub = categories.every(c => subscribed.includes(c));
  if (allSub) {
    // 전체 해지: 병렬 요청
    const results = await Promise.all(
      categories.map(c => api('/api/subscriptions/' + c, { method: 'DELETE' }))
    );
    if (results.some(r => !r)) return;
    subscribed = subscribed.filter(c => !categories.includes(c));
  } else {
    // 미구독 항목만 추가 구독: 병렬 요청
    const toAdd = categories.filter(c => !subscribed.includes(c));
    const results = await Promise.all(
      toAdd.map(c => api('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ category: c })
      }))
    );
    if (results.some(r => !r)) return;
    toAdd.forEach(c => subscribed.push(c));
  }
  curFilter = subscribed.length > 0 ? [...subscribed] : 'all';
  updateBtnStyles();
  rerender();
}

// ── 버튼 스타일 업데이트 ──────────────────────
// 구독 상태에 따라 카테고리 버튼 색상과 +/- 기호 변경
// 그룹 버튼은 그룹 내 전체 구독 시 초록으로 변경
function updateBtnStyles() {
  // 개별 카테고리 버튼
  Object.keys(LABEL).forEach(cat => {
    const btn = document.getElementById('filter-' + cat);
    if (!btn) return;
    if (subscribed.includes(cat)) {
      btn.classList.add('bg-green-600', 'text-white');
      btn.classList.remove('bg-gray-100', 'text-gray-600');
      btn.innerHTML = LABEL[cat] + ' <span class="text-yellow-400 text-base ml-0.5">-</span>';
    } else {
      btn.classList.remove('bg-green-600', 'text-white');
      btn.classList.add('bg-gray-100', 'text-gray-600');
      btn.innerHTML = LABEL[cat] + ' <span class="text-green-600 text-base ml-0.5">+</span>';
    }
  });

  // 그룹 버튼: 그룹 내 전체 구독 시 초록
  Object.entries(GROUPS).forEach(([groupId, cats]) => {
    const btn = document.getElementById('groupSub-' + groupId);
    if (!btn) return;
    const allSub = cats.every(c => subscribed.includes(c));
    btn.classList.toggle('bg-green-600', allSub);
    btn.classList.toggle('text-white', allSub);
    btn.classList.toggle('border-green-600', allSub);
    btn.classList.toggle('bg-gray-200', !allSub);
    btn.classList.toggle('text-gray-700', !allSub);
    btn.classList.toggle('border-gray-400', !allSub);
  });

  // 전체 버튼: curFilter가 'all'일 때만 초록
  const allBtn = document.getElementById('filter-all');
  if (!allBtn) return;
  const isAll = curFilter === 'all';
  allBtn.classList.toggle('bg-green-600', isAll);
  allBtn.classList.toggle('text-white', isAll);
  allBtn.classList.toggle('bg-gray-100', !isAll);
  allBtn.classList.toggle('text-gray-600', !isAll);
}

// ── 뉴스 카드 렌더링 ──────────────────────────
// 구독 중인 카테고리 뉴스에는 '✓ 구독중' 배지 표시
function renderNews(list) {
  const container = document.getElementById('newsList');
  if (!list.length) {
    container.innerHTML = '<p class="text-gray-400 text-sm">등록된 뉴스가 없습니다.</p>';
    return;
  }
  container.innerHTML = list.map(item => `
    <div class="border rounded-lg p-4 mb-3 bg-white cursor-pointer hover:shadow-md transition"
         onclick="openModal('${escapeStr(item.title)}', '${escapeStr(item.content)}', '${item.category}', '${item.created_at}')">
      <div class="flex justify-between items-center mb-1">
        <div class="flex items-center gap-2">
          <span class="text-xs text-green-600 font-medium">${LABEL[item.category] || item.category}</span>
          ${subscribed.includes(item.category)
            ? '<span class="text-xs px-2 py-0.5 rounded-full border border-green-500 text-green-600 bg-green-50">✓ 구독중</span>'
            : ''}
        </div>
        <span class="text-xs text-gray-400">${new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
      </div>
      <h2 class="font-semibold mb-1">${item.title}</h2>
      <p class="text-sm text-gray-500 line-clamp-2">${item.content}</p>
    </div>
  `).join('');
}

// onclick 속성 안에 문자열 넣을 때 따옴표 충돌 방지
function escapeStr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── 기사 모달 ─────────────────────────────────
function openModal(title, content, category, createdAt) {
  document.getElementById('modalCategory').textContent = LABEL[category] || category;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalDate').textContent = new Date(createdAt).toLocaleDateString('ko-KR');
  document.getElementById('modalContent').textContent = content;
  document.getElementById('articleModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('articleModal').classList.add('hidden');
}

// 모달 바깥 클릭 시 닫기
document.getElementById('articleModal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ── 엔터키 로그인/회원가입 ────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedId = localStorage.getItem('savedUsername');
  if (savedId) {
    document.getElementById('loginUsername').value = savedId;
    document.getElementById('rememberMe').checked = true;
  }
  ['loginUsername', 'loginPassword'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') login();
    })
  );
  ['regUsername', 'regPassword'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') register();
    })
  );
});
