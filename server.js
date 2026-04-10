// ──────────────────────────────────────────────
// FarmTrade Daily - 백엔드 서버 (server.js)
// Express + MariaDB + JWT 기반 뉴스 구독 서비스
// ──────────────────────────────────────────────

const express = require('express');
const mariadb = require('mariadb');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcrypt');
const cors    = require('cors');
require('dotenv').config(); // .env 파일에서 DB/JWT 환경변수 로드

const app = express();
app.use(cors());                   // 다른 도메인에서 API 요청 허용
app.use(express.json());           // 요청 body를 JSON으로 파싱
app.use(express.static('public')); // public 폴더 정적 파일 제공 (index.html, app.js 등)

// ── DB 연결 풀 ────────────────────────────────
// 매 요청마다 연결을 새로 만들지 않고 풀에서 재사용 → 성능 최적화
const pool = mariadb.createPool({
  host:            'localhost',
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME,
  connectionLimit: 5
});

// ── DB 쿼리 헬퍼 ──────────────────────────────
// 모든 라우터에서 반복되는 getConnection + try/finally 패턴을 하나로 묶음
async function query(sql, params) {
  const conn = await pool.getConnection();
  try {
    return await conn.query(sql, params);
  } finally {
    conn.release(); // 사용 후 반드시 풀에 연결 반환
  }
}

// ── JWT 인증 미들웨어 ─────────────────────────
// Authorization: Bearer <token> 헤더에서 토큰 추출 후 검증
// 유효하면 req.user에 사용자 정보 담아서 다음 미들웨어로 전달
const authenticate = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '토큰 없음' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '토큰 만료 또는 유효하지 않음' });
  }
};

// ── 회원가입 ──────────────────────────────────
// 비밀번호를 bcrypt로 해시화(단방향 암호화)해서 DB에 저장
// 중복 아이디 시 MariaDB 에러코드 1062 → 사용자 메시지 반환
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  try {
    const hashed = await bcrypt.hash(password, 10); // 10 = salt rounds (해시 강도)
    await query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);
    res.json({ message: '회원가입 완료' });
  } catch (err) {
    if (err.errno === 1062)
      res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    else
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── 로그인 ────────────────────────────────────
// 아이디 조회 → bcrypt로 비밀번호 비교 → JWT 발급 (2시간 만료)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  const rows = await query('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length)
    return res.status(401).json({ error: '존재하지 않는 아이디입니다.' });
  const valid = await bcrypt.compare(password, rows[0].password);
  if (!valid)
    return res.status(401).json({ error: '비밀번호가 틀렸습니다.' });
  const token = jwt.sign({ id: rows[0].id, username }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.json({ token });
});

// ── 전체 뉴스 조회 ────────────────────────────
// 로그인한 사용자만 접근 가능 (authenticate 미들웨어), 최신순 정렬
app.get('/api/news', authenticate, async (req, res) => {
  res.json(await query('SELECT * FROM news ORDER BY created_at DESC'));
});

// ── 카테고리별 뉴스 조회 ──────────────────────
// URL 파라미터로 카테고리를 받아서 필터링
app.get('/api/news/:category', authenticate, async (req, res) => {
  res.json(await query(
    'SELECT * FROM news WHERE category = ? ORDER BY created_at DESC',
    [req.params.category]
  ));
});

// ── 내 구독 카테고리 조회 ─────────────────────
// JWT에서 추출한 user_id로 구독 목록 조회
app.get('/api/subscriptions', authenticate, async (req, res) => {
  res.json(await query(
    'SELECT category FROM subscriptions WHERE user_id = ?',
    [req.user.id]
  ));
});

// ── 구독 추가 ─────────────────────────────────
// INSERT IGNORE: 이미 구독 중이면 에러 없이 무시 (중복 방지)
app.post('/api/subscriptions', authenticate, async (req, res) => {
  await query(
    'INSERT IGNORE INTO subscriptions (user_id, category) VALUES (?, ?)',
    [req.user.id, req.body.category]
  );
  res.json({ message: '구독 완료' });
});

// ── 구독 해지 ─────────────────────────────────
// URL 파라미터로 카테고리를 받아서 해당 구독 삭제
app.delete('/api/subscriptions/:category', authenticate, async (req, res) => {
  await query(
    'DELETE FROM subscriptions WHERE user_id = ? AND category = ?',
    [req.user.id, req.params.category]
  );
  res.json({ message: '구독 취소 완료' });
});

app.listen(3000, () => console.log('서버 실행 중 - 포트 3000'));
