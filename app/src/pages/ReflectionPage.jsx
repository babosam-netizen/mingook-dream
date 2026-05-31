import { useEffect, useMemo, useState } from 'react'
import RoomBar from '../components/shared/RoomBar'

import ReflectionEditor from '../components/phase4/ReflectionEditor'
import ReflectionCard from '../components/phase4/ReflectionCard'
import ReflectionApprovalQueue from '../components/phase4/ReflectionApprovalQueue'
import useGameStore from '../store/gameStore'
import { subscribe } from '../lib/rtdb-helpers'
import { PHASE_META, CARD } from '../styles/tokens'
import SessionFinishButton from '../components/shared/SessionFinishButton'
import PollFeed from '../components/shared/PollFeed'
import DiscussionPrompt from '../components/shared/DiscussionPrompt'
import StudentWorkflowProgress from '../components/shared/StudentWorkflowProgress'
import HighlightBox from '../components/shared/HighlightBox'
import { useWorkflow } from '../lib/use-workflow'

const SORTS = [
  { id: 'recent',   label: '최신순' },
  { id: 'empathy',  label: '공감 많은 순' },
]

function ReflectionPage({ previewMode = false }) {
  const meta = PHASE_META[4]
  const role = useGameStore((s) => s.role)
  const wf = useWorkflow()
  const isStudent = role === 'student' || previewMode
  const anyHL = isStudent && !!wf.currentStep?.highlight
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const [reflectionsMap, setReflectionsMap] = useState({})
  const [sort, setSort] = useState('recent')

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'reflections', (d) =>
      setReflectionsMap(d || {}),
    )
    return () => u?.()
  }, [roomCode])

  // 본인의 미승인 글도 자기에게는 보이도록
  const reflections = useMemo(() => {
    const arr = Object.entries(reflectionsMap).map(([id, r]) => ({ id, ...r }))
    const visible = arr.filter((r) => {
      if (role === 'teacher') return true
      if (r.status !== 'approved') return r.authorStudentId === myStudentId
      if (r.isPrivate) return r.authorStudentId === myStudentId
      return true
    })
    if (sort === 'empathy') {
      return visible.sort((a, b) => {
        const aSum = Object.values(a.empathy || {}).reduce((s, n) => s + (n || 0), 0)
        const bSum = Object.values(b.empathy || {}).reduce((s, n) => s + (n || 0), 0)
        return bSum - aSum
      })
    }
    return visible.sort(
      (a, b) =>
        (b.approvedAt || b.createdAt || 0) - (a.approvedAt || a.createdAt || 0),
    )
  }, [reflectionsMap, role, myStudentId, sort])

  const myReflection = Object.values(reflectionsMap).find(
    (r) => r.authorStudentId === myStudentId,
  )

  return (
    <div className={`min-h-screen ${meta.pageBg}`}>
      <RoomBar />

      <main className="max-w-6xl mx-auto p-4 lg:p-6 space-y-5">
        <StudentWorkflowProgress tone="pink" />

        <header className="space-y-3">
          <h1 className={`text-2xl font-bold ${meta.titleText}`}>정리글 벽</h1>
          <p className="text-sm text-gray-600">
            우리가 만든 작은 대한민국을 함께 돌아봐요. 친구의 글에 공감을 남겨 주세요.
          </p>
          <DiscussionPrompt
            tone="pink"
            question="이 프로젝트가 나에게 남긴 것은 무엇인가?"
            subline="다섯 가지 질문에 답한 뒤, '민국이의 꿈 프로젝트를 마치며'로 한 편의 글을 써 봅시다."
          />
        </header>

        {/* editor(작성) + wall(갤러리 워크) 두 단계 모두 이 영역이 활성 */}
        <HighlightBox
          active={wf.isHighlight('editor') || wf.isHighlight('wall')}
          anyHighlight={anyHL}
          previewMode={previewMode}
        >
          <div className="grid lg:grid-cols-4 gap-4">
            {/* 좌측 패널 */}
            <div className="space-y-4 lg:col-span-1">
              {role === 'student' && !myReflection && <ReflectionEditor />}
              {role === 'student' && myReflection && (
                <div className="bg-white p-4 rounded-2xl border-2 border-pink-200">
                  <h3 className="font-bold text-pink-800">✓ 제출 완료</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    상태:{' '}
                    <strong>
                      {myReflection.status === 'approved'
                        ? '승인됨 (게시 중)'
                        : myReflection.status === 'rejected'
                        ? '반려됨'
                        : '승인 대기'}
                    </strong>
                  </p>
                </div>
              )}
              {role === 'teacher' && (
                <div className="bg-white rounded-2xl shadow-sm border p-4">
                  <ReflectionApprovalQueue />
                </div>
              )}
            </div>

            {/* 패들렛 그리드 */}
            <div className="lg:col-span-3">
              <div className="flex items-baseline gap-2 mb-3">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSort(s.id)}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      sort === s.id
                        ? 'bg-pink-600 text-white'
                        : 'bg-white border hover:border-pink-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-500">
                  {reflections.length}개 글
                </span>
              </div>

              {reflections.length === 0 ? (
                <div className={CARD.ghost}>
                  아직 정리 글이 없어요.{' '}
                  {role === 'student' && '왼쪽에서 첫 글을 써 보세요.'}
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
                  {reflections.map((r) => (
                    <ReflectionCard key={r.id} reflection={r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </HighlightBox>

        <HighlightBox active={wf.isHighlight('poll')} anyHighlight={anyHL} previewMode={previewMode}>
          <div className="mt-4">
            <PollFeed />
          </div>
        </HighlightBox>
      </main>
      <SessionFinishButton />
    </div>
  )
}

export default ReflectionPage
