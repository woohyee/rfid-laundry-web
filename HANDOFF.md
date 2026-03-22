# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-21

### 오늘 한 것
- GitHub 레포 생성 및 Vercel 배포 완료 (rfid-laundry-web.vercel.app)
- Vercel 배포 오류 2건 수정 (tailwindcss dependencies 이동, postcss.config.js 정리)
- PWA 지원 추가 (vite-plugin-pwa) — 독에 앱으로 설치 완료
- Sign Up 페이지 생성 (상호, 대표이름, 연락처, 주소 등 → Firestore shops/{uid} 저장)
- 헤더에 상호명 표시 (RFID Laundry — dodo cleaners)
- Lookup View 기능: 태그별 received/missing 상태 표시
- Receiving: receivedTags Firestore 누적 저장 (세션 끊겨도 유지)

### 현재 상태
- 배포 완료, PWA 앱으로 정상 작동 중

### 다음에 할 것 (우선순위 순)
1. 실제 현장 테스트 (RFID 스캐너 연결, 인보이스 등록/수신)
2. 기존 계정에 shops/{uid} 문서 수동 생성 (Firebase 콘솔)
3. 피드백 기반 추가 개선

### 알아둘 것
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- .npmrc에 legacy-peer-deps=true 설정 (vite-plugin-pwa Vite 8 미지원 때문)
- receivedTags 필드는 이번 세션 추가 — 기존 인보이스는 View에서 모두 missing으로 표시됨
- Sign Up 이전 생성 계정은 헤더 상호명 미표시
- 배포 URL: rfid-laundry-web.vercel.app
