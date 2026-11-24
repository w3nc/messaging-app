import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ApiError } from "../api.js";

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { signIn, signUp, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    setErrors({});
    try {
      if (isSignup) {
        await signUp({
          username: form.username,
          displayName: form.displayName,
          email: form.email,
          password: form.password,
        });
      } else {
        await signIn({
          email: form.email,
          password: form.password,
          remember: form.remember,
        });
      }
      navigate(location.state?.from || "/chat", { replace: true });
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {};
      setErrors(fields || {});
      setFormError(err.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onGuest() {
    setBusy(true);
    setFormError("");
    try {
      await continueAsGuest();
      navigate("/chat", { replace: true });
    } catch (err) {
      setFormError(
        err.message || "Could not start a visitor session. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth__form-side">
        <h1 className="auth__title">
          {isSignup ? "Create account" : "Sign in"}
        </h1>
        <p className="auth__sub">
          Pick up your conversations where you left them.
        </p>
        <div
          className="auth__switch-tabs"
          role="tablist"
          aria-label="Sign in or create account"
        >
          <Link
            role="tab"
            aria-selected={!isSignup}
            className={`auth__tab${!isSignup ? " auth__tab--on" : ""}`}
            to="/login"
          >
            Sign in
          </Link>
          <Link
            role="tab"
            aria-selected={isSignup}
            className={`auth__tab${isSignup ? " auth__tab--on" : ""}`}
            to="/signup"
          >
            Create account
          </Link>
        </div>
        <form className="auth__form" onSubmit={onSubmit} noValidate>
          {isSignup && (
            <>
              <Field
                id="username"
                label="Username"
                value={form.username}
                onChange={(v) => update("username", v)}
                error={errors.username}
                autoComplete="username"
                hint="3-20 letters, numbers, _ or ."
              />
              <Field
                id="displayName"
                label="Display name"
                value={form.displayName}
                onChange={(v) => update("displayName", v)}
                error={errors.displayName}
                autoComplete="name"
              />
            </>
          )}
          <Field
            id="email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => update("email", v)}
            error={errors.email}
            autoComplete="email"
          />
          <Field
            id="password"
            label="Password"
            type="password"
            value={form.password}
            onChange={(v) => update("password", v)}
            error={errors.password}
            autoComplete={isSignup ? "new-password" : "current-password"}
            hint={isSignup ? "At least 8 characters" : undefined}
          />

          {formError && (
            <p className="auth__error" role="alert">
              {formError}
            </p>
          )}

          {!isSignup && (
            <div className="auth__row">
              <label className="auth__remember">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(e) => update("remember", e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <span className="auth__forgot">Forgot password?</span>
            </div>
          )}

          <button className="btn btn--cta" type="submit" disabled={busy}>
            {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>
        or
        <button
          className="auth__guest"
          type="button"
          onClick={onGuest}
          disabled={busy}
        >
          Continue without using an account
        </button>
      </section>
    </main>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  autoComplete,
}) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
      />
      {hint && !error && (
        <small id={`${id}-hint`} className="field__hint">
          {hint}
        </small>
      )}
      {error && (
        <small id={`${id}-error`} className="field__error">
          {error}
        </small>
      )}
    </div>
  );
}
