// No hooks and no "use client": usable in server and client components.

/** A shopping bag with white polka dots (the shop's Retrospot pattern); decorative. */
export default function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M11 12V9.5a5 5 0 0 1 10 0V12" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect className="logo-bag" x="5" y="11" width="22" height="18" rx="3" />
      <circle className="logo-dot" cx="10" cy="16" r="1.7" />
      <circle className="logo-dot" cx="16" cy="16" r="1.7" />
      <circle className="logo-dot" cx="22" cy="16" r="1.7" />
      <circle className="logo-dot" cx="13" cy="21.5" r="1.7" />
      <circle className="logo-dot" cx="19" cy="21.5" r="1.7" />
      <circle className="logo-dot" cx="10" cy="26" r="1.2" />
      <circle className="logo-dot" cx="16" cy="26" r="1.2" />
      <circle className="logo-dot" cx="22" cy="26" r="1.2" />
    </svg>
  );
}
