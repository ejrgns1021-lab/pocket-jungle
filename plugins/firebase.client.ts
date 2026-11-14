// Firebase 초기화 (설정값이 없으면 조용히 꺼짐 → 게임은 localStorage만으로 동작)
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

export default defineNuxtPlugin(() => {
  const pub = useRuntimeConfig().public as any
  const cfg = pub.firebase as Record<string, string>
  let app: FirebaseApp | null = null
  let db: Firestore | null = null
  let ready: Promise<User | null> = Promise.resolve(null)

  if (cfg.apiKey && cfg.projectId) {
    try {
      app = initializeApp(cfg)

      // App Check: 내 사이트에서 온 요청만 Gemini/Firestore를 쓰게 막아 줌 (남이 키를 훔쳐 써도 차단)
      if (pub.recaptchaSiteKey) {
        if (location.hostname === 'localhost') (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(pub.recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true
        })
      }

      db = getFirestore(app)
      const auth = getAuth(app)
      // 익명 로그인: 회원가입 없이 기기별 고유 uid로 기록/랭킹 저장
      ready = new Promise((resolve) => {
        const stop = onAuthStateChanged(auth, (u) => { if (u) { stop(); resolve(u) } })
        signInAnonymously(auth).catch((e) => { console.warn('[firebase] 익명 로그인 실패', e); resolve(null) })
      })
    } catch (e) {
      console.warn('[firebase] 초기화 실패 — 로컬 모드로 동작', e)
    }
  }

  return { provide: { fb: { app, db, ready, geminiModel: pub.geminiModel as string } } }
})
