'use client'

import dynamic from 'next/dynamic'
import type { GetTheAppBannerProps } from './GetTheAppBannerInner'

const GetTheAppBannerImpl = dynamic(
  () => import('./GetTheAppBannerInner').then((m) => ({ default: m.GetTheAppBannerInner })),
  { ssr: false }
)

export type { GetTheAppBannerProps }

export function GetTheAppBanner(props: GetTheAppBannerProps) {
  return <GetTheAppBannerImpl {...props} />
}
