import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  async function confirmEmail() {
    if (!token) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to verify email");
      setVerified(true);
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "Unable to verify email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Email verification</p>
      <h1>{verified ? "Email verified" : "Confirm your email"}</h1>
      {verified ? (
        <p>Your email address is verified. You can now return to the app.</p>
      ) : (
        <>
          <p>Confirm the email address associated with this account.</p>
          {error && <p className="preference-notification error" role="alert">{error}</p>}
          <button type="button" onClick={() => void confirmEmail()} disabled={!token || submitting}>
            {submitting ? "Verifying..." : "Verify email"}
          </button>
        </>
      )}
      <Link className="action-link" to="/login">Return to login</Link>
    </section>
  );
}