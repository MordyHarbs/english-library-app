import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Shows a recoverable message instead of a blank screen when rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">Please reload the page and try again.</p>
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => window.location.assign('/')}
        >
          Back to the catalog
        </button>
      </div>
    )
  }
}
