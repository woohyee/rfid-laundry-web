# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-26

### 오늘 한 것
- **TagScanner 포커스 버그 수정**: 다른 탭(유튜브 등) 갔다 돌아왔을 때 브라우저 클릭만 해도 태그 스캔 자동 활성화 (`window focus` + `document click` 이벤트 추가)
- **Edit 탭 태그 추가 기능**: 인보이스에 없는 새 태그 스캔 시 "Add Tag" 모달 표시 → Shirt / D/C 선택 후 저장
- **Edit 탭 레이블 변경**: "Scan Tag to Select" → "Scan Tag to Select or Add"
- **gstack 자동 업그레이드**: v0.11.10.0 → v0.11.21.0

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
- TagScanner의 `document click` 이벤트: 모달 열려있을 때도 포커스 이동하므로 모달 UX 주의 (현재는 문제 없음)
