# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-03-23

### 오늘 한 것
- **RFID 오입력 대응**: Tagging에 "✕ Reset All" 버튼 추가 (언제든 처음으로 초기화)
- **Invoice 입력란 ✕ 클리어 버튼**: 오입력 즉시 제거 가능
- **UI 가독성 개선**: 라벨 폰트 크기 업, 색상 진하게 (gray-400 → gray-700)
- **Lookup Edit 기능**: 인보이스 번호 수정 모달 추가 (추후 불필요로 판단 → 삭제)
- **"missing" → "pending"**: View 모달 태그 상태 표현 변경
- **Clean Ops 디자인 시스템 적용**:
  - 헤더/탭 네비: 진한 slate(`#18181B`) 배경
  - 액센트 전체: 파란색 → 앰버(`#E07B0F`) 통일
  - 배경: 순백 → 따뜻한 오프화이트(`#F7F6F3`)
  - 탭 글씨: `text-2xl font-bold`로 크게
  - Sign Out 버튼: 빨간색 테두리로 가시성 향상

### 현재 상태
- 배포 완료 (`rfid-laundry-web.vercel.app`)
- Clean Ops 디자인 적용 완료
- PWA 앱 정상 작동

### 다음에 할 것 (우선순위 순)
1. 현장 테스트 피드백 기반 추가 개선
2. DESIGN.md 작성 (디자인 시스템 문서화)
3. 기존 계정에 shops/{uid} 문서 수동 생성 (Firebase 콘솔)

### 알아둘 것
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- .npmrc에 legacy-peer-deps=true 설정 (vite-plugin-pwa Vite 8 미지원)
- receivedTags 필드는 최근 추가 — 기존 인보이스는 View에서 모두 pending으로 표시됨
- Sign Up 이전 생성 계정은 헤더 상호명 미표시 (Firebase 콘솔에서 shops/{uid} 수동 생성 필요)
- 배포 URL: rfid-laundry-web.vercel.app
- 디자인 컬러: Header `#18181B`, Accent `#E07B0F`, BG `#F7F6F3`
