'use client'

import { useMemo, useState } from 'react'

export function HomeDemoVideo() {
  const [failed, setFailed] = useState(false)

  const embedUrl = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL || ''
    return raw.trim()
  }, [])

  if (embedUrl) {
    return (
      <div className="home-demo-frame" aria-label="StackPilot walkthrough video">
        <iframe
          className="home-demo-iframe"
          src={embedUrl}
          title="StackPilot walkthrough"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="home-demo-frame" aria-label="StackPilot walkthrough video">
      {!failed ? (
        <video
          className="home-demo-video"
          controls
          playsInline
          preload="metadata"
          poster="/preview-product-listing.png"
          onError={() => setFailed(true)}
        >
          <source src="/stackpilot-demo.mp4" type="video/mp4" />
        </video>
      ) : (
        <div className="home-demo-fallback">
          <div className="home-demo-fallback__title">Add a 90-second walkthrough</div>
          <div className="home-demo-fallback__body">
            Drop a file at <code>/public/stackpilot-demo.mp4</code> or set <code>NEXT_PUBLIC_DEMO_VIDEO_URL</code> (YouTube/Vimeo embed).
          </div>
        </div>
      )}
    </div>
  )
}

