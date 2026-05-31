import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'

function ReflectionApprovalQueue() {
  const roomCode = useGameStore((s) => s.roomCode)
  const [map, setMap] = useState({})
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    if (!roomCode) return
    const u = subscribe(roomCode, 'reflections', (d) => setMap(d || {}))
    return () => u?.()
  }, [roomCode])

  const list = useMemo(() => {
    const arr = Object.entries(map)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    if (filter === 'all') return arr
    return arr.filter((r) => r.status === filter)
  }, [map, filter])

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    for (const r of Object.values(map)) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [map])

  const approve = (id) =>
    updateAt(roomCode, `reflections/${id}`, {
      status: 'approved',
      approvedAt: Date.now(),
    })
  const reject = (id) =>
    updateAt(roomCode, `reflections/${id}`, { status: 'rejected' })
  const del = (id) => {
    if (!confirm('이 정리 글을 영구 삭제할까요?')) return
    removeAt(roomCode, `reflections/${id}`)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-bold text-pink-800">📝 정리글 승인</h3>
        <div className="flex gap-1 ml-auto text-xs">
          {[
            ['pending', `대기 ${counts.pending || 0}`],
            ['approved', `승인 ${counts.approved || 0}`],
            ['all', '전체'],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded ${
                filter === v
                  ? 'bg-pink-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2 max-h-[480px] overflow-y-auto">
        {list.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-6">
            표시할 글이 없어요.
          </li>
        )}
        {list.map((r) => (
          <li key={r.id} className="bg-white border rounded-lg p-3 text-sm">
            {r.isPrivate && (
              <span className="inline-block text-xs px-1.5 py-0.5 bg-gray-100 rounded mb-1">
                🔒 비공개
              </span>
            )}
            <p className="font-semibold text-xs text-gray-500 mb-1">
              {r.authorNumber}번 {r.authorNickname}
            </p>
            {r.impressive && <p className="text-xs">1️⃣ {r.impressive}</p>}
            {r.revisit && <p className="text-xs mt-0.5">2️⃣ {r.revisit}</p>}
            {r.pledge && <p className="text-xs mt-0.5 font-semibold">3️⃣ {r.pledge}</p>}
            <div className="mt-2 flex gap-1 justify-end">
              {r.status !== 'approved' && (
                <button
                  onClick={() => approve(r.id)}
                  className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  승인
                </button>
              )}
              {r.status !== 'rejected' && (
                <button
                  onClick={() => reject(r.id)}
                  className="px-3 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
                >
                  반려
                </button>
              )}
              <button
                onClick={() => del(r.id)}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ReflectionApprovalQueue
