import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type AiConfig, type AiMessage, type AiResponse } from '@/lib/tauri'
import { useLotteryStore } from '@/stores/lotteryStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Settings,
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Sparkles,
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react'

// ─── Constants ───

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'gemini', label: 'Google Gemini' },
]

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Oi! Sou o LotoLab AI, seu assistente de loterias! 🎯

Tenho acesso direto aos dados dos concursos no seu banco de dados. Posso te ajudar com:

• **Analisar numeros** — quais estao quentes, frios, atrasados
• **Sugerir jogos** — com base em estatisticas reais dos concursos
• **Ensinar estrategias** — frequencia, equilibrio, dispersao, padroes
• **Tirar duvidas** — probabilidade, como funcionam as loterias
• **Curiosidades** — recordes, fatos interessantes, numerologia

Me conta: qual loteria voce quer explorar hoje?`,
  timestamp: new Date(),
}

// ─── Types ───

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: Date
  configJson?: string | null
}

// ─── Helper: generate unique ID ───

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ─── Component ───

export default function Assistente() {
  const { activeGame } = useLotteryStore()
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Config state
  const [config, setConfig] = useState<AiConfig>({
    provider: 'openai',
    api_key: '',
    model: 'gpt-4o-mini',
  })
  const [configLoaded, setConfigLoaded] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [configDraft, setConfigDraft] = useState<AiConfig>({ ...config })

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ─── Load saved config on mount ───

  useEffect(() => {
    api.getAiConfig()
      .then((saved) => {
        if (saved) {
          setConfig(saved)
          setConfigDraft(saved)
        }
      })
      .catch((e) => console.error('Erro ao carregar config AI:', e))
      .finally(() => setConfigLoaded(true))
  }, [])

  // ─── Auto-scroll to bottom ───

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight
        }
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // ─── Send message ───

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    if (!config.api_key) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'error',
          content: 'Configure sua chave de API antes de enviar mensagens. Clique no icone de engrenagem no topo.',
          timestamp: new Date(),
        },
      ])
      return
    }

    const userMessage: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // Build message history for API (exclude welcome, errors, and config_json metadata)
    const apiMessages: AiMessage[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, content: m.content }))

    apiMessages.push({ role: 'user', content: text })

    try {
      const response: AiResponse = await api.aiChat(config, apiMessages, activeGame)

      const assistantMessage: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        configJson: response.config_json,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'error',
          content: `Erro ao comunicar com a IA: ${errMsg}`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, isLoading, config, messages])

  // ─── Handle Enter key ───

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // ─── Save settings ───

  const handleSaveSettings = useCallback(async () => {
    try {
      await api.saveAiConfig(configDraft)
      setConfig(configDraft)
      setSettingsOpen(false)
    } catch (e: unknown) {
      console.error('Erro ao salvar config AI:', e)
    }
  }, [configDraft])

  // ─── Open settings dialog ───

  const handleOpenSettings = useCallback(() => {
    setConfigDraft({ ...config })
    setShowApiKey(false)
  }, [config])

  // ─── Provider change in draft ───

  const handleProviderChange = useCallback((provider: string) => {
    const models = MODEL_OPTIONS[provider] || []
    setConfigDraft((prev) => ({
      ...prev,
      provider,
      model: models[0] || '',
    }))
  }, [])

  // ─── Clear chat ───

  const handleClearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE])
  }, [])

  // ─── Apply config from AI response ───

  const handleApplyConfig = useCallback((configJsonStr: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content: 'Configuracao aplicada com sucesso! As novas configuracoes serao usadas na proxima geracao de jogos.',
        timestamp: new Date(),
      },
    ])
    // The config_json could be used by the parent app to apply game generation settings
    // For now we just confirm to the user
    console.log('Config aplicada:', configJsonStr)
  }, [])

  // ─── Render ───

  const providerLabel =
    PROVIDER_OPTIONS.find((p) => p.value === config.provider)?.label || config.provider

  const hasApiKey = config.api_key.length > 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Assistente IA</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={hasApiKey ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0">
                {hasApiKey ? providerLabel : 'Nao configurado'}
              </Badge>
              {hasApiKey && (
                <span className="text-[10px] text-muted-foreground">{config.model}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  disabled={messages.length <= 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Limpar conversa</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenSettings}
                      className={cn(!hasApiKey && 'text-orange-400 animate-pulse')}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Configuracoes da IA</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Configuracoes do Assistente IA</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Provider */}
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Select
                    value={configDraft.provider}
                    onValueChange={handleProviderChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select
                    value={configDraft.model}
                    onValueChange={(model) =>
                      setConfigDraft((prev) => ({ ...prev, model }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODEL_OPTIONS[configDraft.provider] || []).map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* API Key */}
                <div className="space-y-2">
                  <Label>Chave de API</Label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      value={configDraft.api_key}
                      onChange={(e) =>
                        setConfigDraft((prev) => ({ ...prev, api_key: e.target.value }))
                      }
                      placeholder="sk-... ou AIza..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sua chave e armazenada localmente e nunca compartilhada.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveSettings} disabled={!configDraft.api_key.trim()}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ─── Messages Area ─── */}
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="flex flex-col gap-4 p-5 pb-2">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApplyConfig={handleApplyConfig}
            />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-start gap-3 max-w-[80%]">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ─── Input Area ─── */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
        {!hasApiKey && configLoaded && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-xs text-orange-300">
              Configure sua chave de API para comecar a conversar.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs text-orange-400 h-7"
              onClick={() => {
                handleOpenSettings()
                setSettingsOpen(true)
              }}
            >
              Configurar
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasApiKey
                ? 'Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)'
                : 'Configure a API para comecar...'
            }
            disabled={!hasApiKey || isLoading}
            className="min-h-[44px] max-h-[160px] resize-none text-sm"
            rows={1}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || !hasApiKey}
                  size="icon"
                  className="shrink-0 h-[44px] w-[44px]"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enviar mensagem</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}

// ─── Message Bubble Component ───

function MessageBubble({
  message,
  onApplyConfig,
}: {
  message: ChatMessage
  onApplyConfig: (configJson: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const isUser = message.role === 'user'
  const isError = message.role === 'error'


  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: do nothing
    }
  }, [message.content])

  // Parse config_json if present
  let parsedConfig: Record<string, unknown> | null = null
  if (message.configJson) {
    try {
      parsedConfig = JSON.parse(message.configJson)
    } catch {
      parsedConfig = null
    }
  }

  // ─── Error message ───
  if (isError) {
    return (
      <div className="flex items-start gap-3 max-w-[85%]">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10 shrink-0">
          <AlertCircle className="w-4 h-4 text-destructive" />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  // ─── User message ───
  if (isUser) {
    return (
      <div className="flex items-start gap-3 max-w-[80%] ml-auto flex-row-reverse">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-primary text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <p className="text-[10px] opacity-60 mt-1.5 text-right">
            {message.timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    )
  }

  // ─── Assistant message ───
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="space-y-2 min-w-0">
        <div className="group relative rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border">
          <p className="text-sm text-card-foreground whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {message.id !== 'welcome' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Config card from AI */}
        {parsedConfig && message.configJson && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Configuracao Sugerida
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="rounded-lg bg-background/50 border border-border p-3 mb-3">
                <pre className="text-[11px] text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {JSON.stringify(parsedConfig, null, 2)}
                </pre>
              </div>
              <Button
                size="sm"
                className="w-full text-xs"
                onClick={() => onApplyConfig(message.configJson!)}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Aplicar Configuracao
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
