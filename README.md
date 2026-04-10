# FarmTrade Daily

## 1. 프로젝트 개요

**수행 주제:** 카테고리별 농산물·원자재 뉴스 구독 서비스

**배포 주소:** https://use-node-else-drugs.trycloudflare.com

**사용 기술:** HTML · Tailwind CSS · Vanilla JS · Node.js (Express) · MariaDB · JWT · GCP · Cloudflare Tunnel

**프로젝트 소개:**
1차 해커톤에서 FarmTrade라는 농산물 선물거래 시뮬레이터를 만들었습니다. 옥수수·밀·대두·생우 같은 농산물의 실시간 가격 차트를 보며 매수/매도를 체험하는 서비스였는데, 실제 선물 거래는 가격만 보고 판단하지 않습니다. 트레이더들은 작황 뉴스, 원유 공급 동향, 금리 변화 같은 시장 정보를 보고 판단합니다. FarmTrade Daily는 그 연장선에서 만든 서비스입니다. 농산물 거래 판단의 근거가 되는 시장 뉴스를 카테고리별로 구독하고 모아볼 수 있습니다. 옥수수·밀·대두 등 곡물부터 원유·금·은·구리 등 에너지/금속, 커피·코코아·설탕 등 소프트 원자재까지 16개 카테고리의 뉴스를 제공하며 관심 카테고리를 구독하면 로그인 직후 내 피드에서 바로 모아볼 수 있습니다.


## 서비스 화면

**로그인**

<img width="1920" height="1080" alt="1" src="https://github.com/user-attachments/assets/f65c49cb-2331-44c8-a5ff-77c270953c7e" />

**전체 뉴스**

<img width="1920" height="1080" alt="2" src="https://github.com/user-attachments/assets/417a49bf-10af-4bdb-aa95-2793f578e705" />

**구독 모음**

<img width="1920" height="1080" alt="3" src="https://github.com/user-attachments/assets/c162ebb3-0735-4e5b-ba99-9add0e436221" />

---

## 2. 백엔드 구성 및 라우팅

`server.js`에서 설정한 주요 API 경로와 역할입니다.
모든 `/api/*` 경로는 JWT 인증 미들웨어를 통과해야 접근 가능합니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/register` | 회원가입 (bcrypt 비밀번호 해시화) |
| POST | `/login` | 로그인 + JWT 발급 (2시간 만료) |
| GET | `/api/news` | 전체 뉴스 조회 |
| GET | `/api/news/:category` | 카테고리별 뉴스 조회 |
| GET | `/api/subscriptions` | 내 구독 카테고리 목록 조회 |
| POST | `/api/subscriptions` | 구독 추가 |
| DELETE | `/api/subscriptions/:category` | 구독 해지 |

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

-- 구독 테이블 (user_id + category 조합에 UNIQUE KEY 설정으로 중복 구독 방지)
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

-- 구독 추가 (이미 구독 중이면 에러 없이 무시)
INSERT IGNORE INTO subscriptions (user_id, category) VALUES (?, ?);
```

---

## 4. 인프라 및 배포 기록

**클라우드 서버 (GCP VM)**
- 인스턴스: GCP VM (bootcamp-1, asia-northeast3-a) · Ubuntu 24.04
- `/home/flathfk/farmnews` 디렉토리에서 Node.js 서버 실행
- `nohup node server.js &` 로 백그라운드 실행 유지

**도메인 연결 (Cloudflare Tunnel)**
- 별도 도메인 구매 없이 `cloudflared tunnel --url http://localhost:3000` 으로 HTTPS 터널 생성
- Cloudflare가 자동으로 SSL 인증서를 적용해 누구나 HTTPS로 접속 가능한 상태로 배포
---

## 5. 트러블슈팅

**사례 1: node 프로세스 중복 실행으로 인한 포트 충돌**
- 문제: `nohup node server.js &` 를 여러 번 실행하면서 3000번 포트에 node 프로세스가 5~6개 쌓여 서버가 응답하지 않는 상황이 반복됐습니다.
- 원인: 포트는 한 번에 하나의 프로세스만 점유할 수 있는데 기존 프로세스를 종료하지 않고 새로 실행하면서 같은 포트를 여러 프로세스가 점유하려다 충돌이 발생했습니다.
- 해결: `kill $(lsof -t -i:3000)` 으로 3000번 포트를 점유한 프로세스를 전부 종료한 뒤 서버를 하나만 재실행했습니다.

