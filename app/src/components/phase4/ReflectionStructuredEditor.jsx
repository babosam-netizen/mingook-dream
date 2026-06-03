import { useEffect, useState } from 'react'
import useGameStore from '../../store/gameStore'
import { getOnce, pushUnder, updateAt } from '../../lib/rtdb-helpers'
import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

export { COLORS as REFLECTION_COLORS }

const COLORS = [
  { id: 'yellow', cls: 'bg-yellow-100 border-yellow-300', label: '노랑' },
  { id: 'pink',   cls: 'bg-pink-100 border-pink-300',     label: '핑크' },
  { id: 'sky',    cls: 'bg-sky-100 border-sky-300',       label: '하늘' },
  { id: 'lime',   cls: 'bg-lime-100 border-lime-300',     label: '연두' },
  { id: 'violet', cls: 'bg-violet-100 border-violet-300', label: '보라' },
  { id: 'amber',  cls: 'bg-amber-100 border-amber-300',   label: '주황' },
]

// 문장에 [사실]/[의견] 태그 토글 버튼
function SentenceTagButton({ value, onChange }) {
  const isFact    = value === 'fact'
  const isOpinion = value === 'opinion'
  return (
    <div className="flex gap-1 mt-1">
      <button
        type="button"
        onClick={() => onChange(isFact ? '' : 'fact')}
        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
          isFact ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
        }`}
      >
        📊 사실
      </button>
      <button
        type="button"
        onClick={() => onChange(isOpinion ? '' : 'opinion')}
        className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
          isOpinion ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
        }`}
      >
        💬 의견
      </button>
    </div>
  )
}

