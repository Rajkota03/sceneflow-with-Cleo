'use client';
import { useState, useEffect, useCallback } from 'react';

interface KleoRecapProps {
  message: string;
  onDismiss: () => void;
}

export function KleoRecap({ message, onDismiss }: KleoRecapProps) {
  const [typedText, setTypedText] = useState('');
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let i = 0;
    setTypedText('');
    const interval = setInterval(() => {
      if (i < message.length) {
        setTypedText(message.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setShowButton(true);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [message]);

  // Also dismiss on Escape or any typing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (showButton && !e.metaKey && !e.ctrlKey && e.key.length === 1)) {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss, showButton]);

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'linear-gradient(180deg, rgba(19,18,15,0.97) 0%, rgba(19,18,15,0.85) 70%, transparent 100%)',
        padding: '48px 0 80px',
        display: 'flex', justifyContent: 'center',
        animation: 'fadeIn 0.5s ease-out',
      }}
      onClick={showButton ? onDismiss : undefined}
    >
      <div style={{ maxWidth: 520, padding: '0 32px' }}>
        {/* Kleo identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c45c4a 0%, #8a3a2a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#13120f',
          }}>K</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c45c4a', letterSpacing: '0.06em' }}>KLEO</span>
          <span style={{ fontSize: 10, color: '#4a4740', marginLeft: 4 }}>session recap</span>
        </div>

        {/* Message */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.8,
          color: '#d6ccb0',
        }}>
          {typedText}
          {!showButton && (
            <span style={{ opacity: 0.4, animation: 'blink 1s infinite' }}>|</span>
          )}
        </div>

        {/* Dismiss hint */}
        {showButton && (
          <div style={{
            marginTop: 20, fontSize: 11, color: '#4a4740',
            animation: 'fadeIn 0.5s ease-out',
          }}>
            Press any key or click to start writing
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blink { 0%, 50% { opacity: 0.4; } 51%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}
