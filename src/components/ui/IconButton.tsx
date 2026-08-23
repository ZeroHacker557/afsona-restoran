import type { ReactNode } from 'react'

type Props = { children: ReactNode; label: string; onClick?: () => void }

export function IconButton({ children, label, onClick }: Props) {
  return (
    <button aria-label={label} onClick={onClick} className="icon-button">
      {children}
    </button>
  )
}
