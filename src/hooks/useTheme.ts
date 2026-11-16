import { useEffect } from 'react'

export type Theme = 'purple' | 'pink' | 'deep'

/** Sets the page background. Real Talk uses deep purple; the default is purple. */
export function useTheme(theme: Theme) {
  useEffect(() => {
    document.body.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'pink' ? '#FF4F8B' : theme === 'deep' ? '#2D1A7A' : '#5B2EE5')
  }, [theme])
}
