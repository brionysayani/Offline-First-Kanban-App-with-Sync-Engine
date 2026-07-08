import { useCallback, useEffect, useMemo, useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BoardsPage from './pages/BoardsPage';
import BoardPage from './pages/BoardPage';
import { useAppStore } from './store/useAppStore';

type View = 'login' | 'register' | 'boards' | 'board';

function App() {
  const [view, setView] = useState<View>('boards');
  const [selectedBoardId, setSelectedBoardId] = useState<string | undefined>();
  const setOnline = useAppStore((state) => state.setOnline);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);

    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, [setOnline]);

  const openBoard = useCallback((boardId: string) => {
    setSelectedBoardId(boardId);
    setView('board');
  }, []);

  const currentPage = useMemo(() => {
    switch (view) {
      case 'register':
        return <RegisterPage onSwitchToLogin={() => setView('login')} />;
      case 'boards':
        return <BoardsPage onOpenBoard={openBoard} />;
      case 'board':
        return <BoardPage boardId={selectedBoardId} onBack={() => setView('boards')} />;
      case 'login':
      default:
        return <LoginPage onSwitchToRegister={() => setView('register')} onLogin={() => setView('boards')} />;
    }
  }, [openBoard, selectedBoardId, view]);

  return <div className="min-h-screen bg-slate-950 text-slate-100">{currentPage}</div>;
}

export default App;
