# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-04-12

### 오늘 한 것
- **v3 설계 전면 재수정**: 멀티테넌트/Partnership/Factory 대시보드 전부 제거
  - DepotLayout (PC 중심): Tagging/Receiving/Lookup/Missing Items
  - 공장 로그인 완전 제거 → 공개 URL `/view/{depotUid}`로 전환
  - 공장은 QR 코드 스캔 → 사진 확인 + 코멘트 입력 (로그인 불필요)
  - Firebase Anonymous Auth로 Firestore 읽기/쓰기 권한 확보
- **Firebase Storage → Cloudinary**: Blaze 업그레이드 없이 사진 업로드 해결
  - unsigned upload preset (`rfid_laundry_unsigned`), cloud name: `dngymnr6b`
  - Firebase Storage SDK 제거 (번들 축소)
- **실시간 리스너**: getDocs → onSnapshot 전환 (양쪽 즉시 반영)
- **PWA 공장 지원**: QR 접속 → 홈화면 추가 → depotUid localStorage 저장 → 자동 리다이렉트
- **UI 개선 다수**: 모바일 탭 오버플로우, 모달 시트 스타일, 사진 확대/축소, Reply 입력창 등

### 커밋 수: 24개 (이번 세션)

### 미완성 / 다음 세션 우선순위

1. **PWA 공장 뷰 테스트**: 홈화면 아이콘 삭제 후 재설치 → `/view/{depotUid}` 자동 리다이렉트 확인
2. **Firestore Security Rules**: 현재 테스트 모드일 가능성. Firebase Console에서 실제 규칙 적용 필요
   - depot: 자신의 lostReports만 읽기/쓰기
   - anonymous (공장): lostReports 읽기 + comments 필드만 업데이트
3. **디포 모바일 UI 추가 개선**: Missing Items 탭의 모바일 반응형 (카메라 촬영 UX)
4. **cors.json 정리**: 프로젝트 루트에 남아있는 불필요한 파일 삭제
5. **vitest 설정 + 핵심 테스트**: 라우팅, 리포트 생성, 코멘트 추가

### 설계 결정 사항 (이번 세션)
- **공장 로그인 제거**: URL/QR 코드만으로 접근. 로그인 요구는 공장 입장에서 성가심.
- **1:1 하드코딩**: Partnership 개념 완전 제거. 공장은 모든 lostReports 조회.
- **Cloudinary unsigned upload**: Firebase Storage 대신 사용. Blaze 플랜 불필요.
- **코멘트 작성자 "Factory" 고정**: 이름 물어보는 UX 제거. 공장은 하나뿐.
- **onSnapshot 실시간**: 디포 삭제 → 공장 즉시 반영, 공장 코멘트 → 디포 즉시 반영.
- **PWA localStorage 리다이렉트**: `/`로 열려도 저장된 depotUid로 자동 이동.

### 현재 파일 구조 (src/)
```
src/
├── App.jsx                    — 라우팅 (/, /view/:depotUid)
├── context/AuthContext.jsx     — Firebase Auth + registering 플래그
├── lib/firebase.js             — Firebase 초기화 (Storage 제거됨)
├── lib/storage.js              — Cloudinary unsigned upload
├── components/
│   ├── DepotLayout.jsx         — PC 중심 레이아웃 (탭 4개)
│   ├── PhotoUpload.jsx         — 사진 업로드 컴포넌트
│   ├── PhotoCapture.jsx        — 카메라 촬영 컴포넌트
│   ├── TagScanner.jsx          — RFID 태그 스캐너
│   └── ErrorBanner.jsx         — 에러 배너
├── pages/
│   ├── Login.jsx               — 디포 전용 로그인
│   ├── Onboarding.jsx          — 디포 전용 가입 (역할 선택 없음)
│   ├── Tagging.jsx             — RFID 태깅 (PC)
│   ├── Receiving.jsx           — 수령 확인 (PC)
│   ├── Lookup.jsx              — 조회 (PC)
│   ├── MissingItems.jsx        — 미도착 옷 사진 업로드 + 목록 + QR 공유
│   └── FactoryPublicView.jsx   — 공장 공개 뷰 (로그인 불필요)
```

### 삭제된 파일 (이번 세션)
- Layout.jsx → DepotLayout으로 대체
- FactoryLayout.jsx → 공장 로그인 제거로 삭제
- FactoryView.jsx → FactoryPublicView로 대체
- FactoryLostItems.jsx, LostItems.jsx → MissingItems로 대체
- Announcements.jsx → 공지사항 기능 제거
- TagEdit.jsx, Archive.jsx, Partnership.jsx, SignUp.jsx → 이미 고아

### 환경 변수
- `.env` (git 미포함): Firebase + Cloudinary
  - VITE_CLOUDINARY_CLOUD_NAME=dngymnr6b
  - VITE_CLOUDINARY_UPLOAD_PRESET=rfid_laundry_unsigned
- Vercel에도 동일하게 설정 완료

### Firebase 설정
- Anonymous Auth: 활성화됨 (공장 공개 뷰용)
- Firestore 인덱스: lostReports (depotUid ↑, createdAt ↓) — Building 완료

### 디자인 문서
- `~/.gstack/projects/woohyee-rfid-laundry-web/senn-main-design-20260412-150245.md` (APPROVED)

### 현재 상태
- 배포: `rfid-laundry-web.vercel.app` — 운영 중
- 로컬: 빌드 성공 (`npm run build` ✓)
- origin/main 동기화됨

### 알아둘 것
- **실운영 데이터**: Firestore에 실제 운영 중인 데이터 있음. 절대 삭제 금지.
- **디자인**: Depot 오렌지(#E07B0F), Factory 블루(#2563EB), Header #18181B
- **Cloudinary API Secret**: .env에 저장하지 않음 (unsigned upload만 사용)
