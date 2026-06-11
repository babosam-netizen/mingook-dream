import { useEffect, useMemo, useState, Fragment } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, setAt, pushUnder } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import { preserveWindowScrollAfter } from '../../lib/preserve-scroll'
import { MULTI_PARTY_STAGES } from '../debate/tools/DebateTimer'
import { DEFAULT_ROLES, normalizeRoleList } from '../../lib/scaffolding-data'

const CABINET_PRE_OPTIONS = [
  { id: 'keep', label: '대체로 유지' },
  { id: 'cut', label: '일부 감액' },
  { id: 'increase', label: '일부 증액' },
  { id: 'rework', label: '전면 재조정' },
]

const CABINET_POST_BASE_OPTIONS = [
  { id: 'balanced', label: '예산 균형이 가장 중요하다' },
  { id: 'priority', label: '최우선과제 해결 효과가 가장 중요하다' },
  { id: 'feasible', label: '실행 가능성이 가장 중요하다' },
  { id: 'publicGood', label: '공익성이 가장 중요하다' },
]

const STATUS_FOR_DISCUSSION = new Set(['saved', 'submitted', 'requested', 'adjusted', 'final'])

function memberMapOf(group) {
  return Object.keys(group?.members || {}).reduce((acc, sid) => {
    acc[sid] = true
    return acc
  }, {})
}

function shortText(text, limit = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > limit ? `${s.slice(0, limit)}...` : s
}

function hasMeaningfulValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number' || typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.some(hasMeaningfulValue)
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue)
  return String(value).trim() !== ''
}

