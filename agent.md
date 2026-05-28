# LFmall 기획전 실시간 성과 분석기 - 개발자 및 에이전트 지침서 (agent.md)

이 문서는 본 저장소(Repository)의 개발 목적, 전체 아키텍처 구조, 데이터 처리 방식 및 에이전트(Agent)가 개발 작업을 할 때 반드시 준수해야 하는 규칙과 룰을 규정합니다. 향후 저장소 작업을 수행하는 모든 개발자와 AI 에이전트는 본 문서를 기준으로 일관성을 유지해야 합니다.

## 🚨 [최우선 비즈니스 규칙] 100% 리얼 라이브 데이터 정책 (Non-Negotiable)
- **본 시스템은 실제 LFmall 기획전 분석 및 운영용 제품이므로, 가짜 데이터(Fake), 데모용 모의 데이터(Mock), 혹은 시뮬레이션용 데이터(Seeded)가 절대 개입되어서는 안 됩니다.**
- 모든 데이터베이스 리셋, 인메모리 스토어 초기화 시에는 가짜 5일 치 시드 데이터를 넣지 않고 **완벽한 제로 상태(Empty `{}`)**로 시작해야 합니다.
- 시스템의 모든 출력, 스코어카드, 랭킹 및 그래프는 오직 GTM(`tracker.js`)을 통해 실시간으로 수집되는 순수 유저 트래픽 데이터만으로 구동되어야 합니다.

---

## 1. 시스템 목적 (System Purpose)

본 시스템은 **LFmall 기획전 실시간 성과 분석기 (LFmall Real-Time Exhibition Analytics Telemetry)** 입니다.
수많은 기획전(Campaign)이 동시다발적으로 운영되는 E-Commerce 환경에서, 쇼핑객들의 유입 흐름(페이지뷰), 활성 상호작용(배너/쿠폰 클릭 활동량), 그리고 구매 기여 매출(Last-Touch Attribution 모델 기반)을 실시간으로 추적·시각화하여 마케팅 효율을 분석하는 것을 목적으로 합니다.

---

## 2. 프로젝트 아키텍처 및 폴더 구조

본 프로젝트는 의존성을 최소화하고 브라우저 `file://` 프로토콜(로컬 파일 실행) 및 Live Express 백엔드 서버 양쪽 환경에서 CORS 오류 없이 완전히 독립적이고 견고하게 작동하도록 웹 표준 기술(React Standalone, Vanilla CSS, Express)로 설계되었습니다.

### 📂 주요 파일 구성 및 역할

```markdown
├── index.html                    # 메인 뷰포트 (React Standalone 구동, 단독 구동 및 라이브 연동 통합 파일)
├── server.js                     # Express 백엔드 (JSONL 데이터베이스 파티셔닝, CORS Credentials 가드 및 수집/Attribution API)
├── style.css                     # Clay.com 스타일 디자인 시스템 CSS 규칙 및 마이크로 인터랙션 모션
├── vercel.json                   # Vercel 배포/라우팅 룰 구성 및 static components/ 폴더 다이렉트 바이패스 매핑
├── tracker.js                    # [Legacy] 클라이언트 통계 트래커 유틸리티
├── app.js / dashboard.js         # [Legacy] 초기 분할 뷰 코디네이터 및 대시보드 리포팅 모듈
├── store.js                      # [Legacy] 시뮬레이션용 모의 프론트 쇼핑몰 상점 레이아웃
├── components/                   # [물리 모듈 분할 컴포넌트 폴더]
│   ├── Icons.js                  # 13종 격리형 커스텀 인라인 SVG 아이콘 모듈
│   ├── FunnelChart.js            # SVG 기반 5단계 퍼널 분석 시각화 컴포넌트
│   ├── CampaignGrid.js           # 브랜드명 파싱, 브랜드별 테마 및 지표 출력 그리드 및 레이지 로더 컴포넌트
│   └── Dashboard.js              # 조회 기간 프론트 맵, 스코어카드 및 daily-trend SVG 라인 곡선 차트 핵심 컴포넌트
├── exhibition_analytics_icon.png # 대시보드 메인 브랜드 로고 및 탭 파비콘 이미지
└── agent.md                      # [본 문서] 시스템 가이드 및 개발 에이전트 룰 규정 파일
```

### 💻 각 레이어별 세부 구조

