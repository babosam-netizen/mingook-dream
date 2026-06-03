import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, removeAt } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

/**
 * 4단계: 교사 정리글 빠른 승인 큐
 * - 전체 일괄 승인 버튼
 * - 캔바 카드뉴스 인라인 미리보기
 * - 5박스 + 구조적 정리글 전체 표시
 * - 수정됨(isModified) 배지 표시
 * - 반려 시 수정 요청 메모 가능
 * - 사이드 패널로 상세 확인
 */
function TagBadge({ tag }) {
  if (!tag) return null
  return tag === 'fact'
    ? <span className="inline-block text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold ml-1">사실</span>
    : <span className="inline-block text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold ml-1">의견</span>
}

function DetailPanel({ r, onClose, onApprove, onReject, onDelete }) {
  const [rejectMemo, setRejectMemo] = useState(r.rejectMemo || '')
  const [canvaOpen, setCanvaOpen] = useState(false)
  const canvaUrl = r.canvaUrl ? formatCanvaEmbedUrl(r.canvaUrl) : ''

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">{r.authorNumber}번 {r.authorNickname}</h3>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {r.isPrivate && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded">🔒 비공개</span>}
              {r.isModified && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">✏️ 수정됨</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
              }`}>
                {r.status === 'approved' ? '✓ 승인됨' : r.status === 'rejected' ? '✗ 반려됨' : '⏳ 대기 중'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {/* 캔바 카드뉴스 */}
          {canvaUrl && (
            <div className="border border-violet-200 rounded-xl overflow-hidden">
              <button onClick={() => setCanvaOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50">
                <span>🎨 캔바 카드뉴스</span>
                <span>{canvaOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>
              {canvaOpen && (
                <div className="aspect-video">
                  <iframe src={canvaUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="카드뉴스" />
                </div>
              )}
            </div>
          )}

          {/* 개요 */}
          {r.outline && (r.outline.intro || r.outline.body || r.outline.conclusion) && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-gray-600">📋 개요</p>
              {r.outline.intro      && <p><span className="text-blue-600 font-semibold">도입:</span> {r.outline.intro}</p>}
              {r.outline.body       && <p><span className="text-emerald-600 font-semibold">전개:</span> {r.outline.body}</p>}
              {r.outline.conclusion && <p><span className="text-pink-600 font-semibold">마무리:</span> {r.outline.conclusion}</p>}
            </div>
          )}

          {/* 구조적 단락 */}
          {[
            { label: '📘 도입 단락', data: r.p1 },
            { label: '📗 전개 단락', data: r.p2 },
            { label: '📕 마무리 단락', data: r.p3 },
          ].map(({ label, data }) => data?.main && (
            <div key={label} className="bg-white border rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-gray-600">{label}</p>
              <p className="font-semibold">중심: {data.main}<TagBadge tag={data.mainTag} /></p>
              {data.supportA && <p className="text-gray-600 pl-2">↳ {data.supportA}<TagBadge tag={data.supportATag} /></p>}
              {data.supportB && <p className="text-gray-600 pl-2">↳ {data.supportB}<TagBadge tag={data.supportBTag} /></p>}
            </div>
          ))}

          {/* 기존 5박스 호환 표시 */}
          {!r.p1 && (
            <>
              {r.participation   && <p><span className="font-semibold">1️⃣ 참여:</span> {r.participation}</p>}
              {r.feelings        && <p><span className="font-semibold">2️⃣ 느낌:</span> {r.feelings}</p>}
              {r.mostImpressive  && <p><span className="font-semibold">3️⃣ 인상깊은:</span> {r.mostImpressive}</p>}
              {r.newLearnings    && <p><span className="font-semibold">4️⃣ 새로 안 것:</span> {r.newLearnings}</p>}
              {r.pledge          && <p><span className="font-semibold">5️⃣ 다짐:</span> {r.pledge}</p>}
            </>
          )}

          {/* 마치며 */}
          {r.finalEssay && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
              <p className="text-xs font-bold text-pink-700 mb-1">📜 마치며</p>
              <p className="whitespace-pre-wrap text-gray-800">{r.finalEssay}</p>
            </div>
          )}

          {/* 반려 메모 */}
          {r.status !== 'approved' && (
            <div>
              <label className="text-xs font-semibold text-gray-600">반려 사유 메모 (선택 — 학생에게 표시)</label>
              <textarea value={rejectMemo} onChange={(e) => setRejectMemo(e.target.value)}
                rows={2} placeholder="어떤 부분을 수정해야 하는지 써 주세요."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="sticky bottom-0 bg-white border-t p-3 flex gap-2">
          {r.status !== 'approved' && (
            <button onClick={() => onApprove(r.id)}
              className="flex-1 py-2 text-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">
              ✓ 승인
            </button>
          )}
          {r.status !== 'rejected' && (
            <button onClick={() => onReject(r.id, rejectMemo)}
              className="flex-1 py-2 text-sm rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600">
              ✗ 반려
            </button>
          )}
          <button onClick={() => onDelete(r.id)}
            className="px-3 py-2 text-sm rounded-xl bg-red-100 text-red-700 font-bold hover:bg-red-200">
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReflectionApprovalQueue() {
  const roomCode = useGameStore((s) => s.roomCode)
  const [map, setMap]       = useState({})
  const [filter, setFilter] = useState('pending')
  const [detail, setDetail] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)

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

  const approve = (id) => updateAt(roomCode, `reflections/${id}`, {
    status: 'approved', approvedAt: Date.now(), rejectMemo: null,
  })
  const reject = (id, memo) => updateAt(roomCode, `reflections/${id}`, {
    status: 'rejected', rejectMemo: memo || null,
  })
  const del = (id) => {
    if (!confirm('이 정리 글을 영구 삭제할까요?')) return
    removeAt(roomCode, `reflections/${id}`)
    if (detail?.id === id) setDetail(null)
  }

  // 전체 일괄 승인
  const bulkApproveAll = async () => {
    const pending = Object.entries(map).filter(([, r]) => r.status === 'pending')
    if (!pending.length) return
    if (!confirm(`대기 중인 ${pending.length}개를 모두 승인할까요?`)) return
    setBulkLoading(true)
    await Promise.all(pending.map(([id]) =>
      updateAt(roomCode, `reflections/${id}`, { status: 'approved', approvedAt: Date.now() })
    ))
    setBulkLoading(false)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-bold text-pink-800 text-sm">📝 정리글 승인 큐</h3>
        <div className="flex gap-1 ml-auto text-xs flex-wrap">
          {[
            ['pending',  `⏳ 대기 ${counts.pending  || 0}`],
            ['approved', `✓ 승인 ${counts.approved || 0}`],
            ['rejected', `✗ 반려 ${counts.rejected || 0}`],
            ['all',      '전체'],
          ].map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-2 py-1 rounded-lg font-semibold transition ${
                filter === v ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 일괄 승인 버튼 */}
      {counts.pending > 0 && (
        <button onClick={bulkApproveAll} disabled={bulkLoading}
          className="w-full mb-3 py-2 text-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 transition">
          {bulkLoading ? '승인 중...' : `⚡ 대기 ${counts.pending}개 전체 일괄 승인`}
        </button>
      )}

      {/* 목록 */}
      <ul className="space-y-2 max-h-[480px] overflow-y-auto">
        {list.length === 0 && (
          <li className="text-sm text-gray-400 text-center py-8">표시할 글이 없어요.</li>
        )}
        {list.map((r) => (
          <li key={r.id}
            onClick={() => setDetail(r)}
            className="bg-white border rounded-xl p-3 text-sm cursor-pointer hover:border-pink-300 hover:shadow-sm transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex gap-1 flex-wrap mb-1">
                  {r.isPrivate  && <span className="text-[10px] px-1 py-0.5 bg-gray-100 rounded">🔒</span>}
                  {r.isModified && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">✏️ 수정됨</span>}
                  {r.canvaUrl   && <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded font-bold">🎨 카드뉴스</span>}
                </div>
                <p className="font-semibold text-gray-700">{r.authorNumber}번 {r.authorNickname}</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {r.finalEssay || r.p1?.main || r.participation || '(내용 없음)'}
                </p>
                {r.rejectMemo && (
                  <p className="text-xs text-amber-700 mt-0.5 truncate">💬 {r.rejectMemo}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  r.status === 'approved' ? 'bg-emerald-100 text-emerald-700'
                  : r.status === 'rejected' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {r.status === 'approved' ? '✓ 승인' : r.status === 'rejected' ? '✗ 반려' : '대기'}
                </span>
                {/* 빠른 승인/반려 버튼 */}
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {r.status !== 'approved' && (
                    <button onClick={() => approve(r.id)}
                      className="px-2 py-0.5 text-[10px] bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700">
                      승인
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button onClick={() => reject(r.id, '')}
                      className="px-2 py-0.5 text-[10px] bg-amber-400 text-white rounded font-bold hover:bg-amber-500">
                      반려
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 상세 패널 */}
      {detail && (
        <DetailPanel
          r={map[detail.id] ? { id: detail.id, ...map[detail.id] } : detail}
          onClose={() => setDetail(null)}
          onApprove={(id) => { approve(id) }}
          onReject={(id, memo) => { reject(id, memo) }}
          onDelete={(id) => { del(id); setDetail(null) }}
        />
      )}
    </div>
  )
}