function debateSideId(gid, index) {
  return `exec_${String(gid || index).replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

/**
 * 교사 대시보드 — Phase 3 행정부 빠른 제어 패널.
 * stage(0~5)는 PHASE_STEPS[3] 각 행정부 step의 stage 필드에서 직접 가져옵니다.
 */
function Phase3ExecutiveQuickPanel() {
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)
  const students = useGameStore((s) => s.students)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const coreIssue = useGameStore((s) => s.roomData?.coreIssue) || '최우선과제'
  const electionWinnerGroupId = useGameStore((s) => s.roomData?.election?.winnerGroupId)
  const isCollaborative = (branchConfig?.executive?.mode || 'role_based') === 'collaborative'

  const isRolesLocked = Boolean(config?.branchRolesLocked?.executive)

  const branchRoles = useMemo(() => {
    return normalizeRoleList(
      'executive',
      config?.roles?.executive ||
        config?.branchConfig?.executive?.roles ||
        DEFAULT_ROLES.executive || []
    )
  }, [config])

  const toggleRoleLock = async () => {
    await updateAt(roomCode, 'config', {
      branchRolesLocked: {
        ...(config?.branchRolesLocked || {}),
        executive: !isRolesLocked,
      },
    })
  }

  // 교사가 특정 학생을 대표(isRepresentative 역할)로 직접 지정
  const assignRepresentative = async (gid, studentId, repKey, sessionRoles) => {
    if (!roomCode || !repKey) return
    const updates = {}
    // 기존 대표 보유자 해제 (선택 학생과 다른 사람)
    Object.entries(sessionRoles || {}).forEach(([sid, rk]) => {
      if (rk === repKey && sid !== studentId) updates[`groups/${gid}/sessionRoles/executive-default/${sid}`] = null
    })
    if (studentId) updates[`groups/${gid}/sessionRoles/executive-default/${studentId}`] = repKey
    try {
      await updateAt(roomCode, '', updates)
    } catch (err) {
      alert('대표 지정 에러: ' + err.message)
    }
  }

  // 예산검토 → 토의평가 전환 시: 작성분이 있는 모든 부처를 일괄 '제출' 처리(덜 된 것 포함)해 평가 대상에 올린다.
  const fieldsMeaningful = (pf) => pf && typeof pf === 'object' && Object.values(pf).some((v) => typeof v === 'string' && v.trim().length > 0)
  const mergeSectionContent = (sections) => {
    const pf = {}
    const budget = []
    for (const sec of Object.values(sections || {})) {
      const c = sec?.content
      const spf = c?.policyFields
      if (spf && typeof spf === 'object') {
        for (const [k, v] of Object.entries(spf)) {
          if (typeof v === 'string' && v.trim() && !pf[k]) pf[k] = v
        }
      }
      if (Array.isArray(c?.budgetItems)) budget.push(...c.budgetItems)
    }
    return { policyFields: pf, budgetItems: budget }
  }
  const bulkSubmitDrafts = async (silent = false) => {
    if (!roomCode) return
    const units = branchConfig?.executive?.units || []
    let count = 0
    for (const unit of units) {
      const gid = unit.groupId
      if (!gid || gid === presidentGroupId) continue // 대통령실은 시행령 미작성 — 제외
      const policy = policiesMap?.[gid] || {}
      if (['submitted', 'requested', 'adjusted', 'final'].includes(policy.status)) continue // 이미 제출됨
      const draft = draftsMap?.[unit.unitId] || {}
      let content = null
      if (fieldsMeaningful(policy.policyFields) || (Array.isArray(policy.budgetItems) && policy.budgetItems.length)) {
        content = { policyFields: policy.policyFields || {}, budgetItems: policy.budgetItems || [] }
      } else if (draft.finalDoc?.content && fieldsMeaningful(draft.finalDoc.content.policyFields)) {
        content = { policyFields: draft.finalDoc.content.policyFields, budgetItems: draft.finalDoc.content.budgetItems || [] }
      } else {
        const merged = mergeSectionContent(draft.sections)
        if (fieldsMeaningful(merged.policyFields) || merged.budgetItems.length) content = merged
      }
      if (!content) continue // 작성분 없음 → 건너뜀
      const budgetTotal = (content.budgetItems || []).reduce((s, it) => s + (Number(it?.amount) || 0), 0)
      await setAt(roomCode, `policies/${gid}`, {
        ...policy,
        ministryName: unit.ministryName || policy.ministryName || '',
        groupId: gid,
        branchUnitId: unit.unitId,
        status: 'submitted',
        submittedAt: Date.now(),
        autoSubmitted: true,
        policyFields: content.policyFields,
        budgetItems: content.budgetItems || [],
        draftBudget: budgetTotal,
        requestedBudget: budgetTotal,
      })
      count++
    }
    if (!silent) alert(count > 0 ? `${count}개 부처의 초안을 제출 처리했습니다. 이제 친구들이 평가할 수 있어요.` : '제출할 작성 내용이 있는 미제출 부처가 없습니다.')
  }

  // 초안 제출 취소 — 공동작업/역할중심 공통. finalDoc 잠금 해제 + policies 를 'saved'로 되돌려 다시 편집·제출 가능.
  const cancelSubmission = async (unit) => {
    if (!roomCode || !unit) return
    const name = unit.ministryName || groups?.[unit.groupId]?.name || '이 부처'
    if (!confirm(`${name}의 초안 제출을 취소할까요?\n학생들이 다시 편집하고 제출할 수 있게 됩니다. (작성 내용은 그대로 보존됩니다)`)) return
    const updates = {}
    updates[`branchDrafts/${unit.unitId}/finalDoc/status`] = 'draft'
    if (policiesMap?.[unit.groupId]) updates[`policies/${unit.groupId}/status`] = 'saved'
    try {
      await updateAt(roomCode, '', updates)
    } catch (err) {
      alert('제출 취소 에러: ' + err.message)
    }
  }

  const resetAllRoles = async () => {
    if (!roomCode || !groups) return
    if (!confirm('🚨 모든 행정부 모둠원 역할 지정을 정말 초기화(배정 취소)할까요?')) return
    const updates = {}
    for (const groupId of Object.keys(groups)) {
      updates[`groups/${groupId}/sessionRoles/executive-default`] = null
    }
    try {
      await updateAt(roomCode, '', updates)
      alert('모든 행정부 역할 지정을 초기화했습니다.')
    } catch (err) {
      alert('초기화 에러: ' + err.message)
    }
  }
  
  const [policiesMap, setPoliciesMap] = useState({})
  const [commentsMap, setCommentsMap] = useState({})
  const [debateSessions, setDebateSessions] = useState({})
  const [draftsMap, setDraftsMap] = useState({})
  const [bulkSubmitMarker, setBulkSubmitMarker] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u1 = subscribe(roomCode, 'policies', (d) => setPoliciesMap(d || {}))
    const u2 = subscribe(roomCode, 'executivePolicyComments', (d) => setCommentsMap(d || {}))
    const u3 = subscribe(roomCode, 'debateSessions', (d) => setDebateSessions(d || {}))
    const u4 = subscribe(roomCode, 'branchDrafts', (d) => setDraftsMap(d || {}))
    const u5 = subscribe(roomCode, 'executiveBulkSubmitDone', (d) => setBulkSubmitMarker(!!d))
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.() }
  }, [roomCode])

  const wf = useWorkflow()
  const stepIndex = useGameStore((s) => s.roomData?.workflow?.phase3?.stepIndex ?? 0)
  const stepId = wf.currentStep?.id
  const wfStage = wf.currentStep?.stage
  // 실제 행정 step 일 때만 stage 사용. 그 외(입법/기사/여론조사)는 명시적으로 '대기' 상태 표시.
  const isExecStep = typeof stepId === 'string' && stepId.startsWith('executive-')
  let stage = isExecStep ? (wfStage ?? 0) : -1

  // 초안작성(stage1) 다음 단계로 넘어가면 작성분을 1회 자동 일괄 제출 → 평가 대상에 올림.
  // 마커(executiveBulkSubmitDone)로 1회만 실행. 초안작성 단계로 돌아오면 마커 해제(다음 전환 시 재실행).
  useEffect(() => {
    if (!roomCode) return
    if (stage <= 1) {
      if (bulkSubmitMarker) setAt(roomCode, 'executiveBulkSubmitDone', false)
      return
    }
    if (stage >= 2 && !bulkSubmitMarker) {
      const dataReady = Object.keys(policiesMap || {}).length > 0 || Object.keys(draftsMap || {}).length > 0
      if (!dataReady) return
      setAt(roomCode, 'executiveBulkSubmitDone', true)
      bulkSubmitDrafts(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bulkSubmitMarker, policiesMap, draftsMap, roomCode])

  // 이전/다음 단계 라벨 (실제 step 의 studentLabel 사용)
  const prevStep = stepIndex > 0 ? wf.steps[stepIndex - 1] : null
  const nextStep = stepIndex < wf.steps.length - 1 ? wf.steps[stepIndex + 1] : null
  const prevShort = prevStep?.studentLabel?.replace(/^행정\s*/, '') || null
  const nextShort = nextStep?.studentLabel?.replace(/^행정\s*/, '') || null

  const policyEntries = useMemo(() => Object.entries(policiesMap || {})
    .map(([gid, p]) => ({ gid, ...p }))
    .filter((p) => STATUS_FOR_DISCUSSION.has(p?.status))
    .sort((a, b) => (Number(b.requestedBudget ?? b.draftBudget) || 0) - (Number(a.requestedBudget ?? a.draftBudget) || 0)), [policiesMap])
  const all = Object.values(policiesMap || {})
  const submitted = all.filter(p => ['submitted', 'requested', 'adjusted', 'final'].includes(p.status)).length
  const requested = all.filter(p => ['requested', 'adjusted', 'final'].includes(p.status)).length
  const totalGroups = Object.keys(groups || {}).filter(gid => Object.keys(groups[gid].members || {}).length > 0).length
  const isAllSubmitted = totalGroups > 0 && submitted >= totalGroups
  const isAllRequested = totalGroups > 0 && requested >= totalGroups
  const totalBudget = Number(branchConfig?.executive?.totalBudget) || 100
  const presidentGid = branchConfig?.executive?.presidentGroupId || null
  const isPresidentP = (p) =>
    (presidentGid && p.gid === presidentGid) ||
    p.branchUnitId === 'exe-president' ||
    String(p.ministryName || '').includes('대통령')
  const policyBudgetOf = (p) => {
    const itemTotal = Array.isArray(p.budgetItems)
      ? p.budgetItems.reduce((s, item) => s + (Number(item.amount) || 0), 0)
      : 0
    return Number(p.requestedBudget ?? p.draftBudget) || itemTotal || 0
  }
  // 대통령 공약 예약분을 먼저 떼고, 부처는 잔여분(ministryCap)에서 조정한다.
  const presidentReserved = policyEntries.filter(isPresidentP).reduce((sum, p) => sum + policyBudgetOf(p), 0)
  const ministryCap = Math.max(0, totalBudget - presidentReserved)
  const totalRequested = policyEntries.filter((p) => !isPresidentP(p)).reduce((sum, p) => sum + policyBudgetOf(p), 0)
  const budgetDiff = Math.round((totalRequested - ministryCap) * 10) / 10
  const cabinetDebate = useMemo(() => Object.entries(debateSessions || {})
    .map(([id, s]) => ({ id, ...s }))
    .find((s) => s?.relatedExecutiveMeeting && s?.isActive) || null, [debateSessions])
  const executiveUnitsByGroup = useMemo(() => {
    const map = {}
    for (const unit of branchConfig?.executive?.units || []) {
      if (unit?.groupId) map[unit.groupId] = unit
    }
    return map
  }, [branchConfig?.executive?.units])
  const executiveEvaluatorGroupIds = useMemo(() => new Set(
    (branchConfig?.executive?.evaluators || []).map((e) => e?.groupId).filter(Boolean),
  ), [branchConfig?.executive?.evaluators])
  const presidentGroupId = branchConfig?.executive?.presidentGroupId || electionWinnerGroupId || ''

  let stageLabel, nextHint
  const STAGE_INFO = [
    [
      isCollaborative ? '① 공동 작업 준비' : '① 역할 및 준비',
      isCollaborative
        ? '학생들이 부처별로 모여 함께 집행계획·시행령·예산안을 작성하도록 안내하세요.'
        : '역할을 먼저 나눈 뒤(대표 포함), 근거 기사·워드클라우드로 우리 부처가 할 일을 정하도록 안내하세요. 아래에서 역할 배정을 확인하고 잠글 수 있습니다.',
    ],
    ['② 정책 및 예산 초안 작성', isAllSubmitted ? `모든 부처(${submitted}/${totalGroups})가 초안 작성을 마쳤습니다.` : `각 부처가 정책 초안을 제출(공개)할 때까지 대기 (${submitted}/${totalGroups} 제출)`],
    ['③ 예산 초안 검토', '아래 [🎬 전광판 띄우기] 버튼을 눌러 각 부처 예산 청구액을 교실 TV로 방송하세요.'],
    ['④ 온라인 토의 및 평가', '학생들이 찬성/반대/중립 의견과 3축 평가를 남기는 중입니다.'],
    ['⑤ 다자간 토론(국무회의)', '평가단 브리핑 후 초과액/잔여액을 보며 교실에서 국무회의 토론을 진행하고 여론조사를 실시하세요.'],
    ['⑥ 정책 및 예산안 최종 수정', isAllRequested ? `모든 부처(${requested}/${totalGroups})가 최종 수정을 마쳤습니다.` : `대통령 모둠과 부처가 합의하여 시행령과 최종 배정액을 확정하세요. (${requested}/${totalGroups})`],
    ['⑦ 최종 발표', '최종 정책·배정 예산·조정 이유를 발표하고 행정부 활동을 정리하세요.'],
  ]
  if (stage === -1) {
    stageLabel = '⏳ 행정부 시작 전 대기'
    nextHint = '입법부 단계가 끝나면 다음 단계 → 를 눌러 행정부 ① 준비 단계로 진입하세요.'
  } else if (stage >= 0 && stage <= 6) {
    [stageLabel, nextHint] = STAGE_INFO[stage]
  } else {
    stageLabel = '진행 중'
    nextHint = '다음 단계로 넘어가세요.'
  }

  const stages = [
    { idx: 0, label: isCollaborative ? '준비' : '역할및준비' },
    { idx: 1, label: '초안작성' },
    { idx: 2, label: '예산검토' },
    { idx: 3, label: '토의·평가' },
    { idx: 4, label: '국무회의' },
    { idx: 5, label: '최종수정' },
    { idx: 6, label: '발표' },
  ]

  const openExecutiveTVBoard = () => {
    if (!roomCode) return
    const url = `${window.location.origin}${window.location.pathname}#/tv-executive-board?room=${encodeURIComponent(roomCode)}`
    window.open(
      url,
      'tvexecutiveboard_' + roomCode,
      'width=1280,height=800,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no',
    )
  }

  const commentsForPolicy = (policyId) => Object.values(commentsMap || {}).filter((c) => c?.policyId === policyId)

  const statsForPolicy = (policyId) => {
    const list = commentsForPolicy(policyId)
    const count = (key, value) => list.filter((c) => c?.[key] === value).length
    const avg = (key) => list.length
      ? Math.round((list.reduce((sum, c) => sum + (Number(c?.ratings?.[key]) || 0), 0) / list.length) * 10) / 10
      : 0
    const suggested = list
      .map((c) => Number(c?.suggestedBudget))
      .filter((n) => Number.isFinite(n) && n > 0)
    const suggestedAvg = suggested.length
      ? Math.round((suggested.reduce((sum, n) => sum + n, 0) / suggested.length) * 10) / 10
      : null
    return {
      total: list.length,
      pro: count('stance', '찬성'),
      con: count('stance', '반대'),
      neutral: count('stance', '중립'),
      keep: count('budgetOpinion', '유지'),
      increase: count('budgetOpinion', '증액'),
      cut: count('budgetOpinion', '감액'),
      rework: count('budgetOpinion', '재검토'),
      relevance: avg('relevance'),
      feasibility: avg('feasibility'),
      publicGood: avg('publicGood'),
      suggestedAvg,
    }
  }

  const buildCabinetDebateTopic = () => {
    const stateLine = budgetDiff > 0
      ? `${budgetDiff}억 초과: 줄일 곳을 찾아야 합니다.`
      : budgetDiff < 0
        ? `${Math.abs(budgetDiff)}억 잔여: 더 배정할 곳을 찾아야 합니다.`
        : '정부 예산과 청구액이 일치합니다.'
    const lines = [
      '행정부 국무회의 다자간 토론',
      '',
      `정부 총예산: ${totalBudget}억`,
      ...(presidentReserved > 0 ? [`대통령 공약 예약분: ${presidentReserved}억 (먼저 확보) → 부처 가용: ${ministryCap}억`] : []),
      `부처 청구액 합계: ${totalRequested}억`,
      `현재 상태: ${stateLine}`,
      '',
      '토론 기준: 과제관련성, 실행가능성, 공익성',
      '토론 쟁점:',
      '- 어느 부처 예산을 유지·증액·감액해야 할까요?',
      '- 최우선과제 해결에 가장 직접적으로 연결되는 정책은 무엇일까요?',
      '- 시민에게 가장 큰 이익을 주면서 실제 실행 가능한 조정안은 무엇일까요?',
      '',
      '온라인 토의 요약:',
    ]

    if (policyEntries.length === 0) {
      lines.push('- 아직 공개된 정책·예산 초안이 없습니다.')
      return lines.join('\n')
    }

    policyEntries.forEach((policy, index) => {
      const fields = policy.policyFields || {}
      const requestedBudget = Number(policy.requestedBudget ?? policy.draftBudget) || 0
      const s = statsForPolicy(policy.gid)
      const ministry = policy.ministryName || executiveUnitsByGroup[policy.groupId || policy.gid]?.ministryName || policy.groupName || groups?.[policy.groupId || policy.gid]?.name || `부처 ${index + 1}`
      lines.push(
        '',
        `${index + 1}. ${ministry} — ${fields.title || '정책명 미입력'}`,
        `   청구 예산: ${requestedBudget}억`,
        `   온라인 의견: 찬성 ${s.pro}, 반대 ${s.con}, 중립 ${s.neutral} / 예산 유지 ${s.keep}, 증액 ${s.increase}, 감액 ${s.cut}, 재검토 ${s.rework}`,
        `   3축 평균: 관련성 ${s.relevance}, 실행가능성 ${s.feasibility}, 공익성 ${s.publicGood}`,
      )
      if (s.suggestedAvg !== null) lines.push(`   학생 제안 예산 평균: ${s.suggestedAvg}억`)
      if (fields.linkedBillTitle) lines.push(`   근거 법령: ${shortText(fields.linkedBillTitle, 80)}`)
      if (fields.content) lines.push(`   집행계획: ${shortText(fields.content)}`)
      if (fields.ordinance) lines.push(`   시행령 초안: ${shortText(fields.ordinance)}`)
    })

    return lines.join('\n')
  }

  const buildCabinetDebateSides = () => {
    const policyGroupIds = policyEntries
      .map((p) => p.groupId || p.gid)
      .filter(Boolean)
      .filter((gid, idx, arr) => arr.indexOf(gid) === idx)
      .filter((gid) => !executiveEvaluatorGroupIds.has(gid))
    const sideGroups = policyGroupIds
      .map((gid) => {
        const unit = executiveUnitsByGroup[gid]
        const group = groups?.[gid]
        return {
          gid,
          label: unit?.ministryName || group?.name || '부처',
          group,
        }
      })
      .filter((item) => Object.keys(item.group?.members || {}).length > 0)

    const evaluators = {}
    for (const gid of executiveEvaluatorGroupIds) {
      Object.assign(evaluators, memberMapOf(groups?.[gid]))
    }

    const pro = sideGroups[0] || null
    const con = sideGroups[1] || null
    const extraSides = {}
    sideGroups.slice(2).forEach((item, idx) => {
      const sideId = debateSideId(item.gid, idx)
      extraSides[sideId] = {
        label: item.label,
        students: memberMapOf(item.group),
        createdAt: Date.now(),
      }
    })

    return {
      proStudents: memberMapOf(pro?.group),
      conStudents: memberMapOf(con?.group),
      evaluators,
      extraSides,
      debateTeamNames: sideGroups.map((item, idx) => item.label || `${idx + 1}부처`),
      sideLabelOverrides: {
        pro: pro?.label || '1부처',
        con: con?.label || '2부처',
        evaluator: '평가단',
        chair: '대통령 모둠',
      },
    }
  }

  const startCabinetDebate = async () => {
    if (!roomCode) return
    if (policyEntries.length === 0) {
      alert('국무회의 토론에 넣을 공개 정책·예산 초안이 아직 없습니다.\n먼저 부처별 정책 초안을 저장하거나 공개해 주세요.')
      return
    }
    if (cabinetDebate) {
      alert('이미 진행 중인 행정부 국무회의 토론 세션이 있습니다.\n[토론 도구]나 [전광판]에서 확인하세요.')
      return
    }
    if (!confirm(
      '행정부 국무회의 다자토론을 시작할까요?\n\n' +
      '· 기존 활성 토론 세션은 자동 종료됩니다.\n' +
      '· 정책·예산 초안과 온라인 토의 요약이 논제로 들어갑니다.\n' +
      '· 부처 모둠은 다자토론 참여 팀으로 자동 배정됩니다.',
    )) return

    for (const [sid, session] of Object.entries(debateSessions || {})) {
      if (session?.isActive) await updateAt(roomCode, `debateSessions/${sid}`, { isActive: false })
    }

    const { debateTeamNames = [], ...sides } = buildCabinetDebateSides()
    const cabinetStages = MULTI_PARTY_STAGES.map((stage) =>
      stage?.isRound
        ? { ...stage, teams: debateTeamNames, evalNames: debateTeamNames }
        : stage
    )
    const presidentName = groups?.[presidentGroupId]?.name
    const sessionId = await pushUnder(roomCode, 'debateSessions', {
      title: '행정부 국무회의: 예산 조정 다자간 토론',
      topic: `'${coreIssue}' 해결을 위해 가장 효과적인 행정부 정책은 무엇일까요?`,
      phase: '3',
      type: 'multi_party',
      chairId: '',
      chairName: presidentName ? `${presidentName} 대통령 모둠` : '대통령 모둠',
      activeTools: ['stancePollPre', 'prepCard', 'debateScript', 'debateTimer'],
      teacherTab: 'pre',
      currentDebateStage: 0,
      isActive: true,
      isPopupOpen: true,
      relatedExecutiveMeeting: true,
      sourceStepId: 'executive-meeting',
      debateTimer: {
        stages: cabinetStages,
        currentStage: 0,
        currentTeamIdx: 0,
        isRunning: false,
        isPaused: false,
        pausedRemaining: cabinetStages[0]?.seconds || 0,
        visibleToStudents: true,
      },
      ...sides,
    })
    const submittedEntries = policyEntries.filter((p) =>
      ['submitted', 'requested', 'adjusted', 'final'].includes(p.status),
    )
    const prePolicyOptions = (submittedEntries.length >= 2 ? submittedEntries : policyEntries).slice(0, 8).map((policy, index) => {
      const gid = policy.groupId || policy.gid
      const label = policy.ministryName || executiveUnitsByGroup[gid]?.ministryName || groups?.[gid]?.name || `부처 ${index + 1}`
      return { id: `policy_pre_${index}`, label }
    })
    const prePollOptions = prePolicyOptions.length >= 2 ? prePolicyOptions : CABINET_PRE_OPTIONS
    await setAt(roomCode, `debateSessions/${sessionId}/stancePoll/pre`, {
      question: '어떤 부처의 정책이 가장 마음에 드나요?',
      options: prePollOptions,
      isOpen: true,
      allowChange: false,
      type: 'pre',
    })
    alert('국무회의 다자토론 세션을 만들었습니다.\n토론 도구에서 바로 확인하고 전광판을 띄울 수 있습니다.')
  }

  const openCabinetDebateBoard = () => {
    if (!roomCode) return
    const sessionId = cabinetDebate?.id
    const url = `${window.location.origin}${window.location.pathname}#/debate-timer-tv?room=${encodeURIComponent(roomCode)}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`
    window.open(
      url,
      'cabinetDebateTimerTV_' + roomCode,
      'width=1280,height=800,resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no',
    )
  }

  const openCabinetResultPoll = async () => {
    if (!roomCode) return
    if (!cabinetDebate) {
      alert('먼저 [토론 시작]으로 국무회의 토론 세션을 만들어 주세요.')
      return
    }
    const submittedEntries = policyEntries.filter((p) =>
      ['submitted', 'requested', 'adjusted', 'final'].includes(p.status),
    )
    const policyOptions = (submittedEntries.length >= 2 ? submittedEntries : policyEntries).slice(0, 8).map((policy, index) => {
      const gid = policy.groupId || policy.gid
      const label = policy.ministryName || executiveUnitsByGroup[gid]?.ministryName || groups?.[gid]?.name || `부처 ${index + 1}`
      return { id: `policy_${index}`, label }
    })
    const options = policyOptions.length >= 2 ? policyOptions : CABINET_POST_BASE_OPTIONS
    await setAt(roomCode, `debateSessions/${cabinetDebate.id}/stancePoll/post`, {
      question: '국무회의 후, 어떤 부처의 정책이 가장 설득력 있었나요?',
      options,
      isOpen: true,
      allowChange: false,
      type: 'post',
    })
    await updateAt(roomCode, `debateSessions/${cabinetDebate.id}`, {
      activeTools: Array.from(new Set([...(cabinetDebate.activeTools || []), 'stancePollPost'])),
      teacherTab: 'post',
      isPopupOpen: true,
    })
    alert('국무회의 결과 발표용 사후 여론조사를 열었습니다.\n토론 도구의 [토론 후] 탭에서 결과를 확인하세요.')
  }

  return (
    <section className="bg-white rounded-2xl shadow border-2 border-violet-300 p-4 space-y-3">
      <header className="flex items-baseline justify-between flex-wrap gap-1">
        <h2 className="font-bold text-violet-800">🏢 Phase 3 행정부 — 빠른 제어</h2>
        <span className="text-[11px] text-gray-500">
          공개 {submitted} / {totalGroups} · 청구 {requested} / {totalGroups}
        </span>
      </header>

      {/* === 패턴 C — 가로 progress bar (dot + label) === */}
      <div className="px-1 pt-1 overflow-x-auto">
        <div className="flex items-start min-w-[500px] md:min-w-0">
          {stages.map((s, i) => {
            const done = stage >= 0 && stage > s.idx
            const current = stage >= 0 && stage === s.idx
            return (
              <Fragment key={s.idx}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                    done ? 'bg-emerald-500 text-white shadow' :
                    current ? 'bg-violet-600 text-white ring-4 ring-violet-200 scale-110' :
                    'bg-gray-300 text-white'
                  }`}>
                    {done ? '✓' : current ? '▶' : i + 1}
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${
                    done ? 'text-emerald-700' :
                    current ? 'text-violet-850 font-extrabold' :
                    'text-gray-400'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-3.5 ${
                    done ? 'bg-emerald-400' : 'bg-gray-200'
                  }`} />
                )}
              </Fragment>
            )
          })}
        </div>
      </div>

      {/* === 역할 잠금 및 초기화 버튼 (① 준비 단계, 역할중심 모드) === */}
      {!isCollaborative && stage === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-700">학생 역할 설정 관리</p>
            <p className="text-[11px] text-gray-500">
              {isRolesLocked
                ? '현재 잠금 상태 — 학생들이 역할을 변경할 수 없습니다.'
                : '역할을 잠가 학생들이 역할을 변경하지 못하도록 제한할 수 있습니다.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetAllRoles}
              className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border border-red-200 text-red-700 bg-white hover:bg-red-50 transition"
            >
              🔄 역할 전체 초기화
            </button>
            <button
              onClick={toggleRoleLock}
              className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                isRolesLocked
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isRolesLocked ? '🔓 잠금 해제' : '🔒 역할 잠금'}
            </button>
          </div>
        </div>
      )}

      {/* 현재 단계 + 다음 행동 안내 및 제어 버튼 */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-2.5 flex-1 space-y-2">
          <div>
            <p className="text-xs font-bold text-violet-800">{stageLabel}</p>
            <p className="text-sm text-violet-900 mt-0.5">👩‍🏫 {nextHint}</p>
          </div>
          <div className="pt-1 border-t border-violet-200/60 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-violet-700">📺 교실 TV/프로젝터 송출용 전광판</span>
            <button
              onClick={openExecutiveTVBoard}
              className="px-3 py-1.5 text-xs rounded-lg bg-amber-500 text-white font-black hover:bg-amber-600 shadow-sm transition animate-pulse flex items-center gap-1"
            >
              <span>🎬 전광판 띄우기 (새 창)</span>
            </button>
          </div>
          {stage === 4 && (
            <div className="pt-2 border-t border-violet-200/60 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-black text-violet-800">🎙️ 국무회의 토론 도구</p>
                  <p className="text-[11px] text-violet-600">
                    {cabinetDebate
                      ? `진행 중: ${cabinetDebate.title || '행정부 국무회의'}`
                      : '정책·예산 초안과 온라인 토의 요약을 다자토론 논제로 자동 준비합니다.'}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${cabinetDebate ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {cabinetDebate ? '토론 세션 준비됨' : '토론 세션 없음'}
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <button
                  onClick={startCabinetDebate}
                  disabled={!!cabinetDebate}
                  className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-violet-800 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  토론 시작
                </button>
                <button
                  onClick={openCabinetDebateBoard}
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700"
                >
                  토론 전광판
                </button>
                <button
                  onClick={openCabinetResultPoll}
                  disabled={!cabinetDebate}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  결과 발표
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                현재 예산 상태: 총 {totalBudget}억{presidentReserved > 0 ? ` (👑예약 ${presidentReserved} · 부처가용 ${ministryCap})` : ''} / 부처청구 {totalRequested}억 · {budgetDiff > 0 ? `${budgetDiff}억 초과` : budgetDiff < 0 ? `${Math.abs(budgetDiff)}억 잔여` : '균형'}
              </p>
            </div>
          )}
        </div>

        {/* 이전/다음 단계 제어 버튼 — 이동 대상 라벨 명시 */}
        <div className="flex md:flex-col gap-2 shrink-0 md:w-44">
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: Math.max(0, stepIndex - 1) }))}
            disabled={!prevStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border-2 border-violet-200 text-violet-700 font-bold hover:bg-violet-50 disabled:opacity-40 text-left leading-tight"
            title={prevShort || ''}
          >
            ← 이전 단계
            {prevShort && <div className="text-[10px] font-normal text-violet-500 truncate">({prevShort})</div>}
          </button>
          <button
            onClick={() => preserveWindowScrollAfter(() => updateAt(roomCode, 'workflow/phase3', { stepIndex: stepIndex + 1 }))}
            disabled={!nextStep}
            className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-violet-600 text-white font-bold hover:bg-violet-700 shadow-sm disabled:opacity-40 text-left leading-tight"
            title={nextShort || ''}
          >
            다음 단계 →
            {nextShort && <div className="text-[10px] font-normal text-violet-100 truncate">({nextShort})</div>}
          </button>
        </div>
      </div>

      {/* === 토의·평가 마감: 작성분 일괄 제출 (예산검토~토의평가 단계) === */}
      {(stage === 2 || stage === 3) && (
        <div className="border-t border-slate-200 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/60 -mx-1 px-3 py-2.5 rounded-lg">
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-900">📥 토의·평가 시작 전 일괄 제출(마감)</p>
            <p className="text-[11px] text-amber-700">누르면 작성 중인 모든 부처 초안을 제출 처리해 평가 대상에 올립니다(덜 된 것 포함). 각 모둠은 평가 중에도 토의화면에서 수정·재제출할 수 있어요.</p>
          </div>
          <button
            onClick={() => bulkSubmitDrafts(false)}
            className="shrink-0 px-3 py-2 text-xs font-black rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition active:scale-95"
          >
            📥 모든 부처 초안 일괄 제출
          </button>
        </div>
      )}

      {/* === 부처별 실시간 진행 현황 모니터링 === */}
      <div className="border-t border-slate-200 pt-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-violet-800 flex items-center gap-1.5">
            <span>📊 부처별 실시간 진행 현황</span>
            <span className="text-[10px] text-gray-500 font-normal">
              ({isCollaborative ? '공동작업 모드' : '역할중심 모드'})
            </span>
          </h3>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {(branchConfig?.executive?.units || []).map((unit) => {
            const group = groups?.[unit.groupId]
            const groupName = group?.name || `모둠 ${unit.groupId}`
            
            if (isCollaborative) {
              // 공동작업 모드 모니터링
              const policy = policiesMap?.[unit.groupId] || {}
              const fields = policy.policyFields || {}
              const status = policy.status
              const budgetItems = Array.isArray(policy.budgetItems) ? policy.budgetItems : []
              const requestedBudget = Number(policy.requestedBudget ?? policy.draftBudget) || 0

              let statusLabel = '❌ 작성 전'
              let statusColor = 'bg-gray-100 text-gray-500'
              if (status === 'submitted') {
                statusLabel = '✅ 제출 완료'
                statusColor = 'bg-emerald-100 text-emerald-700'
              } else if (status === 'requested') {
                statusLabel = '💰 청구 확정'
                statusColor = 'bg-indigo-100 text-indigo-700'
              } else if (status === 'saved') {
                statusLabel = '📝 작성중'
                statusColor = 'bg-amber-100 text-amber-700 font-semibold'
              } else if (status) {
                statusLabel = '📢 발의됨'
                statusColor = 'bg-violet-100 text-violet-700'
              }

              return (
                <div key={unit.unitId} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="font-extrabold text-slate-800">
                      🏢 {unit.ministryName} <span className="font-medium text-slate-500 text-[10px]">({groupName})</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <p className="flex justify-between">
                      <span>• 정책명:</span>
                      <span className="font-semibold text-slate-800 max-w-[150px] truncate">{fields.title || '미입력'}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>• 시행령:</span>
                      <span className="font-semibold text-slate-800">
                        {fields.ordinance ? `${fields.ordinance.slice(0, 15)}... (${fields.ordinance.length}자)` : '❌ 미작성'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>• 국민 눈높이:</span>
                      <span className="font-semibold text-slate-800">
                        {fields.publicConcern || fields.publicResponse ? '✅ 작성됨' : '❌ 미작성'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span>• 예산청구:</span>
                      <span className="font-semibold text-slate-800">
                        {requestedBudget > 0 ? `${requestedBudget}억 (항목 ${budgetItems.length}개)` : '❌ 미입력'}
                      </span>
                    </p>
                  </div>
                  {['submitted', 'requested', 'adjusted', 'final'].includes(status) && (
                    <button
                      onClick={() => cancelSubmission(unit)}
                      className="w-full mt-1 px-2 py-1.5 text-[11px] font-bold rounded-lg border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 transition"
                    >
                      ↩️ 제출 취소 (다시 제출 허용)
                    </button>
                  )}
                </div>
              )
            } else {
              // 역할중심 모드 모니터링
              const sessionRoles = group?.sessionRoles?.['executive-default'] || {}
              const draft = draftsMap?.[unit.unitId] || {}
              const memberNotes = draft.memberNotes || {}
              const sections = draft.sections || {}

              // ① 역할및준비 단계 산출물: 워드클라우드 + 우리 부서 할 일
              const prep = draft.prep || {}
              const wordCounts = {}
              Object.values(prep.brainstorm || {}).forEach((w) => {
                const word = (w?.word || '').trim()
                if (word) wordCounts[word] = (wordCounts[word] || 0) + 1
              })
              const prepWords = Object.entries(wordCounts).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count)
              const chosenTaskText = prep.chosenTask?.text?.trim() || ''

              // 대표 지정용: 이 부처의 대표 역할 키 + 현재 대표 + 모둠원 목록
              const presidentGroupId = branchConfig?.executive?.presidentGroupId
              const isPresidentUnit = unit.groupId === presidentGroupId || Boolean(group?.name?.includes('대통령'))
              const unitRoles = isPresidentUnit ? normalizeRoleList('executive', DEFAULT_ROLES.executive_president || []) : branchRoles
              const repKey = unitRoles.find((r) => r.isRepresentative)?.key || null
              const currentRepId = repKey ? (Object.entries(sessionRoles).find(([, rk]) => rk === repKey)?.[0] || '') : ''
              const unitMembers = Object.keys(group?.members || {})
                .map((sid) => ({ id: sid, ...(students?.[sid] || {}) }))
                .filter((m) => m.nickname)
                .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))

              return (
                <div key={unit.unitId} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                  <div className="border-b border-slate-200 pb-1.5 flex justify-between">
                    <span className="font-extrabold text-slate-800">
                      🏢 {unit.ministryName} <span className="font-medium text-slate-500 text-[10px]">({groupName})</span>
                    </span>
                  </div>
                  {/* 대표 직접 지정 */}
                  {repKey && (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      <span className="text-[10px] font-black text-amber-800 shrink-0">👑 대표 지정</span>
                      <select
                        value={currentRepId}
                        onChange={(e) => assignRepresentative(unit.groupId, e.target.value, repKey, sessionRoles)}
                        className="flex-1 min-w-0 text-[11px] border border-amber-300 rounded px-1.5 py-1 bg-white font-bold text-amber-900"
                      >
                        <option value="">— 미지정 —</option>
                        {unitMembers.map((m) => (
                          <option key={m.id} value={m.id}>{m.number ? `${m.number}번 ` : ''}{m.nickname}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {branchRoles.map((roleDef) => {
                      const studentId = Object.entries(sessionRoles).find(([, rkey]) => rkey === roleDef.key)?.[0]
                      const student = studentId ? students?.[studentId] : null
                      
                      // 통합 섹션 진척도 (이제 1단계 메모가 없으므로 2단계 초안/예산으로 통일)
                      const section = roleDef.assignedSection ? sections[roleDef.assignedSection] : null
                      // policyFields 나 budgetItems 중 하나라도 있으면 진행중으로 간주
                      const hasFields = section && typeof section.content === 'object' && Object.values(section.content.policyFields || {}).some(hasMeaningfulValue)
                      const hasBudgets = section && Array.isArray(section.content?.budgetItems) && section.content.budgetItems.length > 0
                      const isSecDone = section && section.status === 'ready'
                      const isSecWriting = (hasFields || hasBudgets) && !isSecDone

                      return (
                        <div key={roleDef.key} className={`bg-white border rounded px-2 py-1.5 flex-1 min-w-[150px] space-y-0.5 ${roleDef.isRepresentative ? 'border-amber-300' : 'border-slate-200'}`}>
                          {/* 1줄: 역할명 + 대표 배지 */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-500 truncate">{roleDef.emoji} {roleDef.label}</span>
                            {roleDef.isRepresentative && (
                              <span className="text-[8px] px-1 py-px rounded-full bg-amber-100 text-amber-700 font-black shrink-0 border border-amber-200">대표</span>
                            )}
                          </div>
                          {/* 2줄: 배정된 학생 이름(크게) + 상태 배지 */}
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`text-xs font-black truncate ${student ? 'text-indigo-700' : 'text-rose-400'}`}>
                              {student ? `${student.number ? `${student.number}번 ` : ''}${student.nickname}` : '❌ 미배정'}
                            </span>
                            {student && roleDef.assignedSection && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-black shrink-0 ${
                                isSecDone ? 'bg-emerald-100 text-emerald-700' :
                                isSecWriting ? 'bg-amber-100 text-amber-700' :
                                'bg-gray-100 text-gray-400'
                              }`}>
                                {isSecDone ? '초안완료' : isSecWriting ? '작성중' : '작성대기'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* ① 역할및준비 산출물: 워드클라우드 + 우리 부서 할 일 */}
                  {(prepWords.length > 0 || chosenTaskText) && (
                    <div className="mt-1 pt-1.5 border-t border-slate-200 space-y-1.5">
                      {prepWords.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 mb-0.5">💭 할 수 있는 일 (브레인스토밍)</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {prepWords.map((w) => (
                              <span key={w.word} style={{ fontSize: `${Math.min(20, 11 + w.count * 3)}px`, lineHeight: 1.15 }} className="font-black text-indigo-700">
                                {w.word}{w.count > 1 && <span className="text-[9px] text-indigo-400 align-super">×{w.count}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {chosenTaskText && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 mb-0.5">🎯 우리 부서 입법 관련 할 일</p>
                          <p className="text-[11px] text-slate-700 whitespace-pre-wrap bg-white border border-slate-100 rounded px-2 py-1">{chosenTaskText}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(draft.finalDoc?.status === 'locked' || ['submitted', 'requested', 'adjusted', 'final'].includes(policiesMap?.[unit.groupId]?.status)) && (
                    <button
                      onClick={() => cancelSubmission(unit)}
                      className="w-full mt-1 px-2 py-1.5 text-[11px] font-bold rounded-lg border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 transition"
                    >
                      ↩️ 제출 취소 (다시 제출 허용)
                    </button>
                  )}
                </div>
              )
            }
          })}
        </div>
      </div>
    </section>
  )
}

export default Phase3ExecutiveQuickPanel
