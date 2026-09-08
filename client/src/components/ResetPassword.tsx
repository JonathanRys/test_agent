import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: searchParams.get("token"), password }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Unable to reset password");
      navigate("/login", {
        replace: true,
        state: { message: "Password reset. You can now log in." },
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reset password",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Choose a new password</h1>
      <form onSubmit={submit} className="composer">
        <label className="floating-field">
          <input
            type="password"
            placeholder=" "
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span>New password</span>
        </label>
        <label className="floating-field">
          <input
            type="password"
            placeholder=" "
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <span>Confirm password</span>
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={saving || !searchParams.get("token")}>
          {saving ? "Saving..." : "Reset password"}
        </button>
      </form>
      <Link to="/login">Back to login</Link>
    </section>
  );
}
