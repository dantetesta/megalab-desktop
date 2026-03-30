import { useState, useEffect, useRef, useCallback } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, type AiConfig, type AiMessage, type AiResponse, type AiGameToSave } from '@/lib/tauri'
import { useLotteryStore } from '@/stores/lotteryStore'
import { useChatStore, type ChatMessage } from '@/stores/chatStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
  BarChart, Bar, PieChart, Pie, LineChart, Line,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from 'recharts'

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
  Plus,
  MessageSquare,
} from 'lucide-react'

// ─── Constants ───

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'gemini', label: 'Google Gemini' },
]

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-flash'],
}

const WELCOME_CONTENT = `Oi! Sou o LotoLab AI, seu assistente de loterias! 🎯

Tenho acesso direto aos dados dos concursos no seu banco de dados. Posso te ajudar com:

• **Analisar numeros** — quais estao quentes, frios, atrasados
• **Sugerir jogos** — com base em estatisticas reais dos concursos
• **Ensinar estrategias** — frequencia, equilibrio, dispersao, padroes
• **Tirar duvidas** — probabilidade, como funcionam as loterias
• **Curiosidades** — recordes, fatos interessantes, numerologia

Me conta: qual loteria voce quer explorar hoje?`

// ─── Helper: generate unique ID ───

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function makeWelcomeMessage(): ChatMessage {
  return {
    id: 'welcome-' + uid(),
    role: 'assistant',
    content: WELCOME_CONTENT,
    timestamp: new Date().toISOString(),
  }
}

// ─── Helper: clean message content for display ───

function cleanMessageContent(content: string): string {
  // Remove ```json ... ``` blocks
  let cleaned = content.replace(/```(?:json|sql|JSON|SQL)\s*[\s\S]*?```/g, '')
  // Remove raw JSON objects that look like save_games or config
  cleaned = cleaned.replace(/\{[^{}]*"save_games"\s*:\s*\[[\s\S]*?\]\s*\}/g, '')
  cleaned = cleaned.replace(/\{[^{}]*"strategy_id"\s*:[\s\S]*?\}/g, '')
  // Remove raw JSON arrays of numbers
  cleaned = cleaned.replace(/\{[^{}]*"numbers"\s*:\s*\[[\s\S]*?\]\s*\}/g, '')
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return cleaned
}

// ─── Helper: extract chart blocks from content ───

interface ChartData {
  type: 'bar' | 'pie' | 'line'
  title: string
  data: { name: string; value: number }[]
}

function extractChartBlocks(content: string): { cleanContent: string; charts: ChartData[] } {
  const charts: ChartData[] = []
  const cleanContent = content.replace(/```chart\s*([\s\S]*?)```/g, (_, json) => {
    try {
      charts.push(JSON.parse(json.trim()))
    } catch { /* ignore parse errors */ }
    return ''
  })
  return { cleanContent: cleanContent.replace(/\n{3,}/g, '\n\n').trim(), charts }
}

// ─── Chart Renderer ───

const CHART_COLORS = ['#8b5cf6', '#6366f1', '#a78bfa', '#c084fc', '#7c3aed', '#4f46e5', '#818cf8', '#e879f9']

