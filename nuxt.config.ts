// Nuxt 설정 — 서버 없이 정적 사이트로 빌드 (npm run generate)
// Firebase Hosting(무료 Spark 요금제)과 GitHub Pages 어디에 올려도 그대로 동작
// .env 또는 GitHub Actions 변수의 NUXT_PUBLIC_... 값이 아래 runtimeConfig.public 에 자동으로 들어감
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/main.css'],

  app: {
    // GitHub Pages(…github.io/pocket-jungle/)용: 빌드할 때 NUXT_APP_BASE_URL 로 바뀜
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'ko' },
      title: '포켓 정글 서바이벌',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover' },
        { name: 'theme-color', content: '#1c3a24' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'description', content: '매일 숲이 변하는 레트로 픽셀 서바이벌 로그라이크' }
      ],
      link: [
        { rel: 'manifest', href: 'manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: 'icon.svg' }
      ]
    }
  },

  runtimeConfig: {
    public: {
      firebase: {
        apiKey: '',
        authDomain: '',
        projectId: '',
        appId: ''
      },
      // Firebase AI Logic으로 부를 Gemini 모델 (콘솔에서 지원 모델 확인 후 바꿀 수 있음)
      geminiModel: 'gemini-3.8-flash',
      // App Check(reCAPTCHA Enterprise) 사이트 키 — AI Logic 보호에 필요
      recaptchaSiteKey: ''
    }
  }
})
