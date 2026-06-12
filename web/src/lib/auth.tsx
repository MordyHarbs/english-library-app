import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from './database.types'

type Member = Database['public']['Tables']['members']['Row']

interface AuthState {
  session: Session | null
  user: User | null
  member: Member | null
  isAdmin: boolean
  loading: boolean
  refreshMember: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMember = useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setMember(null)
      return
    }
    // Link this auth user to their member row (idempotent), then read it.
    await supabase.rpc('claim_membership')
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('auth_user_id', uid)
      .maybeSingle()
    setMember(data ?? null)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadMember(data.session?.user.id)
      if (active) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      await loadMember(s?.user.id)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadMember])

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    member,
    isAdmin: !!member?.is_admin,
    loading,
    refreshMember: () => loadMember(session?.user.id),
    signOut: async () => {
      await supabase.auth.signOut()
      setMember(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
