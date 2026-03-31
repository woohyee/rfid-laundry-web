# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-31

### 오늘 한 것
- **아카이브 시스템 구축**: 인보이스 상태 흐름 `pending → received (당일 Lookup) → archived (익일) → 삭제 (7일 후)`
- **Archive 탭 신설**: 아카이브된 인보이스 번호 + 수령일 목록 표시
- **스캐너 버그 수정**: `lastScan` stale 표시 문제, completed 인보이스 재스캔 처리, Firestore updateDoc 원자성 개선
- **Firestore 복합 인덱스 오류 해결 (긴급)**: 배포 후 모든 pending 인보이스가 "not found"로 나오는 버그 — `status` 조건을 Firestore 쿼리에서 제거하고 클라이언트 JavaScript 필터링으로 전환 (Receiving, DayCheck, Lookup cleanup, Archive 전부)
- **당일 completed 인보이스 재스캔**: 파란색 "Already Received Today" 카드 표시

### 현재 상태
- 배포 완료 (`rfid-laundry-web.vercel.app`)
- Firestore 복합 인덱스 의존성 없음 — 모든 쿼리는 `shopId`만 사용, 나머지는 클라이언트 처리
- 현장에서 엉킨 태그는 사진 판독으로 직접 복구 완료

### 다음에 할 것 (우선순위 순)
1. 현장 테스트 피드백 기반 추가 개선
2. 로고 이미지 교체 (짙은 배경 버전으로 새로 제작 예정)
3. DESIGN.md 작성 (디자인 시스템 문서화)
4. Firebase 콘솔에서 기존 계정 shops/{uid} 수동 생성

### 알아둘 것
- **Firestore 쿼리 원칙**: 모든 쿼리는 `where('shopId', '==', uid)` 단일 조건만 사용. status/날짜 필터는 전부 클라이언트에서 처리. 복합 인덱스 생성 없이 동작함
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- .npmrc에 legacy-peer-deps=true 설정 (vite-plugin-pwa Vite 8 미지원)
- receivedTags 필드는 최근 추가 — 기존 인보이스는 View에서 모두 pending으로 표시됨
- Sign Up 이전 생성 계정은 헤더 상호명 미표시 (Firebase 콘솔에서 shops/{uid} 수동 생성 필요)
- 배포 URL: rfid-laundry-web.vercel.app
- 디자인 컬러: Header `#18181B`, Accent `#E07B0F`, BG `#F7F6F3`
- dueDay 필드: 신규 인보이스는 태깅 시 입력, 기존 인보이스는 Day Check 탭에서 스캔 후 입력 가능
- TagScanner의 `document click` 이벤트: 모달 열려있을 때도 포커스 이동하므로 모달 UX 주의 (현재는 문제 없음)
