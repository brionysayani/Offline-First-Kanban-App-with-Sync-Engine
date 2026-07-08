import { FormEvent, useState } from 'react';
import { apiClient } from '../api/client';

type LoginPageProps = {
  onSwitchToRegister: () => void;
  onLogin: () => void;
};

type AuthResponse = {
  token: string;
  user: {
    id: string;
    email: string;
  };
};

function LoginPage({ onSwitchToRegister, onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setSubmitting(true);

    try {
      const response = await apiClient.post<AuthResponse>('/api/auth/login', { email, password }, { auth: false });
      apiClient.setToken(response.token);
      onLogin();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-md border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase text-cyan-400">Offline-First Kanban</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <input
            className="min-h-12 w-full rounded-md border border-slate-700 bg-slate-950 px-4 text-sm outline-none focus:border-cyan-500"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
          <input
            className="min-h-12 w-full rounded-md border border-slate-700 bg-slate-950 px-4 text-sm outline-none focus:border-cyan-500"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            className="min-h-12 w-full rounded-md bg-cyan-500 px-4 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Signing in' : 'Continue'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          No account yet?{' '}
          <button className="text-cyan-400" onClick={onSwitchToRegister}>
            Create one
          </button>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