// 단락 에디터: 중심문장 + 뒷받침문장 2개
function ParagraphEditor({ title, accent, mainSentence, setMain, mainTag, setMainTag, supportA, setSupportA, supportATag, setSupportATag, supportB, setSupportB, supportBTag, setSupportBTag }) {
  return (
    <div className={`rounded-xl border-2 p-4 space-y-3 ${accent}`}>
      <p className="font-bold text-sm text-gray-800">{title}</p>

      <div>
        <label className="text-xs font-semibold text-gray-600">중심 문장 (이 단락의 핵심 주장)</label>
        <textarea
          value={mainSentence}
          onChange={(e) => setMain(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="한 문장으로 핵심을 분명하게 쓰세요."
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
        />
        <SentenceTagButton value={mainTag} onChange={setMainTag} />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">뒷받침 문장 ①</label>
        <textarea
          value={supportA}
          onChange={(e) => setSupportA(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="중심 문장을 구체적인 사실이나 경험으로 뒷받침해 주세요."
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
        />
        <SentenceTagButton value={supportATag} onChange={setSupportATag} />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">뒷받침 문장 ②</label>
        <textarea
          value={supportB}
          onChange={(e) => setSupportB(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="또 다른 근거나 사례를 추가해 주세요. (선택)"
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
        />
        <SentenceTagButton value={supportBTag} onChange={setSupportBTag} />
      </div>
    </div>
  )
}

/**
 * 3단계: 구조적 정리글 작성 에디터
 * - 상단: 내 캔바 카드뉴스 미리보기 (접기/펼치기)
 * - 개요 섹션(3단락): 도입/전개/마무리
 * - 각 단락: 중심문장 + 뒷받침문장 2개 + [사실]/[의견] 태깅
 * - 하단: 마치며 글 (finalEssay)
 * - 제출 후 수정 가능 (승인 후도 수정 가능, 수정됨 표시)
 */
export default function ReflectionStructuredEditor({ existingReflection, onEditDone }) {
  const roomCode    = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  const myNumber    = useGameStore((s) => s.myNumber)
  const myNickname  = useGameStore((s) => s.myNickname)

  const isEdit = !!existingReflection
  const existing = existingReflection || {}

  // 캔바 미리보기
  const [canvaUrl, setCanvaUrlLocal] = useState('')
  const [showCanva, setShowCanva] = useState(false)

  // 색상 / 비공개
  const [color,     setColor]     = useState(existing.color     || 'yellow')
  const [isPrivate, setIsPrivate] = useState(existing.isPrivate || false)

  // 개요
  const [intro,      setIntro]      = useState(existing.outline?.intro      || '')
  const [body,       setBody]       = useState(existing.outline?.body       || '')
  const [conclusion, setConclusion] = useState(existing.outline?.conclusion || '')

  // 단락 1 (도입)
  const [p1Main,       setP1Main]       = useState(existing.p1?.main       || '')
  const [p1MainTag,    setP1MainTag]    = useState(existing.p1?.mainTag    || '')
  const [p1SupportA,   setP1SupportA]   = useState(existing.p1?.supportA   || '')
  const [p1SupportATag,setP1SupportATag]= useState(existing.p1?.supportATag|| '')
  const [p1SupportB,   setP1SupportB]   = useState(existing.p1?.supportB   || '')
  const [p1SupportBTag,setP1SupportBTag]= useState(existing.p1?.supportBTag|| '')

  // 단락 2 (전개)
  const [p2Main,       setP2Main]       = useState(existing.p2?.main       || '')
  const [p2MainTag,    setP2MainTag]    = useState(existing.p2?.mainTag    || '')
  const [p2SupportA,   setP2SupportA]   = useState(existing.p2?.supportA   || '')
  const [p2SupportATag,setP2SupportATag]= useState(existing.p2?.supportATag|| '')
  const [p2SupportB,   setP2SupportB]   = useState(existing.p2?.supportB   || '')
  const [p2SupportBTag,setP2SupportBTag]= useState(existing.p2?.supportBTag|| '')

  // 단락 3 (마무리)
  const [p3Main,       setP3Main]       = useState(existing.p3?.main       || '')
  const [p3MainTag,    setP3MainTag]    = useState(existing.p3?.mainTag    || '')
  const [p3SupportA,   setP3SupportA]   = useState(existing.p3?.supportA   || '')
  const [p3SupportATag,setP3SupportATag]= useState(existing.p3?.supportATag|| '')
  const [p3SupportB,   setP3SupportB]   = useState(existing.p3?.supportB   || '')
  const [p3SupportBTag,setP3SupportBTag]= useState(existing.p3?.supportBTag|| '')

  // 마치며 글
  const [finalEssay, setFinalEssay] = useState(existing.finalEssay || '')

  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // 내 캔바 URL 로드
  useEffect(() => {
    if (!roomCode || !myStudentId) return
    getOnce(roomCode, `students/${myStudentId}/canvaCardNewsUrl`).then((url) => {
      if (url) setCanvaUrlLocal(formatCanvaEmbedUrl(url))
    })
  }, [roomCode, myStudentId])

  const buildPayload = () => ({
    color,
    isPrivate,
    canvaUrl: canvaUrl || '',
    outline: { intro: intro.trim(), body: body.trim(), conclusion: conclusion.trim() },
    p1: { main: p1Main.trim(), mainTag: p1MainTag, supportA: p1SupportA.trim(), supportATag: p1SupportATag, supportB: p1SupportB.trim(), supportBTag: p1SupportBTag },
    p2: { main: p2Main.trim(), mainTag: p2MainTag, supportA: p2SupportA.trim(), supportATag: p2SupportATag, supportB: p2SupportB.trim(), supportBTag: p2SupportBTag },
    p3: { main: p3Main.trim(), mainTag: p3MainTag, supportA: p3SupportA.trim(), supportATag: p3SupportATag, supportB: p3SupportB.trim(), supportBTag: p3SupportBTag },
    finalEssay: finalEssay.trim(),
    // 하위 호환 필드
    participation: intro.trim(),
    feelings:      p1Main.trim(),
    mostImpressive:p2Main.trim(),
    newLearnings:  p2SupportA.trim(),
    pledge:        p3Main.trim(),
    impressive:    p2Main.trim(),
    revisit:       p1Main.trim(),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const allTexts = [intro, body, conclusion, p1Main, p2Main, p3Main, finalEssay]
    if (allTexts.every((v) => !v.trim())) {
      setError('최소 하나 이상의 항목을 작성해 주세요.')
      return
    }
    setBusy(true)
    try {
      if (isEdit) {
        // 수정 — 승인 여부와 관계없이 내용 업데이트, 수정됨 표시
        const wasApproved = existing.status === 'approved'
        await updateAt(roomCode, `reflections/${existing.id}`, {
          ...buildPayload(),
          updatedAt: Date.now(),
          isModified: true,
          // 승인됐던 글은 재승인 없이 자동 게시 유지 (status 변경 안 함)
          // 미승인/반려 상태였으면 다시 pending
          status: wasApproved ? 'approved' : 'pending',
        })
        setDone(true)
        setTimeout(() => { setDone(false); onEditDone?.() }, 2000)
      } else {
        // 신규 제출
        await pushUnder(roomCode, 'reflections', {
          ...buildPayload(),
          authorStudentId: myStudentId,
          authorNumber: myNumber,
          authorNickname: myNickname,
          status: 'pending',
          isModified: false,
          empathy: { heart: 0, clap: 0, lightbulb: 0, thumbsup: 0 },
        })
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-4 border border-pink-200">
        <h2 className="font-black text-pink-800 text-lg mb-1">
          {isEdit ? '✏️ 정리글 수정' : '📝 정리글 작성'}
        </h2>
        <p className="text-sm text-gray-600">
          카드뉴스를 참고하며 개요를 잡고, 단락별 중심문장·뒷받침문장으로 정리글을 완성하세요.
        </p>
      </div>

      {/* 내 캔바 카드뉴스 미리보기 */}
      {canvaUrl && (
        <div className="bg-white border border-violet-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCanva((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 transition"
          >
            <span>🎨 내 캔바 카드뉴스 미리보기</span>
            <span>{showCanva ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showCanva && (
            <div className="aspect-video">
              <iframe src={canvaUrl} className="w-full h-full" frameBorder="0" allowFullScreen title="내 카드뉴스" />
            </div>
          )}
        </div>
      )}

      {/* 개요 (3단락 구조) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h3 className="font-bold text-gray-800 text-sm">📋 개요 작성 (3단락 구조)</h3>
        <div>
          <label className="text-xs font-semibold text-blue-700">도입 — 이 프로젝트에서 무엇을 했나요?</label>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} maxLength={200}
            placeholder="시민단체 활동부터 선거, 국정 활동까지 한 줄로 소개하세요."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-emerald-700">전개 — 가장 의미 있었던 경험과 배움</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={200}
            placeholder="인상 깊었던 활동, 새롭게 알게 된 것, 어려웠던 점 등"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-pink-700">마무리 — 민주 시민으로서 다짐</label>
          <textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} rows={2} maxLength={200}
            placeholder="이 경험이 나에게 남긴 것, 앞으로의 다짐"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none" />
        </div>
      </div>

      {/* 단락별 중심/뒷받침 문장 */}
      <ParagraphEditor
        title="📘 도입 단락 — 중심문장 · 뒷받침문장"
        accent="border-blue-200 bg-blue-50/40"
        mainSentence={p1Main} setMain={setP1Main} mainTag={p1MainTag} setMainTag={setP1MainTag}
        supportA={p1SupportA} setSupportA={setP1SupportA} supportATag={p1SupportATag} setSupportATag={setP1SupportATag}
        supportB={p1SupportB} setSupportB={setP1SupportB} supportBTag={p1SupportBTag} setSupportBTag={setP1SupportBTag}
      />
      <ParagraphEditor
        title="📗 전개 단락 — 중심문장 · 뒷받침문장"
        accent="border-emerald-200 bg-emerald-50/40"
        mainSentence={p2Main} setMain={setP2Main} mainTag={p2MainTag} setMainTag={setP2MainTag}
        supportA={p2SupportA} setSupportA={setP2SupportA} supportATag={p2SupportATag} setSupportATag={setP2SupportATag}
        supportB={p2SupportB} setSupportB={setP2SupportB} supportBTag={p2SupportBTag} setSupportBTag={setP2SupportBTag}
      />
      <ParagraphEditor
        title="📕 마무리 단락 — 중심문장 · 뒷받침문장"
        accent="border-pink-200 bg-pink-50/40"
        mainSentence={p3Main} setMain={setP3Main} mainTag={p3MainTag} setMainTag={setP3MainTag}
        supportA={p3SupportA} setSupportA={setP3SupportA} supportATag={p3SupportATag} setSupportATag={setP3SupportATag}
        supportB={p3SupportB} setSupportB={setP3SupportB} supportBTag={p3SupportBTag} setSupportBTag={setP3SupportBTag}
      />

      {/* 마치며 글 */}
      <div className="bg-white border-2 border-pink-200 rounded-xl p-4 space-y-2">
        <label className="text-sm font-bold text-pink-700">
          📜 마치며 — 위 내용을 한 편의 글로 정리해 보세요
        </label>
        <textarea
          value={finalEssay}
          onChange={(e) => setFinalEssay(e.target.value)}
          rows={8}
          maxLength={1500}
          placeholder="시민단체 활동부터 선거·국정·사법까지의 경험을 한 편의 글로 정리해 보세요."
          className="w-full px-3 py-2 rounded-lg border border-pink-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
        />
        <p className="text-xs text-gray-400 text-right">{finalEssay.length} / 1500자</p>
      </div>

      {/* 카드 색상 */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">카드 색상</p>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button type="button" key={c.id} onClick={() => setColor(c.id)}
              className={`w-9 h-9 rounded-full border-2 transition ${c.cls} ${color === c.id ? 'ring-2 ring-offset-2 ring-pink-500 scale-110' : ''}`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* 비공개 */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="rounded" />
        <span>🔒 선생님만 볼 수 있게 (비공개)</span>
      </label>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {done  && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">✓ {isEdit ? '수정됐어요!' : '제출됐어요. 선생님 승인을 기다려 주세요.'}</p>}

      <div className="flex gap-2">
        {isEdit && (
          <button type="button" onClick={onEditDone}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50">
            취소
          </button>
        )}
        <button type="submit" disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white font-bold disabled:opacity-50 hover:bg-pink-700 transition">
          {busy ? '저장 중...' : isEdit ? '수정 완료' : '정리글 제출'}
        </button>
      </div>
    </form>
  )
}
