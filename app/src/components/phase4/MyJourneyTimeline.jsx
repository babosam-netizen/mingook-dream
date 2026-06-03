import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'

/**
 * 1단계: 나의 여정 타임라인 + 별점 자율평가
 * - 1·2·3 여정에서 본인이 작성한 글/활동을 여정별 타임라인으로 표시
 * - 각 활동 카드에 ⭐1~5 별점 자율 평가 → students/{id}/journeyRatings 에 저장
 */

const PHASE_COLORS = {
  1: { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-400',  line: 'bg-amber-200', title: 'text-amber-800', label: '첫 번째 여정', sub: '시민 광장', emoji: '🏙️' },
  2: { bg: 'bg-rose-50',   border: 'border-rose-200',  badge: 'bg-rose-100 text-rose-800',    dot: 'bg-rose-400',   line: 'bg-rose-200',   title: 'text-rose-800',  label: '두 번째 여정', sub: '선거',    emoji: '🗳️' },
  3: { bg: 'bg-slate-50',  border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700',  dot: 'bg-slate-400',  line: 'bg-slate-200',  title: 'text-slate-800', label: '세 번째 여정', sub: '국정 포털', emoji: '🏛️' },
}

function StarRating({ value = 0, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          className="text-lg transition-transform hover:scale-125 focus:outline-none"
          title={`${n}점`}
        >
          <span className={(hover || value) >= n ? 'text-yellow-400' : 'text-gray-300'}>
            ★
          </span>
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-gray-500 self-center">{value}점</span>
      )}
    </div>
  )
}

function ActivityCard({ phase, activityKey, title, meta, content, rating, onRate }) {
  const c = PHASE_COLORS[phase]
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-3 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1 ${c.badge}`}>
            {meta}
          </span>
          <p className="font-semibold text-sm text-gray-800 leading-tight">{title}</p>
        </div>
        <StarRating value={rating} onChange={(v) => onRate(activityKey, v)} />
      </div>

      {content && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            {open ? '▲ 내용 접기' : '▼ 내용 펼치기'}
          </button>
          {open && (
            <p className="text-xs text-gray-700 whitespace-pre-wrap bg-white/60 rounded-lg p-2 border border-white/80">
              {content}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function PhaseSection({ phase, activities, ratings, onRate }) {
  const c = PHASE_COLORS[phase]
  if (!activities.length) return null

  return (
    <section>
      {/* 여정 헤더 */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full ${c.dot} flex items-center justify-center text-xl shadow`}>
          {c.emoji}
        </div>
        <div>
          <p className={`font-black text-base ${c.title}`}>{c.label}</p>
          <p className="text-xs text-gray-500">{c.sub}</p>
        </div>
        <div className="flex-1 h-0.5 rounded-full ml-2" style={{ background: `var(--tw-${c.line})` }} />
      </div>

      {/* 활동 카드 목록 */}
      <div className="ml-5 pl-3 border-l-2 border-dashed border-gray-200 space-y-3 pb-2">
        {activities.map((act) => (
          <ActivityCard
            key={act.key}
            phase={phase}
            activityKey={act.key}
            title={act.title}
            meta={act.meta}
            content={act.content}
            rating={ratings[act.key] || 0}
            onRate={onRate}
          />
        ))}
      </div>
    </section>
  )
}