#### A. 프론트엔드 대시보드 (`index.html` & `components/*`)
- **초경량 오케스트레이터 구조**: `index.html` 본체는 약 50라인의 초경량 구조로 React Standalone 런타임 탑재 및 `components/` 하위 모듈들을 `<script type="text/babel" src="...">` 방식으로 로드하여 마운팅하는 오케스트레이터 역할에 한정됩니다.
- **물리적 분할 컴포넌트 아키텍처**: 비주얼 카드 그리드, 인라인 SVG 아이콘, SVG 퍼널 차트, 스코어카드 및 daily-trend 에어리어 차트 등 모든 구성 요소는 `components/` 폴더 아래 물리적 모듈로 엄격히 격리 분할되어 구동됩니다.
- **인터랙티브 SVG 트렌드 차트**: 외부 라이브러리(Chart.js, Recharts 등) 없이 React 내장 SVG 요소를 활용한 프리미엄 곡선 라인-에어리어 차트입니다. dynamic 툴팁 가이드선이 축에 완벽히 동기화됩니다.
- **레이지 로더 (Lazy Loader)**: 대량 데이터 로드로 인한 브라우저 병목을 방지하기 위해 최초 20개 카드를 로드하고 하단 버튼 클릭 시 비동기 스피너 모션(800ms)과 함께 10개씩 페이징 로딩됩니다.

#### B. 백엔드 집계 엔진 (`server.js`)
- **고성능 JSON Lines (JSONL) DB 탑재**:
  - 트래픽 대량 적재 시의 파일 쓰기 Lock 및 파싱 병목을 제거하기 위해 기존 JSON Array 구조를 탈피하고, 신규 유입 이벤트를 일자별 파일 `events-YYYY-MM-DD.jsonl` 끝에 `fs.promises.appendFile`로 O(1) 시간복잡도로 고속 Append하는 DB 아키텍처를 가동합니다.
- **Vercel 서버리스 `/tmp` 최적화 및 인메모리 폴백 (In-Memory Fallback)**:
  - Vercel Serverless의 Read-Only 파일 시스템 특성을 극복하기 위해 서버 구동 환경을 실시간 감지하여 쓰기가 허용된 `/tmp/db_store` 디렉터리를 가동 경로로 동적 지정합니다.
  - 디렉터리 생성 및 쓰기/읽기 작업에서 파일 시스템 예외 발생 시, 즉시 **인메모리 분할 맵(`inMemoryDb`)**으로 폴백하여 에러율 0%의 탄탄한 서버리스 생존 아키텍처를 자랑합니다.
- **수집 및 기여도 연산 API**:
  - `/api/collect`: 사용자의 원격 이벤트 로그(PAGE_VIEW, CLICK, PURCHASE 등) 수집 및 일자별 샤딩
  - `/api/stats`: 조회 기간 범위 내 날짜 파일/인메모리 세그먼트만 파싱해 Last-Touch Attribution 기여 매출 계산 및 데이터 서빙
  - `/api/simulate` & `/api/reset`: 모의 유저 유입 시뮬레이션 분할 파일 디스패치 및 디렉터리/인메모리 리셋 연동
- **Last-Touch Attribution 모델**: 구매(`PURCHASE`) 로그 발생 시, 해당 유저의 세션ID(`sessionId`)가 직전에 마지막으로 머물렀던 기획전 ID(`exhibitionId`)를 찾아내어 매출 기여도를 즉시 합산 처리합니다.

#### C. 디자인 시스템 및 스타일 (`style.css`)
- **Clay.com 디자인 테마 반영**:
  - 따뜻하고 미려한 크림 캔버스 바탕색(`--colors-canvas: #fffaf0`)과 정교한 단색 대비 헤어라인 스타일 적용.
  - 고유의 7가지 브랜드 테마 컬러 스펙트럼(Pink, Teal, Lavender, Peach, Ochre, Mint, Coral)을 사용해 마이크로 인터랙션을 유기적으로 연출합니다.

---

## 3. 핵심 비즈니스 로직 및 계산 모델

AI 에이전트가 데이터나 파이프라인 수정을 진행할 때는 아래 계산 원칙을 엄격하게 지켜야 합니다.

### A. 일자 간격 ($D$, Days) 연산 규칙
- `startDate`와 `endDate` 사이의 실제 차이 일수($D$)를 계산합니다. 당일을 포함해야 하므로 **반드시 차이 일수에 `+ 1`**을 반영합니다.
- 계산된 일수 $D$는 항상 `1` 이상이어야 하며, 분모 오류 방지를 위해 하한선을 `1`로 고정합니다.

### B. 일 평균(Daily Average) 변환 공식
'일 평균 데이터' 뷰 모드가 활성화될 때 각 지표는 다음과 같이 정밀하게 변환됩니다.
1.  **순수 누적량 (PV, UV, Clicks, Revenue)**: $\text{일 평균 수치} = \text{round}\left(\frac{\text{누적 수치}}{D}\right)$
2.  **비율 및 기존 평균 지표 (이탈률, CVR, 평균 체류시간)**: 데이터 훼손을 방지하기 위해 나눗셈 연산에서 **제외(원래 값 유지)** 처리합니다.
3.  **퍼널 인입 인원**: 퍼널 차트 우측의 실유저 수를 일 평균으로 나눈 후 레이블 뒤에 `' / 일'` 문구를 자동으로 덧붙입니다.

