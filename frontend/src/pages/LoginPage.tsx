import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';

// ============================================================================
// LoginPage — standalone (outside AppLayout) personal login. On success the
// AuthProvider stores the forever-JWT and swaps in the app shell.
// ============================================================================

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      // On success the whole tree re-renders into the app shell; no reset needed.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-[360px]">
        <div className="rounded-wm-card border border-line bg-surface p-7 shadow-wm-card">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon name="lock" size={20} />
            </div>
            <h1 className="text-lg font-semibold text-fg">WhatsApp Manager</h1>
            <p className="text-[13px] text-fg-muted">Sign in to continue</p>
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label="Username"
              name="username"
              value={username}
              onChange={setUsername}
              autoFocus
              placeholder="username"
            />
            <Input
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              error={error ?? undefined}
            />
            <Button
              type="submit"
              block
              loading={busy}
              label="Sign in"
              icon="arrowRight"
              iconTrailing
            />
          </div>
        </div>
      </form>
    </div>
  );
}
