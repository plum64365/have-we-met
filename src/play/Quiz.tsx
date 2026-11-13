import { useCallback, useEffect, useRef, useState } from 'react'
import { IconCheck, IconEyes, IconMic, IconPin } from '../components/ui.tsx'
import { useSpeech } from '../hooks/useSpeech.ts'
import { setPlayerLocation, updateQuizPlayer } from '../lib/api.ts'
import { INTERESTS, MAX_INTERESTS, MIN_INTERESTS, quizComplete, quizForRound, voiceAnswersFor } from '../shared/quiz.ts'
import type { QuizSelection, ThisOrThat } from '../shared/quiz.ts'
import type { VoiceQuestion } from '../shared/question-bank.ts'
import type { PlayerRow } from '../shared/types.ts'
import { Message } from './Message.tsx'

const STEPS = ['Interests', 'Voice 1', 'Voice 2', 'Voice 3', 'This or that', 'Location'] as const

/** Resume at the first question that has not been answered or explicitly passed. */
function resumeStep(player: PlayerRow, questions: QuizSelection): number {
  if (player.interests.length < MIN_INTERESTS) return 0
  const answers = voiceAnswersFor(player)
  const missing = questions.voice.findIndex((q) => !answers.some((a) => a.question_id === q.id))
  if (missing >= 0) return missing + 1
  if (questions.thisOrThat.some((q) => !player.this_or_that[q.key])) return 4
  return 5
}

export function Quiz({ player, round }: { player: PlayerRow; round: number }) {
  const questions = quizForRound(player.room_id, round)
  const [draft, setDraft] = useState(player)
  const [step, setStep] = useState(() => resumeStep(player, questions))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)

  const save = useCallback(
    async (patch: Partial<PlayerRow>, nextStep: number) => {
      if (pending.current) return
      pending.current = true
      setSaving(true)
      try {
        setError(null)
        await updateQuizPlayer(player.id, round, patch)
        setDraft((p) => ({ ...p, ...patch }))
        setStep(nextStep)
      } catch {
        setError('That did not save. Check your connection and try again.')
      } finally {
        pending.current = false
        setSaving(false)
      }
    },
    [player.id, round],
  )

  if (quizComplete(player, round) || quizComplete(draft, round)) {
    return <Message icon={<IconEyes size={72} />} title="You're in!" body="Look up at the big screen." />
  }

  const question = questions.voice[step - 1]
  const answerVoice = (answer: string) => {
    const previous = voiceAnswersFor(draft).filter((a) =>
      a.question_id !== question.id && questions.voice.some((q) => q.id === a.question_id),
    )
    return save({
      voice_answers: [...previous, { question_id: question.id, question: question.prompt, answer }],
    }, step + 1)
  }
  return (
    <section className="quiz" aria-busy={saving}>
      <ol className="progress" aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}>
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'past' : i === step ? 'on' : ''} />
        ))}
      </ol>
      <fieldset className="quiz-fields" disabled={saving}>
        {step === 0 && <InterestsStep player={draft} onNext={(interests) => save({ interests }, 1)} />}
        {step >= 1 && step <= 3 && (
          <VoiceStep
            key={question.id}
            question={question}
            number={step}
            answer={voiceAnswersFor(draft).find((a) => a.question_id === question.id)?.answer ?? ''}
            onNext={answerVoice}
            onBack={() => setStep(step - 1)}
          />
        )}
        {step === 4 && (
          <ThisOrThatStep
            player={draft}
            questions={questions.thisOrThat}
            onNext={(this_or_that) => save({ this_or_that }, 5)}
            onBack={() => setStep(3)}
          />
        )}
        {step === 5 && (
          <LocationStep
            player={draft}
            onBack={() => setStep(4)}
            onError={setError}
            onComplete={() => save({ quiz_done: true }, 5)}
          />
        )}
      </fieldset>
      {saving && <p className="hint" role="status">Saving…</p>}
      {error && <p className="notice" role="alert">{error}</p>}
    </section>
  )
}

