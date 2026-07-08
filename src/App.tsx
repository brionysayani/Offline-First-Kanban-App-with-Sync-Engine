import { useMemo, useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BoardsPage from './pages/BoardsPage';
import BoardPage from './pages/BoardPage';

type View = 'login' | 'register' | 'boards' | 'board';

function App() {
  const [view, setView] = useState<View>('login');

  const currentPage = useMemo(() => {
    switch (view) {
      case 'register':
        return <RegisterPage onSwitchToLogin={() => setView('login')} />;
      case 'boards':
        return <BoardsPage onOpenBoard={() => setView('board')} />;
      case 'board':
        return <BoardPage onBack={() => setView('boards')} />;
      case 'login':
      default:
        return <LoginPage onSwitchToRegister={() => setView('register')} onLogin={() => setView('boards')} />;
    }
  }, [view]);

  return <div className="min-h-screen bg-slate-950 text-slate-100">{currentPage}</div>;
}

export default App;
