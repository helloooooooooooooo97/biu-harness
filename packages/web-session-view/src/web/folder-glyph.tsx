export function FolderGlyph({ className = 'project-chip-icon' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 18V10A1.5 1.5 0 0 0 19 8.5h-7.2L10 6.5H5A1.5 1.5 0 0 0 3.5 8v.5z"
      />
    </svg>
  )
}
