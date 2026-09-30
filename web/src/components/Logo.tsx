import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Dorway home">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6,36 L6,20 A14,14 0 0 1 34,20 L34,36 L27,36 L27,21 A7,7 0 0 0 13,21 L13,36 Z"
        />
      </svg>
      <span className="logo-text">Dorway</span>
    </Link>
  );
}
