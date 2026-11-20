import { useRef, useState } from 'react'
import { patchRoom } from '../lib/api.ts'
import { clearDraft, readDraft, useDraft, saveError } from '../lib/drafts.ts'
import { exploresCampus } from '../shared/experience.ts'
import type { RoomRow } from '../shared/types.ts'

export function RoomDetails({
  room,
  onSaved,
  onEditingChange,
}: {
  room: RoomRow
  onSaved: () => void
  onEditingChange?: (open: boolean) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const key = `hwm.room.details.v1.${room.id}`
  const [draft, setDraft, draftSaved] = useDraft(key, {
    title: room.title ?? 'Have We Met?',
    description: room.description ?? '',
  })
  const { title, description } = draft
  const setTitle = (title: string) => setDraft({ ...draft, title })
  const setDescription = (description: string) => setDraft({ ...draft, description })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const open = () => {
    setDraft(readDraft(key, { title: room.title ?? 'Have We Met?', description: room.description ?? '' }))
    setError('')
    onEditingChange?.(true)
    dialog.current?.showModal()
  }
  const save = async () => {
    setBusy(true)
    try {
      await patchRoom(room, { title: title.trim(), description: description.trim() })
      clearDraft(key)
      onSaved()
      dialog.current?.close()
    } catch (error) {
      setError(saveError(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-white btn-small" disabled={busy} onClick={open}>
        Customize room
      </button>
      <dialog
        className="card room-dialog"
        ref={dialog}
        aria-labelledby="room-details-title"
        onClose={() => onEditingChange?.(false)}
      >
        <form
          className="step"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <fieldset className="step" disabled={busy}>
            <h2 id="room-details-title">Welcome your group</h2>
            <label className="field">
              Room name
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                required
                autoFocus
              />
            </label>
            <label className="field">
              Describe this group and its goals
              <textarea
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={4}
                placeholder="For example: We are first-year students new to UC San Diego. We want to discover campus spots and find people to explore with."
              />
            </label>
            <button
              className="btn btn-white btn-small"
              type="button"
              onClick={() =>
                setDescription(
                  'We are new students at UC San Diego. We want to explore campus, discover shared interests, and find people to hang out with again.',
                )
              }
            >
              Use new-student introduction
            </button>
            <p className="hint">
              {exploresCampus({ description })
                ? 'This game will use campus discovery questions and end with an on-campus exploration task.'
                : 'The group description and personal introductions will guide questions and hangout ideas.'}
            </p>
            <p className="hint">
              {draftSaved
                ? 'Edits are kept on this browser until you save them for the room.'
                : 'This browser could not keep your draft. Save before leaving.'}
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="community-actions">
              <button className="btn" disabled={busy || !title.trim()}>
                Save introduction
              </button>
              <button
                className="btn btn-white"
                type="button"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </>
  )
}
