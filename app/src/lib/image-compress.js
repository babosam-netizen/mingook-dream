/**
 * 이미지 압축 — canvas 기반
 * 파일을 받아서 max 길이(기본 800px)에 맞춰 비율 유지로 리사이즈하고
 * JPEG로 품질 80%로 압축한 Blob을 돌려준다.
 *
 * 24명이 동시에 큰 이미지를 올리면 NAS·RTDB·네트워크 모두 무거워지므로
 * 클라이언트에서 미리 줄여서 보낸다.
 */

export async function compressImage(file, maxSize = 1024, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('이미지 파일이 아닙니다.')
  }

  const dataUrl = await readAsDataURL(file)
  const img = await loadImage(dataUrl)

  let { width, height } = img
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round(height * (maxSize / width))
      width = maxSize
    } else {
      width = Math.round(width * (maxSize / height))
      height = maxSize
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas → Blob 실패'))),
      'image/jpeg',
      quality,
    )
  })

  return new File([blob], `poster_${Date.now()}.jpg`, { type: 'image/jpeg' })
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
