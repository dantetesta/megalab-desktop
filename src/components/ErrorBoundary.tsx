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
        <div className="h-screen flex items-center justify-center flex-col gap-5 p-10 bg-[#0c1518] text-white">
          <div className="text-center">
            <h1 className="text-[32px] font-extrabold mb-2.5">Erro na Aplicacao</h1>
            <p className="text-base text-[#aaa] mb-5">
              Desculpe, algo deu errado. Aqui esta o erro:
            </p>
            <div className="bg-[#1a2e36] p-5 rounded-[10px] font-mono text-xs max-w-[600px] text-left max-h-[200px] overflow-auto mb-5">
              <p className="m-0 text-[#ff6b6b] font-bold">
                {this.state.error?.message}
              </p>
              <pre className="mt-2.5 mb-0 mx-0 text-[#aaa] overflow-auto whitespace-pre-wrap break-words">
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-lg bg-[var(--ml-primary,#00a876)] text-white border-none cursor-pointer text-sm font-semibold"
            >
              Reiniciar Aplicacao
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
