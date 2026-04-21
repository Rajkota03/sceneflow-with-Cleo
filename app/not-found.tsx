import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: '#13120f', color: '#c8bda0' }}
    >
      <h1 className="text-6xl font-light" style={{ color: '#4a4535' }}>404</h1>
      <p className="text-sm" style={{ color: '#7a7060' }}>
        This page doesn't exist in any draft.
      </p>
      <Link
        href="/editor"
        className="text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg transition-all"
        style={{
          color: '#c45c4a',
          border: '1px solid rgba(196,92,74,0.25)',
          background: 'rgba(196,92,74,0.08)',
        }}
      >
        Back to Editor
      </Link>
    </div>
  );
}
