import type { ReactNode, ErrorInfo } from 'react'
import { Component } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('❌ ErrorBoundary caught:', error.message)
    console.error('Stack:', error.stack)
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo) {
    console.error('Error details:', errorInfo)
    console.error('Component stack:', errorInfo.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: 40, background: '#0c1518', color: '#fff' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 10 }}>❌ Erro na Aplicação</h1>
            <p style={{ fontSize: 16, color: '#aaa', marginBottom: 20 }}>
              Desculpe, algo deu errado. Aqui está o erro:
            </p>
            <div style={{
              background: '#1a2e36',
              padding: '20px',
              borderRadius: 10,
              fontFamily: 'monospace',
              fontSize: 12,
              maxWidth: 600,
              textAlign: 'left',
              maxHeight: 200,
              overflow: 'auto',
              marginBottom: 20
            }}>
              <p style={{ margin: 0, color: '#ff6b6b', fontWeight: 'bold' }}>
                {this.state.error?.message}
              </p>
              <pre style={{ margin: '10px 0 0 0', color: '#aaa', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                background: 'var(--ml-primary, #00a876)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              🔄 Reiniciar Aplicação
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
