import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { updateAt } from '../../lib/rtdb-helpers'
import { REFLECTION_COLORS } from './ReflectionEditor'
import CommentList from '../phase1/CommentList'

const EMOJIS = [
  { key: 'heart',     emoji: '❤️' },
  { key: 'clap',      emoji: '👏' },
  { key: 'lightbulb', emoji: '💡' },
  { key: 'thumbsup',  emoji: '👍' },
]

function ReflectionCard({ reflection }) {
  const role = useGameStore((s) => s.role)
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const [openComments, setOpenComments] = useState(false)
  const colorMeta = REFLECTION_COLORS.find((c) => c.id === reflection.color) || REFLECTION_COLORS[0]
  const empathy = reflection.empathy || {}

  // 학생이 이미 누른 이모지 (간단 추적: empathyVoters/{studentId} = emojiKey)
  const myReact = reflection.empathyVoters?.[myStudentId] || null

  const onReact = async (key) => {
    if (!myStudentId) return
    if (myReact === key) {
      // 같은 거 다시 누르면 취소
      const next = Math.max(0, (empathy[key] || 0) - 1)
      await updateAt(roomCode, `reflections/${reflection.id}`, {
        [`empathy/${key}`]: next,
        [`empathyVoters/${myStudentId}`]: null,
      })
    } else {
      const updates = {}
      if (myReact) {
        // 이전 이모지 취소
        const prev = Math.max(0, (empathy[myReact] || 0) - 1)
        updates[`empathy/${myReact}`] = prev
      }
      updates[`empathy/${key}`] = (empathy[key] || 0) + 1
      updates[`empathyVoters/${myStudentId}`] = key
      await updateAt(roomCode, `reflections/${reflection.id}`, updates)
    }
  }

  return (
    <article
      className={`p-4 rounded-2xl border-2 shadow-sm break-inside-avoid mb-4 ${colorMeta.cls}`}
    >
      {reflection.isPrivate && (
        <p className="text-xs font-semibold text-gray-500 mb-1">
          🔒 비공개 (선생님만)
        </p>
      )}

      {/* 신 5박스 (있을 때) — 없으면 구 3박스로 폴백 */}
      {reflection.participation && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">1️⃣ 참여한 활동</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.participation}</p>
        </div>
      )}
      {reflection.feelings && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">2️⃣ 인상·느낌</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.feelings}</p>
        </div>
      )}
      {reflection.mostImpressive && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">3️⃣ 가장 인상 깊었던</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.mostImpressive}</p>
        </div>
      )}
      {reflection.newLearnings && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">4️⃣ 새로 알게 된 점</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.newLearnings}</p>
        </div>
      )}
      {/* 구 3박스 호환 — 신 필드가 없을 때만 fallback */}
      {!reflection.participation && reflection.impressive && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">인상</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.impressive}</p>
        </div>
      )}
      {!reflection.feelings && reflection.revisit && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-600">다시 보고 싶은</p>
          <p className="text-sm whitespace-pre-wrap">{reflection.revisit}</p>
        </div>
      )}
      {reflection.pledge && (
        <div className="mb-2 bg-white/60 p-2 rounded-lg">
          <p className="text-xs font-semibold text-gray-600">5️⃣ 다짐</p>
          <p className="text-sm font-bold whitespace-pre-wrap">{reflection.pledge}</p>
        </div>
      )}
      {reflection.finalEssay && (
        <details className="mb-2 border-t border-white/50 pt-2">
          <summary className="text-xs cursor-pointer font-semibold text-gray-600 hover:text-gray-900">
            📜 마치며 글 펼치기
          </summary>
          <p className="text-sm whitespace-pre-wrap mt-1 bg-white/60 p-2 rounded">
            {reflection.finalEssay}
          </p>
        </details>
      )}
      <p className="text-xs text-gray-500 mt-2">
        {reflection.authorNumber}번 {reflection.authorNickname}
      </p>

      {/* 공감 이모지 */}
      <div className="mt-2 flex gap-1 flex-wrap">
        {EMOJIS.map((e) => {
          const count = empathy[e.key] || 0
          const mine = myReact === e.key
          return (
            <button
              key={e.key}
              onClick={() => onReact(e.key)}
              className={`px-2 py-1 rounded-full text-sm transition ${
                mine ? 'bg-white shadow ring-2 ring-pink-400' : 'bg-white/60 hover:bg-white'
              }`}
            >
              {e.emoji} {count > 0 && count}
            </button>
          )
        })}
      </div>

      <button
        onClick={() => setOpenComments((v) => !v)}
        className="mt-2 text-xs text-pink-700 hover:text-pink-900"
      >
        {openComments ? '댓글 접기 ▲' : '댓글 펼치기 ▼'}
      </button>
      {openComments && (
        <div className="mt-2 pt-2 border-t border-white/50">
          <CommentList targetType="reflection" targetId={reflection.id} />
        </div>
      )}
    </article>
  )
}

export default ReflectionCard
