import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(username, password, needs2fa ? totpToken : undefined);
      if (result.requires2fa) {
        setNeeds2fa(true);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center login-bg">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm space-y-4">
        <h1 className="text-section-head text-text-primary text-center mb-2">ForgePanel</h1>

        {!needs2fa ? (
          <>
            <div>
              <label className="field-label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
          </>
        ) : (
          <div>
            <label className="field-label">2FA Code</label>
            <input className="input" value={totpToken} onChange={(e) => setTotpToken(e.target.value)} autoFocus maxLength={6} autoComplete="one-time-code" />
          </div>
        )}

        {error && <p className="text-stopped text-caption">{error}</p>}

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Signing in...' : needs2fa ? 'Verify' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
