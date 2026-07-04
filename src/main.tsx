import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from '@/app/App'
import '@/styles/index.css'

// 'prompt' registration: the update toast UI lands in M6; until then a new
// version activates on the next cold start.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
