const fs = require('fs');
const path = '/Volumes/web/class_democra/docs/history.md';
let code = fs.readFileSync(path, 'utf8');
code = code.replace('---\n', `---\n\n## v1.2.214 — 예산 입력창 너비 확장 및 공동작업 모드 전환 오류 수정 (2026-05-24 / [Antigravity])\n- 예산 계산 및 편성 시 '억' 단위 결과값 칸 너비를 늘려 큰 금액도 잘 보이도록 수정 (\`grid-cols\` 및 \`w-16\` 조정)\n- 행정부 교사용/학생용 \`ExecutiveTab\`에서 공동작업/역할중심 모드 전환 시, 중복되거나 분절된 렌더링 로직(\`roleBasedDraftUnits\`, \`collaborativeDraftUnits\`)을 하나로 통합하여 공동작업 모드로 스위칭할 때 올바르게 \`BranchUnitWorkspace\`가 나오도록 수정\n`);
fs.writeFileSync(path, code);
