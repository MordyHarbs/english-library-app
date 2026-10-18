import { todayStr } from '@/lib/format'
import { Input } from '@/components/ui/input'

/** Date picker for the lend date. A future date marks the book unavailable until then. */
export function LendDateField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mt-3 max-w-xs">
      <label className="text-sm font-medium">Lend date</label>
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value || todayStr())}
        className="mt-1"
      />
      {value > todayStr() && (
        <p className="mt-1 text-xs text-muted-foreground">
          Future date — the book shows as unavailable until then.
        </p>
      )}
    </div>
  )
}
