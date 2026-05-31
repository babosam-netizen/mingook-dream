import { useState, useEffect } from 'react'
import useGameStore from '../../store/gameStore'
import { compressImage } from '../../lib/image-compress'
import { uploadImage } from '../../lib/upload-helper'
import { pushUnder, setAt } from '../../lib/rtdb-helpers'
import { extractCanvaUrl, formatCanvaEmbedUrl } from '../../lib/canva-embed'

/**
 * 포스터 업로드 — 학생이 자기 모둠 이름으로 캠페인 포스터를 한 장 올린다.
 *
 * props:
 *   groupId (필수) — 자기 모둠 ID
 *   posterId (선택) — 기존 포스터 수정 시 ID
 *   onSuccess (선택) — 업로드 성공 시 콜백
 */
function PosterUpload({ groupId, posterId, existingPoster, onSuccess, hideTitle }) {
  const roomCode = useGameStore((s) => s.roomCode)
  const myStudentId = useGameStore((s) => s.myStudentId)
  
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [mode, setMode] = useState('image')
  const [canvaUrl, setCanvaUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
 
  // [Antigravity] 수정 시 기존 캡션 세팅
  useEffect(() => {
    if (posterId && existingPoster) {
      setCaption(existingPoster.caption || '')
      setCanvaUrl(existingPoster.canvaUrl || existingPoster.posterCanvaUrl || '')
      setMode(existingPoster.canvaUrl || existingPoster.posterCanvaUrl ? 'canva' : 'image')
    } else {
      setCaption('')
      setCanvaUrl('')
      setMode('image')
    }
  }, [posterId, existingPoster?.createdAt, existingPoster?.updatedAt])

  const onPick = (e) => {
    const f = e.target.files?.[0]
    setError('')
    if (!f) {
      setFile(null)
      setPreview(null)
      return
    }
    const isHEIC = f.type === 'image/heic' || f.name.toLowerCase().endsWith('.heic')
    if (isHEIC) {
      setError('iPhone 사진(HEIC)은 지원하지 않습니다. JPG나 PNG 파일로 올려주세요.')
      return
    }
    if (!f.type.startsWith('image/')) {
      setError('이미지 파일만 가능합니다.')
      return
    }
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const onUpload = async () => {
    if (mode === 'image' && !file) return
    if (mode === 'canva' && !canvaUrl.trim()) {
      setError('Canva 임베드 코드나 공유 링크를 붙여넣어 주세요.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let imageUrl = null
      let cleanCanvaUrl = null
      if (mode === 'image') {
        const compressed = await compressImage(file, 1024, 0.85)
        imageUrl = await uploadImage(compressed)
      } else {
        cleanCanvaUrl = extractCanvaUrl(canvaUrl)
      }

      const data = {
        groupId,
        imageUrl,
        canvaUrl: cleanCanvaUrl,
        posterType: mode,
        caption: caption.trim(),
        authorStudentId: myStudentId,
        updatedAt: Date.now(), // [Antigravity] 수정 시간 기록
      }

      if (posterId) {
        // [Antigravity] 기존 포스터 수정
        await setAt(roomCode, `posters/${posterId}`, data)
      } else {
        // 새 포스터 등록
        await pushUnder(roomCode, `posters`, data)
      }

      setFile(null)
      setPreview(null)
      setCanvaUrl('')
      setCaption('')
      onSuccess?.() // [Antigravity] 성공 콜백 호출
    } catch (e) {
      console.error('Poster Upload Error:', e)
      setError('업로드 실패: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-amber-200 h-full space-y-3">
      <h3 className="font-bold text-amber-800 flex items-center gap-1 text-lg">
        📷 캠페인 포스터
        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-sm ml-1">모둠 공통 1장</span>
      </h3>

      <div className="grid grid-cols-2 gap-1 bg-amber-50 border border-amber-100 rounded-xl p-1">
        {[
          ['image', '사진 올리기'],
          ['canva', 'Canva 붙여넣기'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id)
              setError('')
              if (id === 'canva' && preview) {
                URL.revokeObjectURL(preview)
                setPreview(null)
                setFile(null)
              }
            }}
            disabled={busy}
            className={`py-2 rounded-lg text-xs font-bold transition ${
              mode === id
                ? 'bg-white text-amber-800 shadow-sm border border-amber-200'
                : 'text-amber-700 hover:bg-white/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'image' && !preview && (
        <label className="block">
          <span className="block text-sm text-gray-500 mb-2">
            {posterId 
              ? '기존 포스터를 바꾸려면 새 이미지를 골라 주세요.' 
              : '모둠 캠페인을 보여 줄 이미지를 골라 주세요. 자동으로 1024px·JPEG 85%로 줄여서 올려요.'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onPick}
            className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
          />
        </label>
      )}

      {mode === 'canva' && (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm text-gray-500 mb-2">
              Canva의 공유/임베드 코드나 링크를 붙여넣으세요. 후보 등록 화면과 같은 방식으로 표시됩니다.
            </span>
            <textarea
              value={canvaUrl}
              onChange={(e) => setCanvaUrl(extractCanvaUrl(e.target.value))}
              rows={3}
              placeholder='<iframe ...> 또는 https://www.canva.com/design/...'
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          </label>
          {canvaUrl && (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border bg-gray-50">
              <iframe
                src={formatCanvaEmbedUrl(canvaUrl)}
                allowFullScreen
                allow="fullscreen"
                className="absolute inset-0 w-full h-full border-0"
                title="Canva 포스터 미리보기"
              />
            </div>
          )}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="포스터 한 줄 설명 (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            maxLength={50}
          />
          <button
            onClick={onUpload}
            disabled={busy || !canvaUrl.trim()}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700"
          >
            {busy ? (posterId ? '수정 중...' : '올리는 중...') : (posterId ? '수정하기' : '올리기')}
          </button>
        </div>
      )}

      {mode === 'image' && preview && (
        <div className="space-y-3">
          <img
            src={preview}
            alt="미리보기"
            className="max-h-64 mx-auto rounded-xl border"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="포스터 한 줄 설명 (선택)"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            maxLength={50}
          />
          <div className="flex gap-2">
            <button
              onClick={onUpload}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50 hover:bg-indigo-700"
            >
              {busy ? (posterId ? '수정 중...' : '올리는 중...') : (posterId ? '수정하기' : '올리기')}
            </button>
            <button
              onClick={() => {
                setFile(null)
                setPreview(null)
                setCaption('')
              }}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100 animate-pulse">
          <strong>⚠️ 오류:</strong> {error}
        </div>
      )}
    </div>
  )
}

export default PosterUpload
