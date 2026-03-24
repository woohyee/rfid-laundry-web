# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-24

### 오늘 한 것
- **태그 입력 순서 변경**: Shirt 먼저 → D/C 나중 순서로 변경
- **Edit 탭 추가**: 인보이스 검색 → 태그 선택(스캔 or 클릭) → 이동(Shirt↔D/C) / 삭제 / 인보이스 전체 삭제
  - 태그 이동 시 shirtCount / dcCount 자동 조정
  - 태그 선택 시 모달로 액션 표시 (스크롤 불필요)
- **중복 인보이스 방지**: 인보이스 번호 입력 시 Firestore 중복 체크 → 이미 있으면 거부
- **Lookup 날짜 구간 검색**: From/To 구간 필터 (단일 날짜 → 구간으로 교체)
- **Lookup 일괄 삭제**: received 인보이스만 선택 기간 일괄 삭제 (pending 자동 제외)
- **Lookup 상단 중복 Pending 박스 제거**
- **로고 크기 소폭 확대**: h-16 → h-20

### 현재 상태
- 배포 완료 (`rfid-laundry-web.vercel.app`)
- 모든 기능 정상 작동 확인

### 다음에 할 것 (우선순위 순)
1. 현장 테스트 피드백 기반 추가 개선
2. 로고 이미지 교체 (짙은 배경 버전으로 새로 제작 예정)
3. DESIGN.md 작성 (디자인 시스템 문서화)
4. Firebase 콘솔에서 기존 계정 shops/{uid} 수동 생성

### 알아둘 것
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- .npmrc에 legacy-peer-deps=true 설정 (vite-plugin-pwa Vite 8 미지원)
- receivedTags 필드는 최근 추가 — 기존 인보이스는 View에서 모두 pending으로 표시됨
- Sign Up 이전 생성 계정은 헤더 상호명 미표시 (Firebase 콘솔에서 shops/{uid} 수동 생성 필요)
- 배포 URL: rfid-laundry-web.vercel.app
- 디자인 컬러: Header `#18181B`, Accent `#E07B0F`, BG `#F7F6F3`
