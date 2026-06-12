import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { useCart } from '@/lib/cart'
import { useAuth } from '@/lib/auth'
import { usePublicSettings } from '@/lib/queries'
import { coverUrl } from '@/lib/covers'
import { callFunction } from '@/lib/functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Reserve() {
  const { items, remove, clear, count } = useCart()
  const { session, member } = useAuth()
  const { data: limits } = usePublicSettings()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [pickup, setPickup] = useState('')
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Prefill from the logged-in member.
  useEffect(() => {
    if (member) {
      setName((n) => n || member.name)
      setEmail((e) => e || member.email)
    }
  }, [member])

  const defaultLimit = limits?.default_book_limit ?? 5
  const maxLimit = limits?.max_book_limit ?? 10
  const overSoft = count > defaultLimit
  const blocked = count > maxLimit

  async function submit() {
    if (!name.trim()) return toast.error('Please enter your name')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return toast.error('Please enter a valid email')
    if (blocked) return toast.error(`Please request no more than ${maxLimit} books`)

    setBusy(true)
    try {
      await callFunction('submit-reservation', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        pickup_time: pickup.trim(),
        comments: comments.trim(),
        book_ids: items.map((i) => i.id),
      })
      clear()
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (e) {
      toast.error((e as Error).message || 'Could not send your request')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 size-12 text-success" />
          <h1 className="text-2xl font-semibold">Request received!</h1>
          <p className="mt-2 text-muted-foreground">
            The library will review your request and email you to confirm pickup.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button onClick={() => navigate('/')}>Back to catalog</Button>
            {!session && (
              <p className="text-sm text-muted-foreground">
                Want to track this request and your books?{' '}
                <Link to="/login" className="font-medium text-foreground underline">
                  Log in with your email
                </Link>{' '}
                — totally optional.
              </p>
            )}
          </div>
        </div>
      </AppShell>
    )
  }

  if (count === 0) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <BookOpen className="mx-auto mb-4 size-10 text-muted-foreground opacity-40" />
          <h1 className="text-xl font-semibold">Your request is empty</h1>
          <p className="mt-2 text-muted-foreground">
            Browse the catalog and add the books you'd like to borrow.
          </p>
          <Button className="mt-6" onClick={() => navigate('/')}>
            Browse the catalog
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Your request</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Book list */}
        <div className="space-y-3">
          {items.map((item) => {
            const cover = coverUrl(item.cover_path)
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">
                  {cover ? (
                    <img src={cover} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <BookOpen className="size-5 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.title}</p>
                  {item.author && (
                    <p className="text-sm text-muted-foreground">{item.author}</p>
                  )}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={`Remove ${item.title}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            )
          })}

          {overSoft && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                blocked
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-warning/40 bg-warning/10 text-warning'
              }`}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {blocked ? (
                <span>
                  That's more than the {maxLimit}-book limit. Please remove{' '}
                  {count - maxLimit} to send your request.
                </span>
              ) : (
                <span>
                  You're requesting more than the usual {defaultLimit} books — the
                  library may not be able to approve them all.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-email">Email</Label>
            <Input
              id="r-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!member}
              className={member ? 'bg-muted' : undefined}
            />
            {member && (
              <p className="text-xs text-muted-foreground">
                Using your account email.
              </p>
            )}
          </div>

          {/* Guests give contact details so the library can add them as members */}
          {!member && (
            <>
              <div className="space-y-2">
                <Label htmlFor="r-phone">Phone (optional)</Label>
                <Input id="r-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-address">Address (optional)</Label>
                <Input
                  id="r-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="r-pickup">When will you pick up? (optional)</Label>
            <Input
              id="r-pickup"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="e.g. Tomorrow afternoon"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-comments">Notes (optional)</Label>
            <Input
              id="r-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={busy || blocked} onClick={submit}>
            {busy ? 'Sending…' : `Send request (${count})`}
          </Button>

          {!session && (
            <p className="text-center text-xs text-muted-foreground">
              No account needed. Logging in later just lets you track your request.
            </p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