function ChatChart({ chart }: { chart: ChartData }) {
  return (
    <div className="my-3 p-3 rounded-lg bg-accent/20 border border-border">
      <h4 className="text-xs font-bold mb-2">{chart.title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        {chart.type === 'bar' ? (
          <BarChart data={chart.data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RTooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0] as [number, number, number, number]}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        ) : chart.type === 'pie' ? (
          <PieChart>
            <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <RTooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
          </PieChart>
        ) : (
          <LineChart data={chart.data}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RTooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e0e0e0' }} />
            <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

// ─── Game Suggestion Cards ───

function GameSuggestionCards({ games }: { games: AiGameToSave[] }) {
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())

  return (
    <div className="space-y-2 my-3">
      {games.map((game, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-border">
          <span className="text-[10px] font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
          <div className="flex gap-1 flex-wrap flex-1">
            {game.numbers.map((n) => (
              <span key={n} className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
                {String(n).padStart(2, '0')}
              </span>
            ))}
          </div>
          <button
            onClick={async () => {
              try {
                await api.aiSaveGames([game])
                setSavedIds((prev) => new Set([...prev, i]))
              } catch { /* ignore */ }
            }}
            disabled={savedIds.has(i)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-md shrink-0 transition-colors ${
              savedIds.has(i)
                ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                : 'bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer'
            }`}
          >
            {savedIds.has(i) ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Component ───

export default function Assistente() {
  const { activeGame } = useLotteryStore()
  const {
    chats,
    activeChatId,
    createChat,
    deleteChat,
    setActiveChat,
    addMessage,
    getActiveChat,
  } = useChatStore()

  // Local state
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

  // ─── Initialize chats on mount ───

  useEffect(() => {
    if (chats.length === 0) {
      const id = createChat()
      addMessage(id, makeWelcomeMessage())
    } else if (!activeChatId) {
      setActiveChat(chats[0].id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── Active chat messages ───

  const activeChat = getActiveChat()
  const messages = activeChat?.messages || []

  // ─── Auto-scroll to bottom ───

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // ─── Create new chat ───

  const handleNewChat = useCallback(() => {
    const id = createChat()
    addMessage(id, makeWelcomeMessage())
  }, [createChat, addMessage])

  // ─── Send message ───

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading || !activeChatId) return

    if (!config.api_key) {
      addMessage(activeChatId, {
        id: uid(),
        role: 'error',
        content: 'Configure sua chave de API antes de enviar mensagens. Clique no icone de engrenagem no topo.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    const userMessage: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    addMessage(activeChatId, userMessage)
    setInput('')
    setIsLoading(true)

    // Build message history for API (exclude welcome, errors, and config_json metadata)
    const apiMessages: AiMessage[] = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => !m.id.startsWith('welcome'))
      .map((m) => ({ role: m.role, content: m.content }))

    apiMessages.push({ role: 'user', content: text })

    try {
      let response: AiResponse = await api.aiChat(config, apiMessages, activeGame)
      let currentMessages = [...apiMessages]

      // If AI requests SQL query, execute and send results back (max 2 rounds)
      for (let round = 0; round < 2 && response.sql_query; round++) {
        try {
          const queryResult = await api.aiQueryDb(response.sql_query)
          currentMessages = [...currentMessages,
            { role: 'assistant', content: response.message || 'Consultando dados.' },
            { role: 'user', content: `[RESULTADO DA QUERY]\n${queryResult}\n\nResponda minha pergunta com base nesses dados reais. Use tabelas markdown. NAO inclua blocos SQL ou JSON.` },
          ]
          response = await api.aiChat(config, currentMessages, activeGame)
        } catch (sqlErr) {
          response = { message: `${response.message || ''}\n\n_Erro na consulta: ${sqlErr}_`, config_json: null, sql_query: null }
          break
        }
      }

      let saveGames: AiGameToSave[] | undefined
      if (response.config_json) {
        try {
          const parsed = JSON.parse(response.config_json)
          if (parsed.save_games && Array.isArray(parsed.save_games)) {
            saveGames = parsed.save_games
          }
        } catch {}
      }

      addMessage(activeChatId, {
        id: uid(), role: 'assistant', content: response.message,
        timestamp: new Date().toISOString(), configJson: response.config_json, saveGames,
      })
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      addMessage(activeChatId, {
        id: uid(),
        role: 'error',
        content: `Erro ao comunicar com a IA: ${errMsg}`,
        timestamp: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }, [input, isLoading, config, messages, activeChatId, activeGame, addMessage])

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

  const handleProviderChange = useCallback((provider: string | null) => {
    if (!provider) return
    const models = MODEL_OPTIONS[provider] || []
    setConfigDraft((prev) => ({
      ...prev,
      provider,
      model: models[0] || '',
    }))
  }, [])

  // ─── Apply config from AI response ───

  const handleApplyConfig = useCallback((configJsonStr: string) => {
    if (!activeChatId) return
    addMessage(activeChatId, {
      id: uid(),
      role: 'assistant',
      content: 'Configuracao aplicada com sucesso! As novas configuracoes serao usadas na proxima geracao de jogos.',
      timestamp: new Date().toISOString(),
    })
    console.log('Config aplicada:', configJsonStr)
  }, [activeChatId, addMessage])

  // ─── Render ───

  const providerLabel =
    PROVIDER_OPTIONS.find((p) => p.value === config.provider)?.label || config.provider

  const hasApiKey = config.api_key.length > 0

  return (
    <div className="flex h-full bg-background">
      {/* ─── Chat Sidebar ─── */}
      <div className="w-[200px] flex flex-col border-r border-border bg-card/30 shrink-0">
        <div className="p-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={handleNewChat}
          >
            <Plus size={14} />
            Novo chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 p-1.5">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  'group flex items-center gap-1.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-left',
                  chat.id === activeChatId
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50 text-muted-foreground'
                )}
                onClick={() => setActiveChat(chat.id)}
              >
                <MessageSquare size={13} className="shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate leading-tight">
                    {chat.title}
                  </p>
                  <p className="text-[9px] opacity-50 mt-0.5">
                    {new Date(chat.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                >
                  <Trash2 size={11} className="text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Main Chat Area ─── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* ─── Top Bar ─── */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Assistente IA</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant={hasApiKey ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                  {hasApiKey ? providerLabel : 'Nao configurado'}
                </Badge>
                {hasApiKey && (
                  <span className="text-[10px] text-muted-foreground">{config.model}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <DialogTrigger>
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
                      onValueChange={(model) => {
                        if (model) setConfigDraft((prev) => ({ ...prev, model }))
                      }}
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          <div className="flex flex-col gap-4">
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Pensando</span>
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:200ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse [animation-delay:400ms]" />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Input Area ─── */}
        <div className="shrink-0 border-t border-border bg-card/50 backdrop-blur-sm px-6 py-3">
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
                <TooltipTrigger>
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

  const timestamp = new Date(message.timestamp)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: do nothing
    }
  }, [message.content])

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
            {timestamp.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    )
  }

  // ─── Assistant message ───
  const cleaned = cleanMessageContent(message.content)
  const { cleanContent, charts } = extractChartBlocks(cleaned)

  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
        <Bot className="w-4 h-4 text-primary" />
      </div>
      <div className="space-y-2 min-w-0">
        {/* Game suggestion cards (visual balls with individual save) */}
        {message.saveGames && message.saveGames.length > 0 && (
          <GameSuggestionCards games={message.saveGames} />
        )}

        {/* Chart blocks */}
        {charts.map((chart, i) => <ChatChart key={i} chart={chart} />)}

        <div className="group relative rounded-2xl rounded-tl-sm px-4 py-3 bg-card border border-border">
          <div className="text-sm text-card-foreground leading-relaxed">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2 rounded-lg border border-border">
                    <table className="w-full text-xs border-collapse">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 text-left font-semibold border-b border-border text-foreground">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border-b border-border/50">{children}</td>,
                tr: ({ children }) => <tr className="hover:bg-muted/30">{children}</tr>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="pl-4 mb-2 list-disc space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="pl-4 mb-2 list-decimal space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                a: ({ children, href }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener">{children}</a>,
                h1: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
                h2: ({ children }) => <h3 className="text-sm font-bold mb-1.5 mt-2">{children}</h3>,
                h3: ({ children }) => <h4 className="text-sm font-semibold mb-1 mt-2">{children}</h4>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-primary pl-3 italic text-muted-foreground my-2">{children}</blockquote>,
                code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                hr: () => <hr className="border-border my-3" />,
              }}
            >
              {cleanContent}
            </Markdown>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-muted-foreground">
              {timestamp.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {!message.id.startsWith('welcome') && (
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

        {/* Config card from AI — formatted, no raw JSON */}
        {message.configJson && !message.saveGames && (
          <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-bold">Configuracao pronta</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">O assistente preparou uma configuracao para o Gerador Pro.</p>
            <Button size="sm" onClick={() => onApplyConfig(message.configJson!)}>
              Aplicar no Gerador Pro
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
