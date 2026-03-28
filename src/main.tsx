import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

// Log uncaught errors to console
window.addEventListener('error', (e) => {
  console.error('🔴 Uncaught Error:', e.error)
  console.error('Message:', e.message)
  console.error('Stack:', e.error?.stack)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('🔴 Unhandled Promise Rejection:', e.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
