import { useEffect, useMemo, useState, useRef } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'

/**
 * 1단계: 민국에서 나의 발자취 돌아보기
 * - 꼬불꼬불(snake) 경로 위에 활동 노드 배치
 * - 노드 클릭 → 카드 모달(내용 + 별점 + 이전/다음)
 */

const PHASE_META = {
  1: { label: '첫 번째 여정', sub: '시민 광장', emoji: '🏙️', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  2: { label: '두 번째 여정', sub: '선거',      emoji: '🗳️', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
  3: { label: '세 번째 여정', sub: '국정 포털', emoji: '🏛️', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', text: '#1e293b' },
}

const COLS = 4 // 한 행에 놓이는 노드 수

// ── 별점 컴포넌트
function Stars({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0)
  const sz = size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          className={`${sz} transition-transform hover:scale-125 focus:outline-none leading-none`}
          title={`${n}점`}
        >
          <span style={{ color: (hover || value) >= n ? '#facc15' : '#d1d5db' }}>★</span>
        </button>
      ))}
    </div>
  )
}

// ── 활동 카드 모달
function ActivityModal({ activities, index, ratings, onRate, onClose, onPrev, onNext }) {
  const act = activities[index]
  if (!act) return null
  const meta = PHASE_META[act.phase]
  const [open, setOpen] = useState(false)

  // 키보드 ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: meta.bg, border: `2px solid ${meta.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 */}
        <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{meta.emoji}</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: meta.color + '22', color: meta.color }}>
                {meta.label} · {act.meta.replace(/ · \d여정/, '')}
              </span>
            </div>
            <h3 className="font-black text-base leading-snug" style={{ color: meta.text }}>
              {act.title}
            </h3>
          </div>
          <button onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-lg transition">
            ✕
          </button>
        </div>

        {/* 내용 */}
        {act.content && (
          <div className="mx-5 mb-4">
            <button onClick={() => setOpen((v) => !v)}
              className="text-xs font-semibold underline underline-offset-2 mb-1"
              style={{ color: meta.color }}>
              {open ? '▲ 내용 접기' : '▼ 활동 내용 보기'}
            </button>
            {open && (
              <div className="rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap"
                style={{ background: 'rgba(255,255,255,0.7)' }}>
                {act.content}
              </div>
            )}
          </div>
        )}

        {/* 별점 */}
        <div className="mx-5 mb-5 p-4 rounded-2xl flex flex-col items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.6)' }}>
          <p className="text-sm font-bold text-gray-700">이 활동에 별점을 주세요</p>
          <Stars value={ratings[act.key] || 0} onChange={(v) => onRate(act.key, v)} size="lg" />
          {ratings[act.key] > 0 && (
            <p className="text-xs text-gray-500">{'★'.repeat(ratings[act.key])} {ratings[act.key]}점</p>
          )}
        </div>

        {/* 이전 / 다음 네비게이션 */}
        <div className="flex items-center justify-between px-4 pb-4 gap-2">
          <button onClick={onPrev} disabled={index === 0}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-30"
            style={{ background: meta.color + '22', color: meta.color }}>
            ← 이전
          </button>
          <span className="text-xs text-gray-400 shrink-0">{index + 1} / {activities.length}</span>
          <button onClick={onNext} disabled={index === activities.length - 1}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-30"
            style={{ background: meta.color + '22', color: meta.color }}>
            다음 →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Snake 경로 커넥터 (행 사이 U/N 곡선)
function SnakeConnector({ direction }) {
  // direction: 'right' → 오른쪽 끝에서 아래로 꺾임, 'left' → 왼쪽 끝에서 아래로 꺾임
  return (
    <div className="flex items-stretch my-0" style={{ height: 48 }}>
      {direction === 'right' ? (
        <>
          <div className="flex-1" />
          <div style={{
            width: 40, height: 48,
            borderRight: '3px dashed #d1d5db',
            borderBottom: '3px dashed #d1d5db',
            borderBottomRightRadius: 24,
          }} />
        </>
      ) : (
        <>
          <div style={{
            width: 40, height: 48,
            borderLeft: '3px dashed #d1d5db',
            borderBottom: '3px dashed #d1d5db',
            borderBottomLeftRadius: 24,
          }} />
          <div className="flex-1" />
        </>
      )}
    </div>
  )
}

