import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Account() {
  const { user, logout } = useAuth();

  return (
    <section className="panel">
      <p className="eyebrow">Account</p>
      <h1>{user?.name}</h1>
      <p>{user?.email}</p>
      <p>{user?.emailVerifiedAt ? "Email verified" : "Email not verified"}</p>
      <div className="meta-row account-actions">
        <Link className="action-link" to="/settings">
          Preferences
        </Link>
        <button type="button" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    </section>
  );
}
