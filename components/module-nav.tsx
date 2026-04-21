'use client';
import Link from 'next/link';

interface ModuleNavProps {
  subtitle?: string;
}

export function ModuleNav({ subtitle }: ModuleNavProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-2.5 border-b shrink-0"
      style={{ borderColor: 'rgba(200,189,160,0.06)', background: '#17160f' }}
    >
      <Link
        href="/editor"
        className="text-[10px] font-medium tracking-[0.3em] uppercase hover:opacity-80 transition-opacity"
        style={{ color: '#7a7060' }}
      >
        SceneFlow
      </Link>

      {subtitle ? (
        <p className="text-xs max-w-sm truncate hidden sm:block" style={{ color: '#4a4535' }}>
          &ldquo;{subtitle}&rdquo;
        </p>
      ) : (
        <div className="w-20" />
      )}
    </header>
  );
}
