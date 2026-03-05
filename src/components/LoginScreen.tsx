import { useState } from 'react';

interface LoginScreenProps {
  onSubmit: (token: string) => void;
}

export default function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || checking) return;

    setChecking(true);
    setError(false);

    try {
      const res = await fetch('/api/snapshot', {
        headers: { Authorization: `Bearer ${value.trim()}` },
      });
      if (res.ok) {
        onSubmit(value.trim());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-title">Agent Teams Dashboard</div>
        <div className="login-subtitle">Authentication required</div>
        <input
          type="password"
          className="login-input"
          placeholder="Enter access token"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(false); }}
          autoFocus
        />
        {error && <div className="login-error">Invalid token</div>}
        <button type="submit" className="login-button" disabled={checking || !value.trim()}>
          {checking ? 'Verifying...' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
