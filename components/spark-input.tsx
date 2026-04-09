'use client';
import { useState } from 'react';

interface SparkInputProps {
  onSubmit: (logline: string) => void;
  isLoading: boolean;
}

export function SparkInput({ onSubmit, isLoading }: SparkInputProps) {
  const [value, setValue] = useState('');

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <h1 className="text-3xl md:text-4xl font-light text-text-2 text-center mb-8 tracking-tight">
        What&apos;s the <span className="text-gold">one line</span> that holds
        <br />your entire story?
      </h1>

      <div>
        <div className="vintage-editor-wrap border rounded-xl p-1">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Two struggling writers meet in a Hyderabad coffee shop and discover they're writing each other's stories..."
            className="vintage-editor w-full p-5 rounded-lg text-lg resize-none outline-none min-h-[120px] border-none"
            maxLength={300}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
                e.preventDefault();
                onSubmit(value.trim());
              }
            }}
          />
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="text-xs" style={{ color: 'var(--color-ink-faint)' }}>{value.length} / 300</span>
          <span className="text-xs italic" style={{ color: 'var(--color-ink-faint)' }}>This is the seed. Everything grows from here.</span>
        </div>
      </div>

      <div className="flex justify-center mt-6">
        <button
          onClick={() => value.trim() ? onSubmit(value.trim()) : onSubmit("Two struggling writers meet in a Hyderabad coffee shop and discover they're writing each other's stories.")}
          disabled={isLoading}
          className="px-8 py-3 bg-surface border border-border-2 rounded-lg text-sm font-medium tracking-wide uppercase text-text-2 hover:bg-surface-2 hover:text-text hover:border-border-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Reading between your lines...' : 'Begin Discovery'}
        </button>
      </div>
    </div>
  );
}
