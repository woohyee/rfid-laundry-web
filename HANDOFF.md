# HANDOFF — rfid-laundry-web

## 마지막 세션: 2026-04-06

### 오늘 한 것
- **/office-hours**: 전체 시스템 v2 재설계 디자인 문서 작성 및 승인 (APPROVED)
- **/plan-eng-review**: 엔지니어링 리뷰 완료, 5개 이슈 발견/해결, CLEARED
- 코드 변경 없음 — 설계 세션

### v2 재설계 디자인 문서
- 파일: `~/.gstack/projects/woohyee-rfid-laundry-web/senn-main-design-20260406-224344.md`
- 상태: APPROVED

#### 핵심 결정사항
1. **멀티테넌트**: Firestore `organizations/{orgId}/` 구조, `users/{uid}.orgId`, 1인 1조직
2. **제거**: DayCheck 탭, Archive 탭 (Lookup에 통합), Edit 탭 (Lookup 내 모달)
3. **새 탭 구조 — 디포**: Tagging | Receiving | Lookup | Lost Items
4. **새 탭 구조 — 공장**: Lost Items | Depot Management
5. **분실물 시스템**: `partnerships/{pid}/lostItems/` — 5단계 상태 전이, 역할별 권한
6. **태그 재사용**: 리시빙 완료 → 즉시 재사용 가능, 인보이스 기록 14일 보관 후 삭제, 통계 영구
7. **바코드 스캔**: `html5-qrcode`로 태깅 시 인보이스 번호 입력 편의 (카메라)
8. **모바일 RFID**: BLE HID 모드 리더 호환 (기존 TagScanner 그대로 동작)
9. **Security Rules**: `memberUids` 배열 패턴, partnerships는 양쪽 org 멤버 검증
10. **마이그레이션**: 복사만 허용, 원본 데이터 절대 삭제 금지, 무기한 유지

#### Phase 구조
- Phase 1: 기반 재설계 (Firestore 멀티테넌트, Auth 확장, 마이그레이션)
- Phase 2: 코드 정리 (DayCheck/Archive 제거, DRY 유틸 추출, TagEditor 분리)
- Phase 3: 파트너십 + 분실물 시스템
- Phase 3.5: 모바일 스캔 지원 (바코드 카메라 + BLE RFID)
- Phase 4: 공장 연동 (향후, 이번 범위 밖)

#### 엔지니어링 리뷰 결정
- Vitest 추가, Phase별 TDD
- `useOrgCollection` 커스텀 훅으로 orgId 전달
- `garments` 컬렉션은 Phase 3에서 생성 (YAGNI)
- fmtDate, DAY_COLORS, StatusBadge → 공통 유틸 추출
- TagEdit → TagEditor 컴포넌트로 분리, Lookup에서 모달 호출
- Critical gaps 2개: 마이그레이션 부분 실패 처리, 신규 사용자 org 로드

### 현재 상태
- 배포 완료 (`rfid-laundry-web.vercel.app`) — 현재 v1 운영 중
- v2는 설계 완료, 구현 미시작

### 다음에 할 것 (우선순위 순)
1. **The Assignment**: 공장 담당자에게 분실물 시스템 아이디어 보여주기 (공장 YES면 플랫폼)
2. Phase 1 구현 시작: Vitest 설정 → Firestore 멀티테넌트 구조 → AuthContext 확장 → 마이그레이션 스크립트
3. Phase 2: DayCheck/Archive 제거, DRY 정리

### 알아둘 것
- **실운영 데이터**: Firestore에 실제 운영 중인 데이터 있음. 절대 삭제 금지. 마이그레이션은 복사만.
- **RFID 리더 필수**: 이 시스템은 RFID 리더 없이는 효과 0. 바코드 스캔은 인보이스 입력 편의 기능일 뿐.
- **시장 제약**: 세탁공장이 RFID 자동화를 도입한 경우에만 이 시스템이 의미 있음.
- **Firestore 쿼리 원칙**: 모든 쿼리는 `where('shopId', '==', uid)` 단일 조건만 사용. 복합 인덱스 없음.
- Vercel 환경변수 6개 직접 설정 필요 (신규 배포 시)
- 배포 URL: rfid-laundry-web.vercel.app
- 디자인 컬러: Header `#18181B`, Accent `#E07B0F`, BG `#F7F6F3`
- 일일 인보이스 약 100장 이내 (디포 기준)
