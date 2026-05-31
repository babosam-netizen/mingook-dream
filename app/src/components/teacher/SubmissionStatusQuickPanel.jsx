import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe } from '../../lib/rtdb-helpers'
import { useWorkflow } from '../../lib/use-workflow'
import SubmissionDetailModal from './SubmissionDetailModal'

const STEP_CONFIGS = {
  media: {
    title: '1-4 캠페인 포스터·주장글·자료 제출 확인',
    mode: 'group',
    sources: ['posters', 'essays', 'links'],
  },
  article: {
    title: '1-7 기사 작성 제출 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 1) === 1,
  },
  prep: {
    title: '2-1 공약 개발용 자료수집 확인',
    mode: 'group',
    sources: ['researchPlans'],
    researchContext: 'phase2_election',
  },
  register: {
    title: '2-2 후보 등록 제출 확인',
    mode: 'group',
    sources: ['candidates'],
  },
  finalNews: {
    title: '2-8 선거 결과 기사 작성 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 2 || article?.target === 'election',
  },
  'legislative-draft': {
    title: '3-2 입법 발의 제출 확인',
    mode: 'group',
    sources: ['bills'],
  },
  article1: {
    title: '3-8 입법 결과 기사 작성 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'legislative',
  },
  'executive-budget': {
    title: '3-10 정책·예산안 제출 확인',
    mode: 'group',
    sources: ['policies'],
  },
  article2: {
    title: '3-17 행정 결과 기사 작성 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'executive',
  },
  article3: {
    title: '3-20 사법 결과 기사 작성 확인',
    mode: 'student',
    sources: ['articles'],
    articleFilter: (article) => Number(article?.phase || 0) === 3 && article?.target === 'judicial',
  },
  reflect: {
    title: '4-1 정리글 작성 제출 확인',
    mode: 'student',
    sources: ['reflections'],
  },
}

const SOURCE_PATHS = {
  posters: 'posters',
  essays: 'essays',
  links: 'links',
  articles: 'articles',
  researchPlans: 'researchPlans',
  candidates: 'candidates',
  journalistNewspapers: 'journalistNewspapers',
  bills: 'bills',
  policies: 'policies',
  reflections: 'reflections',
}

const NEWSPAPER_LAYOUT_TYPES = [
  { key: 'lead', label: '머리기사' },
  { key: 'support', label: '보조기사' },
  { key: 'analysis', label: '분석기사' },
  { key: 'interview', label: '인터뷰/의견' },
  { key: 'brief', label: '짧은 기사' },
  { key: 'unused', label: '이번 신문에는 제외' },
]

const timeOf = (item = {}) =>
  item.updatedAt || item.createdAt || item.registeredAt || item.submittedAt || item.policySubmittedAt || item.budgetSubmittedAt || item.at || 0

