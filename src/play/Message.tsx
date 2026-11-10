import type { ReactNode } from 'react'

/** A calm full-screen message: icon, title, optional line of text. */
export function Message({ icon, title, body, children }: { icon?: ReactNode; title: string; body?: string; children?: ReactNode }) {
  return (
    <section className="message" role="status">
      {icon && <div className="message-icon">{icon}</div>}
      <h1>{title}</h1>
      {body && <p>{body}</p>}
      {children}
    </section>
  )
}