**사례 2: JWT 토큰 만료 후 조용한 실패**
- 문제: 토큰이 만료되면 API 요청이 401로 실패하는데 사용자에게 아무 안내 없이 화면이 빈 채로 멈췄습니다.
- 원인: 각 API 요청마다 401 에러 처리를 따로 하지 않아 토큰 만료 시 요청이 조용히 실패하고 화면이 업데이트되지 않았습니다.
- 해결: 프론트엔드에 `api()` 공통 함수를 만들어 401 응답 시 자동으로 로그아웃 처리와 안내 메시지를 함께 띄우도록 했습니다.

**사례 3: 구독 해지 후 기사 잔상 문제**
- 문제: 카테고리 구독을 해지해도 해당 카테고리 기사가 피드에 그대로 남아있었습니다.
- 원인: 구독 해지 후 API 요청만 보내고 프론트엔드의 `curFilter` 상태 변수를 업데이트하지 않아 화면이 이전 필터 상태 그대로 렌더링됐습니다.
- 해결: `curFilter` 상태 변수로 현재 필터를 추적하고 구독 해지 시 `curFilter`를 남은 구독 카테고리 배열로 즉시 업데이트한 뒤 `rerender()` 를 호출하도록 수정했습니다.

**사례 4: DB 연결 코드 중복**
- 문제: 모든 API 라우터마다 `getConnection()` + `try/finally { conn.release() }` 패턴이 반복돼 코드가 길고 지저분했습니다.
- 원인: DB 연결과 해제 로직을 각 라우터마다 직접 작성하다 보니 7개 라우터에 동일한 패턴이 중복됐습니다.
- 해결: `query(sql, params)` 헬퍼 함수로 추상화해서 라우터 코드를 절반으로 줄였습니다.

---

## 6. 최종 회고

8시간 안에 기획부터 배포까지 혼자 완수했습니다. 처음에는 단순히 뉴스 목록을 보여주는 서비스를 구상했으나 구독 기능을 붙이면서 생각보다 프론트엔드 상태 관리가 복잡해졌습니다. 버튼 색이 실제 구독 상태와 어긋나거나 해지한 카테고리 기사가 피드에 남아있는 버그를 반복해서 마주치면서 UI 상태와 서버 데이터를 어떻게 동기화할지 고민하는 시간이 길었습니다. 결국 `curFilter`라는 단일 상태 변수로 현재 필터를 추적하고 그 값을 기준으로 렌더링하는 구조로 정리하면서 버그가 해소됐고 상태 관리가 왜 중요한지 직접 체감했습니다.

**배운 점**
- JWT 인증 흐름을 직접 구현하면서 왜 토큰 기반 인증이 필요한지 체감했습니다. 로그인 → 토큰 발급 → 헤더에 담아 요청 → 미들웨어 검증의 전체 사이클을 손으로 짜보니 평소에 당연하게 쓰던 로그인 기능이 다르게 보였습니다.
- INNER JOIN을 단순 문법이 아니라 실제 기능 구현에 써봤습니다. 구독 피드를 만들면서 subscriptions 테이블과 news 테이블을 JOIN해야 한다는 걸 스스로 설계하는 과정이 SQL을 진짜로 이해하는 계기가 됐습니다.
- 프론트엔드 상태 관리의 중요성을 뼈저리게 느꼈습니다. 상태를 한 곳에서 관리하고 그 상태 기준으로 렌더링하는 패턴이 왜 중요한지 알게 됐습니다.

**개선하고 싶은 점**
- 현재 뉴스 데이터는 직접 DB에 입력한 샘플 데이터입니다. 실제 뉴스 API와 연동해서 실시간 데이터를 제공하면 서비스로서 의미가 생길 것 같습니다.
- 뉴스 검색 기능이 없어서 특정 키워드로 찾아보기 어렵습니다. 다음 버전에서는 검색 기능을 추가하고 싶습니다.
- Vanilla JS로 구현한 프론트엔드를 React로 마이그레이션하면 컴포넌트 단위로 상태를 관리할 수 있어 지금처럼 상태 버그가 덜 생길 것 같습니다. 웹 프레임워크 단계에서 꼭 다시 만들어보고 싶습니다.
