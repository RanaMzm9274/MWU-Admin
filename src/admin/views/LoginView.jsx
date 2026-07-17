import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Field } from "../components/Common";

export default function LoginView({ onLogin, logoSrc }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin({ email, password });
    } catch (loginError) {
      const message = loginError.message || "Login failed.";
      setError(/failed to fetch|networkerror|load failed/i.test(message) ? "Admin API is not reachable. Start the admin API server on port 4000." : message);
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
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                className="password-toggle-button"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
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