const fmtTime = (ts) => {
  if (!ts) return '시간 기록 없음'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const asArray = (map = {}) => Object.entries(map || {}).map(([id, value]) => ({ id, ...value }))
const groupIdOf = (item = {}) => item.groupId || item.authorGroupId || item.proposerGroupId
const studentIdOf = (item = {}) => item.authorStudentId || item.submittedByStudentId || item.leaderStudentId

function normalizeNewspaperLayoutItem(item = {}) {
  const slot = NEWSPAPER_LAYOUT_TYPES.some((type) => type.key === item.slot) ? item.slot : 'brief'
  if (slot === 'unused') return { ...item, slot, page: 0 }
  const page = Number(item.page || (['analysis', 'interview'].includes(slot) ? 2 : 1)) === 2 ? 2 : 1
  return { ...item, slot, page }
}

function getNewspaperLayoutGroups(layoutItems = []) {
  const groups = {
    1: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    2: Object.fromEntries(NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused').map((slot) => [slot.key, []])),
    unused: [],
  }
  ;(layoutItems || []).forEach((item) => {
    const normalized = normalizeNewspaperLayoutItem(item)
    if (normalized.slot === 'unused') groups.unused.push(normalized)
    else groups[normalized.page][normalized.slot].push(normalized)
  })
  return groups
}

function latestFirst(items = []) {
  return [...items].sort((a, b) => timeOf(b) - timeOf(a))
}

function getResearchSubmissions(researchPlans = {}, contextKey) {
  const context = researchPlans?.[contextKey] || {}
  return Object.entries(context).map(([gid, plan]) => {
    const targets = asArray(plan?.targets)
    const items = asArray(plan?.items)
    return {
      id: gid,
      groupId: gid,
      type: 'research',
      title: `자료 목록 ${targets.length}개 · 수집 자료 ${items.length}개`,
      targets,
      items,
      updatedAt: Math.max(0, ...targets.map(timeOf), ...items.map(timeOf)),
    }
  }).filter((entry) => entry.targets.length || entry.items.length)
}

function buildSubmissions(config, data) {
  if (!config) return []
  if (config.researchContext) return getResearchSubmissions(data.researchPlans, config.researchContext)

  if (config.sources.includes('posters') || config.sources.includes('essays') || config.sources.includes('links')) {
    return [
      ...latestFirst(asArray(data.posters)).map((item) => ({ ...item, type: 'poster', title: item.caption || '캠페인 포스터' })),
      ...latestFirst(asArray(data.essays)).map((item) => ({ ...item, type: 'essay', title: item.title || item.claim || '주장하는 글' })),
      ...latestFirst(asArray(data.links)).map((item) => ({ ...item, type: 'link', title: item.title || item.url || '자료 링크' })),
    ].filter((item) => groupIdOf(item))
  }

  if (config.sources.includes('articles')) {
    return asArray(data.articles)
      .filter((article) => article.status !== 'deleted')
      .filter((article) => !config.articleFilter || config.articleFilter(article))
      .map((article) => ({ ...article, type: 'article', title: article.headline || '기사' }))
  }

  if (config.sources.includes('candidates')) {
    return asArray(data.candidates)
      .filter((item) => item.status === 'submitted' || item.registeredAt)
      .map((item) => ({ ...item, type: 'candidate', title: `${item.leaderNickname || '후보'} 후보 등록` }))
  }

  if (config.sources.includes('bills')) {
    return asArray(data.bills).map((item) => ({ ...item, type: 'bill', title: item.title || '법률안' }))
  }

  if (config.sources.includes('policies')) {
    return asArray(data.policies)
      .filter((item) => item.status === 'submitted' || item.policySubmittedAt || item.budgetSubmittedAt || item.submittedAt)
      .map((item) => ({ ...item, type: 'policy', title: item.policyFields?.title || item.policyFields?.policyName || item.ministryName || '정책·예산안' }))
  }

  if (config.sources.includes('reflections')) {
    return asArray(data.reflections).map((item) => ({ ...item, type: 'reflection', title: item.finalEssay ? '정리글' : '활동 소감' }))
  }

  return []
}

function summarizeSubmitter(entity, submissions, mode, groups, students) {
  const name = mode === 'group'
    ? entity.name || entity.topic || entity.id
    : `${entity.number ? `${entity.number}번 ` : ''}${entity.nickname || entity.name || entity.id}`
  return {
    id: entity.id,
    name,
    submitted: submissions.length > 0,
    count: submissions.length,
    latestAt: Math.max(0, ...submissions.map(timeOf)),
    submissions: latestFirst(submissions),
    meta: mode === 'group'
      ? `${Object.keys(entity.members || {}).length}명`
      : groups?.[entity.groupId]?.name || '',
  }
}

/* ── 후보 등록 상세 모달 (2-2 전용) ── */
function CandidateDetailModal({ groupName, candidateData: c, journalistData, newspaperData, onClose }) {
  const backdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  const header = (
    <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
      <div>
        <p className="text-[10px] text-gray-400 font-semibold">2-2 후보 등록 확인</p>
        <h2 className="text-lg font-black text-gray-900">{groupName}</h2>
        {c && (
          <p className="text-xs mt-0.5">
            {c.leaderNickname ? <span className="text-gray-600">{c.leaderNickname} 후보 · </span> : null}
            <span className={c.status === 'submitted' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {c.status === 'submitted' ? '✅ 최종제출 완료' : '⏳ 작성 중'}
            </span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 font-bold text-lg shrink-0 ml-3"
      >✕</button>
    </div>
  )

  /* 기자단 */
  if (journalistData) {
    const newspaperSteps = journalistNewspaperSteps(newspaperData)
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]">
          {header}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div className="text-center space-y-2">
              <p className="text-4xl">📰</p>
              <p className="font-black text-blue-800 text-lg">선거 기자단 등록 완료</p>
              <p className="text-xs text-blue-400">{fmtTime(journalistData.registeredAt)}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-blue-500">기자단 마무리 신문</p>
                  <h3 className="text-base font-black text-blue-950">{newspaperData?.title || '신문 이름 미정'}</h3>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${newspaperData?.status === 'submitted' ? 'bg-emerald-600 text-white' : 'bg-amber-200 text-amber-800'}`}>
                  {newspaperData?.status === 'submitted' ? '신문 제출' : newspaperData ? '작성 중' : '미시작'}
                </span>
              </div>
              <div className="mt-3 grid sm:grid-cols-2 gap-2">
                {newspaperSteps.map((step) => {
                  const CLS = {
                    done: 'border-emerald-200 bg-white text-emerald-800',
                    warn: 'border-amber-200 bg-amber-50 text-amber-800',
                    empty: 'border-slate-200 bg-slate-50 text-slate-400',
                  }
                  return (
                    <div key={step.label} className={`rounded-xl border px-3 py-2 text-xs ${CLS[step.state]}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{step.label}</span>
                        <span className="font-black">{step.state === 'done' ? '완료' : step.state === 'warn' ? '작성중' : '미제출'}</span>
                      </div>
                      {step.time && <p className="mt-0.5 text-[10px] opacity-70">{fmtTime(step.time)}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
            {newspaperData?.meetingNotes && <TextBlock title="편집회의 결과" text={newspaperData.meetingNotes} />}
            {newspaperData?.layoutPlan && <TextBlock title="배치 계획" text={newspaperData.layoutPlan} />}
            {newspaperData?.layoutItems?.length > 0 && <NewspaperLayoutBlock layoutItems={newspaperData.layoutItems} totalPages={newspaperData.totalPages} />}
            {newspaperData?.selectedArticleIds?.length > 0 && <TextBlock title="배치 선택 기사" text={`${newspaperData.selectedArticleIds.length}개 기사 선택`} />}
            {newspaperData?.canvaUrl && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-[11px] font-black text-slate-400 mb-1">캔바 신문</p>
                <a href={newspaperData.canvaUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline break-all">캔바 신문 열기</a>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* 미시작 */
  if (!c) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
        <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl">
          {header}
          <p className="text-center text-gray-400 py-10 text-sm">아직 등록을 시작하지 않았습니다.</p>
        </div>
      </div>
    )
  }

  const steps = [
    {
      num: 1, label: '후보 이름',
      state: stepState(!!(c.candidateSavedAt || c.leaderStudentId), !!c.leaderNickname),
      time: c.candidateSavedAt,
      content: c.leaderNickname ? (
        <p className="text-sm font-bold text-gray-800">
          {c.leaderNickname}
          {c.leaderNumber ? <span className="font-normal text-gray-500"> ({c.leaderNumber}번)</span> : null}
        </p>
      ) : null,
    },
    {
      num: 2, label: '소개·출마 선언',
      state: stepState(!!c.introSavedAt, !!(c.pamphlet?.trim())),
      time: c.introSavedAt,
      content: c.pamphlet ? (
        <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{c.pamphlet}</p>
      ) : null,
    },
    {
      num: 3, label: '공약',
      state: stepState(!!c.pledgesSavedAt, !!(c.pledges?.some((p) => p?.trim()))),
      time: c.pledgesSavedAt,
      content: c.pledges?.some(Boolean) ? (
        <ul className="space-y-1">
          {c.pledges.filter(Boolean).map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
              <span className="shrink-0 w-4 h-4 rounded-full bg-amber-100 text-amber-700 font-black flex items-center justify-center text-[9px]">{i + 1}</span>
              {p}
            </li>
          ))}
        </ul>
      ) : null,
    },
    {
      num: 4, label: '홍보자료',
      state: mediaState(c),
      badge: (() => {
        if (!c.mediaSavedAt) return '미제출'
        const cnt = mediaItemCount(c)
        if (cnt >= 3) return '완료 (3/3)'
        if (cnt === 0) return '내용 없음'
        return `미흡 (${cnt}/3)`
      })(),
      time: c.mediaSavedAt,
      content: c.mediaSavedAt ? (
        <div className="space-y-1">
          {c.posterCanvaUrl
            ? <a href={c.posterCanvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">🖼️ 선거 포스터</a>
            : <p className="text-xs text-gray-400">🖼️ 선거 포스터 — <span className="text-red-400 font-bold">미등록</span></p>}
          {c.canvaUrl
            ? <a href={c.canvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">📋 공약 카드뉴스</a>
            : <p className="text-xs text-gray-400">📋 공약 카드뉴스 — <span className="text-red-400 font-bold">미등록</span></p>}
          {c.videoCanvaUrl
            ? <a href={c.videoCanvaUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 underline break-all">🎬 홍보 영상</a>
            : <p className="text-xs text-gray-400">🎬 홍보 영상 — <span className="text-red-400 font-bold">미등록</span></p>}
        </div>
      ) : null,
    },
    {
      num: 5, label: '최종제출',
      state: stepState(c.status === 'submitted', c.status === 'submitted'),
      time: c.submittedAt,
      content: null,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={backdrop}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[88vh]">
        {header}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {steps.map((step) => {
            const BG   = { done: 'bg-emerald-50 border-emerald-100', warn: 'bg-amber-50 border-amber-100', empty: 'bg-gray-50 border-gray-100' }
            const DOT  = { done: 'bg-emerald-500 text-white', warn: 'bg-amber-400 text-white', empty: 'bg-gray-300 text-gray-500' }
            const LBL  = { done: 'text-emerald-800', warn: 'text-amber-800', empty: 'text-gray-400' }
            const BDGE = { done: 'bg-emerald-200 text-emerald-800', warn: 'bg-amber-200 text-amber-800', empty: 'bg-gray-200 text-gray-500' }
            const ICON = { done: step.num, warn: '△', empty: step.num }
            const BTXT = { done: '완료', warn: '내용 없음', empty: '미제출' }
            return (
              <div key={step.num} className={`rounded-2xl border p-4 ${BG[step.state]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${DOT[step.state]}`}>
                      {ICON[step.state]}
                    </span>
                    <span className={`text-sm font-black ${LBL[step.state]}`}>{step.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {step.time && <span className="text-[10px] text-gray-400">{fmtTime(step.time)}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${BDGE[step.state]}`}>
                      {step.badge ?? BTXT[step.state]}
                    </span>
                  </div>
                </div>
                <div className="pl-7">
                  {(step.state === 'done' || step.state === 'warn') && step.content
                    ? step.content
                    : step.state === 'warn'
                      ? <p className="text-xs text-amber-600 italic font-semibold">⚠️ 저장은 됐지만 내용이 비어 있습니다.</p>
                      : step.state === 'empty'
                        ? <p className="text-xs text-gray-400 italic">아직 저장하지 않았습니다.</p>
                        : null
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function stepState(saved, filled) {
  if (!saved) return 'empty'
  if (!filled) return 'warn'
  return 'done'
}

/** 홍보자료 3종 중 몇 개 올렸는지 */
function mediaItemCount(c) {
  return [c?.posterCanvaUrl, c?.canvaUrl, c?.videoCanvaUrl].filter(Boolean).length
}
/** 홍보자료 전용 상태: 3개 모두 있어야 done, 1~2개면 warn, 미저장이면 empty */
function mediaState(c) {
  if (!c?.mediaSavedAt) return 'empty'
  return mediaItemCount(c) >= 3 ? 'done' : 'warn'
}

function journalistNewspaperSteps(newspaperData) {
  return [
    { num: 1, label: '신문 이름 저장', short: '신문이름', state: stepState(!!newspaperData?.titleSavedAt, !!newspaperData?.title?.trim()), time: newspaperData?.titleSavedAt },
    { num: 2, label: '신문편집회의 저장', short: '편집회의', state: stepState(!!newspaperData?.meetingSavedAt, !!(newspaperData?.meetingNotes?.trim() || newspaperData?.layoutPlan?.trim() || newspaperData?.selectedArticleIds?.length)), time: newspaperData?.meetingSavedAt },
    { num: 3, label: '캔바 작업 저장', short: '캔바작업', state: stepState(!!newspaperData?.canvaSavedAt, !!newspaperData?.canvaUrl), time: newspaperData?.canvaSavedAt },
    { num: 4, label: '최종제출', short: '최종제출', state: stepState(newspaperData?.status === 'submitted', newspaperData?.status === 'submitted'), time: newspaperData?.submittedAt },
  ]
}

/* ── 후보 등록 체크리스트 (2-2 전용) ── */
function CandidateChecklist({ candidateData, journalistData, newspaperData }) {
  if (journalistData) {
    const steps = journalistNewspaperSteps(newspaperData)
    const CLS = {
      done: 'bg-emerald-100 text-emerald-800',
      warn: 'bg-amber-100 text-amber-700',
      empty: 'bg-slate-100 text-slate-400',
    }
    const ICON = { done: '✓', warn: '△', empty: '○' }
    return (
      <div className="mt-2 space-y-1.5">
        <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">📰 기자단 등록 완료</span>
        <div className="flex gap-1 flex-wrap">
          {steps.map(({ label, short, state, num }) => (
            <span key={label} title={label} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${CLS[state]}`}>
              {ICON[state]} {num}. {short}
            </span>
          ))}
        </div>
      </div>
    )
  }
  if (!candidateData) {
    return (
      <div className="mt-2">
        <span className="text-[10px] text-slate-400">아직 시작하지 않음</span>
      </div>
    )
  }
  const c = candidateData
  const items = [
    { label: '후보 이름', state: stepState(!!(c.candidateSavedAt || c.leaderStudentId), !!c.leaderNickname) },
    { label: '소개·선언',  state: stepState(!!c.introSavedAt, !!(c.pamphlet?.trim())) },
    { label: '공약',       state: stepState(!!c.pledgesSavedAt, !!(c.pledges?.some((p) => p?.trim()))) },
    { label: c.mediaSavedAt ? `홍보 ${mediaItemCount(c)}/3` : '홍보자료', state: mediaState(c) },
    { label: '최종제출',   state: stepState(c.status === 'submitted', c.status === 'submitted') },
  ]
  const CLS = {
    done:  'bg-emerald-100 text-emerald-800',
    warn:  'bg-amber-100 text-amber-700',
    empty: 'bg-slate-100 text-slate-400',
  }
  const ICON = { done: '✓', warn: '△', empty: '○' }
  return (
    <div className="mt-2 flex gap-1 flex-wrap">
      {items.map(({ label, state }) => (
        <span key={label} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${CLS[state]}`}>
          {ICON[state]} {label}
        </span>
      ))}
    </div>
  )
}

export default function SubmissionStatusQuickPanel() {
  const wf = useWorkflow()
  const roomCode = useGameStore((s) => s.roomCode)
  const groups = useGameStore((s) => s.groups)
  const students = useGameStore((s) => s.students)
  const [data, setData] = useState({})
  const [selected, setSelected] = useState(null)
  const [journalistsMap, setJournalistsMap] = useState({})
  const [journalistNewspapersMap, setJournalistNewspapersMap] = useState({})
  const [selectedCandidateGroup, setSelectedCandidateGroup] = useState(null)

  const stepId = wf.currentStep?.id
  const config = STEP_CONFIGS[stepId]
  const sourcesKey = (config?.sources || []).join('|')
  const isCandidateRegister = stepId === 'register'

  useEffect(() => {
    if (!roomCode || !config) return undefined
    const unsubs = (config.sources || []).map((source) => {
      const path = SOURCE_PATHS[source]
      return subscribe(roomCode, path, (value) => {
        setData((prev) => ({ ...prev, [source]: value || {} }))
      })
    })
    return () => unsubs.forEach((u) => u?.())
  }, [roomCode, stepId, sourcesKey])

  // 후보 등록 단계에서 기자단 데이터도 구독
  useEffect(() => {
    if (!roomCode || !isCandidateRegister) return
    const u1 = subscribe(roomCode, 'electionJournalists', (d) => setJournalistsMap(d || {}))
    const u2 = subscribe(roomCode, 'journalistNewspapers', (d) => setJournalistNewspapersMap(d || {}))
    return () => { u1?.(); u2?.() }
  }, [roomCode, isCandidateRegister])

  useEffect(() => {
    setSelected(null)
  }, [stepId])

  const groupEntries = useMemo(
    () => Object.entries(groups || {})
      .map(([id, group]) => ({ id, ...group }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko')),
    [groups],
  )

  const studentEntries = useMemo(
    () => Object.entries(students || {})
      .map(([id, student]) => ({ id, ...student }))
      .sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0)),
    [students],
  )

  const submissions = useMemo(() => buildSubmissions(config, data), [config, data])

  const rows = useMemo(() => {
    if (!config) return []
    if (config.mode === 'group') {
      return groupEntries.map((group) => {
        const mine = submissions.filter((item) => groupIdOf(item) === group.id || item.id === group.id)
        return summarizeSubmitter(group, mine, 'group', groups, students)
      })
    }
    return studentEntries.map((student) => {
      const mine = submissions.filter((item) => studentIdOf(item) === student.id)
      return summarizeSubmitter(student, mine, 'student', groups, students)
    })
  }, [config, groupEntries, studentEntries, submissions, groups, students])

  if (!config) return null

  const doneCount = isCandidateRegister
    ? rows.filter((row) => {
      const candidateData = data.candidates?.[row.id]
      const journalistData = journalistsMap?.[row.id]
      const newspaperData = journalistNewspapersMap?.[row.id]
      return candidateData?.status === 'submitted' || (journalistData && newspaperData?.status === 'submitted')
    }).length
    : rows.filter((row) => row.submitted).length
  const totalCount = rows.length
  const modeLabel = config.mode === 'group' ? '모둠 제출' : '개인 제출'

  return (
    <section className="bg-white rounded-2xl shadow-lg border-2 border-sky-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-black text-sky-600 uppercase tracking-wide">제출 확인 빠른보기</p>
          <h2 className="text-base font-black text-slate-900">{config.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{modeLabel} · 제출자 이름을 누르면 제출 내용을 확인할 수 있습니다.</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-sky-700 tabular-nums">{doneCount}/{totalCount}</div>
          <div className="text-[11px] font-bold text-slate-400">제출 완료</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {rows.map((row) => {
          const candidateData  = isCandidateRegister ? (data.candidates?.[row.id] || null) : null
          const journalistData = isCandidateRegister ? (journalistsMap?.[row.id] || null) : null
          const newspaperData  = isCandidateRegister ? (journalistNewspapersMap?.[row.id] || null) : null
          const cardTitle = journalistData
            ? `${row.name} 기자단-${newspaperData?.title?.trim() || '신문 이름 미정'}`
            : row.name
          // 후보 등록 단계: 기자단이거나 candidateSavedAt이 있으면 "시작함"으로 표시
          const candidateStarted = !!(candidateData?.candidateSavedAt || candidateData?.leaderStudentId || journalistData || newspaperData)
          const candidateSubmitted = candidateData?.status === 'submitted'
          const journalistSubmitted = !!(journalistData && newspaperData?.status === 'submitted')
          const displayBg = isCandidateRegister
            ? ((candidateSubmitted || journalistSubmitted) ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
               : candidateStarted  ? 'bg-amber-50 border-amber-200 text-amber-900'
               : 'bg-slate-50 border-slate-200 text-slate-500')
            : (row.submitted ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-500')

          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (isCandidateRegister) {
                  setSelectedCandidateGroup({
                    groupId: row.id,
                    groupName: row.name,
                    candidateData: data.candidates?.[row.id] || null,
                    journalistData: journalistsMap?.[row.id] || null,
                    newspaperData: journalistNewspapersMap?.[row.id] || null,
                  })
                } else {
                  setSelected(row)
                }
              }}
              className={`text-left rounded-xl border px-3 py-2 transition hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${displayBg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-sm truncate">{cardTitle}</span>
                <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-black ${
                  isCandidateRegister
                    ? ((candidateSubmitted || journalistSubmitted) ? 'bg-emerald-600 text-white'
                       : candidateStarted  ? 'bg-amber-500 text-white'
                       : 'bg-slate-200 text-slate-500')
                    : (row.submitted ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')
                }`}>
                  {isCandidateRegister
                    ? (candidateSubmitted ? '후보제출' : journalistSubmitted ? '신문제출' : candidateStarted ? '작성중' : '미시작')
                    : (row.submitted ? `${row.count}건` : '미제출')}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate">{row.meta}</span>
                {!isCandidateRegister && (
                  <span className="tabular-nums">{row.submitted ? fmtTime(row.latestAt) : '아직 없음'}</span>
                )}
              </div>
              {/* 후보 등록 체크리스트 */}
              {isCandidateRegister && (
                <CandidateChecklist candidateData={candidateData} journalistData={journalistData} newspaperData={newspaperData} />
              )}
            </button>
          )
        })}
      </div>

      {selected && (
        <SubmissionDetailModal
          isOpen={true}
          onClose={() => setSelected(null)}
          title={`${selected.name} 제출 내용`}
          items={selected.submissions}
          renderItem={(item) => <SubmissionDetail item={item} groups={groups} students={students} />}
        />
      )}

      {selectedCandidateGroup && (
        <CandidateDetailModal
          groupName={selectedCandidateGroup.groupName}
          candidateData={selectedCandidateGroup.candidateData}
          journalistData={selectedCandidateGroup.journalistData}
          newspaperData={selectedCandidateGroup.newspaperData}
          onClose={() => setSelectedCandidateGroup(null)}
        />
      )}
    </section>
  )
}

function SubmissionDetail({ item, groups, students }) {
  const group = groups?.[groupIdOf(item)]
  const student = students?.[studentIdOf(item)]
  const author = student ? `${student.number || ''}번 ${student.nickname || ''}`.trim() : item.authorNickname || item.ministerName || ''

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-slate-400 uppercase">{item.type}</p>
          <h3 className="font-black text-slate-900">{item.title || item.headline || item.policyFields?.title || '제출물'}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{group?.name || item.groupName || ''} {author && `· ${author}`} · {fmtTime(timeOf(item))}</p>
        </div>
      </div>

      {item.type === 'poster' && (
        <div className="space-y-2">
          {item.imageUrl && <img src={item.imageUrl} alt="포스터" className="w-full max-h-[52vh] object-contain rounded-xl border bg-slate-50" />}
          {item.canvaUrl && <a href={item.canvaUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">Canva 포스터 열기</a>}
          {item.caption && <p className="whitespace-pre-wrap">{item.caption}</p>}
        </div>
      )}

      {item.type === 'essay' && <TextBlock title="주장하는 글" text={[item.claim, item.reason, item.evidence, item.body, item.final].filter(Boolean).join('\n\n') || JSON.stringify(item, null, 2)} />}
      {item.type === 'link' && <TextBlock title={item.title || '자료 링크'} text={`${item.url || ''}\n${item.memo || item.description || ''}`} />}
      {item.type === 'article' && <TextBlock title={item.headline || '기사'} text={item.body || ''} />}
      {item.type === 'candidate' && <TextBlock title={`${item.leaderNickname || '후보'} 후보 등록`} text={[`공약: ${(item.pledges || []).join(' / ')}`, item.pamphlet, item.posterCanvaUrl && `선거 포스터: ${item.posterCanvaUrl}`, item.canvaUrl && `공약 카드뉴스: ${item.canvaUrl}`, item.videoCanvaUrl && `홍보영상: ${item.videoCanvaUrl}`].filter(Boolean).join('\n\n')} />}
      {item.type === 'bill' && <TextBlock title={item.title || '법률안'} text={item.body || ''} />}
      {item.type === 'policy' && (
        <div className="space-y-2">
          <TextBlock title="정책 내용" text={Object.entries(item.policyFields || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || '정책 필드 없음'} />
          <TextBlock title={`예산안 총 ${Number(item.requestedBudget || item.draftBudget || 0).toLocaleString()}억`} text={(item.budgetItems || []).map((b, idx) => `${idx + 1}. ${b.title || '항목'} / ${b.note || ''} / ${Number(b.amount || 0).toLocaleString()}억`).join('\n') || '예산 항목 없음'} />
        </div>
      )}
      {item.type === 'research' && (
        <div className="space-y-2">
          <TextBlock title="자료 수집 목록" text={(item.targets || []).map((t, idx) => `${idx + 1}. ${t.title || t.label || t.name}`).join('\n') || '목록 없음'} />
          <TextBlock title="수집 자료" text={(item.items || []).map((r, idx) => {
            const memo = r.idea || r.memo || r.note || r.summary || ''
            return `${idx + 1}. ${r.title || '자료'}\n${r.url || ''}${memo ? `\n떠오른 아이디어: ${memo}` : ''}`
          }).join('\n\n') || '자료 없음'} />
        </div>
      )}
      {item.type === 'reflection' && <TextBlock title="정리글" text={[item.participation, item.feelings, item.mostImpressive, item.newLearnings, item.pledge, item.finalEssay, item.body].filter(Boolean).join('\n\n')} />}
    </div>
  )
}

function TextBlock({ title, text }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black text-slate-400 mb-1">{title}</p>
      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-slate-700">{text || '내용 없음'}</p>
    </div>
  )
}

function NewspaperLayoutBlock({ layoutItems = [], totalPages = 1 }) {
  const normalizedTotalPages = Number(totalPages) === 2 ? 2 : 1
  const groups = getNewspaperLayoutGroups(layoutItems)
  const hasPage = (page) => NEWSPAPER_LAYOUT_TYPES.some((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length)
  const hasUnused = groups.unused.length > 0
  if (!hasPage(1) && !hasPage(2) && !hasUnused) return null

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black text-slate-400 mb-2">신문편집 배치안</p>
      <div className="space-y-2">
        {[1, 2].map((page) => (page <= normalizedTotalPages || hasPage(page)) && (
          <div key={page} className="rounded-xl border border-slate-200 bg-white p-2">
            <p className="mb-1 border-b border-slate-200 pb-1 text-[11px] font-black text-slate-900">{page}면</p>
            {hasPage(page) ? (
              <div className="grid sm:grid-cols-2 gap-2">
                {NEWSPAPER_LAYOUT_TYPES.filter((slot) => slot.key !== 'unused' && groups[page]?.[slot.key]?.length).map((slot) => (
                <div key={`${page}-${slot.key}`} className={`rounded-lg border bg-slate-50 p-2 ${slot.key === 'lead' ? 'border-slate-800 sm:col-span-2' : 'border-slate-200'}`}>
                  <p className="text-[11px] font-black text-slate-800">{slot.label}</p>
                  <ul className="mt-1 space-y-1">
                    {groups[page][slot.key].map((item) => (
                      <li key={item.articleId} className="text-xs leading-relaxed text-slate-600">- {item.headline || '제목 없는 기사'}</li>
                    ))}
                  </ul>
                </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-3 text-center text-xs font-bold text-slate-400">아직 이 면에 배치된 기사가 없습니다.</p>
            )}
          </div>
        ))}
        {hasUnused && (
          <div className="rounded-lg border border-slate-200 bg-white p-2 opacity-70">
            <p className="text-[11px] font-black text-slate-800">이번 신문에는 제외</p>
            <ul className="mt-1 space-y-1">
              {groups.unused.map((item) => (
                <li key={item.articleId} className="text-xs leading-relaxed text-slate-600">- {item.headline || '제목 없는 기사'}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
