import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from '@/app/App'
import { useUpdateStore } from '@/lib/pwa/updateStore'
import '@/styles/index.css'

// 'prompt' registration: never hot-swap mid-WOD. The toast (App) offers the
// restart, and it stays hidden while a timer session is active.
const updateSW = registerSW({
  onNeedRefresh() {
    useUpdateStore.setState({
      needRefresh: true,
      apply: () => void updateSW(true),
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
