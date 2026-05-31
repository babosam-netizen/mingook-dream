/**
 * NAS PHP 업로드 클라이언트
 * - 개발 단계 localhost에서는 절대 URL로 업로드 (CORS는 upload.php에서 허용)
 * - 운영 환경에서는 현재 도메인 기반 상대 경로 활용
 */
const isLocalHost = (hostname) =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.local') ||
  /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)

const NAS_UPLOAD_URL = 'https://babosam.net/class_democra/upload.php'
const KNOWN_CLASS_DEMOCRA_HOSTS = new Set([
  'babosam.net',
  'www.babosam.net',
  'demos.babosam.net',
])

function resolveUploadUrl() {
  const { hostname, origin, pathname } = window.location
  if (isLocalHost(hostname) || KNOWN_CLASS_DEMOCRA_HOSTS.has(hostname)) {
    return NAS_UPLOAD_URL
  }

  const appIndex = pathname.indexOf('/app')
  const basePath = appIndex >= 0 ? pathname.slice(0, appIndex) : ''
  const uploadPath = `${basePath}/upload.php`.replace(/\/{2,}/g, '/')
  return new URL(uploadPath, origin).href
}

const UPLOAD_URL = resolveUploadUrl()

export async function uploadImage(file) {
  if (!(file instanceof Blob)) {
    throw new Error('업로드할 파일이 없습니다.')
  }

  const form = new FormData()
  // [Antigravity] Blob인 경우에도 파일명을 명시적으로 지정하여 서버에서 $_FILES 인식을 돕는다.
  const fileName = file.name || `image_${Date.now()}.jpg`
  form.append('image', file, fileName)

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: form,
  })

  let data
  const text = await res.text()
  try {
    data = JSON.parse(text)
  } catch (e) {
    console.error('Upload JSON Parse Error. Response Text:', text)
    // HTML인 경우 타이틀 태그 추출 시도
    const titleMatch = text.match(/<title>(.*?)<\/title>/i)
    const titleInfo = titleMatch ? ` [Server: ${titleMatch[1]}]` : ''
    throw new Error(`서버 응답이 JSON이 아닙니다.${titleInfo} (${text.slice(0, 50)}...)`)
  }

  if (!res.ok || data.error) {
    throw new Error(data.error || `업로드 실패 (HTTP ${res.status})`)
  }

  return data.url // 예: https://babosam.net/class_democra/uploads/xxx.jpg
}