// ── 노드 원형 버튼
function Node({ act, index, ratings, isActive, onClick }) {
  const meta = PHASE_META[act.phase]
  const score = ratings[act.key] || 0
  return (
    <div className="flex flex-col items-center gap-1.5 relative" style={{ minWidth: 64 }}>
      {/* 번호 */}
      <span className="text-[10px] font-bold text-gray-400">{index + 1}</span>

      {/* 원형 노드 */}
      <button
        onClick={() => onClick(index)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-md transition-all duration-200 hover:scale-110 focus:outline-none"
        style={{
          background: isActive ? meta.color : meta.bg,
          border: `3px solid ${meta.color}`,
          boxShadow: isActive ? `0 0 0 4px ${meta.color}44` : undefined,
        }}
        title={act.title}
      >
        <span>{act.icon}</span>
        {/* 별점 표시 */}
        {score > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 text-white text-[9px] font-black flex items-center justify-center shadow">
            {score}
          </span>
        )}
      </button>

      {/* 짧은 제목 */}
      <span className="text-[10px] text-center text-gray-600 font-medium leading-tight max-w-[64px] line-clamp-2">
        {act.shortTitle}
      </span>
    </div>
  )
}

// ── 행 간 연결선
function HConnector({ reversed }) {
  return (
    <div className="flex-1 flex items-center mx-1" style={{ minWidth: 8, maxWidth: 32 }}>
      <div className="w-full border-t-2 border-dashed border-gray-300" />
      {!reversed && <span className="text-gray-300 text-xs ml-0.5">›</span>}
      {reversed  && <span className="text-gray-300 text-xs mr-0.5 order-first">‹</span>}
    </div>
  )
}

