import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { callFunction } from '@/lib/functions'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = 'email' | 'code' | 'password' | 'setPassword'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isAdmin } = useAuth()
  const from = (location.state as { from?: string } | null)?.from

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in and just landed here → bounce away.
  if (session && step !== 'setPassword') {
    return null
  }

  const redirectAfterLogin = () => {
    navigate(from ?? (isAdmin ? '/admin' : '/account/books'), { replace: true })
  }

  async function sendCode() {
    const e = email.trim().toLowerCase()
    if (!emailRe.test(e)) return toast.error('Enter a valid email address')
    setBusy(true)
    try {
      const res = await callFunction<{ ok: boolean; reason?: string }>(
        'request-login-code',
        { email: e },
      )
      if (!res.ok) {
        if (res.reason === 'not_member') {
          toast.error(
            'That email is not on the member list. Please ask the library to add you as a member.',
            { duration: 7000 },
          )
        } else {
          toast.error('Could not send a code. Please try again.')
        }
        return
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: e,
        options: { shouldCreateUser: false },
      })
      if (error) throw error
      setStep('code')
      toast.success('We emailed you a 6-digit code.')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    const e = email.trim().toLowerCase()
    if (code.trim().length < 6) return toast.error('Enter the 6-digit code')
    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: e,
        token: code.trim(),
        type: 'email',
      })
      if (error) throw error
      toast.success('Logged in!')
      setStep('setPassword') // offer (optional) password creation
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function loginWithPassword() {
    const e = email.trim().toLowerCase()
    if (!emailRe.test(e)) return toast.error('Enter a valid email address')
    if (!password) return toast.error('Enter your password')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      })
      if (error) throw error
      redirectAfterLogin()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function savePassword() {
    if (password.length < 8)
      return toast.error('Password must be at least 8 characters')
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Password saved.')
      redirectAfterLogin()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Ayalot Library</CardTitle>
          <CardDescription>
            {step === 'setPassword'
              ? 'Optionally set a password for next time'
              : 'Logging in is optional — it just lets you track your books and requests'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* EMAIL → CODE flow */}
          {step === 'email' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  placeholder="you@example.com"
                />
              </div>
              <Button className="w-full" onClick={sendCode} disabled={busy}>
                Email me a login code
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={() => setStep('password')}
              >
                I have a password
              </button>
            </>
          )}

          {/* CODE entry */}
          {step === 'code' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code sent to {email}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button className="w-full" onClick={verifyCode} disabled={busy}>
                Verify & log in
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={() => setStep('email')}
              >
                Use a different email
              </button>
            </>
          )}

          {/* PASSWORD login */}
          {step === 'password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pw-email">Email</Label>
                <Input
                  id="pw-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loginWithPassword()}
                />
              </div>
              <Button className="w-full" onClick={loginWithPassword} disabled={busy}>
                Log in
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={() => {
                  setPassword('')
                  setStep('email')
                }}
              >
                Email me a code instead (or forgot password)
              </button>
            </>
          )}

          {/* Optional SET PASSWORD after code login */}
          {step === 'setPassword' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password (optional)</Label>
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <Button className="w-full" onClick={savePassword} disabled={busy}>
                Save password
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={redirectAfterLogin}
              >
                Skip — I'll keep using email codes
              </button>
            </>
          )}

          {step !== 'setPassword' && (
            <div className="border-t pt-3 text-center">
              <Link
                to="/"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Just browsing? Continue to the catalog →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