export default function MyJourneyTimeline() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const groups = useGameStore((s) => s.groups)

  // 내 그룹 찾기
  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  // 여정 데이터
  const [essays, setEssays] = useState({})
  const [posters, setPosters] = useState({})
  const [candidates, setCandidates] = useState({})
  const [supports, setSupports] = useState({})
  const [articles, setArticles] = useState({})
  const [branchData, setBranchData] = useState({})
  const [ratings, setRatings] = useState({})
  const [savingKey, setSavingKey] = useState(null)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'essays',             (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',            (d) => setPosters(d || {})),
      subscribe(roomCode, 'candidates',         (d) => setCandidates(d || {})),
      subscribe(roomCode, 'supportStatements',  (d) => setSupports(d || {})),
      subscribe(roomCode, 'articles',           (d) => setArticles(d || {})),
      subscribe(roomCode, 'branchUnits',        (d) => setBranchData(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  // 별점 초기 로드
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}/journeyRatings`).then((d) => {
      if (d) setRatings(d)
    })
  }, [roomCode, myStudentId])

  // 별점 저장
  const handleRate = async (key, value) => {
    setSavingKey(key)
    const next = { ...ratings, [key]: value }
    setRatings(next)
    await updateAt(roomCode, `students/${myStudentId}`, { journeyRatings: next })
    setSavingKey(null)
  }

  // ── 1여정: 내 에세이 + 내 포스터
  const phase1Activities = useMemo(() => {
    const acts = []

    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`,
        title: e.title || '주장하는 글',
        meta: '📝 주장하는 글 · 1여정',
        content: [e.claim, e.evidence, e.impact].filter(Boolean).join('\n\n'),
      })
    })

    Object.entries(posters).forEach(([id, p]) => {
      // 포스터는 그룹 단위 — 내 그룹 것만
      if (!myGroupId || p.groupId !== myGroupId) return
      // 포스터 작성자 필터 (authorStudentId 있는 경우)
      if (p.authorStudentId && p.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_poster_${id}`,
        title: p.title || p.caption || '포스터',
        meta: '🖼️ 포스터 · 1여정',
        content: p.caption || p.description || '',
      })
    })

    return acts
  }, [essays, posters, myStudentId, myGroupId])

  // ── 2여정: 내 그룹 후보등록, 내 지지선언문, 내 기사
  const phase2Activities = useMemo(() => {
    const acts = []

    // 후보 등록 (내 그룹)
    if (myGroupId && candidates[myGroupId]) {
      const c = candidates[myGroupId]
      acts.push({
        key: 'phase2_candidate',
        title: c.candidateName ? `후보: ${c.candidateName}` : '후보 등록',
        meta: '🗳️ 후보 등록 · 2여정',
        content: c.pledge || c.manifesto || '',
      })
    }

    // 내 지지 선언문
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`,
        title: '지지 선언문',
        meta: '📣 지지 선언문 · 2여정',
        content: s.content || s.statement || '',
      })
    })

    // 2여정 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId) return
      if (a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`,
        title: a.title || '선거 기사',
        meta: '📰 기사 · 2여정',
        content: a.body || a.content || '',
      })
    })

    return acts
  }, [candidates, supports, articles, myStudentId, myGroupId])

  // ── 3여정: 브랜치 활동 + 3여정 기사
  const phase3Activities = useMemo(() => {
    const acts = []

    // 브랜치 유닛 (입법/행정/사법) — 내 그룹 관련
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId) return
      if (unit.type === 'legislative') {
        const bills = Object.values(unit.bills || {})
        bills.forEach((bill, i) => {
          acts.push({
            key: `phase3_bill_${unitId}_${i}`,
            title: bill.title || '법안',
            meta: '🏛️ 입법 법안 · 3여정',
            content: bill.content || bill.body || '',
          })
        })
      }
      if (unit.type === 'executive') {
        acts.push({
          key: `phase3_executive_${unitId}`,
          title: unit.ministryName || '부처 정책',
          meta: '🏢 행정 정책 · 3여정',
          content: unit.policyDraft || unit.finalPolicy || '',
        })
      }
      if (unit.type === 'judicial') {
        acts.push({
          key: `phase3_judicial_${unitId}`,
          title: unit.role ? `사법 — ${unit.role}` : '사법 활동',
          meta: '⚖️ 사법 활동 · 3여정',
          content: unit.submission || unit.verdict || '',
        })
      }
    })

    // 3여정 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId) return
      if (a.phase !== 3) return
      acts.push({
        key: `phase3_article_${id}`,
        title: a.title || '국정 기사',
        meta: '📰 기사 · 3여정',
        content: a.body || a.content || '',
      })
    })

    return acts
  }, [branchData, articles, myStudentId, myGroupId])

  const totalRated = Object.values(ratings).filter((v) => v > 0).length
  const totalActivities = phase1Activities.length + phase2Activities.length + phase3Activities.length

  return (
    <div className="space-y-6">
      {/* 안내 헤더 */}
      <div className="bg-gradient-to-r from-pink-50 to-violet-50 rounded-2xl p-4 border border-pink-200">
        <h2 className="font-black text-pink-800 text-lg mb-1">📅 나의 여정 타임라인</h2>
        <p className="text-sm text-gray-600">
          1·2·3여정에서 내가 직접 쓰고 만든 활동들이에요.
          각 활동에 <strong>별점(⭐1~5)</strong>을 매겨 보세요. 별점은 나만 볼 수 있어요.
        </p>
        {totalActivities > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-pink-400 transition-all duration-500"
                style={{ width: `${totalActivities ? (totalRated / totalActivities) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">
              {totalRated} / {totalActivities}개 평가
            </span>
          </div>
        )}
      </div>

      {/* 여정별 섹션 */}
      {totalActivities === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold">아직 불러올 활동이 없어요.</p>
          <p className="text-sm mt-1">1~3 여정에서 작성한 글이나 포스터가 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <PhaseSection phase={1} activities={phase1Activities} ratings={ratings} onRate={handleRate} />
          <PhaseSection phase={2} activities={phase2Activities} ratings={ratings} onRate={handleRate} />
          <PhaseSection phase={3} activities={phase3Activities} ratings={ratings} onRate={handleRate} />
        </div>
      )}

      {savingKey && (
        <p className="text-center text-xs text-pink-500 animate-pulse">별점 저장 중...</p>
      )}

      {totalRated > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-sm text-emerald-700 font-semibold">
            ✓ 별점 {totalRated}개 저장됨 — 2단계에서 캔바 카드뉴스를 만들 때 참고하세요!
          </p>
        </div>
      )}
    </div>
  )
}
