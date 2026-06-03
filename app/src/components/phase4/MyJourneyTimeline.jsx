import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'
import PosterMedia from '../phase1/PosterMedia'
import { calculateRanks } from '../../lib/election'

/**
 * 1단계: 민국에서 나의 발자취 돌아보기
 * - 학생이 수행하여 '학생 분석'에 수집되는 활동들을 1->2->3여정 단계 순서대로 노드로 시각화
 * - 꼬불꼬불(snake) 경로 위에 활동 노드 배치
 * - 노드 클릭 → 카드 모달(활동 전체 펼침 + 우측 상단 별점 + 이전/다음 네비게이션)
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
    <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
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
function ActivityModal({ activities, index, ratings, onRate, onClose, onPrev, onNext, myStudentId, candidatesMap, groups }) {
  const act = activities[index]
  if (!act) return null
  const meta = PHASE_META[act.phase]

  // 키보드 ESC
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative z-10 w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: meta.bg, border: `3px solid ${meta.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 헤더 & 별점 영역 */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100/50 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-2xl">{act.icon || meta.emoji}</span>
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase border shadow-sm"
                style={{ background: meta.color + '15', borderColor: meta.color + '44', color: meta.color }}>
                {meta.label} · {act.stepLabel}
              </span>
            </div>
            <h3 className="font-black text-base md:text-lg leading-snug animate-in fade-in duration-350" style={{ color: meta.text }}>
              {act.title}
            </h3>
          </div>
          
          {/* 우측 상단 별점 + 닫기 영역 */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {/* 별점 컴포넌트 */}
              <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-2xl border border-gray-200/50 shadow-sm flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-gray-500 leading-none">별점 평가</span>
                <Stars value={ratings[act.key] || 0} onChange={(v) => onRate(act.key, v)} size="md" />
              </div>
              
              {/* 닫기 버튼 */}
              <button onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold text-sm shadow-sm transition active:scale-95">
                ✕
              </button>
            </div>
            {ratings[act.key] > 0 && (
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50 animate-bounce">
                평가함: ⭐{ratings[act.key]}점
              </span>
            )}
          </div>
        </div>

        {/* 중앙 본문 (전체 펼침 상태 및 시각화 지원) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          
          {/* 1. 포스터인 경우 미디어 미리보기 */}
          {act.type === 'poster' && act.poster && (
            <div className="rounded-2xl overflow-hidden shadow border bg-white aspect-[4/3] relative">
              <PosterMedia 
                poster={act.poster} 
                className="w-full h-full"
                imageClassName="w-full h-full object-contain bg-slate-50"
              />
            </div>
          )}

          {/* 2. 링크(뉴스/영상/캔바)인 경우 카드 형태 시각화 */}
          {act.type === 'link' && act.link && (() => {
            const l = act.link
            const isCanva = l.url && l.url.toLowerCase().includes('canva.')
            return (
              <div className="space-y-3">
                {/* 캔바 임베드 또는 썸네일 지원 */}
                {isCanva ? (
                  <div className="rounded-2xl overflow-hidden shadow border bg-slate-50 aspect-[4/3] relative">
                    <PosterMedia 
                      poster={{ posterCanvaUrl: l.url }} 
                      className="w-full h-full"
                    />
                  </div>
                ) : l.thumbnail ? (
                  <img src={l.thumbnail} alt="기사 썸네일" className="w-full h-40 object-cover rounded-2xl shadow-sm border bg-white" />
                ) : null}

                <div className="bg-white/85 p-4 rounded-2xl border flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-2 py-0.5 rounded-full">
                      {l.type === 'news' ? '📰 신문기사' : '🎬 영상·캔바'}
                    </span>
                    {l.source && (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        출처: {l.source}
                      </span>
                    )}
                  </div>
                  
                  <a href={l.url} target="_blank" rel="noreferrer" 
                    className="text-xs font-black text-blue-600 hover:underline break-all flex items-center gap-1">
                    🔗 원본 자료 링크 바로가기 ↗
                  </a>
                </div>
              </div>
            )
          })()}

          {/* 3. 설문 여론조사 결과 시각화 (나의 선택 + 전체 결과) */}
          {act.type === 'poll' && act.rawPoll && (() => {
            const p = act.rawPoll
            const votes = p.votes || {}
            const totalVotes = Object.keys(votes).length
            const normalizedOptions = (p.options || []).map((opt, index) => {
              if (typeof opt === 'string') return { id: `opt_${index}`, label: opt }
              return { id: opt.id || `opt_${index}`, label: opt.label || opt.id || '' }
            })
            
            const counts = {}
            Object.values(votes).forEach((v) => {
              if (v?.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1
            })

            const myVoteData = votes[myStudentId]
            const myVoteId = myVoteData?.optionId

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>📊 전체 설문 조사 결과</span>
                  <span>총 {totalVotes}명 참여</span>
                </div>
                <div className="space-y-3.5">
                  {normalizedOptions.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myVoteId === o.id
                    return (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                            {o.label} {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded font-black ml-1">내 선택</span>}
                          </span>
                          <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                        </div>
                        <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border">
                          <div className="h-full bg-indigo-400 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 4. 토론 여론조사 (사전/사후) 비교 시각화 */}
          {act.type === 'debate_poll' && act.debateSession && (() => {
            const s = act.debateSession
            const prePoll = s.stancePoll?.pre || {}
            const postPoll = s.stancePoll?.post || {}
            
            const baseOptions = Array.isArray(prePoll.options) && prePoll.options.length 
              ? prePoll.options 
              : ['찬성', '반대', '중립']
            const options = baseOptions.map(o => typeof o === 'string' ? o : o.label || o.id || '')

            const preVotes = prePoll.votes || {}
            const postVotes = postPoll.votes || {}
            const preTotal = Object.keys(preVotes).length
            const postTotal = Object.keys(postVotes).length

            const preCounts = {}
            const postCounts = {}
            options.forEach(o => { preCounts[o] = 0; postCounts[o] = 0 })

            Object.values(preVotes).forEach(v => { if (v?.option && preCounts[v.option] !== undefined) preCounts[v.option]++ })
            Object.values(postVotes).forEach(v => { if (v?.option && postCounts[v.option] !== undefined) postCounts[v.option]++ })

            const myPre = preVotes[myStudentId]?.option || null
            const myPost = postVotes[myStudentId]?.option || null
            const postReason = postVotes[myStudentId]?.reason || ''

            const STANCE_COLOR_MAP = {
              '찬성': 'bg-emerald-500', '유죄': 'bg-emerald-500',
              '반대': 'bg-rose-500', '무죄': 'bg-rose-500',
              '중립': 'bg-slate-400', '기타': 'bg-slate-400'
            }

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 토론 전 */}
                  <div className="bg-white/80 border p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                      <span>🗳️ 토론 전 입장</span>
                      <span>참여 {preTotal}명</span>
                    </div>
                    <div className="space-y-3">
                      {options.map((o) => {
                        const cnt = preCounts[o] || 0
                        const pct = preTotal ? Math.round((cnt / preTotal) * 100) : 0
                        const isMine = myPre === o
                        return (
                          <div key={o} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                                {o} {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded ml-1">내 선택</span>}
                              </span>
                              <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                            </div>
                            <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border">
                              <div className={`h-full ${STANCE_COLOR_MAP[o] || 'bg-indigo-400'} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 토론 후 */}
                  <div className="bg-white/80 border p-4 rounded-2xl space-y-3 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                      <span>🗳️ 토론 후 입장</span>
                      <span>참여 {postTotal}명</span>
                    </div>
                    <div className="space-y-3">
                      {options.map((o) => {
                        const cnt = postCounts[o] || 0
                        const pct = postTotal ? Math.round((cnt / postTotal) * 100) : 0
                        const isMine = myPost === o
                        return (
                          <div key={o} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                              <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                                {o} {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded ml-1">내 선택</span>}
                              </span>
                              <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                            </div>
                            <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border">
                              <div className={`h-full ${STANCE_COLOR_MAP[o] || 'bg-indigo-400'} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* 내 생각 변화 요약 */}
                {myPost && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-800">📊 내 생각의 변화</h4>
                    <div className="flex items-center gap-2 text-sm justify-center py-1">
                      <div className="bg-white px-4 py-2 rounded-xl border font-bold text-gray-600 text-center min-w-[100px]">
                        <span className="block text-[9px] text-gray-400 font-bold mb-0.5">토론 전</span>
                        {myPre || '미참여'}
                      </div>
                      <span className="text-indigo-400 font-bold text-xl">→</span>
                      <div className="bg-white px-4 py-2 rounded-xl border border-indigo-300 font-black text-indigo-700 text-center min-w-[100px] shadow-sm">
                        <span className="block text-[9px] text-indigo-400 font-bold mb-0.5">토론 후</span>
                        {myPost}
                      </div>
                    </div>
                    {myPre && myPre !== myPost && (
                      <p className="text-[10px] text-emerald-600 text-center font-black animate-pulse">
                        🔄 토론을 통해 생각이 바뀌었어요!
                      </p>
                    )}
                    {postReason && (
                      <div className="bg-white/80 p-3 rounded-xl border text-xs text-gray-600 mt-2 leading-relaxed">
                        <span className="font-bold text-indigo-800 block mb-1">💡 작성했던 생각(이유):</span>
                        "{postReason}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* 5. 대통령 선거 투표 결과 시각화 */}
          {act.type === 'election' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const totalVotes = Object.keys(votes).length
            const ranks = calculateRanks(candidatesMap || {}, votes)
            const myVoteGroupId = votes[myStudentId]?.candidateGroupId

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>🏆 대통령 선거 득표 현황</span>
                  <span>총 투표수 {totalVotes}표</span>
                </div>
                <div className="space-y-4">
                  {ranks.map((r, idx) => {
                    const pct = totalVotes ? Math.round((r.count / totalVotes) * 100) : 0
                    const isMine = myVoteGroupId === r.groupId
                    const isWinner = idx === 0 && r.count > 0
                    const group = groups?.[r.groupId]
                    
                    return (
                      <div key={r.groupId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                            {isWinner && '👑 '}
                            {r.candidateNumber}번 {r.leaderNickname} 후보 ({group?.name || '후보'})
                            {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded ml-1 font-black">내 투표</span>}
                          </span>
                          <span className="font-mono text-gray-500">{r.count}표 ({pct}%)</span>
                        </div>
                        <div className="relative w-full h-3.5 bg-gray-100 rounded-full overflow-hidden border">
                          <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 6. 의회 법안 의결 표결 결과 시각화 */}
          {act.type === 'billvote' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const myChoice = votes[myStudentId]
            const totalVotes = Object.keys(votes).length
            
            const counts = { pro: 0, con: 0, abstain: 0 }
            Object.values(votes).forEach(v => {
              if (counts[v] !== undefined) counts[v]++
            })

            const options = [
              { id: 'pro', label: '✅ 찬성', bg: 'bg-emerald-500' },
              { id: 'con', label: '❌ 반대', bg: 'bg-rose-500' },
              { id: 'abstain', label: '⚪ 기권', bg: 'bg-slate-400' },
            ]

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>🏛️ 법안 표결 집계</span>
                  <span>총 {totalVotes}표</span>
                </div>
                <div className="space-y-3">
                  {options.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myChoice === o.id
                    return (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                            {o.label} {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded ml-1 font-black">내 투표</span>}
                          </span>
                          <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                        </div>
                        <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border">
                          <div className={`h-full ${o.bg} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 7. 재판 배심원 표결 결과 시각화 */}
          {act.type === 'juryvote' && act.rawVotes && (() => {
            const votes = act.rawVotes
            const myChoice = votes[myStudentId]
            const totalVotes = Object.keys(votes).length

            const counts = { pro: 0, con: 0 }
            Object.values(votes).forEach(v => {
              if (counts[v] !== undefined) counts[v]++
            })

            const options = [
              { id: 'pro', label: '⚖️ 유죄', bg: 'bg-amber-500' },
              { id: 'con', label: '🛡️ 무죄', bg: 'bg-sky-500' },
            ]

            return (
              <div className="bg-white/80 border p-5 rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold border-b pb-2">
                  <span>⚖️ 배심원 평결 집계</span>
                  <span>총 {totalVotes}표</span>
                </div>
                <div className="space-y-3">
                  {options.map((o) => {
                    const cnt = counts[o.id] || 0
                    const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0
                    const isMine = myChoice === o.id
                    return (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span className={isMine ? 'text-indigo-600 font-black' : ''}>
                            {o.label} {isMine && <span className="text-[9px] bg-indigo-50 border border-indigo-200/50 text-indigo-700 px-1 py-0.5 rounded ml-1 font-black">내 투표</span>}
                          </span>
                          <span className="font-mono text-gray-500">{cnt}표 ({pct}%)</span>
                        </div>
                        <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden border">
                          <div className={`h-full ${o.bg} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* 8. 일반 텍스트 콘텐츠 */}
          {act.content ? (
            <div className="rounded-2xl p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-inner border border-gray-100 max-h-[30vh] overflow-y-auto"
              style={{ background: 'rgba(255,255,255,0.75)' }}>
              {act.content}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs">
              상세 활동 내용이 없습니다.
            </div>
          )}
        </div>

        {/* 하단 네비게이션 */}
        <div className="px-6 pb-6 pt-3 flex items-center justify-between gap-4 border-t border-gray-100/50 bg-white/30">
          <button onClick={onPrev} disabled={index === 0}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-2xl text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none hover:brightness-95 active:scale-[0.98]"
            style={{ background: meta.color + '15', color: meta.color }}>
            ← 이전 활동
          </button>
          
          <span className="text-xs font-bold text-gray-500 shrink-0 bg-white/60 px-3 py-1.5 rounded-full border">
            {index + 1} / {activities.length}
          </span>
          
          <button onClick={onNext} disabled={index === activities.length - 1}
            className="flex-1 flex items-center justify-center gap-1 py-3 rounded-2xl text-xs font-black transition disabled:opacity-30 disabled:pointer-events-none hover:brightness-95 active:scale-[0.98]"
            style={{ background: meta.color + '15', color: meta.color }}>
            다음 활동 →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Snake 경로 커넥터 (행 사이 U/N 곡선)
function SnakeConnector({ direction }) {
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
        {/* 별점 표시 (알약 모양 ⭐ 뱃지) */}
        {score > 0 && (
          <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-yellow-400 text-white text-[9px] font-black flex items-center gap-0.5 shadow-md border border-white animate-pulse">
            ⭐{score}
          </span>
        )}
      </button>

      {/* 짧은 제목 */}
      <span className="text-[10px] text-center text-gray-600 font-bold leading-tight max-w-[64px] line-clamp-2">
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
  const candidatesMap = useGameStore((s) => s.candidates) || {}

  const myGroupId = useMemo(() => {
    for (const [gid, g] of Object.entries(groups || {})) {
      if (g?.members?.[myStudentId]) return gid
    }
    return null
  }, [groups, myStudentId])

  const [essays,          setEssays]          = useState({})
  const [posters,         setPosters]         = useState({})
  const [candidates,      setCandidates]      = useState({})
  const [supports,        setSupports]        = useState({})
  const [articles,        setArticles]        = useState({})
  const [branchData,      setBranchData]      = useState({})
  const [links,           setLinks]           = useState({})
  const [polls,           setPolls]           = useState({})
  const [pollReasons,     setPollReasons]     = useState({})
  const [electionVotes,   setElectionVotes]   = useState({})
  const [billVotes,       setBillVotes]       = useState({})
  const [juryVotes,       setJuryVotes]       = useState({})
  const [debateSessions,  setDebateSessions]  = useState({})
  const [ratings,         setRatings]         = useState({})
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
      subscribe(roomCode, 'links',             (d) => setLinks(d || {})),
      subscribe(roomCode, 'polls',             (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons',     (d) => setPollReasons(d || {})),
      subscribe(roomCode, 'electionVotes',     (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'billVotes',         (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes',         (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'debateSessions',    (d) => setDebateSessions(d || {})),
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

    // ── 1여정 (첫 번째 여정 - 시민 광장) ──
    
    // 1-1. 슬로건
    Object.entries(groups || {}).forEach(([gid, g]) => {
      const ss = g?.slogans || {}
      Object.entries(ss).forEach(([sid, s]) => {
        if (s?.authorStudentId === myStudentId) {
          acts.push({
            key: `phase1_slogan_${gid}_${sid}`,
            phase: 1,
            type: 'slogan',
            icon: '💬',
            shortTitle: '슬로건',
            stepLabel: '슬로건 제출',
            title: `시민광장 슬로건`,
            content: `내가 제출한 슬로건:\n"${s.text}"`
          })
        }
      })
    })

    // 1-2. 주장하는 글 (에세이)
    Object.entries(essays).forEach(([id, e]) => {
      if (e.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase1_essay_${id}`, phase: 1,
        type: 'essay',
        icon: '📝', shortTitle: '주장글',
        stepLabel: '나의 주장글(에세이) 작성',
        title: e.title || '주장하는 글',
        content: [
          e.claim ? `[주장] ${e.claim}` : '',
          e.evidence ? `[근거] ${e.evidence}` : '',
          e.impact ? `[해결 방안 및 기대 효과] ${e.impact}` : ''
        ].filter(Boolean).join('\n\n'),
      })
    })

    // 1-3. 포스터
    Object.entries(posters).forEach(([id, p]) => {
      if (p.authorStudentId !== myStudentId && (!myGroupId || p.groupId !== myGroupId)) return
      const isMyUpload = p.authorStudentId === myStudentId
      acts.push({
        key: `phase1_poster_${id}`, phase: 1,
        type: 'poster',
        poster: p,
        icon: '🖼️', shortTitle: isMyUpload ? '내포스터' : '모둠포스터',
        stepLabel: isMyUpload ? '내 포스터 제작' : '모둠 포스터 제작',
        title: p.title || p.caption || (isMyUpload ? '내가 올린 포스터' : '우리 모둠 포스터'), 
        content: p.caption || p.description || '',
      })
    })

    // 1-4. 시민광장 설문조사 투표 및 사유
    Object.entries(polls).forEach(([pid, p]) => {
      const isPhase1 = pid.startsWith('phase1') || (typeof p?.tag === 'string' && p.tag.includes('시민'))
      if (!isPhase1) return
      const v = p?.votes?.[myStudentId]
      if (!v) return

      const optIdx = parseInt(v.optionId?.replace('opt_', '') || '', 10)
      const opt = p.options?.[optIdx] || p.options?.[v.optionId]
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.id || v.optionId)
      const reason = pollReasons[pid]?.[myStudentId] || ''

      acts.push({
        key: `phase1_poll_${pid}`, phase: 1,
        type: 'poll',
        rawPoll: p,
        icon: '📊', shortTitle: '설문투표',
        stepLabel: '시민 여론조사 투표',
        title: p.question || '시민광장 설문조사',
        content: reason ? `[선택 이유]\n${reason}` : '',
      })
    })

    // ── 2여정 (두 번째 여정 - 선거) ──

    // 2-1. 후보 등록
    if (myGroupId && candidates[myGroupId]) {
      const c = candidates[myGroupId]
      acts.push({
        key: 'phase2_candidate', phase: 2,
        type: 'candidate',
        icon: '🗳️', shortTitle: '후보등록',
        stepLabel: '대통령 후보 등록',
        title: c.candidateName ? `후보: ${c.candidateName}` : '후보 등록',
        content: `[대표 공약]\n${c.pledge || c.manifesto || ''}`,
      })
    }

    // 2-2. 지지 선언문
    Object.entries(supports).forEach(([id, s]) => {
      if (s.authorStudentId !== myStudentId) return
      acts.push({
        key: `phase2_support_${id}`, phase: 2,
        type: 'support',
        icon: '📣', shortTitle: '지지선언',
        stepLabel: '대통령 후보 지지선언문',
        title: '대통령 후보 지지 선언문',
        content: s.content || s.statement || '',
      })
    })

    // 2-3. 선거 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 2) return
      acts.push({
        key: `phase2_article_${id}`, phase: 2,
        type: 'article',
        icon: '📰', shortTitle: '선거기사',
        stepLabel: '선거 보도 기사 작성',
        title: a.title || '선거 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 2-4. 대통령 선거 투표 참여
    if (electionVotes[myStudentId]) {
      acts.push({
        key: 'phase2_election', phase: 2,
        type: 'election',
        rawVotes: electionVotes,
        icon: '🗳️', shortTitle: '대선투표',
        stepLabel: '대통령 선거 투표',
        title: '대통령 선거 투표 참여',
        content: '대한민국 제1대 대통령 선거 투표에 참여하였습니다.',
      })
    }

    // 2-5. 공유 뉴스 기사 (type: news인 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type !== 'news') return
      acts.push({
        key: `phase2_news_${id}`, phase: 2,
        type: 'link',
        link: l,
        icon: '🔗', shortTitle: '뉴스공유',
        stepLabel: '선거 관련 뉴스 공유',
        title: l.title || '공유한 뉴스기사',
        content: l.summary ? `[요약]\n${l.summary}` : '',
      })
    })

    // ── 3여정 (세 번째 여정 - 국정 포털) ──

    // 3-1. 입법 법안
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'legislative') return
      const bills = Object.values(unit.bills || {})
      bills.forEach((bill, i) => {
        acts.push({
          key: `phase3_bill_${unitId}_${i}`, phase: 3,
          type: 'bill',
          icon: '🏛️', shortTitle: '제안법안',
          stepLabel: '의회 법안 발의',
          title: bill.title || '입법부 제안 법안',
          content: bill.content || bill.body || '',
        })
      })
    })

    // 3-2. 행정 정책
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'executive') return
      acts.push({
        key: `phase3_executive_${unitId}`, phase: 3,
        type: 'policy',
        icon: '🏢', shortTitle: '행정정책',
        stepLabel: '행정부 국정 정책 수립',
        title: unit.ministryName || '행정부 정책 수립',
        content: `[수립 정책]\n${unit.policyDraft || unit.finalPolicy || ''}`,
      })
    })

    // 3-3. 사법 활동
    Object.entries(branchData).forEach(([unitId, unit]) => {
      if (!unit || unit.groupId !== myGroupId || unit.type !== 'judicial') return
      acts.push({
        key: `phase3_judicial_${unitId}`, phase: 3,
        type: 'judicial',
        icon: '⚖️', shortTitle: '사법활동',
        stepLabel: '사법부 재판/활동',
        title: unit.role ? `사법부 활동 (${unit.role})` : '사법부 재판/활동',
        content: unit.submission || unit.verdict || '',
      })
    })

    // 3-4. 국정 기사
    Object.entries(articles).forEach(([id, a]) => {
      if (a.authorStudentId !== myStudentId || a.phase !== 3) return
      acts.push({
        key: `phase3_article_${id}`, phase: 3,
        type: 'article',
        icon: '📰', shortTitle: '국정기사',
        stepLabel: '국정 기사 보도',
        title: a.title || '국정 기사',
        content: a.headline ? `[헤드라인] ${a.headline}\n\n${a.body}` : a.body || a.content || '',
      })
    })

    // 3-5. 법안 투표 참여
    Object.entries(billVotes).forEach(([bid, votes]) => {
      if (votes && votes[myStudentId]) {
        let billTitle = bid
        for (const unit of Object.values(branchData)) {
          if (unit.type === 'legislative' && unit.bills) {
            const matched = Object.values(unit.bills).find(b => b.title && b.title.includes(bid) || b.content && b.content.includes(bid))
            if (matched) { billTitle = matched.title; break }
          }
        }
        acts.push({
          key: `phase3_billvote_${bid}`, phase: 3,
          type: 'billvote',
          rawVotes: votes,
          icon: '🏛️', shortTitle: '법안투표',
          stepLabel: '국회 법안 의결 투표',
          title: `법안 표결 참여: ${billTitle}`,
          content: '',
        })
      }
    })

    // 3-6. 배심원 재판 투표 참여
    Object.entries(juryVotes).forEach(([cid, votes]) => {
      if (votes && votes[myStudentId]) {
        acts.push({
          key: `phase3_juryvote_${cid}`, phase: 3,
          type: 'juryvote',
          rawVotes: votes,
          icon: '⚖️', shortTitle: '재판투표',
          stepLabel: '사법 재판 배심원 투표',
          title: `배심원 재판 표결 참여: ${cid}`,
          content: '',
        })
      }
    })

    // 3-7. 공유 영상/캔바 링크 (type이 news가 아닌 외부 링크)
    Object.entries(links).forEach(([id, l]) => {
      if (l.submitterStudentId !== myStudentId || l.type === 'news') return
      acts.push({
        key: `phase3_video_${id}`, phase: 3,
        type: 'link',
        link: l,
        icon: '🎬', shortTitle: '영상공유',
        stepLabel: '영상/캔바 자료 공유',
        title: l.title || '공유한 영상/캔바',
        content: '',
      })
    })

    // ── 3-8. 토론 여론조사 (StancePoll pre/post) ──
    Object.entries(debateSessions).forEach(([sid, s]) => {
      const preVote = s.stancePoll?.pre?.votes?.[myStudentId]
      const postVote = s.stancePoll?.post?.votes?.[myStudentId]
      if (!preVote && !postVote) return // 본인 참여 안 한 토론은 제외

      const phase = Number(s.phase) || 3

      acts.push({
        key: `debate_poll_${sid}`,
        phase,
        type: 'debate_poll',
        debateSession: s,
        icon: '📊',
        shortTitle: '토론설문',
        stepLabel: '토론 여론조사(사전/사후)',
        title: s.title || '토론 여론조사',
        content: s.topic ? `토론 주제: ${s.topic}` : '',
      })
    })

    return acts
  }, [essays, posters, candidates, supports, articles, branchData, links, polls, pollReasons, electionVotes, billVotes, juryVotes, debateSessions, myStudentId, myGroupId, groups])

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
          1·2·3여정 내 활동들을 따라가며 각각 별점을 매겨 보세요.
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
                  const labels = []
                  const seen = new Set()
                  row.forEach((act, i) => {
                    const globalIdx = rowStart + i
                    const prevPhase = globalIdx > 0 ? activities[globalIdx - 1]?.phase : null
                    if (act.phase !== prevPhase && !seen.has(act.phase)) {
                      seen.add(act.phase)
                      const m = PHASE_META[act.phase]
                      labels.push(
                        <div key={act.phase} className="flex items-center gap-1.5 mb-2 mt-2">
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
          myStudentId={myStudentId}
          candidatesMap={candidatesMap}
          groups={groups}
        />
      )}
    </div>
  )
}
