import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { GameContent, RoomRow, Spot } from '../shared/types.ts'

export function CampusTask({
  room,
  task,
  spot,
}: {
  room: RoomRow
  task: NonNullable<GameContent['campus_task']>
  spot?: Spot
}) {
  const key = `hwm.campus.v1.${room.id}.${room.round}.${task.key}`
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
      return task.steps.map((_, index) => Array.isArray(value) && value[index] === true)
    } catch {
      return task.steps.map(() => false)
    }
  })
  const [error, setError] = useState('')
  const toggle = (index: number) => {
    const next = done.map((value, step) => (step === index ? !value : value))
    setDone(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setError('')
    } catch {
      setError('Progress is visible now, but this browser could not save it for your next visit.')
    }
  }
  return (
    <section className="card pad campus-task community-card" aria-label="Campus discovery task">
      <p className="kicker">One more thing, together</p>
      <h2>{task.title}</h2>
      <p>A small first adventure. Pick a time in your planner, then explore at your own pace.</p>
      <ol className="campus-steps">
        {task.steps.map((step, index) => (
          <li key={step}>
            <label>
              <input type="checkbox" checked={done[index] ?? false} onChange={() => toggle(index)} />
              <span>{step}</span>
            </label>
          </li>
        ))}
      </ol>
      <p className="hint">
        {done.filter(Boolean).length} of {task.steps.length} complete · Saved on this browser
      </p>
      {error && <p role="status">{error}</p>}
      <div className="community-actions">
        <a
          className="btn btn-white btn-small"
          href="https://campusmap.ucsd.edu/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Campus map
        </a>
        {spot?.source_url && (
          <a
            className="btn btn-white btn-small"
            href={spot.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            About this spot
          </a>
        )}
      </div>
      <p>{task.return_prompt}</p>
      <Link className="btn btn-cyan" to="/stories/write">
        Record your group’s story
      </Link>
    </section>
  )
}
