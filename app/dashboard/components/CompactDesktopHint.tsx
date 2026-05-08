export function CompactDesktopHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="pwa-hint">
      <h1 className="pwa-hint__title">{title}</h1>
      <p className="pwa-hint__body">{body}</p>
      <div className="pwa-hint__card">
        This screen is simplified on the app. Use the full dashboard in a desktop browser for the complete toolset.
      </div>
    </div>
  )
}
