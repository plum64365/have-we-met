import { useCallback, useState } from 'react'

/** Drafts survive refresh; only a successful server save means shared data is saved. */
export function readDraft<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null')
    return value && value.version === 1 ? (value.data as T) : fallback
  } catch {
    return fallback
  }
}
export function writeDraft<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, data }))
    return true
  } catch {
    return false
  }
}
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Server data still determines completion. */
  }
}
export function useDraft<T>(key: string, fallback: T): [T, (value: T) => void, boolean] {
  const [value, setValue] = useState<T>(() => readDraft(key, fallback))
  const [saved, setSaved] = useState(true)
  const update = useCallback(
    (next: T) => {
      setValue(next)
      setSaved(writeDraft(key, next))
    },
    [key],
  )
  return [value, update, saved]
}
export function saveError(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Check your connection and try again.'
  if (/title|description/i.test(text) && /column|schema cache/i.test(text))
    return 'The game server needs the existing room setup update. Your draft is kept on this browser. Ask the host to contact the project owner.'
  if (/voice_answers|quiz_round|column|schema cache/i.test(text))
    return 'The game server needs the existing quiz update. Your draft is kept on this browser. Ask the host to contact the project owner.'
  if (/permission|row.level|policy|denied|42501/i.test(text))
    return 'The game server refused this save. Your draft is kept on this browser. Ask the host to check the project permissions.'
  return text
}
