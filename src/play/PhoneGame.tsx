import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconClock, IconEyes, IconLock, IconPencil, IconPhone, IconSpark } from '../components/ui.tsx'
import { useCountdown } from '../hooks/useCountdown.ts'
import type { RoomState } from '../hooks/useRoom.ts'
import { castVote, submitAnswer } from '../lib/api.ts'
import { currentAnswers } from '../shared/machine.ts'
import { WIT_MAX_CHARS } from '../shared/quiz.ts'
import type { PlayerRow, RoomRow } from '../shared/types.ts'
import { Message } from './Message.tsx'

interface Props {
  state: RoomState
  room: RoomRow
  player: PlayerRow
}

/** What a phone shows once the game is running. Phones only render the current phase. */
export function PhoneGame({ state, room, player }: Props) {
  const d = room.phase_data
  switch (room.phase) {
    case 'building':
      return <Message icon={<IconSpark size={72} />} title="Building your game…" body="Look up at the big screen." />
    case 'common_ground':
      return <Message icon={<IconEyes size={72} />} title="Look up!" body="See what you all have in common." />
    case 'transition':
      return d.kind === 'phones_out' ? (
        <Message icon={<IconPhone size={72} />} title="Phones out!" body="Keep this screen open. Wit Dispute is next." />
      ) : (
        <PhonesAway />
      )
    case 'tierlist':
      return d.scribeId === player.id ? (
        <Message
          icon={<IconPencil size={72} />}
          title="You're the scribe!"
          body="Head to the laptop. The group debates, you tap the tier."
        />
      ) : (
        <PhonesAway />
      )
    case 'realtalk':
      return <PhonesAway />
    case 'wit_answer':
      return <WitAnswer key={d.promptIndex} state={state} room={room} player={player} />
    case 'wit_vote':
      return <WitVote key={d.promptIndex} state={state} room={room} player={player} />
    case 'wit_reveal':
      return <Message icon={<IconEyes size={72} />} title="Look up!" body="Who wrote what?" />
    case 'hangout':
      return <Message icon={<IconSpark size={72} />} title="Thanks for playing!" body="Look up for your hangout idea." />
    default:
      return <Message title="Hang tight…" />
  }
}

function PhonesAway() {
  return <Message icon={<IconEyes size={84} />} title="Phones away!" body="Look up. This one happens out loud." />
}

function WitAnswer({ state, room, player }: Props) {
  const { promptIndex = 0, pair = [], deadline } = room.phase_data
  const prompt = room.content?.wit[promptIndex]?.prompt ?? ''
  const mine = currentAnswers({ room, answers: state.answers }).find((a) => a.player_id === player.id)
  const secondsLeft = useCountdown(deadline)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sent = useRef(false)

  const send = async () => {
    const answer = text.trim().slice(0, WIT_MAX_CHARS)
    if (!answer || sent.current) return
    sent.current = true
    setSending(true)
    setError(null)
    try {
      await submitAnswer(room, promptIndex, player.id, answer)
      state.refresh()
    } catch {
      sent.current = false
      setError('That did not send. Try again!')
    } finally {
      setSending(false)
    }
  }

  // Time's up: lock in whatever has been typed so far.
  const timeUp = secondsLeft === 0
  useEffect(() => {
    if (timeUp && !mine) void send()
    // Only the timer reaching zero should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  if (!pair.includes(player.id)) {
    return <Message icon={<IconPencil size={72} />} title="Others are writing…" body="Get ready to vote for your favorite." />
  }
  if (mine) {
    return (
      <Message icon={<IconLock size={72} />} title="Locked in!" body="Look up at the big screen.">
        <p className="card pad my-answer">{mine.text}</p>
      </Message>
    )
  }

  return (
    <form
      className="card pad step wit-form"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <p className={`phone-timer ${secondsLeft !== null && secondsLeft <= 10 ? 'low' : ''}`} role="timer">
        <IconClock size={22} /> {secondsLeft ?? '–'}s
      </p>
      <label className="field">
        <span className="wit-phone-prompt">{prompt}</span>
        <textarea
          className="input textarea"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\n/g, ' ').slice(0, WIT_MAX_CHARS))}
          maxLength={WIT_MAX_CHARS}
          rows={3}
          placeholder="Make them laugh…"
          disabled={timeUp}
          autoFocus
        />
      </label>
      <p className="counter" aria-live="off">
        {text.length}/{WIT_MAX_CHARS}
      </p>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-big" type="submit" disabled={!text.trim() || sending || timeUp}>
        <IconLock /> LOCK IT IN
      </button>
    </form>
  )
}

function WitVote({ state, room, player }: Props) {
  const { promptIndex = 0, pair = [] } = room.phase_data
  const prompt = room.content?.wit[promptIndex]?.prompt ?? ''
  const answers = currentAnswers({ room, answers: state.answers })
  const myVote = state.votes.find((v) => v.prompt_index === promptIndex && v.voter_id === player.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Authors cannot vote on their own prompt.
  if (pair.includes(player.id)) {
    return <Message icon={<IconEyes size={72} />} title="Your answer is up!" body="No voting on your own prompt. Watch the big screen." />
  }
  if (myVote) {
    return <Message icon={<IconCheck size={72} />} title="Vote in!" body="Look up for the reveal." />
  }

  const vote = async (answerId: string) => {
    setBusy(true)
    setError(null)
    try {
      await castVote(room, promptIndex, player.id, answerId)
      state.refresh()
    } catch {
      setError('That did not send. Tap again!')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="step vote">
      <p className="card pad wit-phone-prompt">{prompt}</p>
      <h1 className="on-color">Which one wins?</h1>
      {answers.map((a, i) => (
        <button key={a.id} className={`btn btn-vote ${i === 0 ? 'btn-yellow' : 'btn-cyan'}`} disabled={busy} onClick={() => void vote(a.id)}>
          {a.text}
        </button>
      ))}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