### C. 브랜드 파싱 및 다이내믹 컬러링
- 각 기획전의 원본 타이틀 내 괄호 안의 브랜드 스트링(예: `(DAKKS)`, `(HAZZYS)`)을 추출해 brandName으로 지정하고, 괄호가 제거된 정제된 타이틀(cleanTitle)로 화면에 표시합니다.
- 추출된 브랜드를 기준으로 알맞은 고유 테마 컬러(닥스-Pink, 헤지스-Teal 등)를 가로 띠와 뱃지 배경색에 동적으로 주입합니다.

---

## 4. 에이전트 개발 수칙 & 규칙 (Agent Rules)

저장소를 다루는 AI 에이전트는 다음 수칙을 일절 어겨서는 안 됩니다.

*   **[규칙 1] 크림 캔버스 디자인 톤앤매너 고수**:
    - Clay.com의 크림 색상계(배경 `#fffaf0`, 서페이스 카드 `#f5f0e0`, 그림자 연출 등)와 미려한 라운딩 반경(var(--rounded-lg) 등) 디자인 시스템을 절대 해치지 마십시오.
*   **[규칙 2] 기획전 메타데이터 동적 자율 등록 구조 유지**:
    - `index.html`과 `server.js` 양쪽에 선언되어 있는 `EXHIBITION_METADATA` 오브젝트는 **초기값이 반드시 빈 오브젝트(`{}`)로 유지**되어야 하며, 실제 유저 트래픽이 `/api/collect`를 통해 유입될 때 서버가 동적으로 자율 등록하는 방식으로만 채워져야 합니다.
*   **[규칙 3] 에이전트/개발 문서 한글 표준화**:
    - 모든 대시보드 화면상의 다이내믹 텍스트, 아티팩트 보고서(implementation_plan, task, walkthrough), 그리고 개발 룰 관련 설명 등은 **한국어를 표준 언어로 사용**하여 작성해야 합니다.
*   **[규칙 4] 외부 이미지 및 아이콘 CORS 종속 금지**:
    - 아이콘이 추가로 필요한 경우 lucide-react 등의 외부 CDN 로딩 대신, `index.html` 내에 커스텀 인라인 SVG 컴포넌트(예: `IconCursor`, `IconBarChart` 등)를 정의해서 사용해야 합니다.
    - 메인 로고나 Favicon 같이 불가피한 이미지 리소스는 `/exhibition_analytics_icon.png`와 같이 프로젝트 내 로컬 리소스로 번들링하여 서비스합니다.
*   **[규칙 5] 테이블 스타일 변경 금지**:
    - 대시보드 하단의 '현재 운영 중인 실시간 기획전 성과 순위'는 테이블 형태가 아닌 **비주얼 카드 그리드(무료 추천 GRID)** 스타일과 **20개 최초 정렬 레이지 로더 구조**로 고정되어야 하며, 임의로 다시 단순 표 형태로 돌려놓아서는 안 됩니다.
*   **[규칙 6] 와이드스크린 레이아웃 유지**:
    - 대시보드 메인 래퍼 `.dashboard-pane`은 `max-width: 1500px;` 해상도를 지원하는 와이드 모드로 상시 유지되어야 하며, 요약 카드 6종은 데스크톱 화면에서 반드시 **어긋남 없이 완벽하게 단 한 줄(6열)에 모두 수평 배치**되도록 정렬 규칙을 준수해야 합니다.
*   **[규칙 7] 100% 실제 데이터(GTM 기반) 보장 및 모의 데이터 일절 배제**:
    - 본 분석 플랫폼은 마케팅 통계 지표의 완벽한 무결성과 신뢰성을 확보하기 위해 **가상 데이터 시딩 및 인공 트래픽 발생 행위를 영구적으로 일절 금지**합니다.
    - 모든 보고서 수치와 대시보드 성과 차트는 오직 Google Tag Manager(GTM) 및 클라이언트 트래커가 실제 LFmall 기획전 페이지에서 크롤링해 수집한 `/api/collect` 트래픽 로그에만 100% 의존해야 합니다.
    - 백그라운드 쇼퍼 시뮬레이터 `/api/simulate` API는 프로덕션에서 차단(403 Forbidden)되어야 하며, 유저 인터페이스 상에서도 시뮬레이션용 수동 발생 단추는 노출되거나 사용될 수 없습니다.
*   **[규칙 8] Credentials 포함 요청에 대한 CORS 동적 미러링 룰**:
    - GTM 빔 전송(`navigator.sendBeacon` 및 XHR) 시 Credentials 모드(`include`)가 기본 가동되므로, 서버 CORS 설정 내 `Access-Control-Allow-Origin` 헤더에 절대 와일드카드(`*`)를 지정해서는 안 됩니다.
    - 반드시 요청 헤더의 `Origin` 값을 동적으로 읽어 그대로 미러링(`credentials: true` 적용)하여 보안 정책을 완벽하게 통과시키는 dynamic CORS 아키텍처를 영구 유지하십시오.
