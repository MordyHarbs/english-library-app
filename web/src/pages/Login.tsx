import { useState } from 'react'
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { callFunction } from '@/lib/functions'
import { useAuth } from '@/lib/auth'
import { DEFAULT_PUBLIC_SETTINGS, usePublicSettings } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = 'email' | 'code' | 'password'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, isAdmin } = useAuth()
  const { data: publicSettings } = usePublicSettings()
  const branding = publicSettings ?? DEFAULT_PUBLIC_SETTINGS
  const from = (location.state as { from?: string } | null)?.from

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in and just landed here → bounce away.
  if (session) {
    return <Navigate to={from ?? (isAdmin ? '/admin' : '/account/books')} replace />
  }

  const redirectAfterLogin = () => {
    navigate(from ?? (isAdmin ? '/admin' : '/account/books'), { replace: true })
  }

  // Step 1: check the email is a member, then choose the right login method.
  async function continueEmail() {
    const e = email.trim().toLowerCase()
    if (!emailRe.test(e)) return toast.error('Enter a valid email address')
    setBusy(true)
    try {
      const res = await callFunction<{ ok: boolean; reason?: string; hasPassword?: boolean }>(
        'request-login-code',
        { email: e },
      )
      if (!res.ok) {
        if (res.reason === 'not_member') {
          toast.error(
            'That email is not on the member list yet. You can still send a book request; the library will add you as a member and email you when your account is ready.',
            { duration: 7000 },
          )
        } else {
          toast.error('Something went wrong. Please try again.')
        }
        return
      }
      setEmail(e)
      setCode('')
      setPassword('')
      if (res.hasPassword) {
        setStep('password')
      } else {
        await sendOtp(e)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Send the email code and move to the code step. (Membership already verified.)
  async function sendOtp(targetEmail = email.trim().toLowerCase()) {
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
    setStep('code')
    toast.success('We emailed you a login code.')
  }

  async function useCodeInstead() {
    setBusy(true)
    try {
      await sendOtp()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode() {
    const e = email.trim().toLowerCase()
    if (code.trim().length < 4) return toast.error('Enter the code from your email')
    setBusy(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: e,
        token: code.trim(),
        type: 'email',
      })
      if (error) throw error
      toast.success('Logged in!')
      redirectAfterLogin()
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
      await supabase.rpc('mark_password_set')
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
          <img src={branding.library_logo_url} alt={branding.library_name} className="mx-auto mb-1 h-20 w-auto" />
          <CardDescription>
            Logging in is optional — it just lets you track your books and requests
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
                  onKeyDown={(e) => e.key === 'Enter' && continueEmail()}
                  placeholder="you@example.com"
                />
              </div>
              <Button className="w-full" onClick={continueEmail} disabled={busy}>
                Continue
              </Button>
            </>
          )}

          {/* CODE entry */}
          {step === 'code' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Code sent to {email}</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
                  placeholder="Enter the code"
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button className="w-full" onClick={verifyCode} disabled={busy}>
                Verify & log in
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={() => {
                  setPassword('')
                  setStep('password')
                }}
                disabled={busy}
              >
                Use password instead
              </button>
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
                <Label htmlFor="pw">Password for {email}</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
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
                onClick={useCodeInstead}
                disabled={busy}
              >
                I don't have a password - email me a code
              </button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground underline"
                onClick={() => {
                  setPassword('')
                  setStep('email')
                }}
              >
                Use a different email
              </button>
            </>
          )}

          <div className="border-t pt-3 text-center">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Just browsing? Continue to the catalog →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
