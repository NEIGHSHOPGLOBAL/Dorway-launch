import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Dorway home">
      <img src="/logo.png" width="32" height="32" alt="" className="logo-mark" />
      <span className="logo-text">dorway</span>
    </Link>
  );
}