function InterestsStep({ player, onNext }: { player: PlayerRow; onNext: (interests: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>(player.interests)
  const atMax = picked.length >= MAX_INTERESTS

  const toggle = (interest: string) =>
    setPicked((list) =>
      list.includes(interest) ? list.filter((i) => i !== interest) : list.length >= MAX_INTERESTS ? list : [...list, interest],
    )

  return (
    <div className="card pad step">
      <h1>What are you into?</h1>
      <p className="hint" aria-live="polite">
        Pick {MIN_INTERESTS} to {MAX_INTERESTS}. {picked.length} picked{atMax ? ' (that is the max)' : ''}.
      </p>
      <div className="interest-grid" role="group" aria-label="Interests">
        {INTERESTS.map((interest) => {
          const on = picked.includes(interest)
          return (
            <button
              key={interest}
              type="button"
              className={`pick ${on ? 'on' : ''}`}
              aria-pressed={on}
              disabled={!on && atMax}
              onClick={() => toggle(interest)}
            >
              {interest}
            </button>
          )
        })}
      </div>
      <button className="btn btn-big" disabled={picked.length < MIN_INTERESTS} onClick={() => onNext(picked)}>
        Next
      </button>
    </div>
  )
}

function VoiceStep({ question, number, answer, onNext, onBack }: {
  question: VoiceQuestion
  number: number
  answer: string
  onNext: (text: string) => void
  onBack: () => void
}) {
  const [text, setText] = useState(answer)
  const [interim, setInterim] = useState('')
  const [typing, setTyping] = useState(false)
  const base = useRef('')
  const box = useRef<HTMLTextAreaElement>(null)

  const speech = useSpeech((finalText, interimText) => {
    setText(`${base.current} ${finalText}`.trim().slice(0, 400))
    setInterim(interimText)
  })

  // No speech support, or it failed: go straight to typing.
  const useTyping = typing || !speech.supported || speech.failure !== null
  useEffect(() => {
    if (!speech.listening) setInterim('')
  }, [speech.listening])

  const hold = () => {
    base.current = text
    speech.start()
  }

  return (
    <div className="card pad step">
      <p className="hint">Speaking question {number} of 3 · Speak, type, or pass</p>
      <h1>{question.prompt}</h1>

      {!useTyping && (
        <>
          <button
            type="button"
            className={`talk ${speech.listening ? 'on' : ''}`}
            aria-pressed={speech.listening}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              hold()
            }}
            onPointerUp={speech.stop}
            onPointerCancel={speech.stop}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                hold()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') speech.stop()
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <IconMic size={44} />
            <span>{speech.listening ? 'Listening… let go when done' : 'Hold to talk'}</span>
          </button>
          <p className="interim" aria-live="polite">
            {interim || (text ? '' : 'A sentence or two is plenty.')}
          </p>
        </>
      )}

      {speech.failure && !typing && <p className="hint">{speech.failure} Typing works just as well.</p>}
      {!speech.supported && <p className="hint">Voice is not available in this browser, so type your answer.</p>}

      <label className="field">
        <span>{useTyping ? 'Your answer' : 'What we heard (tap to fix it)'}</span>
        <textarea
          ref={box}
          className="input textarea"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 400))}
          rows={4}
          maxLength={400}
          placeholder={useTyping ? 'Type a sentence or two…' : 'Your words show up here'}
        />
      </label>

      {!useTyping && (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            speech.stop()
            setTyping(true)
            setTimeout(() => box.current?.focus(), 0)
          }}
        >
          Rather type it?
        </button>
      )}

      <button className="btn btn-big" disabled={speech.listening} onClick={() => onNext(text.trim())}>
        {text.trim() ? 'Next' : 'Skip this one'}
      </button>
      <button type="button" className="link-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

function ThisOrThatStep({
  player,
  questions,
  onNext,
  onBack,
}: {
  questions: ThisOrThat[]
  player: PlayerRow
  onNext: (picks: Record<string, 'a' | 'b'>) => void
  onBack: () => void
}) {
  const [picks, setPicks] = useState<Record<string, 'a' | 'b'>>(player.this_or_that ?? {})
  const complete = questions.every((q) => picks[q.key])

  return (
    <div className="card pad step">
      <h1>This or that?</h1>
      <p className="hint">Go with your gut.</p>
      {questions.map((q) => (
        <fieldset className="tot" key={q.key}>
          <legend className="sr-only">
            {q.a.label} or {q.b.label}
          </legend>
          {(['a', 'b'] as const).map((side) => (
            <label key={side} className={`pick tot-pick ${picks[q.key] === side ? 'on' : ''}`}>
              <input
                type="radio"
                name={q.key}
                checked={picks[q.key] === side}
                onChange={() => setPicks((p) => ({ ...p, [q.key]: side }))}
              />
              {q[side].label}
            </label>
          ))}
        </fieldset>
      ))}
      <button className="btn btn-big" disabled={!complete} onClick={() => onNext(picks)}>
        Next
      </button>
      <button type="button" className="link-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}

type Coords = { lat: number; lng: number }

function LocationStep({ player, onBack, onError, onComplete }: {
  player: PlayerRow
  onBack: () => void
  onError: (m: string | null) => void
  onComplete: () => Promise<void>
}) {
  const [share, setShare] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<'idle' | 'asking' | 'ok' | 'failed'>('idle')
  const [busy, setBusy] = useState(false)

  const onToggle = (checked: boolean) => {
    setShare(checked)
    if (!checked) {
      setCoords(null)
      setStatus('idle')
      return
    }
    if (!('geolocation' in navigator)) {
      setStatus('failed')
      return
    }
    setStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Rounded to 2 decimals (about 1 km) before it leaves the phone.
        setCoords({
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100,
        })
        setStatus('ok')
      },
      () => setStatus('failed'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    )
  }

  const finish = async () => {
    setBusy(true)
    onError(null)
    try {
      if (share && coords) {
        // Location is optional, so a failure here never blocks finishing the quiz.
        await setPlayerLocation(player.id, coords.lat, coords.lng).catch(() => {})
      } else if (player.shared_location) {
        await setPlayerLocation(player.id, null, null).catch(() => {})
      }
      await onComplete()
      setBusy(false)
    } catch {
      onError('That did not save. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <div className="card pad step">
      <h1>One last thing</h1>
      <p className="hint">Totally optional. It helps us suggest a hangout spot that is close for everyone.</p>

      <label className="check">
        <input type="checkbox" checked={share} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <strong>
            <IconPin size={20} /> Use my general area
          </strong>
          <small>
            We only use your rough area (about 1 km), only for this game, and never show it to anyone.
          </small>
        </span>
      </label>

      <p className="hint" aria-live="polite">
        {status === 'asking' && 'Asking your phone…'}
        {status === 'ok' && (
          <>
            <IconCheck size={18} /> Got it, thanks!
          </>
        )}
        {status === 'failed' && "Couldn't get your location. No worries, you can still finish."}
      </p>

      <button className="btn btn-big" disabled={busy || status === 'asking'} onClick={() => void finish()}>
        {busy ? 'Saving…' : 'Finish'}
      </button>
      <button type="button" className="link-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
