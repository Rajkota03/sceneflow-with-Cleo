'use client';
import { useState, useEffect } from 'react';

interface LoadingStateProps {
  messages: string[];
  interval?: number;
}

export function LoadingState({ messages, interval = 2500 }: LoadingStateProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % messages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [messages.length, interval]);

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      {/* Animated dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              backgroundColor: '#c45c4a',
              animationDelay: `${i * 150}ms`,
              animationDuration: '1.2s',
            }}
          />
        ))}
      </div>

      {/* Rotating messages */}
      <p
        key={index}
        className="text-sm font-light tracking-wide animate-fade-in"
        style={{ color: '#4a4740' }}
      >
        {messages[index]}
      </p>
    </div>
  );
}
