import { useState } from 'react'
import useGameStore from '../../store/gameStore'
import { pushUnder } from '../../lib/rtdb-helpers'
import PlaceholderField, { isFieldComplete } from './PlaceholderField'
import ResearchReferencePanel from '../research/ResearchReferencePanel'

/**
 * 판결문 템플릿 — 4단 구조 (사실관계·쟁점·판단 근거·주문) + 사건번호.
 *
 * props:
 *   caseId    NPC 사건 ID — {dataPath}/{caseId}/... 에 저장
 *   groupId   사법 모둠
 *   decision  'guilty'|'notGuilty' (배심원 평결 결과를 외부에서 전달)
 *   dataPath  RTDB 컬렉션 경로 (기본값: 'verdicts'). RoundTabShell 에서 주입 가능.
 */
function VerdictTemplate({ caseId, groupId, decision, dataPath = 'verdicts' }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const sections = useGameStore((s) => s.config?.templates?.verdict?.sections) || []

  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const allComplete = sections.every((s) => isFieldComplete(values[s.id]))

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!caseId) {
      setError('판결할 사건이 선택되지 않았어요.')
      return
    }
    if (!allComplete) {
      setError('빈칸이 남아 있어요. 회색 안내문을 모두 우리 단어로 채워 주세요.')
      return
    }
    setBusy(true)
    try {
      const body = sections
        .map((s) => `◎ ${s.label}\n${values[s.id]}`)
        .join('\n\n')

      await pushUnder(roomCode, `${dataPath}/${caseId}`, {
        decision: decision || 'notGuilty',
        body,
        templateData: values,
        sentence: values.order || '',
        judgeGroupId: groupId,
      })
      setValues({})
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-4 rounded-2xl border-2 border-rose-200 shadow-sm space-y-3"
    >
      <header>
        <h3 className="font-bold text-rose-800">⚖️ 판결문 템플릿</h3>
        <p className="text-xs text-gray-500">
          판결문 4구조(사실관계·쟁점·판단 근거·주문)를 빈칸으로 채워 작성합니다.
          {decision && (
            <>
              {' '}배심원 평결: <strong>{decision === 'guilty' ? '유죄' : '무죄'}</strong>
            </>
          )}
        </p>
      </header>

      <ResearchReferencePanel
        contextKey="phase3_judicial"
        groupId={groupId}
        title="재판 준비자료 — 참고하며 판결문을 작성하세요"
        emptyMessage="아직 재판 준비 단계에서 모은 자료가 없습니다. 재판 근거 자료실에서 자료 목록과 기사 자료를 모으면 여기에 표시됩니다."
        accent="slate"
        compact
      />

      {sections.map((s) => (
        <PlaceholderField
          key={s.id}
          label={s.label}
          placeholder={s.placeholder}
          value={values[s.id] || ''}
          onChange={(v) => setValues((prev) => ({ ...prev, [s.id]: v }))}
          rows={s.rows}
          maxLength={s.maxLength}
        />
      ))}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
          ✓ 판결문 게시 완료.
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !allComplete}
        className="w-full py-2 rounded-lg bg-rose-700 text-white font-semibold disabled:opacity-50 hover:bg-rose-800"
      >
        {busy ? '제출 중...' : allComplete ? '판결문 게시' : '⚠ 빈칸을 모두 채워 주세요'}
      </button>
    </form>
  )
}

export default VerdictTemplate
