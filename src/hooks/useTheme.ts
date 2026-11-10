import { useEffect } from 'react'

export type Theme = 'purple' | 'pink' | 'deep'

/** Sets the page background. Wit Dispute is pink, Real Talk is deep purple, the rest purple. */
export function useTheme(theme: Theme) {
  useEffect(() => {
    document.body.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'pink' ? '#FF4F8B' : theme === 'deep' ? '#2D1A7A' : '#5B2EE5')
  }, [theme])
}