*   **[규칙 9] 수집 API(/api/collect)의 방어적 Payload 파싱**:
    - 네트워크 전송 지연, 브라우저 스크랩 누락 등으로 인해 필수 키(`type`, `sessionId`, `userId`)나 `extra` 객체가 누락되거나 빈 값(`{}`)으로 전달되더라도, 수집 API는 절대 `400 Bad Request` 에러를 뿜어서는 안 됩니다.
    - 서버 레벨에서 가용한 필드와 디폴트 세이프가드(Default fallback 값 주입)를 강제 매핑하여 **무조건 202/200 성공(수집 완료) 응답을 반환**하는 방어적 섭취 로직을 준수하십시오.
*   **[규칙 10] 온더플라이(On-the-fly) 분석 루프 활성화**:
    - `/api/stats` 집계 엔진은 사전 정의되거나 정적 등록된 메타데이터 목록에 의존하여 루프를 돌아선 안 됩니다.
    - 누적 수집된 데이터 로그를 시간 순서대로 순회하며 새로운 기획전 ID가 감지되는 즉시, 통계 맵 객체(`exhibitionStats`)를 **실시간 동적 개설(On-the-fly)**하여 PAGE_VIEW, CLICK, PURCHASE 데이터의 유실이 전혀 없이 정확하게 합산되도록 연산 흐름을 완벽히 지켜내야 합니다.
*   **[규칙 11] React SPA(Single Page Application) 환경 GTM 수집 대응 규칙 (NEW)**:
    - LFmall 등 React 기반의 SPA 서비스는 브라우저 전체 리로드가 발생하지 않으므로, GTM 태그 내에 일반 `페이지뷰(Page View)` 트리거를 걸어둘 시 가상 라우팅 유입이 완전 누락되는 보틀넥이 발생합니다.
    - 이에 대응하여 반드시 GTM 상에 **`히스토리 변경(History Change)` 트리거**를 걸어 `gtm.historyChange` 이벤트를 PAGE_VIEW로 치환 맵핑하여 데이터 유실율 0%의 수집 환경을 조성해야 합니다.
    - 백엔드 수집기(`server.js`)는 GTM 히스토리 패킷이 매핑되는 `/exhibitions/` 및 `/app/event/` 등 다각화된 URL 규칙을 모두 네이티브 정규식으로 안전하게 수용 및 정밀 파싱하도록 구조를 영구 사수해야 합니다.
*   **[규칙 12] Express & Vercel 정적 모듈 서빙 규칙 (NEW)**:
    - 리팩토링된 `/components` 하위의 자바스크립트 파일들이 라이브 서버에서 404 혹은 wildcard fallback에 걸려 `index.html` 구문을 반환하고 `SyntaxError: Unexpected token '<'`를 유발하는 현상을 철저히 방지해야 합니다.
    - 이를 위해 `vercel.json`의 routes 규칙에 `components/.*`를 bypass로 명시 등록하고, 백엔드 서버 `server.js`에도 `app.use('/components', express.static(...))`을 명시적으로 선언하여 올바른 정적 자바스크립트 마임타입(`application/javascript`) 서빙 환경을 보장해야 합니다.
*   **[규칙 13] 특정 기획전 ID 하드코딩 땜질 전면 금지 (CRITICAL)**:
    - 특정 기획전 ID(예: `106251` 등)를 코드 수준에서 명시적으로 지목하여 조건문 분기로 수동 타이틀을 매핑하는 어떠한 임시 땜질식 하드코딩도 **영구적으로 절대 금지**합니다.
    - 모든 데이터 파이프라인과 수집 로직은 철저하게 클라이언트가 전송한 데이터 및 데이터베이스 인스턴스에 누적된 상태에 기반해 **유기적이고 논리적인(Logic-based) 공통 루틴**으로만 동작해야 합니다.
*   **[규칙 14] Upstash Redis REST 통신 시 UTF-8 인코딩 명시적 가드 의무화 (CRITICAL)**:
    - Node.js `https` 라이브러리를 통해 외부 REST API와 한국어 문자열 데이터를 주고받을 때 발생할 수 있는 데이터 훼손(예: 한글 물음표 `?` 깨짐 현상)을 완전히 방지해야 합니다.
    - REST 요청을 보낼 때는 전송 바디를 `Buffer.from(body, 'utf8')`로 바이너리화하여 길이를 지정하고, 헤더에 `Content-Type: application/json; charset=utf-8`을 선언하며, 응답을 읽을 때는 `res.setEncoding('utf8')`을 무조건 선언하여 인코딩 무결성을 영구 보장하십시오.



