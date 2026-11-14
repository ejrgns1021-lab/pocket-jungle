# 🌿 포켓 정글 서바이벌

매일 숲이 바뀌는 레트로 픽셀 서바이벌 로그라이크 웹게임 — **Nuxt 3 + Firebase + Gemini Flash**

▶ **지금 플레이: https://ejrgns1021-lab.github.io/pocket-jungle/**

> 현재 연결된 Firebase 프로젝트: `pocket-jungle` (익명 로그인 · Firestore 서울 리전 · AI Logic(Gemini Developer API) · App Check(reCAPTCHA Enterprise))

- 서버 없는 정적 사이트 → Firebase 무료(Spark) 요금제로 운영 가능
- `main`에 push하면 **GitHub Pages**와 **Firebase Hosting**에 자동 배포

## 게임 모드

### 🃏 카드 원정 (기본)
덱빌딩 턴제 배틀. 매일 바뀌는 숲 지도(⚔️전투 · 💀정예 · 🔥모닥불 · 🛒상점 · ❓이벤트 · 🎁보물 · 👑보스)를 골라 나아갑니다.
- **6속성 카드 36종** — 풀(방어·독) 불꽃(화상·폭딜) 물(빙결·드로우) 전기(감전·연쇄) 신비(드로우·약화) 용(힘·강공)
- **속성 체인** — 같은 속성을 연달아 쓰면 피해·방어 +2씩 누적
- **조합 카드** — 두 속성 카드가 손에 모이면 합쳐서 조합 카드(10종) 생성
- **유물 8종 · 이벤트 · 상점 · 카드 강화/제거**, 보스를 잡으면 더 깊은 ACT로 무한 진행
- 카드를 탭하면 사용, 적을 탭하면 대상 지정
- 오늘의 숲 변이(AI)가 카드 규칙에도 적용 (예: 짙은 안개 = 적 의도 숨김, 메아리 = 첫 카드 2번 발동)

### ⚔️ 서바이벌
기존 실시간 액션 모드. 시작 화면에서 전환할 수 있습니다.

## 공통 특징

| 구분 | 내용 |
|---|---|
| ✨ 이펙트 | 빛나는 투사체와 꼬리, 지그재그 번개, 데미지·치명타 숫자, 콤보 카운터, 레벨업 빛기둥, 보스 등장 레터박스와 경고 카드, 보스 처치 슬로모션과 무지개 충격파, 화면 번쩍임·줌, 바닥 그을음, 낮엔 낙엽·밤엔 반딧불 |
| ⚙️ 자동 품질 | 프레임이 떨어지면 이펙트를 자동으로 가볍게 (일시정지 메뉴에서 직접 전환 가능) |
| 🔮 오늘의 숲 | Gemini Flash가 하루 한 번 변이 16종 중 3개와 숲 이름·보스 칭호·예언을 정함. 모든 플레이어가 같은 숲 |
| 💠 영구 성장 | 판마다 정수를 모아 9가지 능력 영구 강화 |
| 🌱 정령 진화 | 누적 처치 수에 따라 동료 정령이 3단계로 진화 |
| 🌙 현실 시간 | 한국 시간 저녁 7시~새벽 6시는 밤의 정글 |
| 🔥 콤보 | 100콤보마다 황금 보석 소나기 |
| 🏆 일일 랭킹 | 같은 숲을 플레이한 사람끼리 순위 |
| 📱 모바일 | 안전영역, 큰 터치 버튼, 따라오는 조이스틱, 진동, 자동 일시정지, 홈 화면 추가 |

## 내 컴퓨터에서 실행

```bash
npm install
npm run dev          # http://localhost:3000
```
Firebase 설정 없이도 바로 플레이됩니다 (기록은 브라우저에, 오늘의 숲은 날짜로 자동 생성).

테스트용 주소 옵션: `?speed=4` (4배속), `?mut=storm,split,elite` (변이 직접 지정, 목록은 `game/mutators.js`)

## 자동 배포 설정

### ① GitHub Pages (바로 동작)
저장소 **Settings → Pages → Source: GitHub Actions** 선택 후 `main`에 push하면
`https://<아이디>.github.io/pocket-jungle/` 에서 플레이할 수 있습니다.

### ② Firebase 프로젝트 준비 (한 번만)
1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Authentication → 로그인 방법 → 익명** 사용 설정
3. **Firestore Database** 만들기
4. **AI 서비스 → AI Logic → 시작하기 → Gemini Developer API** 선택 (무료 할당량, 결제 정보 불필요)
5. **App Check**: AI Logic 설정 중 안내에 따라 reCAPTCHA Enterprise 사이트 키 생성 → 아래 `RECAPTCHA_SITE_KEY`에 사용.
   reCAPTCHA 키의 허용 도메인에 `<프로젝트ID>.web.app`, `<아이디>.github.io`, `localhost` 추가
