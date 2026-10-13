/** The Solana logomark, for "paid on Solana" labels. Solid bars, so many copies can share a page. */
export function SolanaMark({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#14F195" d="M6.5 3H23l-5.5 5H1z" />
      <path fill="#5FA8F2" d="M17.5 9.5H1l5.5 5H23z" />
      <path fill="#9945FF" d="M6.5 16H23l-5.5 5H1z" />
    </svg>
  );
}
