import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// ---------------------------------------------------------------------------
// Global fetch wrapper
//  - attaches x-user-id to every /api/* request (except login/demo-accounts)
//  - on session-expiry response, clears localStorage and redirects to /login
//    so no page ever crashes on a stale session
// ---------------------------------------------------------------------------
;(function installFetchWrapper() {
  const w = window as any
  if (w.__fetchWrapped) return
  w.__fetchWrapped = true

  const originalFetch = window.fetch.bind(window)
  const LOGIN_ENDPOINTS = ['/api/login', '/api/demo-accounts']

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input
      : input instanceof URL ? input.pathname + input.search
      : input.url

    const isApiCall = url.startsWith('/api/')
    const isLoginCall = LOGIN_ENDPOINTS.some((p) => url.startsWith(p))

    // 1) auto-attach x-user-id
    let finalInit: RequestInit = init || {}
    if (isApiCall && !isLoginCall) {
      const userId = localStorage.getItem('helphome_user_id')
      if (userId) {
        const headers = new Headers(finalInit.headers || {})
        if (!headers.has('x-user-id')) headers.set('x-user-id', userId)
        finalInit = { ...finalInit, headers }
      }
    }

    const response = await originalFetch(input, finalInit)

    // 2) session-expiry → clean return to /login
    if (isApiCall && !isLoginCall && (response.status === 401 || response.status === 404)) {
      const clone = response.clone()
      const body = await clone.json().catch(() => null)
      const isSessionError =
        body?.error === 'User not found' ||
        body?.error === 'Unauthenticated'

      if (isSessionError) {
        localStorage.removeItem('helphome_logged_in')
        localStorage.removeItem('helphome_role')
        localStorage.removeItem('helphome_user_id')
        localStorage.removeItem('helphome_worker_contexts')
        if (window.location.pathname !== '/login') {
          window.location.replace('/login')
        }
      }
    }

    return response
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