6. **프로젝트 설정 → 내 앱 → 웹 앱(</>) 추가** → 표시되는 `apiKey`, `projectId`, `appId` 확인
7. Authentication → 설정 → **승인된 도메인**에 `<아이디>.github.io` 추가 (Pages에서도 랭킹이 되게)

> ✅ 이 저장소는 위 ②가 이미 끝났고, 웹 설정값은 `nuxt.config.ts`에 들어 있습니다. 아래 ③은 다른 프로젝트로 바꿀 때만 필요하고, Firebase Hosting 자동 배포를 켜려면 **`FIREBASE_SERVICE_ACCOUNT` 시크릿 하나만** 넣으면 됩니다.

### ③ GitHub 저장소에 값 넣기
**Settings → Secrets and variables → Actions**

| 종류 | 이름 | 값 |
|---|---|---|
| Variables | `FIREBASE_PROJECT_ID` | 프로젝트 ID |
| Variables | `FIREBASE_API_KEY` | 웹 앱 apiKey |
| Variables | `FIREBASE_APP_ID` | 웹 앱 appId |
| Variables | `RECAPTCHA_SITE_KEY` | App Check 사이트 키 |
| Variables (선택) | `GEMINI_MODEL` | 기본값 `gemini-3.8-flash` |
| **Secrets** | `FIREBASE_SERVICE_ACCOUNT` | 서비스 계정 JSON 전체 (아래) |

**서비스 계정 JSON 만들기**: [Google Cloud 콘솔 → IAM → 서비스 계정](https://console.cloud.google.com/iam-admin/serviceaccounts) → 프로젝트 선택 → **서비스 계정 만들기** → 역할 **Firebase 관리자** → 만든 계정 클릭 → **키 → 키 추가 → JSON** → 내려받은 파일 내용을 통째로 붙여넣기

이제 `main`에 push할 때마다 `https://<프로젝트ID>.web.app` 에 자동 배포되고 Firestore 보안 규칙도 함께 반영됩니다.

## AI 토큰을 최소로 쓰는 구조

1. 기기에 오늘 신탁이 있으면 → 사용 (호출 0)
2. Firestore `oracles/{오늘}`에 있으면 → 사용 (호출 0)
3. **그날 첫 플레이어만** Gemini 호출 → Firestore에 저장. 보안 규칙이 "그날 최초 1회 생성"만 허용해서 덮어쓰기 불가
4. 실패 시 날짜 기반 생성 (호출 0)

요청은 `변이 id 3개 + 짧은 글 3개` JSON만 받고, 생각(thinking)은 LOW로 제한합니다.
1순위 `gemini-3.8-flash`가 13초 안에 답하지 않으면 `gemini-3.5-flash-lite`로 한 번 더 시도합니다.

**진단**: 주소 끝에 `?oracleTest=1` (특정 모델은 `&model=gemini-3.5-flash-lite`)을 붙이면 저장 없이 AI를 직접 불러 결과나 오류를 화면과 콘솔에 보여 줍니다.
실제 게임 수치는 코드에 있어서 AI가 이상한 답을 줘도 게임은 깨지지 않습니다.

## 폴더 구조

```
app.vue                   화면 전체 (모드 전환 · 서바이벌 화면)
components/CardGame.vue   카드 원정 화면 (전투 UI · 지도 · 보상 · 상점 · 이벤트)
components/card/          CardView(카드 한 장) · MapView(지도)
game/cards/
  data.js                 카드·조합·적·보스·유물·변이·이벤트 데이터
  engine.js               카드 규칙 엔진 (화면과 분리)
  scene.js                전투 무대 캔버스 연출
components/               GameHud · ChoiceSheet · StartScreen · GameOver
composables/              useOracle(Gemini) · useMeta(영구 성장) · useLeaderboard(랭킹)
plugins/firebase.client.ts  Firebase · App Check · 익명 로그인
game/
  engine.js               게임 루프·전투·렌더링
  fx.js                   글로우 텍스처·번개 등 이펙트 도구
  data.js                 스킬 60종·패시브·조합·유물·보스
  mutators.js             오늘의 숲 변이 16종
  meta.js                 영구 업그레이드·점수
  sprites.js / sound.js   픽셀 스프라이트 / 8비트 효과음
firestore.rules           보안 규칙
.github/workflows/deploy.yml  자동 배포
```
