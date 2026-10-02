import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to request a reset link");
      return;
    }
    setSubmitted(true);
  }

  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Account recovery</p>
      <h1>Reset your password</h1>
      {submitted ? (
        <>
          <p role="status">If that email exists, a reset link has been sent.</p>
          <Link to="/login">Back to login</Link>
        </>
      ) : (
        <form onSubmit={submit} className="composer">
          <label className="floating-field">
            <input
              type="email"
              placeholder=" "
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
            <span>Email address</span>
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">Send reset link</button>
        </form>
      )}
    </section>
  );
}
