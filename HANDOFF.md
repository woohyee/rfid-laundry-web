# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-21

### 오늘 한 것
- UI 전반 개선: ErrorBanner 공통 컴포넌트, 반응형 레이아웃, 폰트 크기 계층화
- Lookup: Edit 기능 제거, pending 인보이스 View 버튼 추가 (태그별 received/missing 표시)
- Receiving: 태그 스캔 시 `receivedTags` Firestore 누적 저장 (세션 끊겨도 유지)
- 헤더: 로고 추가, `RFID Laundry — 상호명` 표시
- Sign Up 페이지 생성 (상호, 대표이름, 연락처, 주소, 이메일, 비밀번호 → Firestore `shops/{uid}` 저장)
- Lookup 통계 카드 동적 Tailwind 클래스 버그 수정
- Sign Out을 탭 바 오른쪽으로 이동

### 현재 상태
- 기능 완성, UI 개선 완료. 배포 전 단계.

### 다음에 할 것 (우선순위 순)
1. Firebase Hosting 배포 설정 및 배포
2. 기존 계정(Sign Up 이전 생성)에 shops 문서 수동 생성 필요 (Firestore 콘솔에서)
3. 배포 후 Windows 환경에서 실제 사용 테스트

### 알아둘 것
- `receivedTags` 필드는 이번 세션에 추가됨 — 기존 인보이스는 해당 필드 없음 (View에서 모두 missing으로 표시될 수 있음)
- Sign Up 이전에 만든 계정은 `shops/{uid}` 문서가 없어 헤더에 상호명 미표시
- 로고 파일: `src/assets/logo.png`
