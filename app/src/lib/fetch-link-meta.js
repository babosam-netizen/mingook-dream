/**
 * URL → 페이지 메타(헤드라인·이미지·요약) 자동 추출
 *
 * 1. NAS PHP(fetch_meta.php) 우선 시도 — DSM에서 PHP cURL/OpenSSL 확장이 켜져야 동작
 * 2. 실패 시 microlink.io 무료 API로 fallback (일/100건 한도, 학교 환경에 충분)
 *
 * 둘 다 실패하면 에러 — 학생이 직접 입력하도록 안내.
 */

const NAS_URL = 'https://babosam.net/class_democra/fetch_meta.php'
const MICROLINK_URL = 'https://api.microlink.io'

async function fetchWithTimeout(url, ms = 9000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

function inferSource(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export async function fetchLinkMeta(url) {
  // 1) NAS PHP 시도
  try {
    const res = await fetchWithTimeout(`${NAS_URL}?url=${encodeURIComponent(url)}`)
    const j = await res.json()
    if (!j.error && (j.title || j.image || j.description)) {
      return {
        title: j.title || '',
        description: j.description || '',
        image: j.image || '',
        source: j.source || inferSource(url),
        via: 'nas',
      }
    }
  } catch {
    /* fall through */
  }

  // 2) microlink.io fallback
  try {
    const res = await fetchWithTimeout(`${MICROLINK_URL}?url=${encodeURIComponent(url)}`)
    const j = await res.json()
    if (j.status === 'success' && j.data) {
      return {
        title: j.data.title || '',
        description: j.data.description || '',
        image: j.data.image?.url || '',
        source: j.data.publisher || inferSource(url),
        via: 'microlink',
      }
    }
  } catch {
    /* fall through */
  }

  throw new Error('자동 추출에 실패했어요. 헤드라인·이미지를 직접 입력해 주세요.')
}
