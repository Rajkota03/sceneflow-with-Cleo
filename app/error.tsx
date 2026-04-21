'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: '#13120f', color: '#c8bda0' }}
    >
      <h1 className="text-lg font-light" style={{ color: '#c45c4a' }}>
        Something broke
      </h1>
      <p className="text-sm max-w-md text-center" style={{ color: '#7a7060' }}>
        {error.message || 'An unexpected error occurred. Your work is saved locally.'}
      </p>
      <button
        onClick={reset}
        className="text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all cursor-pointer"
        style={{
          color: '#c45c4a',
          border: '1px solid rgba(196,92,74,0.25)',
          background: 'rgba(196,92,74,0.08)',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
