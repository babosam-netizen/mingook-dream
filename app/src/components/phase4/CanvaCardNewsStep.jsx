import { useEffect, useMemo, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { subscribe, updateAt, getOnce } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

/**
 * 2단계: 캔바 카드뉴스 제작 + URL 제출
 * - 1단계에서 별점 준 상위 활동 3개 참고 목록 표시
 * - Canva 바로가기 버튼 + 제작 가이드
 * - URL/embed 제출 + 미리보기
 */
export default function CanvaCardNewsStep() {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)

  const [ratings, setRatings] = useState({})
  const [essays, setEssays] = useState({})
  const [posters, setPosters] = useState({})
  const [canvaInput, setCanvaInput] = useState('')
  const [savedUrl, setSavedUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // 기존 저장값 로드
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}`).then((d) => {
      if (d?.journeyRatings) setRatings(d.journeyRatings)
      if (d?.canvaCardNewsUrl) {
        setSavedUrl(d.canvaCardNewsUrl)
        setCanvaInput(d.canvaCardNewsUrl)
      }
    })
    const subs = [
      subscribe(roomCode, 'essays',   (d) => setEssays(d || {})),
      subscribe(roomCode, 'posters',  (d) => setPosters(d || {})),
    ]
    return () => subs.forEach((u) => u?.())
  }, [roomCode, myStudentId])

  // 상위 별점 활동 3개 계산
  const topActivities = useMemo(() => {
    const items = []
    Object.entries(ratings).forEach(([key, score]) => {
      if (!score) return
      let label = key
      if (key.startsWith('phase1_essay_')) {
        const id = key.replace('phase1_essay_', '')
        const e = essays[id]
        label = e ? `📝 주장하는 글: "${e.title || '제목 없음'}" (${score}★)` : `📝 에세이 (${score}★)`
      } else if (key.startsWith('phase1_poster_')) {
        label = `🖼️ 포스터 (${score}★)`
      } else if (key === 'phase2_candidate') {
        label = `🗳️ 후보 등록/공약 (${score}★)`
      } else if (key.startsWith('phase2_support_')) {
        label = `📣 지지 선언문 (${score}★)`
      } else if (key.startsWith('phase2_article_')) {
        label = `📰 선거 기사 (${score}★)`
      } else if (key.startsWith('phase3_bill_')) {
        label = `🏛️ 법안 (${score}★)`
      } else if (key.startsWith('phase3_executive_')) {
        label = `🏢 행정 정책 (${score}★)`
      } else if (key.startsWith('phase3_judicial_')) {
        label = `⚖️ 사법 활동 (${score}★)`
      } else if (key.startsWith('phase3_article_')) {
        label = `📰 국정 기사 (${score}★)`
      }
      items.push({ key, score, label })
    })
    return items.sort((a, b) => b.score - a.score).slice(0, 4)
  }, [ratings, essays])

  const handleSave = async () => {
    setError('')
    const url = formatCanvaEmbedUrl(canvaInput.trim())
    if (!url) { setError('Canva URL 또는 embed 코드를 입력해 주세요.'); return }
    setSaving(true)
    try {
      await updateAt(roomCode, `students/${myStudentId}`, { canvaCardNewsUrl: url })
      setSavedUrl(url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 안내 헤더 */}
      <div className="bg-gradient-to-r from-violet-50 to-pink-50 rounded-2xl p-4 border border-violet-200">
        <h2 className="font-black text-violet-800 text-lg mb-1">🎨 캔바 카드뉴스 제작</h2>
        <p className="text-sm text-gray-600">
          1단계에서 별점 준 활동들을 중심으로 Canva에서 카드뉴스를 만들어요.
          나의 여정을 멋진 카드뉴스로 정리해 보세요!
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 왼쪽: 참고 활동 + 캔바 링크 */}
        <div className="space-y-4">
          {/* 별점 상위 활동 */}
          {topActivities.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-bold text-yellow-800 text-sm mb-2">⭐ 내가 높이 평가한 활동들</h3>
              <ul className="space-y-1">
                {topActivities.map((act) => (
                  <li key={act.key} className="text-sm text-gray-700 flex items-center gap-2">
                    <span>{'★'.repeat(act.score)}</span>
                    <span>{act.label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">이 활동들을 카드뉴스에 담아보세요!</p>
            </div>
          )}
          {topActivities.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
              1단계에서 별점을 주면 여기에 활동이 표시돼요.
            </div>
          )}

          {/* 캔바 바로가기 + 제작 가이드 */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">📋 카드뉴스 제작 가이드</h3>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Canva 프레젠테이션(16:9) 또는 인스타그램 정사각형 템플릿 추천</li>
              <li>슬라이드 1: 제목 (나의 여정 이야기)</li>
              <li>슬라이드 2~4: 1·2·3여정 각 하이라이트 한 장씩</li>
              <li>슬라이드 마지막: 나의 다짐 한 줄</li>
            </ul>
            <a
              href="https://www.canva.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold text-sm hover:opacity-90 transition"
            >
              🎨 Canva 열기
            </a>
          </div>
        </div>

        {/* 오른쪽: URL 제출 + 미리보기 */}
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">📎 카드뉴스 URL 제출</h3>
            <p className="text-xs text-gray-500">
              Canva에서 공유 → '링크 복사' 또는 'embed 코드' 중 하나를 붙여 넣으세요.
            </p>
            <textarea
              value={canvaInput}
              onChange={(e) => setCanvaInput(e.target.value)}
              rows={3}
              placeholder="https://www.canva.com/design/... 또는 <iframe ...> 코드"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-emerald-600 font-semibold">✓ 저장됐어요!</p>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50 transition"
            >
              {saving ? '저장 중...' : savedUrl ? '✏️ URL 수정 저장' : '제출하기'}
            </button>
          </div>

          {/* 미리보기 */}
          {savedUrl && (
            <div className="bg-white border border-violet-200 rounded-xl overflow-hidden">
              <p className="text-xs font-bold text-violet-700 px-3 py-2 border-b border-violet-100">
                👁️ 미리보기
              </p>
              <div className="aspect-video">
                <iframe
                  src={savedUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allowFullScreen
                  title="캔바 카드뉴스 미리보기"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {savedUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-sm text-emerald-700 font-semibold">
            ✓ 카드뉴스가 제출됐어요 — 이제 3단계에서 정리글을 써 보세요!
          </p>
        </div>
      )}
    </div>
  )
}
