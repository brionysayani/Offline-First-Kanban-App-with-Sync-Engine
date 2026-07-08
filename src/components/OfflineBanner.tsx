import { useAppStore } from '../store/useAppStore';

function OfflineBanner() {
  const isOnline = useAppStore((state) => state.isOnline);

  if (isOnline) {
    return null;
  }

  return (
    <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
      Offline
    </div>
  );
}

export default OfflineBanner;
