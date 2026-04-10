# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-04-09

### 오늘 한 것
- **탭 통폐합 완료**: DayCheck 삭제, Edit→Lookup 모달, Archive→Lookup 필터 통합 (3탭: Tagging/Receiving/Lookup)
- **Lost Items 시스템 설계 + 전체 구현**: 분실물 신고(Depot), 미아 옷 등록(Factory), 클레임, Delivery Plan
- **공지사항 양방향 구현**: 공장↔디포 공지/메시지 (전체/개별/디포→공장, 보안 격리)
- **온보딩 플로우**: 역할 선택 → 초대코드(depot) → 프로필(업체명/전화/RFID옵션) → 등록
- **역할 기반 UI 분리**: Depot(오렌지) vs Factory(블루) 테마, 탭 구성 다름
- **RFID 리더 옵션**: 없는 디포는 Tagging/Receiving/Lookup 비활성화
- **Partnership**: 초대코드 기반, 가입 시 자동 파트너십 생성. Partners 탭 제거.
- **Cloud Function**: 자동 삭제 스케줄러 (resolved 5일 후 / unclaimed 30일 후 / 만료 공지)
- **Firebase Storage**: getStorage + 사진 업로드/압축 유틸 + PhotoCapture(카메라) / PhotoUpload(갤러리)

### 신규 파일
- `src/pages/Onboarding.jsx` — 회원가입 후 온보딩 (역할/초대코드/프로필/RFID옵션)
- `src/pages/FactoryLostItems.jsx` — Factory Lost Items (Depot Reports + Found Items + Delivery Plan)
- `src/pages/LostItems.jsx` — Depot Lost Items (My Reports + Found Items 클레임)
- `src/pages/Announcements.jsx` — 양방향 공지사항
- `src/pages/Partnership.jsx` — 파트너십 (현재 미사용, Layout에서 제거됨)
- `src/components/PhotoCapture.jsx` — 카메라 직접 실행 (Factory용)
- `src/components/PhotoUpload.jsx` — 갤러리 선택 (Depot용)
- `src/lib/storage.js` — Firebase Storage 업로드/삭제 유틸
- `firebase.json` — Firebase Functions 설정
- `functions/index.js` — 자동 삭제 Cloud Function 스케줄러
- `functions/package.json` — Functions 의존성

### 수정된 파일
- `src/App.jsx` — shop 없으면 Onboarding 라우팅
- `src/components/Layout.jsx` — role 기반 탭 분기, RFID 옵션, Factory/Depot 테마, 초대코드 생성
- `src/context/AuthContext.jsx` — setShop 노출
- `src/lib/firebase.js` — getStorage 추가
- `src/pages/SignUp.jsx` — 간소화 (이메일/비번만, shops 문서 생성 제거)
- `src/pages/Tagging.jsx` — DUE_DAY 인보이스 카드에 통합
- `src/pages/Lookup.jsx` — TagEdit + Archive 기능 통합

### 삭제된 파일
- `src/pages/DayCheck.jsx`

### 고아 파일 (미사용, 삭제 가능)
- `src/pages/TagEdit.jsx` — Lookup에 통합됨
- `src/pages/Archive.jsx` — Lookup에 통합됨
- `src/pages/Partnership.jsx` — Layout에서 제거됨 (온보딩에 통합)

### 미완성 작업 (다음 세션 우선순위)
1. **SignUp + Onboarding 통합**: 현재 SignUp → Onboarding 2단계인데, 초대코드가 회원가입 전에 와야 함. 올바른 플로우: 역할 선택 → 초대코드 → 이메일/비번 + 프로필 → 한번에 등록
2. **Firestore Security Rules**: 계획서에 정리됨, Firebase Console에서 적용 필요
3. **고아 파일 정리**: TagEdit.jsx, Archive.jsx, Partnership.jsx 삭제
4. **테스트**: Factory 계정 생성 → 초대코드 → Depot 계정 등록 → 분실물 플로우 E2E 테스트
5. **Cloud Function 배포**: `cd functions && firebase deploy --only functions`

### 삭제 정책
- **자기가 올린 건 자기가 삭제** 원칙
- lostReport: 디포만 삭제 (Mark Resolved → 5일 후 자동 삭제)
- foundItem: 공장만 삭제 (Mark Resolved → 5일 후 자동 삭제)
- 즉시 삭제 없음. 5일 유예 기간.
- 미해결 foundItem: 30일 후 자동 삭제
- 공지사항: expiresAt 만료 후 자동 삭제

### 설계 계획서
- 파일: `~/.gstack/projects/woohyee-rfid-laundry-web/senn-main-lost-items-plan-20260409-210922.md`
- 상태: FINAL

### 현재 상태
- 배포: `rfid-laundry-web.vercel.app` — 현재 v1 운영 중
- 로컬: 빌드 성공 (`npm run build` ✓)
- 미커밋: 변경사항 다수 (커밋 필요)

### 알아둘 것
- **실운영 데이터**: Firestore에 실제 운영 중인 데이터 있음. 절대 삭제 금지.
- **기존 유저**: shops/{uid}에 role 필드 없으면 코드에서 'depot' 기본 처리 (DB 수정 없음)
- **기존 유저**: hasRfidReader 필드 없으면 true 기본 (기존 기능 유지)
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- 디자인: Depot 오렌지(#E07B0F), Factory 블루(#2563EB), Header #18181B, BG #F7F6F3
