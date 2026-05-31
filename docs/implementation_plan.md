# 사법부 다단계 워크플로 구축 및 행정·사법 빠른 제어 UI 통일화 계획

본 계획은 교사용 화면의 빠른 제어 패널(입법·행정·사법) 간의 디자인 및 로직 일관성을 강화하고, 사법 활동을 다단계(6단계) 흐름으로 세분화하여 학생용 사법부 화면에 게이팅 및 오토 스크롤을 이식하기 위한 구체적인 구현 방안을 기술합니다. 공동작업 모드(collaborative)는 완성 단계이므로 절대 침범하지 않으며 오직 역할중심 모드 관점에서 안정적으로 통합합니다.

## User Review Required

> [!IMPORTANT]
> 공동작업 모드(`collaborative`)의 소스 코드(기존 입법/행정부 활동 완성본)는 일절 수정하지 않고, 역할중심 모드의 관점에서 추가적인 로직을 이식합니다.

> [!NOTE]
> 사법부 모의재판도 입법부/행정부와 동일하게 `debateSessions` 노드를 활용해 다자/라운드 토론 세션을 교실 전광판 및 학생 토론 도구와 유기적으로 연결합니다.

## Proposed Changes

### [Common & Workflow]

#### [MODIFY] [PhaseWorkflow.jsx](file:///Users/babostudio/class_democra_dev/app/src/components/teacher/PhaseWorkflow.jsx)
- `PHASE_STEPS[3]`의 기존 단일 `judicial` 단계를 제거하고, 6단계(`judicial-prep`, `judicial-statement`, `judicial-evidence`, `judicial-witness`, `judicial-debate`, `judicial-verdict`)로 확장하여 고도화합니다.
- `judicial-`로 시작하는 단계들은 교사용 진행 가이드 리스트 상에서 `⚖️ 사법부 활동 진행`이라는 하나의 항목으로 그룹화하여 단순하게 렌더링되도록 묶음 로직을 구현합니다.

### [Teacher Dashboard Components]

#### [MODIFY] [Phase3ExecutiveQuickPanel.jsx](file:///Users/babostudio/class_democra_dev/app/src/components/teacher/Phase3ExecutiveQuickPanel.jsx)
- 기존 가로 `h-1.5` 진행 바 레이아웃을 입법부와 동일하게 원형 숫자(dot) + 하단 텍스트(label) + 연결선(line) 방식의 **Pattern C** 디자인으로 리팩토링합니다.

#### [NEW] [Phase3JudicialQuickPanel.jsx](file:///Users/babostudio/class_democra_dev/app/src/components/teacher/Phase3JudicialQuickPanel.jsx)
- 사법부 6단계 흐름을 직관적으로 제어할 수 있는 교사용 퀵패널 컴포넌트를 신설합니다.
- **Pattern C** progress bar 디자인 적용 (Rose/Crimson 테마).
- 이전 단계 / 다음 단계 제어 버튼과 단계별 교사용 가이드를 표시합니다.
- 사건이 투입되지 않았을 때 NPC 사건 프리셋 목록과 [사건 투입] 버튼을 제공하며, 투입 완료 시 사건 정보와 [🗑️ 사건 삭제] 버튼을 노출합니다.
- [🎙️ 모의재판 시작] 버튼을 배치하여 검사 모둠(`proStudents`), 변호인 모둠(`conStudents`), 배심원/평가단(`evaluators`)을 자동 매핑하고 다자토론/라운드토론 세션을 실시간으로 생성합니다.
- 배심원 평결 현황(유죄/무죄 투표 수 및 누적률 바)을 실시간으로 중계합니다.
- 판사의 최종 판결문 작성 상태 및 작성된 본문을 조회할 수 있도록 구성합니다.

#### [MODIFY] [TeacherDashboard.jsx](file:///Users/babostudio/class_democra_dev/app/src/pages/TeacherDashboard.jsx)
- 상단에 신설된 `Phase3JudicialQuickPanel`을 임포트합니다.
- `currentPhase === 3 && (wf.currentStep?.highlight === 'judicial' || wf.currentStep?.id?.startsWith('judicial-'))` 조건 하에 퀵패널을 렌더링하도록 변경합니다.

### [Student View Components]

#### [MODIFY] [JudicialTab.jsx](file:///Users/babostudio/class_democra_dev/app/src/components/phase3/JudicialTab.jsx)
- 입법부(`LegislativeTab.jsx`)와 완벽히 대칭되는 게이팅 및 스크롤 아키텍처를 도입합니다.
- `STAGE_OF_STEP` 매핑 추가 및 `modeFor` 판별 헬퍼 작성.
- 각 섹션(준비 자료실, 역할 배정/작업공간, 사건 브리핑/변론토론, 배심원 평결 및 판결문)을 `sectionWrap`으로 묶고, 미래 단계는 `hidden`으로 숨기며, 지나간 단계는 `pastClass`로 블러 처리 및 클릭 비활성화를 적용합니다.
- `useRef`를 각 섹션 앵커에 할당하고 `scrollIntoView` 메커니즘을 적용하여 교사가 단계를 넘길 때 활성 영역으로 부드럽게 오토 스크롤을 실행하도록 구성합니다.

## Verification Plan

### Automated Tests
- 로컬 개발 서버를 빌드(`npm run build`)하여 문법 에러 및 번들링 성공 여부를 검증합니다.

### Manual Verification
- 교사 대시보드와 학생용 사법부 화면을 양옆에 띄워 단계 이동 시 실시간으로 게이팅(블러/숨김) 및 오토 스크롤이 매끄럽게 연동되는지 검증합니다.
- 교사 대시보드 사법부 퀵패널에서 사건 투입, 토론 시작(토론 도구 연동), 판결 확인 흐름이 막힘 없이 동작하는지 테스트합니다.
- 공동작업 모드로 설정 시 행정부와 입법부 화면이 이상 없이 공동작업 상태로 유지되고 동작하는지 검토합니다.
