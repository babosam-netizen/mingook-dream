import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder, removeAt, subscribe, updateAt } from '../../lib/rtdb-helpers'
import MultiAxisRating from '../shared/MultiAxisRating'
import { EXECUTIVE_RATING_AXES } from './executiveBudgetData'

const STANCES = ['찬성', '반대', '중립']
const BUDGET_OPINIONS = ['유지', '증액', '감액', '재검토']

function ExecutivePolicyCommentBox({ policy, myGroupId }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNickname = useGameStore((s) => s.myNickname)
  const myNumber = useGameStore((s) => s.myNumber)
  const [commentsMap, setCommentsMap] = useState({})
  const [stance, setStance] = useState('중립')
  const [budgetOpinion, setBudgetOpinion] = useState('유지')
  const [suggestedBudget, setSuggestedBudget] = useState('')
  const [reason, setReason] = useState('')
  const [ratings, setRatings] = useState({ relevance: 0, feasibility: 0, publicGood: 0 })
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'executivePolicyComments', (d) => setCommentsMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const comments = useMemo(() => Object.entries(commentsMap)
    .map(([id, c]) => ({ id, ...c }))
    .filter((c) => c.policyId === policy.gid)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [commentsMap, policy.gid])
  const myComment = comments.find((c) => c.authorStudentId === myStudentId)
  const isMine = policy.gid === myGroupId
  const stats = STANCES.map((s) => ({ stance: s, count: comments.filter((c) => c.stance === s).length }))

  const startEdit = () => {
    if (!myComment) return
    setStance(myComment.stance || '중립')
    setBudgetOpinion(myComment.budgetOpinion || '유지')
    setSuggestedBudget(myComment.suggestedBudget ?? '')
    setReason(myComment.reason || '')
    setRatings(myComment.ratings || { relevance: 0, feasibility: 0, publicGood: 0 })
    setEditing(true)
  }

  const reset = () => {
    setStance('중립')
    setBudgetOpinion('유지')
    setSuggestedBudget('')
    setReason('')
    setRatings({ relevance: 0, feasibility: 0, publicGood: 0 })
    setEditing(false)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!reason.trim() || busy) return

    const confirmed = confirm('정말로 의견을 제출하시겠습니까?\n제출 후에는 찬/반 및 예산 의견을 수정하거나 삭제할 수 없습니다.')
    if (!confirmed) return

    setBusy(true)
    try {
      const payload = {
        policyId: policy.gid,
        targetGroupId: policy.groupId || policy.gid,
        authorStudentId: myStudentId,
        authorNickname: myNickname,
        authorNumber: myNumber,
        stance,
        budgetOpinion,
        suggestedBudget: suggestedBudget === '' ? null : Number(suggestedBudget) || 0,
        reason: reason.trim(),
        ratings,
        updatedAt: Date.now(),
      }
      await pushUnder(roomCode, 'executivePolicyComments', payload)
      reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-violet-100 pt-3">
      <div className="flex flex-wrap gap-2 text-[11px]">
        {stats.map((s) => (
          <span key={s.stance} className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-600">{s.stance} {s.count}</span>
        ))}
      </div>
      {role === 'student' && isMine && <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">우리 부처 정책에는 의견을 남기지 않고, 다른 부처 정책을 평가합니다.</p>}
      {role === 'student' && !isMine && !myComment && (
        <div className="space-y-2">
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-black px-3 py-1.5 rounded-lg text-center shadow-2xs">
            ⚠️ 신중하게 선택해 주세요. 제출 후에는 의견 및 찬/반을 수정하거나 삭제할 수 없습니다.
          </div>
          <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="grid sm:grid-cols-3 gap-2">
              <select value={stance} onChange={(e) => setStance(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
                {STANCES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select value={budgetOpinion} onChange={(e) => setBudgetOpinion(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm">
                {BUDGET_OPINIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <input type="number" min={0} value={suggestedBudget} onChange={(e) => setSuggestedBudget(e.target.value)} placeholder="제안 예산(억, 선택)" className="rounded-lg border px-2 py-1.5 text-sm" />
            </div>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="왜 그렇게 평가했나요? 정책과 예산을 함께 보고 이유를 적어 주세요." className="w-full resize-none rounded-lg border px-3 py-2 text-sm" />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <MultiAxisRating value={ratings} onChange={setRatings} compact axes={EXECUTIVE_RATING_AXES} />
              <button disabled={busy || !reason.trim()} className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40">의견 남기기</button>
            </div>
          </form>
        </div>
      )}
      {role === 'student' && !isMine && myComment && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black px-3 py-2 rounded-lg text-center animate-fade-in flex items-center justify-center gap-1.5 shadow-sm">
          <span>✓ 의견 제출 완료 (변경 및 삭제 불가)</span>
        </div>
      )}
      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="py-3 text-center text-sm text-slate-400">아직 온라인 정책토의 의견이 없습니다.</li>
        ) : comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-white p-3 text-xs shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 flex-wrap font-bold">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{c.stance}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">예산 {c.budgetOpinion}</span>
              {c.suggestedBudget !== null && c.suggestedBudget !== undefined && <span className="text-slate-500">제안 {c.suggestedBudget}억</span>}
              <span className="text-slate-400">{c.authorNumber}번 {c.authorNickname}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.reason}</p>
            <p className="mt-1 text-[10px] text-slate-400">
              관련 {c.ratings?.relevance || 0} · 실행 {c.ratings?.feasibility || 0} · 공익 {c.ratings?.publicGood || 0}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ExecutivePolicyDiscussionList() {
  const roomCode = useGameStore((s) => s.roomCode)
  const role = useGameStore((s) => s.role)
  const groups = useGameStore((s) => s.groups)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const branchConfig = useGameStore((s) => s.config?.branchConfig)
  const totalCap = branchConfig?.executive?.totalBudget ?? 100
  const [policies, setPolicies] = useState({})

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'policies', (d) => setPolicies(d || {}))
    return () => u?.()
  }, [roomCode])

  const myGroupId = useMemo(() => {
    if (!myStudentId) return null
    return Object.entries(groups || {}).find(([, g]) => g?.members?.[myStudentId])?.[0] || null
  }, [groups, myStudentId])

  const submitted = Object.entries(policies)
    .filter(([, p]) => ['saved', 'submitted', 'requested', 'adjusted', 'final'].includes(p?.status))
    .map(([gid, p]) => ({ gid, ...p }))
    .sort((a, b) => (b.submittedAt || b.updatedAt || 0) - (a.submittedAt || a.updatedAt || 0))

  const totalRequested = submitted.reduce((sum, p) => sum + (Number(p.requestedBudget ?? p.draftBudget) || 0), 0)
  const diff = totalRequested - totalCap
  const isExcess = diff > 0
  const pct = totalCap > 0 ? Math.round((totalRequested / totalCap) * 100) : 0

  if (submitted.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">아직 저장되거나 발의된 정책·예산안이 없습니다.</div>
  }

  return (
    <div className="space-y-4">
      {/* 상단 예산 현황 띠배너 */}
      <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-4 text-white shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-base md:text-lg font-black text-amber-300 flex items-center gap-1.5">
              <span>📊 실시간 부처별 예산 청구 합계 현황</span>
            </h3>
            <p className="text-xs text-white/70 mt-0.5">
              각 부처의 청구 예산 합계를 확인하며, 어느 부처 예산을 조정해야 할지 토의의 근거로 삼으세요.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-black/30 px-4 py-2 rounded-xl border border-white/10 flex-wrap">
            <div className="text-center">
              <span className="text-[10px] text-white/60 block font-bold">정부 총예산</span>
              <span className="text-sm md:text-base font-black text-white">{totalCap} 억원</span>
            </div>
            <div className="text-center border-l border-white/10 pl-4">
              <span className="text-[10px] text-white/60 block font-bold">청구 합계</span>
              <span className="text-sm md:text-base font-black text-indigo-300">{totalRequested} 억원</span>
            </div>
            <div className="text-center border-l border-white/10 pl-4">
              <span className="text-[10px] text-white/60 block font-bold">{isExcess ? '초과액' : '잔여액'}</span>
              <span className={`text-sm md:text-base font-black ${isExcess ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                {Math.abs(diff)} 억원 {isExcess ? '⚠️' : '✅'}
              </span>
            </div>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-bold text-white/80 px-0.5">
            <span>예산 소진율</span>
            <span className={isExcess ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>{pct}%</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isExcess ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>

      {submitted.map((p) => {
        const f = p.policyFields || {}
        const requested = Number(p.requestedBudget ?? p.draftBudget) || 0
        const budgetItems = Array.isArray(p.budgetItems) ? p.budgetItems : []
        const isSavedOnly = p.status === 'saved'
        return (
          <article key={p.gid} className="rounded-2xl border-2 border-violet-200 bg-white p-4 space-y-3">
            <header className="flex justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-black text-violet-950">🏢 {p.ministryName || p.groupName || '부처'} — {f.title || '집행계획명 미입력'}</h3>
                <p className="text-xs text-slate-500">청구 예산 {requested}억 · 초안 {p.draftBudget || 0}억</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${isSavedOnly ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                {p.status === 'requested' ? '청구 확정' : isSavedOnly ? '시행령 저장 (발의 대기중)' : '정책·예산안 발의'}
              </span>
            </header>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              {f.linkedBillTitle && (
                <div className="rounded-xl bg-indigo-50 p-3 md:col-span-2"><b className="text-indigo-800">근거 법령</b><p className="whitespace-pre-wrap">{f.linkedBillTitle}</p></div>
              )}
              <div className="rounded-xl bg-amber-50 p-3"><b className="text-amber-800">문제</b><p className="whitespace-pre-wrap">{f.problem}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><b className="text-sky-800">대상</b><p className="whitespace-pre-wrap">{f.targetCitizens || '미입력'}</p></div>
              <div className="rounded-xl bg-violet-50 p-3 md:col-span-2"><b className="text-violet-800">집행계획</b><p className="whitespace-pre-wrap">{f.content}</p></div>
              <div className="rounded-xl bg-fuchsia-50 p-3 md:col-span-2"><b className="text-fuchsia-800">시행령 초안</b><p className="whitespace-pre-wrap">{f.ordinance || '미입력'}</p></div>
              {(f.evidence || f.publicConcern || f.publicResponse || f.expectedEffect) && (
                <div className="rounded-xl bg-amber-50 p-3 md:col-span-2">
                  <b className="text-amber-800">국민 눈높이 반영</b>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">필요 근거 및 사례: </span>{f.evidence || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">예상 피해/손해: </span>{f.publicConcern || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">대응: </span>{f.publicResponse || '미입력'}</p>
                  <p className="mt-1 whitespace-pre-wrap"><span className="font-bold">기대 효과/홍보: </span>{f.expectedEffect || '미입력'}</p>
                </div>
              )}
              {budgetItems.length > 0 && (
                <div className="rounded-xl bg-lime-50 p-3 md:col-span-2">
                  <b className="text-lime-800">예산 항목</b>
                  <ul className="mt-1 space-y-1">
                    {budgetItems.map((item, idx) => (
                      <li key={item.id || idx} className="text-xs text-slate-700">- {item.title || `항목 ${idx + 1}`}: <b>{Number(item.amount) || 0}억</b>{item.note ? ` · ${item.note}` : ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {isSavedOnly ? (
              (() => {
                const myGroup = groups?.[myGroupId]
                const isEvaluator = myGroup?.name?.includes('평가단') || myGroup?.name?.includes('대통령') || role === 'teacher' || role === 'evaluator'
                if (isEvaluator) {
                  return (
                    <div className="space-y-2 pt-2 border-t border-violet-100">
                      <div className="rounded-xl bg-amber-100 p-3 text-xs text-amber-900 font-bold border border-amber-300">
                        👑 현재 [저장 (발의 대기)] 상태입니다. 평가단 및 대통령 모둠은 사전에 열람하고 의견을 제시할 수 있습니다.
                      </div>
                      <ExecutivePolicyCommentBox policy={p} myGroupId={myGroupId} />
                    </div>
                  )
                }
                return (
                  <div className="rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-500 font-bold border border-slate-200">
                    🔒 해당 부처가 시행령과 예산안을 저장했습니다. [정책 제출]과 [예산안 제출]이 모두 완료되면 일반 부처의 평가 및 의견 작성이 활성화됩니다. (평가단은 사전 열람 중)
                  </div>
                )
              })()
            ) : (
              <ExecutivePolicyCommentBox policy={p} myGroupId={myGroupId} />
            )}
          </article>
        )
      })}
    </div>
  )
}

export default ExecutivePolicyDiscussionList
