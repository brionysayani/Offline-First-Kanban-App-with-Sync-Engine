type LoginPageProps = {
  onSwitchToRegister: () => void;
  onLogin: () => void;
};

function LoginPage({ onSwitchToRegister, onLogin }: LoginPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Offline-First Kanban</p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-slate-400">A lightweight shell for auth, boards, and sync.</p>

        <div className="mt-8 space-y-3">
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Email" />
          <input className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Password" type="password" />
          <button className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-medium text-slate-950" onClick={onLogin}>
            Continue
          </button>
        </div>

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
