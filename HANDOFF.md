# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-24

### 오늘 한 것
- **Due Day 기능 추가**: 태깅 시 인보이스 번호 입력 후 요일(MON~SAT) 선택 단계 삽입 → Firestore `dueDay` 필드 저장
- **Day Check 탭 신설**: RFID 태그 스캔 → 인보이스 번호 + 요일 크게 표시. 요일 없는 기존 인보이스는 바로 요일 선택 후 DB 저장
- **Edit 탭 요일 표시/수정**: 인보이스 검색 시 요일 표시, 클릭하면 요일 변경 모달
- **탭 버튼 스타일 개선**: 활성 탭 배경색 채움 (`#E07B0F` + 흰 글씨)
- **Edit 인보이스 번호 # 제거**

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
- dueDay 필드: 신규 인보이스는 태깅 시 입력, 기존 인보이스는 Day Check 탭에서 스캔 후 입력 가능
