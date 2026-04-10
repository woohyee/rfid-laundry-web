# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-04-09 (2차)

### 오늘 한 것
- **SignUp + Onboarding 통합 (진행 중)**: SignUp.jsx 제거하고 Onboarding.jsx 하나로 통합
  - 이메일/비밀번호를 profile 스텝에 추가
  - `createUserWithEmailAndPassword` + `setDoc shop` + partnership 한번에 처리
  - 초대코드 사용 후 `deleteDoc`으로 삭제 (기존 `used: true` 대신)
  - 디포 업체코드 자동 생성: 공장명 첫 단어 + 순번 (예: TopHat001)
  - Login.jsx에서 SignUp → Onboarding으로 교체
  - 빌드 성공 확인

### 미완성 / 다음 세션 우선순위

1. **URL 라우팅 분리**: `/signup/depot`, `/signup/factory` 별도 URL로 분리 (역할 선택 스텝 제거, URL이 역할 결정)
2. **Factory 대시보드 확장**: Factory 탭을 관리자 대시보드 역할로 확장 (디포 관리, 리포트 등)
3. **고아 파일 정리**: TagEdit.jsx, Archive.jsx, Partnership.jsx, SignUp.jsx 삭제
4. **Firestore Security Rules**: 계획서에 정리됨, Firebase Console에서 적용 필요
5. **테스트**: Factory 계정 생성 → 초대코드 → Depot 계정 등록 → 분실물 플로우 E2E 테스트
6. **Cloud Function 배포**: `cd functions && firebase deploy --only functions`

### 설계 결정 사항 (이번 세션)
- **초대코드**: 사용 후 삭제 (재사용 불가)
- **업체코드**: 공장명 첫 단어 + 3자리 순번 (TopHat001, TopHat002...)
  - `shops/{depotUid}.depotCode` + `partnerships.depotCode`에 저장
- **Factory vs Depot**: 한 프로젝트, 한 배포. URL 라우팅으로 분리.
- **Factory = 관리자 대시보드** 역할. Depot = 현장 작업 앱.

### 이전 세션 (2026-04-09 1차) 요약
- 탭 통폐합 완료 (3탭: Tagging/Receiving/Lookup)
- Lost Items 시스템 전체 구현
- 공지사항 양방향 구현
- 온보딩 플로우, 역할 기반 UI 분리
- RFID 리더 옵션, Partnership 초대코드 기반
- Cloud Function 스케줄러, Firebase Storage

### 수정된 파일 (이번 세션)
- `src/pages/Onboarding.jsx` — 통합 등록 플로우 (Auth+Shop+Partnership 한번에)
- `src/pages/Login.jsx` — SignUp → Onboarding 교체

### 고아 파일 (미사용, 삭제 가능)
- `src/pages/TagEdit.jsx` — Lookup에 통합됨
- `src/pages/Archive.jsx` — Lookup에 통합됨
- `src/pages/Partnership.jsx` — Layout에서 제거됨
- `src/pages/SignUp.jsx` — Onboarding에 통합됨

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
- origin/main 대비 2커밋 ahead (push 안 됨)

### 알아둘 것
- **실운영 데이터**: Firestore에 실제 운영 중인 데이터 있음. 절대 삭제 금지.
- **기존 유저**: shops/{uid}에 role 필드 없으면 코드에서 'depot' 기본 처리 (DB 수정 없음)
- **기존 유저**: hasRfidReader 필드 없으면 true 기본 (기존 기능 유지)
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- 디자인: Depot 오렌지(#E07B0F), Factory 블루(#2563EB), Header #18181B, BG #F7F6F3
