import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  DatabaseZap,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Settings,
  Star,
  Sun,
  X,
} from 'lucide-react'

import { Logo } from '@/components/Logo'
import { AlertToastContainer } from '@/components/AlertToast'
import { ToastContainer } from '@/components/Toast'
import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useToggleRealtimeQuotes } from '@/lib/useSharedMutations'
import {
  useCapabilityMatrix,
  usePreferences,
  useQuoteStatus,
  useVersion,
} from '@/lib/useSharedQueries'
import { useQuoteStream } from '@/lib/useQuoteStream'
import { toggleTheme, useTheme } from '@/lib/theme'

function ThemeToggle() {
  const theme = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-btn text-muted transition-colors hover:bg-elevated hover:text-foreground"
      title={dark ? '切换到亮色模式' : '切换到暗色模式'}
      aria-label={dark ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function Sidebar({ compact, onClose }: { compact: boolean; onClose?: () => void }) {
  const { data: prefs } = usePreferences()
  const { data: matrix } = useCapabilityMatrix()
  const { data: quoteStatus } = useQuoteStatus({ poll: true })
  const { data: version } = useVersion()
  const toggleQuotes = useToggleRealtimeQuotes()
  const realtimeEnabled = prefs?.realtime_quotes_enabled ?? false

  const capabilities = matrix?.capabilities ?? []
  const usableCount = capabilities.filter(capability => capability.usable).length
  const running = quoteStatus?.running ?? false
  const trading = quoteStatus?.is_trading_hours ?? false
  const paused = quoteStatus?.paused ?? false
  const unavailable = (quoteStatus?.mode ?? 'none') === 'none'
  const active = realtimeEnabled && running && trading
  const statusLabel = paused
    ? '同步期间暂停'
    : active
      ? '实时行情运行中'
      : realtimeEnabled
        ? (trading ? '正在连接行情' : '等待交易时段')
        : '实时行情已关闭'

  const toggleRealtime = async () => {
    const next = !realtimeEnabled
    await toggleQuotes.mutateAsync(next)
    if (next && trading) {
      try { await api.intradayRefresh() } catch { /* 状态轮询会呈现后端失败 */ }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className={cn('flex h-14 shrink-0 items-center border-b border-border px-3', compact ? 'justify-center' : 'gap-2.5')}>
        <Logo size={24} className="shrink-0 text-violet-500" />
        {!compact && (
          <div className="min-w-0 leading-none">
            <div className="truncate text-[12px] font-bold tracking-[0.14em] text-foreground">知行股票</div>
            <div className="mt-1 text-[9px] tracking-[0.16em] text-muted">ZHIXING TERMINAL</div>
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-elevated hover:text-foreground"
            aria-label="关闭导航"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn('shrink-0 border-b border-border py-2', compact ? 'px-2' : 'px-3')}>
        <NavLink
          to="/settings?tab=data-sources"
          onClick={onClose}
          className={cn(
            'flex items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground',
            compact ? 'h-9 justify-center' : 'gap-2 px-2 py-1.5',
          )}
          title={`数据源能力 ${usableCount}/${capabilities.length || 5}`}
        >
          <DatabaseZap className="h-4 w-4 shrink-0" />
          {!compact && (
            <>
              <span className="flex items-center gap-1">
                {(capabilities.length > 0 ? capabilities : Array.from({ length: 5 }, (_, index) => ({ id: String(index), usable: false }))).map(capability => (
                  <span
                    key={capability.id}
                    className={cn(
                      'h-2 w-2 rounded-[2px]',
                      capabilities.length === 0 ? 'animate-pulse bg-border' : capability.usable ? 'bg-accent' : 'bg-warning/80',
                    )}
                  />
                ))}
              </span>
              <span className="ml-auto font-mono text-[10px]">{capabilities.length ? `${usableCount}/${capabilities.length}` : '检测中'}</span>
            </>
          )}
        </NavLink>
      </div>

      <nav className={cn('flex-1 min-h-0 py-3', compact ? 'px-1.5' : 'px-2')} aria-label="主导航">
        <NavLink
          to="/watchlist"
          onClick={onClose}
          className={({ isActive }) => cn(
            'group flex h-9 items-center rounded-md text-sm transition-colors',
            compact ? 'justify-center' : 'gap-2.5 px-2.5',
            isActive ? 'bg-elevated text-foreground' : 'text-secondary hover:bg-elevated/70 hover:text-foreground',
          )}
          title="自选股"
        >
          {({ isActive }) => (
            <>
              <Star className={cn('h-4 w-4 shrink-0', isActive ? 'fill-accent/15 text-accent' : 'text-muted group-hover:text-foreground')} />
              {!compact && <span>自选</span>}
            </>
          )}
        </NavLink>
      </nav>

      <div className={cn('shrink-0 border-t border-border py-2', compact ? 'px-1.5' : 'px-2')}>
        <button
          type="button"
          onClick={() => void toggleRealtime()}
          disabled={toggleQuotes.isPending || paused || unavailable}
          className={cn(
            'flex h-9 w-full items-center rounded-md text-left transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-45',
            compact ? 'justify-center' : 'gap-2 px-2',
          )}
          title={unavailable ? '当前数据源不支持实时行情' : statusLabel}
        >
          <span className="relative shrink-0">
            <Radio className={cn('h-4 w-4', active ? 'text-accent' : 'text-muted')} />
            <span className={cn('absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full', active ? 'animate-pulse bg-accent' : realtimeEnabled ? 'bg-warning' : 'bg-muted')} />
          </span>
          {!compact && (
            <span className="min-w-0">
              <span className="block text-[11px] text-secondary">实时行情</span>
              <span className="block truncate text-[9px] text-muted">{statusLabel}</span>
            </span>
          )}
        </button>

        <div className={cn('mt-1 flex items-center', compact ? 'flex-col gap-1' : 'gap-1')}>
          <NavLink
            to="/settings"
            onClick={onClose}
            className={cn(
              'flex h-9 flex-1 items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground',
              compact ? 'w-9 justify-center' : 'gap-2 px-2',
            )}
            title="设置"
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!compact && <span className="text-xs">设置</span>}
          </NavLink>
          <ThemeToggle />
        </div>
        {!compact && <div className="px-2 pt-1 text-[9px] text-muted">v{version?.version ?? '0.2.3'} · 自选模块</div>}
      </div>
    </div>
  )
}

export function WatchlistLayout() {
  const location = useLocation()
  const { data: prefs } = usePreferences()
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('zhixing-nav-compact') === '1' } catch { return false }
  })
  const [drawerOpen, setDrawerOpen] = useState(false)

  useQuoteStream(prefs?.realtime_quotes_enabled ?? false, prefs?.sse_refresh_pages)

  useEffect(() => setDrawerOpen(false), [location.pathname])
  useEffect(() => {
    if (!drawerOpen) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [drawerOpen])

  const toggleCompact = () => {
    const next = !compact
    setCompact(next)
    try { localStorage.setItem('zhixing-nav-compact', next ? '1' : '0') } catch {}
  }

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-base text-foreground">
      <aside className={cn('relative hidden shrink-0 border-r border-border md:block', compact ? 'w-14' : 'w-52')}>
        <Sidebar compact={compact} />
        <button
          type="button"
          onClick={toggleCompact}
          className={cn(
            'absolute top-3.5 z-10 grid h-7 w-7 place-items-center rounded-btn text-muted transition-colors hover:bg-elevated hover:text-foreground',
            compact ? '-right-3.5 border border-border bg-surface shadow-lg' : 'right-1.5',
          )}
          title={compact ? '展开导航' : '收起导航'}
          aria-label={compact ? '展开导航' : '收起导航'}
        >
          {compact ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭导航"
          />
          <aside className="relative h-full w-64 border-r border-border shadow-2xl">
            <Sidebar compact={false} onClose={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-btn text-muted hover:bg-elevated hover:text-foreground"
            aria-label="打开导航"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Logo size={20} className="text-violet-500" />
          <span className="text-xs font-semibold tracking-[0.12em]">知行股票</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">加载自选模块…</div>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <ToastContainer />
      <AlertToastContainer />
    </div>
  )
}
