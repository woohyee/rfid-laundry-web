# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-04-10

### 오늘 한 것
- **Factory Code 기반 Partnership**: 초대코드 시스템 → 공장코드(factoryCode) 전환 완료
  - 공장 가입 시 factoryCode 자동 생성 (업체명 기반, 최대 10자)
  - 디포 가입 시 factoryCode 입력 → Auth 생성 → 공장 조회 → partnership 생성
  - factoryCode 매칭 실패 시 Auth cleanup (`user.delete()`)
  - Partnership 생성 실패 시 Auth+shop cleanup + 명시적 에러
- **Factory 대시보드 탭 분리**: Lost Items 서브탭 → 독립 메인 탭으로 분리
  - Depot Reports: 디포 분실 신고 목록
  - Found Items: 미아 옷 사진 촬영+업로드
  - Depots: 연결된 디포 목록 + Disconnect(연결 해제)
  - Notice: 공지사항
- **등록 race condition 수정**: `registering` 플래그로 onAuthStateChanged 충돌 방지
- **UI 정리**: 공장 등록 시 코드 입력 필드 제거, 메뉴바 코드 표시 제거

### 미완성 / 다음 세션 우선순위

1. **E2E 테스트**: Factory 계정 → 초대코드(factoryCode) → Depot 등록 → Lost Items 플로우 전체 테스트
   - Factory: tophat@tophat.com (비밀번호 리셋 필요할 수 있음)
   - Depot: sennpapa@gmail.com (기존 계정)
2. **factoryCode 고정**: 현재 "TOPHATCLEA" 자동 생성됨. 유저는 "TOPHAT001" 원함. 코드 변경 또는 Firestore에서 직접 수정
3. **고아 Auth 계정 정리**: woohyee@naver.com, test@shop.com (shop 문서 없음, Firebase Auth에서 삭제)
4. **고아 파일 정리**: TagEdit.jsx, Archive.jsx, Partnership.jsx, SignUp.jsx 삭제 (별도 cleanup PR)
5. **Firestore Security Rules**: Firebase Console에서 적용 필요
6. **Cloud Function 배포**: `cd functions && firebase deploy --only functions`
7. **테스트 인프라**: vitest 설정 + 기본 테스트 추가

### 설계 결정 사항 (이번 세션)
- **Factory Code 방식**: 초대코드(inviteCodes) → 공장 고유코드(factoryCode). 1:N 구조에 최적.
- **factoryCode 자동 생성**: 업체명에서 공백/특수문자 제거 → 대문자 → 최대 10자. 중복 시 suffix 추가.
- **Factory 탭 독립화**: Depot Reports, Found Items를 각각 메인 탭으로 분리. Delivery Plan은 각 탭 내부.
- **Depots 관리 탭**: 연결된 디포 목록 + Disconnect (partnership.status → inactive). 데이터 삭제 없음.
- **등록 race condition 해결**: AuthContext에 registering 플래그 추가. 등록 중 onAuthStateChanged의 shop 조회 스킵.

### 이전 세션 (2026-04-09) 요약
- SignUp+Onboarding 통합 (Auth+Shop+Partnership 한번에)
- 탭 통폐합 완료 (Depot: Tagging/Receiving/Lookup/Lost Items/Notice)
- Lost Items 시스템 전체 구현
- 공지사항 양방향 구현
- 온보딩 플로우, 역할 기반 UI 분리

### 수정된 파일 (이번 세션)
- `src/pages/Onboarding.jsx` — factoryCode 기반 등록 + race condition 수정
- `src/components/Layout.jsx` — Factory 탭 분리 + Depots 탭 추가 + 코드 표시 제거
- `src/pages/FactoryLostItems.jsx` — 서브탭 → 독립 export 컴포넌트 (FactoryDepotReports, FactoryFoundItems, FactoryDepots)
- `src/context/AuthContext.jsx` — registering 플래그 추가

### 고아 파일 (미사용, 삭제 가능)
- `src/pages/TagEdit.jsx` — Lookup에 통합됨
- `src/pages/Archive.jsx` — Lookup에 통합됨
- `src/pages/Partnership.jsx` — Layout에서 제거됨
- `src/pages/SignUp.jsx` — Onboarding에 통합됨

### Firebase Auth 계정 현황
- `tophat@tophat.com` — Factory (Tophat Cleaners), UID: D3P94A1s...
- `sennpapa@gmail.com` — Depot (기존 운영 계정), UID: 6FTPW0Xz...
- `woohyee@naver.com` — 고아 계정 (shop 없음), 삭제 대상
- `test@shop.com` — 고아 계정 (shop 없음), 삭제 대상

### 삭제 정책
- **자기가 올린 건 자기가 삭제** 원칙
- lostReport: 디포만 삭제 (Mark Resolved → 5일 후 자동 삭제)
- foundItem: 공장만 삭제 (Mark Resolved → 5일 후 자동 삭제)
- 즉시 삭제 없음. 5일 유예 기간.
- 미해결 foundItem: 30일 후 자동 삭제
- 공지사항: expiresAt 만료 후 자동 삭제
- 디포 연결 해제: partnership.status → inactive (데이터 삭제 없음)

### 현재 상태
- 배포: `rfid-laundry-web.vercel.app` — 현재 운영 중
- 로컬: 빌드 성공 (`npm run build` ✓)
- origin/main 동기화됨 (push 완료)

### 알아둘 것
- **실운영 데이터**: Firestore에 실제 운영 중인 데이터 있음. 절대 삭제 금지.
- **기존 유저**: shops/{uid}에 role 필드 없으면 코드에서 'depot' 기본 처리 (DB 수정 없음)
- **기존 유저**: hasRfidReader 필드 없으면 true 기본 (기존 기능 유지)
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- 디자인: Depot 오렌지(#E07B0F), Factory 블루(#2563EB), Header #18181B, BG #F7F6F3
