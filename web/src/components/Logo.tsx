import { Link } from "react-router-dom";

/** Same mark as the landing header: dark tile, white door arch, no inner stroke. */
export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Dorway home">
      <svg width="32" height="32" viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="#12211C" />
        <path d="M12 31V19a8 8 0 0 1 16 0v12" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      <span className="logo-text">dorway</span>
    </Link>
  );
}
