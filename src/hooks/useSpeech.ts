import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API, which TypeScript's DOM lib does not fully cover.
interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechAlternative
}
interface SpeechResultEvent {
  resultIndex: number
  results: { length: number; [index: number]: SpeechResult }
}
interface SpeechRec {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechRecCtor = new () => SpeechRec

function getRecognition(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface Speech {
  /** False when the browser has no speech recognition at all. */
  supported: boolean
  listening: boolean
  /** Set when recognition fails in a way that means "use typing instead". */
  failure: string | null
  start: () => void
  stop: () => void
}

/**
 * Hold-to-talk speech recognition. `onText(finalText, interimText)` is called as words
 * arrive for the current hold. Failures that will not fix themselves (no permission,
 * iPhone with Siri and Dictation off, no speech service) are reported through `failure`
 * so the caller can switch to the typing fallback.
 */
export function useSpeech(onText: (finalText: string, interimText: string) => void): Speech {
  const Recognition = getRecognition()
  const [listening, setListening] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const rec = useRef<SpeechRec | null>(null)
  const holding = useRef(false)
  const finals = useRef('')
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  }, [onText])

  const begin = useCallback(() => {
    if (!Recognition) return
    const r = new Recognition()
    r.lang = 'en-US'
    // Single-utterance mode, restarted while the button is held. Continuous mode repeats
    // words on some Android phones.
    r.continuous = false
    r.interimResults = true
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript
        if (e.results[i].isFinal) finals.current = `${finals.current} ${piece}`.trim()
        else interim += piece
      }
      onTextRef.current(finals.current, interim.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return
      holding.current = false
      setFailure(
        e.error === 'not-allowed' || e.error === 'service-not-allowed'
          ? 'The mic is blocked on this phone. On an iPhone, voice needs Siri or Dictation turned on.'
          : e.error === 'audio-capture'
            ? 'No microphone was found.'
            : 'Voice is not working on this phone right now.',
      )
    }
    r.onend = () => {
      // The recognizer stops by itself after a pause. Keep going while the button is held.
      if (holding.current) {
        try {
          r.start()
          return
        } catch {
          // fall through and stop
        }
      }
      setListening(false)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setFailure('Voice is not working on this phone right now.')
    }
  }, [Recognition])

  const start = useCallback(() => {
    if (!Recognition || holding.current) return
    holding.current = true
    finals.current = ''
    setFailure(null)
    begin()
  }, [Recognition, begin])

  const stop = useCallback(() => {
    holding.current = false
    try {
      rec.current?.stop()
    } catch {
      // already stopped
    }
  }, [])

  useEffect(
    () => () => {
      holding.current = false
      try {
        rec.current?.abort()
      } catch {
        // nothing to clean up
      }
    },
    [],
  )

  return { supported: Boolean(Recognition), listening, failure, start, stop }
}
