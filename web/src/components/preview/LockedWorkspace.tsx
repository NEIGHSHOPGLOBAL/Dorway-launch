import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

export function LockedWorkspace() {
  return (
    <div className="locked-workspace">
      <div className="locked-workspace__bg" aria-hidden="true">
        <div className="locked-workspace__pane" />
        <div className="locked-workspace__pane locked-workspace__pane--mid" />
        <div className="locked-workspace__pane locked-workspace__pane--wide" />
      </div>
      <div className="locked-workspace__veil">
        <span className="locked-workspace__icon">
          <Lock size={28} strokeWidth={2.2} />
        </span>
        <p>Purchase a plan to unlock the best of Dorway AI.</p>
        <Link className="btn btn-primary" to="/pricing">
          Purchase a plan
        </Link>
      </div>
    </div>
  );
}
