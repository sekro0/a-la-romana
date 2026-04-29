import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { ThemeProvider } from './lib/theme'
import AuthScreen from './screens/AuthScreen'
import HomeScreen from './screens/HomeScreen'
import GroupScreen from './screens/GroupScreen'
import { ToastHost } from './components/Toast'

export default function App() {
  const [user, setUser]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [currentGroupId, setGroupId]  = useState(null)
  const [pendingJoin, setPendingJoin] = useState(null)

  useEffect(() => {
    // Handle ?join=CODE URL param
    const params = new URLSearchParams(window.location.search)
    const joinCode = params.get('join')
    if (joinCode) {
      setPendingJoin(joinCode.toUpperCase())
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }

    const userId = localStorage.getItem('splitya_user_id')
    if (!userId) { setLoading(false); return }
    supabase.from('profiles').select().eq('id', userId).maybeSingle().then(({ data }) => {
      if (data) setUser(data)
      else localStorage.removeItem('splitya_user_id')
      setLoading(false)
    })
  }, [])

  return (
    <ThemeProvider>
      {loading ? (
        <div className="min-h-[100dvh] flex items-center justify-center bg-[#faf8f3] dark:bg-[#130f0c]">
          <div className="flex items-center gap-3 text-stone-500 dark:text-stone-400">
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium tracking-tight">Cargando</span>
          </div>
        </div>
      ) : !user ? (
        <AuthScreen onAuth={setUser} />
      ) : currentGroupId ? (
        <GroupScreen
          groupId={currentGroupId}
          user={user}
          onBack={() => setGroupId(null)}
        />
      ) : (
        <HomeScreen user={user} onSelectGroup={setGroupId} pendingJoin={pendingJoin} onClearPendingJoin={() => setPendingJoin(null)} />
      )}
      <ToastHost />
    </ThemeProvider>
  )
}
