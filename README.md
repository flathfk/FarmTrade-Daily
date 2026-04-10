# FarmTrade Daily

## 1. 프로젝트 개요

**수행 주제:** 카테고리별 농산물·원자재 뉴스 구독 서비스

**배포 주소:** https://use-node-else-drugs.trycloudflare.com

**사용 기술:** HTML, Tailwind CSS, Vanilla JS, Node.js (Express), MariaDB, JWT, GCP, Cloudflare Tunnel

**프로젝트 소개:**  
1차 해커톤에서 만든 FarmTrade 농산물 선물거래 시뮬레이터의 연장선으로, 거래 판단의 근거가 되는 뉴스를 제공하는 구독 서비스입니다. 옥수수·밀·대두 등 곡물부터 원유·금·은·구리 등 에너지/금속, 커피·코코아·설탕 등 소프트 원자재까지 16개 카테고리의 뉴스를 카테고리별로 구독하고 모아볼 수 있습니다.

---

## 2. 백엔드 구성 및 라우팅

`server.js`에서 설정한 주요 API 경로와 역할입니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/register` | 회원가입 (bcrypt 비밀번호 해시화) |
| POST | `/login` | 로그인 + JWT 발급 (2시간 만료) |
| GET | `/api/news` | 전체 뉴스 조회 (인증 필요) |
| GET | `/api/news/:category` | 카테고리별 뉴스 조회 |
| GET | `/api/subscriptions` | 내 구독 카테고리 목록 조회 |
| POST | `/api/subscriptions` | 구독 추가 |
| DELETE | `/api/subscriptions/:category` | 구독 해지 |

모든 `/api/*` 경로는 JWT 인증 미들웨어를 통과해야 접근 가능합니다.

---

## 3. 데이터베이스 및 SQL 활용

**사용 테이블**

```sql
-- 사용자 테이블
CREATE TABLE users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 뉴스 테이블
CREATE TABLE news (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  content    TEXT NOT NULL,
  category   VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 구독 테이블
CREATE TABLE subscriptions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  category   VARCHAR(50) NOT NULL,
  UNIQUE KEY unique_sub (user_id, category),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**주요 SQL**

```sql
-- 내가 구독한 카테고리의 뉴스만 조회 (INNER JOIN)
SELECT n.* FROM news n
INNER JOIN subscriptions s ON n.category = s.category
WHERE s.user_id = ?
ORDER BY n.created_at DESC;

-- 구독 추가 (중복 방지: INSERT IGNORE)
INSERT IGNORE INTO subscriptions (user_id, category) VALUES (?, ?);
```

---

## 4. 인프라 및 배포 기록

**클라우드 서버 (GCP VM)**
- 인스턴스: GCP VM (bootcamp-1, asia-northeast3-a)
- OS: Ubuntu 24.04
- Node.js + MariaDB 설치 후 `/home/flathfk/farmnews`에서 서버 실행
- `nohup node server.js &` 로 백그라운드 실행

**도메인 연결 (Cloudflare Tunnel)**
- 별도 도메인 구매 없이 `cloudflared tunnel --url http://localhost:3000` 으로 HTTPS 터널 생성
- Cloudflare가 자동으로 SSL 인증서 적용 → 누구나 HTTPS로 접속 가능

---

## 5. 트러블슈팅

**사례 1: node 프로세스 중복 실행으로 인한 포트 충돌**
- 문제: `nohup node server.js &`를 여러 번 실행하면서 3000번 포트에 node 프로세스가 5~6개 쌓여 서버가 응답하지 않음
- 해결: `kill $(lsof -t -i:3000)` 으로 3000번 포트 점유 프로세스를 전부 종료한 뒤 서버를 단 하나만 재실행

**사례 2: JWT 토큰 만료 후 조용한 실패**
- 문제: 토큰이 만료되면 API 요청이 401로 실패하는데 사용자에게 아무 안내 없이 화면이 빈 채로 멈춤
- 해결: 프론트엔드에 `api()` 공통 함수를 만들어 401 응답 시 자동으로 로그아웃 처리 + 안내 메시지 표시

**사례 3: 구독 해지 후 기사 잔상 문제**
- 문제: 카테고리 구독을 해지해도 해당 카테고리 기사가 피드에 그대로 남아있음
- 해결: `curFilter` 상태 변수로 현재 필터를 추적하고, 구독 해지 시 `curFilter`를 남은 구독 카테고리 배열로 즉시 업데이트 후 `rerender()` 호출

**사례 4: DB 연결 코드 중복**
- 문제: 모든 API 라우터마다 `getConnection()` + `try/finally { conn.release() }` 패턴이 반복됨
- 해결: `query(sql, params)` 헬퍼 함수로 추상화해서 라우터 코드를 절반으로 줄임

---

## 6. 최종 회고

8시간 동안 기획부터 배포까지 혼자 완수하면서 풀스택 개발의 전체 흐름을 직접 경험했습니다.

**배운 점**
- JWT 인증 흐름: 로그인 → 토큰 발급 → 헤더에 담아 요청 → 미들웨어 검증의 전체 사이클을 직접 구현하면서 왜 이 구조가 필요한지 체감했습니다.
- SQL JOIN의 실전 활용: 구독 피드 기능을 만들면서 단순 SELECT가 아닌 INNER JOIN으로 두 테이블을 연결해 필요한 데이터만 가져오는 쿼리를 직접 설계했습니다.
- 상태 관리의 중요성: 프론트엔드에서 `curFilter`, `subscribed` 등 상태 변수를 잘못 관리하면 UI가 실제 데이터와 어긋나는 버그가 생긴다는 것을 여러 번 경험하며 배웠습니다.

**개선하고 싶은 점**
- 실시간 뉴스 데이터 연동 (현재는 수동 입력된 샘플 데이터)
- 뉴스 검색 기능 추가
- React로 마이그레이션해서 컴포넌트 기반으로 재설계
