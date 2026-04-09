'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ModuleNavProps {
  sessionId?: string | null;
  subtitle?: string;
}

export function ModuleNav({ sessionId, subtitle }: ModuleNavProps) {
  const pathname = usePathname();
  const isEditor = pathname === '/editor';
  const isCharBuilder = pathname === '/character-builder';
  const isIdeation = !isEditor && !isCharBuilder;

  const editorHref = sessionId ? `/editor?project=${sessionId}` : '/editor';

  return (
    <header
      className="flex items-center justify-between px-6 py-2.5 border-b shrink-0"
      style={{ borderColor: 'rgba(200,189,160,0.06)', background: '#17160f' }}
    >
      <Link
        href="/"
        className="text-[10px] font-medium tracking-[0.3em] uppercase hover:opacity-80 transition-opacity"
        style={{ color: '#7a7060' }}
      >
        SceneFlow
      </Link>

      {/* Module tabs */}
      <nav className="flex items-center gap-1">
        <Link
          href="/"
          className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] rounded transition-all"
          style={{
            color: isIdeation ? '#c8bda0' : '#4a4535',
            backgroundColor: isIdeation ? 'rgba(200,189,160,0.06)' : 'transparent',
          }}
        >
          Ideation
        </Link>
        <Link
          href="/character-builder"
          className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] rounded transition-all"
          style={{
            color: isCharBuilder ? '#c8bda0' : '#4a4535',
            backgroundColor: isCharBuilder ? 'rgba(200,189,160,0.06)' : 'transparent',
          }}
        >
          Characters
        </Link>
        <Link
          href={editorHref}
          className="px-3 py-1 text-[10px] uppercase tracking-[0.12em] rounded transition-all"
          style={{
            color: isEditor ? '#c8bda0' : '#4a4535',
            backgroundColor: isEditor ? 'rgba(200,189,160,0.06)' : 'transparent',
          }}
        >
          Editor
        </Link>
      </nav>

      {subtitle ? (
        <p className="text-xs max-w-sm truncate hidden sm:block" style={{ color: '#2c2f38' }}>
          &ldquo;{subtitle}&rdquo;
        </p>
      ) : (
        <div className="w-20" />
      )}
    </header>
  );
}