export default function MyJourneyTimeline() {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const groups      = useGameStore((s) => s.groups)

  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [essays,     setEssays]     = useState({})
  const [posters,    setPosters]    = useState({})
  const [candidates, setCandidates] = useState({})
  const [supports,   setSupports]   = useState({})
  const [articles,   setArticles]   = useState({})
  const [branchData, setBranchData] = useState({})
  const [ratings,    setRatings]    = useState({})
  const [savingKey,  setSavingKey]  = useState(null)
  const [activeIdx,  setActiveIdx]  = useState(null)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'essays',            (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',           (d) => setPosters(d || {})),
      subscribe(roomCode, 'candidates',        (d) => setCandidates(d || {})),
      subscribe(roomCode, 'supportStatements', (d) => setSupports(d || {})),
      subscribe(roomCode, 'articles',          (d) => setArticles(d || {})),
      subscribe(roomCode, 'branchUnits',       (d) => setBranchData(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}/journeyRatings`).then((d) => {
      if (d) setRatings(d)
    })
  }, [roomCode, myStudentId])

  const handleRate = async (key, value) => {
    setSavingKey(key)
    const next = { ...ratings, [key]: value }
    setRatings(next)
    await updateAt(roomCode, `students/${myStudentId}`, { journeyRatings: next })
    setSavingKey(null)
  }

  // 전체 활동 목록 (순서: 1여정 → 2여정 → 3여정)
  const activities = useMemo(() => {
    const acts = []

    // ── 1여정
    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`, phase: 1,
        icon: '📝', shortTitle: e.title ? e.title.slice(0, 8) : '주장글',
        title: e.title || '주장하는 글', meta: '📝 주장하는 글 · 1여정',
        content: [e.claim, e.evidence, e.impact].filter(Boolean).join('\n\n'),
      })
    })
    Object.entries(posters).forEach(([id, p]) => {
      if (!myGroupId || p.groupId !== myGroupId) return
      if (p.authorStudentId && p.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_poster_${id}`, phase: 1,
        icon: '🖼️', shortTitle: p.title ? p.title.slice(0, 8) : '포스터',
        title: p.title || p.caption || '포스터', meta: '🖼️ 포스터 · 1여정',
        content: p.caption || p.description || '',
      })
    })

    // ── 2여정
    if (myGroupId && candidates[myGroupId]) {
      const c = candidates[myGroupId]
      acts.push({
        key: 'phase2_candidate', phase: 2,
        icon: '🗳️', shortTitle: '후보등록',
        title: c.candidateName ? `후보: ${c.candidateName}` : '후보 등록', meta: '🗳️ 후보 등록 · 2여정',
        content: c.pledge || c.manifesto || '',
      })
    }
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`, phase: 2,
        icon: '📣', shortTitle: '지지선언',
        title: '지지 선언문', meta: '📣 지지 선언문 · 2여정',
        content: s.content || s.statement || '',
      })
    })
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`, phase: 2,
        icon: '📰', shortTitle: a.title ? a.title.slice(0, 8) : '선거기사',
        title: a.title || '선거 기사', meta: '📰 기사 · 2여정',
        content: a.body || a.content || '',
      })
    })

    // ── 3여정
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId) return
      if (unit.type === 'legislative') {
        const bills = Object.values(unit.bills || {})
        bills.forEach((bill, i) => {
          acts.push({
            key: `phase3_bill_${unitId}_${i}`, phase: 3,
            icon: '🏛️', shortTitle: bill.title ? bill.title.slice(0, 6) : '법안',
            title: bill.title || '입법 법안', meta: '🏛️ 입법 · 3여정',
            content: bill.content || bill.body || '',
          })
        })
      }
      if (unit.type === 'executive') {
        acts.push({
          key: `phase3_executive_${unitId}`, phase: 3,
          icon: '🏢', shortTitle: unit.ministryName ? unit.ministryName.slice(0, 6) : '행정정책',
          title: unit.ministryName || '행정 정책', meta: '🏢 행정 · 3여정',
          content: unit.policyDraft || unit.finalPolicy || '',
        })
      }
      if (unit.type === 'judicial') {
        acts.push({
          key: `phase3_judicial_${unitId}`, phase: 3,
          icon: '⚖️', shortTitle: unit.role || '사법',
          title: unit.role ? `사법 — ${unit.role}` : '사법 활동', meta: '⚖️ 사법 · 3여정',
          content: unit.submission || unit.verdict || '',
        })
      }
    })
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 3) return
      acts.push({
        key: `phase3_article_${id}`, phase: 3,
        icon: '📰', shortTitle: a.title ? a.title.slice(0, 8) : '국정기사',
        title: a.title || '국정 기사', meta: '📰 기사 · 3여정',
        content: a.body || a.content || '',
      })
    })

    return acts
  }, [essays, posters, candidates, supports, articles, branchData, myStudentId, myGroupId])

  // Snake 행으로 분할
  const rows = useMemo(() => {
    const result = []
    for (let i = 0; i < activities.length; i += COLS) {
      result.push(activities.slice(i, i + COLS))
    }
    return result
  }, [activities])

  const totalRated = Object.values(ratings).filter((v) => v > 0).length

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="rounded-3xl p-5 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #6366f1 100%)' }}>
        <div className="absolute right-4 top-4 text-6xl opacity-10 select-none">🗺️</div>
        <h2 className="font-black text-xl mb-1">민국에서 나의 발자취 돌아보기</h2>
        <p className="text-pink-100 text-sm">
          1·2·3여정 내 활동들을 따라가며 각각 별점을 매겨 보세요. (나만 볼 수 있어요)
        </p>
        {activities.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 bg-white/20 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-yellow-300 transition-all duration-500"
                style={{ width: `${(totalRated / activities.length) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-white/80">
              {totalRated}/{activities.length}개 평가
            </span>
          </div>
        )}
      </div>

      {/* 여정 범례 */}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((p) => {
          const m = PHASE_META[p]
          return (
            <span key={p} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: m.bg, border: `1.5px solid ${m.border}`, color: m.text }}>
              {m.emoji} {m.label}
            </span>
          )
        })}
      </div>

      {/* Snake 경로 */}
      {activities.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">아직 활동 기록이 없어요.</p>
          <p className="text-sm mt-1">1~3 여정에서 작성한 글·포스터가 여기 표시됩니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6">
          {rows.map((row, rowIdx) => {
            const reversed = rowIdx % 2 === 1
            const displayRow = reversed ? [...row].reverse() : row
            const rowStart = rowIdx * COLS
            const turnDir = reversed ? 'left' : 'right'

            return (
              <div key={rowIdx}>
                {/* 여정 구분선 라벨 */}
                {(() => {
                  // 이 행에 새로운 여정이 시작되는지 확인
                  const labels = []
                  const seen = new Set()
                  row.forEach((act, i) => {
                    const globalIdx = rowStart + i
                    const prevPhase = globalIdx > 0 ? activities[globalIdx - 1]?.phase : null
                    if (act.phase !== prevPhase && !seen.has(act.phase)) {
                      seen.add(act.phase)
                      const m = PHASE_META[act.phase]
                      labels.push(
                        <div key={act.phase} className="flex items-center gap-1.5 mb-2">
                          <span className="text-base">{m.emoji}</span>
                          <span className="text-xs font-black" style={{ color: m.text }}>{m.label} — {m.sub}</span>
                          <div className="flex-1 h-px" style={{ background: m.border }} />
                        </div>
                      )
                    }
                  })
                  return labels
                })()}

                {/* 노드 행 */}
                <div className={`flex items-start ${reversed ? 'flex-row-reverse' : ''}`}>
                  {displayRow.map((act, colIdx) => {
                    const globalIdx = reversed
                      ? rowStart + (row.length - 1 - colIdx)
                      : rowStart + colIdx
                    return (
                      <div key={act.key} className="flex items-center" style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex flex-col items-center" style={{ flex: 1 }}>
                          <Node
                            act={act}
                            index={globalIdx}
                            ratings={ratings}
                            isActive={activeIdx === globalIdx}
                            onClick={(i) => setActiveIdx(activeIdx === i ? null : i)}
                          />
                        </div>
                        {/* 수평 연결선 */}
                        {colIdx < displayRow.length - 1 && (
                          <HConnector reversed={reversed} />
                        )}
                      </div>
                    )
                  })}
                  {/* 행이 COLS보다 짧으면 빈 공간으로 채움 */}
                  {row.length < COLS && Array.from({ length: COLS - row.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ flex: 1 }} />
                  ))}
                </div>

                {/* 행 사이 꺾임 커넥터 */}
                {rowIdx < rows.length - 1 && <SnakeConnector direction={turnDir} />}
              </div>
            )
          })}

          {/* 완료 깃발 */}
          <div className="flex justify-center mt-4">
            <span className="text-3xl animate-bounce">🏁</span>
          </div>
        </div>
      )}

      {/* 저장 중 표시 */}
      {savingKey && (
        <p className="text-center text-xs text-pink-500 animate-pulse">별점 저장 중...</p>
      )}

      {/* 전체 평가 완료 메시지 */}
      {totalRated > 0 && (
        <div className="rounded-xl border p-3 text-center text-sm font-semibold"
          style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}>
          ✓ 별점 {totalRated}개 저장됨 — 2단계에서 캔바 카드뉴스를 만들 때 참고하세요!
        </div>
      )}

      {/* 카드 모달 */}
      {activeIdx !== null && (
        <ActivityModal
          activities={activities}
          index={activeIdx}
          ratings={ratings}
          onRate={handleRate}
          onClose={() => setActiveIdx(null)}
          onPrev={() => setActiveIdx((i) => Math.max(0, i - 1))}
          onNext={() => setActiveIdx((i) => Math.min(activities.length - 1, i + 1))}
        />
      )}
    </div>
  )
}
