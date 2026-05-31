# 민국이의 꿈 🏛️

> 초등 6학년 주제통합(국어+사회) 20차시 수업용 민주주의 시뮬레이션 웹앱  
> 교실을 '작은 대한민국'으로 만들어 시민단체 → 선거 → 입법·행정·사법 → 여론 형성을 학생들이 직접 경험합니다.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko)

---

## 수업 구성

| 페이즈 | 이름 | 주요 활동 |
|---|---|---|
| Phase 1 | 시민광장 | 시민단체 결성, 캠페인 포스터, 청원, 여론조사 |
| Phase 2 | 선거 | 후보 등록, 토론, 투표, 당선 발표 |
| Phase 3 | 국정포털 | 입법부(법안), 행정부(정책), 사법부(모의재판) |
| Phase 4 | 시사회 | 기사 작성, 정리글, 성찰 |

---

## 기술 스택

- React 19 + Vite + Tailwind CSS + Zustand
- Firebase Realtime Database (데이터)
- Cloudflare Pages (호스팅)
- 학생 인증: 반 코드 + 번호 + 이름 (익명 Firebase Auth)
- 교사 인증: 비밀번호 (Firebase 이메일/비밀번호 Auth)

---

## 다른 선생님이 사용하려면

### 1단계 — 저장소 Fork

GitHub에서 우측 상단 **Fork** 버튼 클릭 → 본인 계정에 복사

### 2단계 — Firebase 프로젝트 만들기

1. [Firebase Console](https://console.firebase.google.com/) 접속 (구글 계정 필요)
2. **프로젝트 추가** → 프로젝트 이름 입력 → 만들기
3. **Realtime Database** → 데이터베이스 만들기 → 테스트 모드로 시작
4. **Authentication** → Sign-in method에서 두 가지 활성화:
   - ✅ 이메일/비밀번호
   - ✅ 익명
5. **Authentication** → Users → **사용자 추가**:
   - 이메일: `teacher@mingook.app` (또는 원하는 이메일)
   - 비밀번호: 교사 모드 비밀번호로 사용할 값 (6자리 이상)
6. 프로젝트 설정 → 일반 → **웹 앱 추가** → Firebase 구성 값 복사

### 3단계 — Cloudflare Pages 연결

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → **프로젝트 만들기**
2. **Git에 연결** → Fork한 본인 저장소 선택
3. 빌드 설정:
   - 빌드 명령어: `cd app && npm install && npm run build`
   - 빌드 출력 디렉터리: `app/dist`
4. **환경 변수** 탭에서 아래 값 입력 (2단계에서 복사한 Firebase 값):

```
VITE_FIREBASE_API_KEY         = AIza...
VITE_FIREBASE_AUTH_DOMAIN     = 프로젝트명.firebaseapp.com
VITE_FIREBASE_DATABASE_URL    = https://프로젝트명.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID      = 프로젝트명
VITE_FIREBASE_STORAGE_BUCKET  = 프로젝트명.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID = 숫자
VITE_FIREBASE_APP_ID          = 1:숫자:web:...
VITE_TEACHER_EMAIL            = teacher@mingook.app
VITE_TEACHER_PASSCODE         = 설정한비밀번호
```

5. **저장 및 배포** → 완료되면 `https://프로젝트명.pages.dev` 주소로 접속 가능

### 4단계 — Firebase 보안 규칙 설정

Firebase Console → Realtime Database → 규칙 탭에 아래 내용 붙여넣기:

> ⚠️ `TEACHER_UID` 부분을 Firebase Console → Authentication → Users에서 확인한 교사 계정 UID로 교체하세요.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "roomsIndex": {
      ".read": true,
      "$roomCode": {
        ".write": "auth != null && auth.uid === 'TEACHER_UID' || !data.exists()",
        ".validate": "newData.hasChildren(['className', 'createdAt']) && $roomCode.length == 6"
      }
    },
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        "currentPhase": {
          ".write": "auth != null && auth.uid === 'TEACHER_UID'",
          ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 4"
        },
        "config": { ".write": "auth != null && auth.uid === 'TEACHER_UID'" },
        "students": { ".write": "auth != null" },
        "groups": { ".write": "auth != null" },
        "posters": { ".write": "auth != null" },
        "comments": { ".write": "auth != null" },
        "articles": { ".write": "auth != null" },
        "reflections": { ".write": "auth != null" },
        "bills": { ".write": "auth != null" },
        "timers": { ".write": "auth != null" },
        "alliances": { ".write": "auth != null" },
        "activityLog": {
          "$logId": {
            ".write": "auth != null && !data.exists()"
          }
        },
        "electionVotes": {
          "$studentId": { ".write": "auth != null && !data.exists()" }
        },
        "billVotes": {
          "$billId": {
            "$studentId": { ".write": "auth != null && !data.exists()" }
          }
        },
        "polls": {
          "$pollId": {
            "votes": {
              "$studentId": { ".write": "auth != null && !data.exists()" }
            }
          }
        }
      }
    }
  }
}
```

---

## 포스터 이미지 업로드 (선택)

이미지 업로드 기능은 현재 NAS PHP 서버를 사용합니다.  
이 기능이 필요하다면 별도 서버 설정이 필요합니다. 설정이 어려울 경우 이미지 업로드 없이 텍스트만으로도 수업 진행이 가능합니다.
캔바 업로드만 사용하셔도 무방합니다. 캔바쪽이 수시 편집하기에는 오히려 더 좋습니다.

---

## 수업에서 사용할 때

```
교사: 앱 접속 → 교사 버튼 → 비밀번호 입력 → 새 방 만들기 → 반 코드 확인
학생: 앱 접속 → 학생 버튼 → 반 코드 + 번호 + 이름 입력 → 입장
```

---

## 라이선스

이 프로젝트는 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ko) 라이선스를 따릅니다.

- ✅ 자유롭게 사용, 수정, 배포 가능
- ✅ 수정 후 배포 시 동일 라이선스 적용
- ❌ 상업적 이용 금지

---

## 문의

수업 관련 문의나 개선 제안은 GitHub Issues를 이용해 주세요.
