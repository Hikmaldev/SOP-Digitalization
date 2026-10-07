import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { useAuth } from '../context/auth-context';

const DEMO_ACCOUNTS = [
  { label: 'Alex · Author (Finance)', email: 'alex.rivera@soply.test' },
  { label: 'Monica · Approver (Finance)', email: 'monica.chen@soply.test' },
  { label: 'Tom · Viewer', email: 'viewer@soply.test' },
  { label: 'Rina · Admin', email: 'admin@soply.test' },
];

const DEMO_PASSWORD = 'Soply123!';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('monica.chen@soply.test');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>SOPly</strong>
            <small>Process library</small>
          </div>
        </div>

        <h1>Sign in</h1>
        <p>One process. One current version. Sign in to your workspace.</p>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="hint-inline">{error}</p>}

          <Button type="submit" disabled={submitting} className="login-submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="login-demo">
          <p>Demo accounts (password {DEMO_PASSWORD}) — click to fill.</p>
          <div className="login-demo-chips">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="login-chip"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(DEMO_PASSWORD);
                  setError(null);
                }}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
