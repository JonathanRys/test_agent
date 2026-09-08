import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AuthFormProps = { mode: "login" | "register" };

export default function AuthForm({ mode }: AuthFormProps) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      const destination =
        (location.state as { from?: string } | null)?.from ?? "/agent";
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel auth-panel">
      <p className="eyebrow">Hiking Agent</p>
      <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p>
        {mode === "login"
          ? "Sign in to access your agent and personal progress."
          : "Save your progress, preferences, favorites, and ratings."}
      </p>
      <form onSubmit={handleSubmit} className="composer">
        {mode === "register" && (
          <label className="floating-field">
            <input
              placeholder=" "
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
            />
            <span>Name</span>
          </label>
        )}
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
        <label className="floating-field">
          <input
            type="password"
            placeholder=" "
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          <span>Password</span>
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting
            ? "Working..."
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </button>
      </form>
      {mode === "login" && (
        <p>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      )}
      <p>
        {mode === "login" ? "New here? " : "Already have an account? "}
        <Link to={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Log in"}
        </Link>
      </p>
    </section>
  );
}
