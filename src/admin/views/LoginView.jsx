import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Field } from "../components/Common";

export default function LoginView({ onLogin, logoSrc }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin({ email, password });
    } catch (loginError) {
      setError(loginError.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <img src={logoSrc} alt="Madda Walabu University" />
          <div>
            <span className="eyebrow">Madda Walabu University</span>
            <h1>Admin CRM Login</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="primary-button" type="submit" disabled={loading}>
            <ShieldCheck size={17} />
            <span>{loading ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
