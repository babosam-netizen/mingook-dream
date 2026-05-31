import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoomBar from '../components/shared/RoomBar'
import useGameStore from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'
import { computeStudentStats, statsToCSV } from '../lib/student-stats'
import { topicBg } from '../styles/tokens'
import PosterMedia from '../components/phase1/PosterMedia'

const TIMELINE_TYPE_EMOJI = {
  poster: '🖼️',
  comment: '💬',
  candidate: '🎤',
  electionVote: '🗳️',
  bill: '📜',
  billVote: '⚖️',
  jury: '⚖️',
  article: '📰',
  reflection: '📝',
  link: '🔗',
  alliance: '🤝',
  poll: '📊',
}

function StudentAnalyticsPage() {
  const navigate = useNavigate()
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const className = useGameStore((s) => s.className)
  const students = useGameStore((s) => s.students)
  const groups = useGameStore((s) => s.groups)
  const config = useGameStore((s) => s.config)

  const [posters, setPosters] = useState({})
  const [comments, setComments] = useState({})
  const [candidates, setCandidates] = useState({})
  const [electionVotes, setElectionVotes] = useState({})
  const [bills, setBills] = useState({})
  const [billVotes, setBillVotes] = useState({})
  const [juryVotes, setJuryVotes] = useState({})
  const [verdicts, setVerdicts] = useState({})
  const [articles, setArticles] = useState({})
  const [reflections, setReflections] = useState({})
  const [links, setLinks] = useState({})
  const [alliances, setAlliances] = useState({})
  const [polls, setPolls] = useState({})
  const [pollReasons, setPollReasons] = useState({})
  const [coreIssueVotes, setCoreIssueVotes] = useState({})

  const [filterGroup, setFilterGroup] = useState('all')
  const [sort, setSort] = useState('number') // 'number'|'activity'|'name'
  const [openStudentId, setOpenStudentId] = useState(null)

  useEffect(() => {
    if (!roomCode) return
    const subs = [
      subscribe(roomCode, 'posters', (d) => setPosters(d || {})),
      subscribe(roomCode, 'comments', (d) => setComments(d || {})),
      subscribe(roomCode, 'candidates', (d) => setCandidates(d || {})),
      subscribe(roomCode, 'electionVotes', (d) => setElectionVotes(d || {})),
      subscribe(roomCode, 'bills', (d) => setBills(d || {})),
      subscribe(roomCode, 'billVotes', (d) => setBillVotes(d || {})),
      subscribe(roomCode, 'juryVotes', (d) => setJuryVotes(d || {})),
      subscribe(roomCode, 'verdicts', (d) => setVerdicts(d || {})),
      subscribe(roomCode, 'articles', (d) => setArticles(d || {})),
      subscribe(roomCode, 'reflections', (d) => setReflections(d || {})),
      subscribe(roomCode, 'links', (d) => setLinks(d || {})),
      subscribe(roomCode, 'alliances', (d) => setAlliances(d || {})),
      subscribe(roomCode, 'polls', (d) => setPolls(d || {})),
      subscribe(roomCode, 'polls/reasons', (d) => setPollReasons(d || {})),
      subscribe(roomCode, 'polls/coreIssue/votes', (d) => setCoreIssueVotes(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode])

  const statsMap = useMemo(
    () =>
      computeStudentStats({
        students, groups, posters, comments, candidates, electionVotes,
        bills, billVotes, juryVotes, verdicts, articles, reflections, links, alliances,
        polls, pollReasons, coreIssueVotes,
      }),
    [students, groups, posters, comments, candidates, electionVotes,
     bills, billVotes, juryVotes, verdicts, articles, reflections, links, alliances,
     polls, pollReasons, coreIssueVotes],
  )

  const list = useMemo(() => {
    let arr = Object.values(statsMap)
    if (filterGroup !== 'all') arr = arr.filter((s) => s.groupId === filterGroup)
    if (sort === 'activity') arr.sort((a, b) => b.activityScore - a.activityScore)
    else if (sort === 'name') arr.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''))
    else arr.sort((a, b) => (a.number || 0) - (b.number || 0))
    return arr
  }, [statsMap, filterGroup, sort])

  const onCSV = () => {
    const csv = statsToCSV(statsMap)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${className || 'class'}_${roomCode}_학생활동분석_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-8 rounded-2xl shadow text-center max-w-md">
          <h2 className="text-xl font-bold text-red-700">접근 권한이 없습니다</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 rounded-lg bg-gray-800 text-white"
          >
            홈으로
          </button>
        </div>
      </div>
    )
  }

  const openStudent = openStudentId ? statsMap[openStudentId] : null
  const totalCount = Object.keys(students).length

  return (
    <div className="min-h-screen bg-indigo-50">
      <RoomBar />
      <main className="max-w-7xl mx-auto p-4 lg:p-6 space-y-4">
        <header className="flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-indigo-800">학생 활동 분석</h1>
            <p className="text-sm text-gray-600">
              학생별 누적 활동 — 포스터 · 댓글 · 투표 · 법안 · 기사 · 정리글 · 링크
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCSV}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              📥 CSV 내보내기
            </button>
            <button
              onClick={() => navigate('/teacher')}
              className="px-3 py-1.5 text-sm rounded-lg bg-white border hover:bg-gray-50"
            >
              ← 교사실
            </button>
          </div>
        </header>

        {/* 필터 */}
        <section className="bg-white rounded-2xl shadow-sm border p-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="font-semibold text-gray-700">필터:</span>
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="px-2 py-1 rounded border border-gray-300"
          >
            <option value="all">모든 모둠</option>
            {Object.entries(groups).map(([gid, g]) => (
              <option key={gid} value={gid}>
                {g.name || gid}
              </option>
            ))}
          </select>

          <span className="font-semibold text-gray-700 ml-2">정렬:</span>
          <div className="flex gap-1">
            {[
              ['number', '번호순'],
              ['activity', '활동순'],
              ['name', '이름순'],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setSort(v)}
                className={`px-2 py-1 rounded ${
                  sort === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-gray-500 text-xs">
            {list.length} / {totalCount}명 표시
          </span>
        </section>

        {/* 학생 활동 표 — 항목별 비교 */}
        <section className="bg-white rounded-2xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-xs text-gray-600 uppercase tracking-wider">
                <Th sticky>번호</Th>
                <Th sticky>이름</Th>
                <Th>모둠</Th>
                <Th align="right" className="text-indigo-700">점수</Th>
                <Th align="right" title="포스터 업로드">🖼️</Th>
                <Th align="right" title="작성 댓글 수">💬</Th>
                <Th align="right" title="법안 발의">📜</Th>
                <Th align="right" title="법안 의결 찬성/반대">찬/반</Th>
                <Th align="right" title="기사 승인/대기">📰</Th>
                <Th align="center" title="정리글 상태">📝</Th>
                <Th align="right" title="외부 링크 제출">🔗</Th>
                <Th align="right" title="설문 참여">📊</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((st, idx) => {
                const groupColor = config?.topics?.[groups[st.groupId]?.topic]?.color
                const reflectionStatus = st.reflection?.status
                const reflectionMark =
                  reflectionStatus === 'approved'
                    ? '✓'
                    : reflectionStatus === 'pending'
                    ? '…'
                    : reflectionStatus === 'rejected'
                    ? '✕'
                    : '—'
                
                // 설문 참여 횟수 계산
                const pollCount = st.timeline.filter(t => t.type === 'poll').length

                return (
                  <tr
                    key={st.studentId}
                    onClick={() => setOpenStudentId(st.studentId)}
                    className={`cursor-pointer hover:bg-indigo-50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <Td sticky className="font-mono text-gray-500">{st.number}</Td>
                    <Td sticky>
                      <div className="flex items-center gap-1.5 font-semibold whitespace-nowrap">
                        {st.isOnline && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                        {st.nickname}
                      </div>
                    </Td>
                    <Td>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs border ${topicBg(
                          groupColor,
                        )}`}
                      >
                        {st.groupName || '—'}
                      </span>
                    </Td>
                    <Td align="right" className="font-bold text-indigo-700 tabular-nums">
                      {st.activityScore.toFixed(1)}
                    </Td>
                    <Td align="right" mute={!st.posters}>{st.posters || '·'}</Td>
                    <Td align="right" mute={!st.comments.total}>
                      {st.comments.total || '·'}
                    </Td>
                    <Td align="right" mute={!st.bills.proposed}>
                      {st.bills.proposed || '·'}
                    </Td>
                    <Td align="right" mute={!(st.bills.yes + st.bills.no)} className="whitespace-nowrap">
                      {st.bills.yes + st.bills.no === 0
                        ? '·'
                        : `${st.bills.yes}/${st.bills.no}`}
                    </Td>
                    <Td align="right" mute={!st.articles.total} className="whitespace-nowrap">
                      {st.articles.total === 0
                        ? '·'
                        : `${st.articles.approved}/${st.articles.pending}`}
                    </Td>
                    <Td align="center" mute={!st.reflection}>{reflectionMark}</Td>
                    <Td align="right" mute={!st.links.submitted}>
                      {st.links.submitted || '·'}
                    </Td>
                    <Td align="right" mute={!pollCount}>
                      {pollCount || '·'}
                    </Td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center text-gray-400 py-8">
                    표시할 학생이 없어요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-gray-400">
          행을 클릭하면 학생의 사고 과정이 담긴 '프리미엄 활동 리포트'를 볼 수 있어요.
        </p>
      </main>

      {/* 상세 모달 [Antigravity Premium Upgrade] */}
      {openStudent && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenStudentId(null)}
        >
          <div
            className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="p-8 bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-600 text-white flex items-center justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
              <div className="flex items-center gap-6 relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center text-3xl shadow-inner border border-white/30">
                  👤
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-3xl font-black tracking-tight">
                      {openStudent.number}번 {openStudent.nickname}
                    </h2>
                    <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold border border-white/30">
                      {openStudent.groupName || '모둠 없음'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-white/80 font-medium">
                    <span className="flex items-center gap-1.5 bg-indigo-800/40 px-2 py-1 rounded-lg">
                      🎯 활동 점수 <strong className="text-white text-lg">{openStudent.activityScore.toFixed(1)}</strong>
                    </span>
                    <span className="text-sm opacity-60">|</span>
                    <span className="text-sm">실시간 프로세스 분석 리포트</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpenStudentId(null)}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all active:scale-90 group relative z-10"
              >
                <span className="text-2xl group-hover:rotate-90 transition-transform">✕</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar bg-gray-50/50">
              {/* 1. 핵심 성과 지표 (Grid) */}
              <section>
                <h3 className="text-lg font-black text-indigo-900 mb-5 flex items-center gap-2">
                  📊 핵심 성과 지표
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <Stat label="포스터" value={openStudent.posters} icon="🖼️" />
                  <Stat label="댓글" value={openStudent.comments.total} icon="💬" />
                  <Stat label="법안발의" value={openStudent.bills.proposed} icon="📜" />
                  <Stat label="찬/반투표" value={`${openStudent.bills.yes}/${openStudent.bills.no}`} icon="⚖️" />
                  <Stat label="기사승인" value={openStudent.articles.approved} icon="📰" />
                  <Stat label="정리글" value={openStudent.reflection?.status === 'approved' ? '완료' : '진행중'} icon="📝" />
                </div>
              </section>

              {/* 2. 상세 활동 타임라인 - 본문 포함 [Antigravity Focus] */}
              <section>
                <h3 className="text-lg font-black text-indigo-900 mb-5 flex items-center gap-2">
                  🕒 활동 프로세스 상세 내역
                </h3>
                {openStudent.timeline.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">아직 기록된 활동이 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-6 relative before:absolute before:left-[1.65rem] before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                    {openStudent.timeline.map((t, i) => (
                      <div key={i} className="relative pl-14 group">
                        <div className="absolute left-0 top-0 w-12 h-12 bg-white rounded-2xl border-2 border-indigo-100 flex items-center justify-center text-xl shadow-sm z-10 group-hover:border-indigo-400 transition-colors">
                          {TIMELINE_TYPE_EMOJI[t.type] || '•'}
                        </div>
                        <div className="bg-white rounded-[1.5rem] border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
                          <header className="flex items-center justify-between mb-4">
                            <span className="font-black text-indigo-900">{t.label}</span>
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-full uppercase tracking-wider">
                              {t.at ? new Date(t.at).toLocaleString() : ''}
                            </span>
                          </header>

                          {/* 콘텐츠 본문 렌더링 [Antigravity] */}
                          <div className="space-y-3">
                            {t.type === 'poll' && (
                              <div className="space-y-3">
                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                  <p className="text-[10px] text-indigo-400 font-bold mb-1 uppercase">선택 결과</p>
                                  <p className="text-sm font-black text-indigo-700">{t.choice}</p>
                                </div>
                                {t.reason && (
                                  <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                                    <p className="text-[10px] text-amber-500 font-bold mb-1 uppercase">💡 변화 사유</p>
                                    <p className="text-xs text-amber-900 font-medium leading-relaxed">{t.reason}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {(t.type === 'article' || t.type === 'bill') && (
                              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                                {t.headline && <h4 className="font-bold text-gray-900 mb-2">{t.headline}</h4>}
                                <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{t.body}</p>
                                {t.perspective && (
                                  <span className="inline-block mt-3 px-2 py-0.5 bg-white border border-gray-200 text-[10px] font-black text-gray-400 rounded uppercase tracking-tighter">
                                    {t.perspective}
                                  </span>
                                )}
                              </div>
                            )}

                            {t.type === 'poster' && (t.imageUrl || t.canvaUrl || t.posterCanvaUrl) && (
                              <div className="group/img relative w-48 h-32 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                                <PosterMedia poster={t} className="w-full h-full" imageClassName="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                {t.imageUrl && <a href={t.imageUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-white text-[10px] font-bold">원본보기</a>}
                              </div>
                            )}

                            {t.type === 'comment' && (
                              <blockquote className="border-l-4 border-indigo-200 pl-4 py-1 italic text-gray-500 text-xs leading-relaxed">
                                "{t.body}"
                              </blockquote>
                            )}

                            {t.type === 'reflection' && (
                              <div className="space-y-4 bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100">
                                <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{t.body}</p>
                                {(t.impressive || t.revisit || t.pledge) && (
                                  <div className="pt-3 border-t border-emerald-100 grid grid-cols-1 gap-3">
                                    {t.impressive && (
                                      <div>
                                        <p className="text-[10px] text-emerald-600 font-bold mb-1">✨ 인상 깊은 장면</p>
                                        <p className="text-[11px] text-gray-600">{t.impressive}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <footer className="p-6 bg-white border-t border-gray-100 flex justify-end items-center gap-4">
               <p className="text-[10px] text-gray-400 mr-auto font-medium">활동 내역은 실시간으로 업데이트됩니다.</p>
               <button
                onClick={() => setOpenStudentId(null)}
                className="px-8 py-3 bg-gray-900 hover:bg-black text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-gray-200"
              >
                닫기
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-colors">
      <div className="flex items-center gap-2 mb-2 text-gray-400">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-black text-indigo-700 tabular-nums leading-none">{value || '—'}</p>
    </div>
  )
}

function Th({ children, align = 'left', sticky = false, title, className = '' }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const stickyCls = sticky ? 'sticky left-0 bg-gray-50 z-10' : ''
  return (
    <th
      title={title}
      className={`px-2 py-2 font-semibold ${alignCls} ${stickyCls} ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children, align = 'left', sticky = false, mute = false, className = '', title }) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
  const stickyCls = sticky ? 'sticky left-0 bg-inherit z-[1]' : ''
  const muteCls = mute ? 'text-gray-300' : ''
  return (
    <td
      title={title}
      className={`px-2 py-2 border-t border-gray-100 tabular-nums ${alignCls} ${stickyCls} ${muteCls} ${className}`}
    >
      {children}
    </td>
  )
}

export default StudentAnalyticsPage
