'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { KleoTasteProfile } from '@/lib/kleo-store';

interface KleoOnboardingProps {
  onComplete: (taste: KleoTasteProfile) => void;
}

type Step = 'intro' | 'films' | 'identity' | 'analyzing' | 'reading';

export function KleoOnboarding({ onComplete }: KleoOnboardingProps) {
  const [step, setStep] = useState<Step>('intro');
  const [films, setFilms] = useState<string[]>(['', '', '', '', '']);
  const [identity, setIdentity] = useState('');
  const [tasteReading, setTasteReading] = useState('');
  const [personality, setPersonality] = useState<KleoTasteProfile['personality']>('gentle');
  const [typedText, setTypedText] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Typewriter effect for Kleo's messages
  const typeMessage = useCallback((text: string, speed = 30) => {
    setTypedText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setTypedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step === 'intro') {
      return typeMessage("Hey. I'm Kleo. Before we start writing together, I want to understand how you see stories. Tell me five films that shaped you — not your \"top 5 of all time\" list, but the ones that made you want to write.");
    }
  }, [step, typeMessage]);

  const filmsValid = films.filter(f => f.trim()).length >= 3;

  const handleFilmSubmit = () => {
    if (!filmsValid) return;
    setStep('identity');
    setTimeout(() => {
      typeMessage("Good choices. Now tell me — what kind of stories do you want to tell? Not genre. The feeling. What do you want an audience to walk away with?");
    }, 100);
  };

  const handleIdentitySubmit = () => {
    if (!identity.trim()) return;
    setStep('analyzing');
    // Call API to analyze taste
    const validFilms = films.filter(f => f.trim());
    analyzeTaste(validFilms, identity.trim());
  };

  const analyzeTaste = async (filmList: string[], writerIdentity: string) => {
    try {
      const res = await fetch('/api/kleo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze-taste',
          films: filmList,
          writerIdentity,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setTasteReading(data.tasteReading);
      setPersonality(data.personality);
      setStep('reading');
      setTimeout(() => typeMessage(data.tasteReading), 200);
    } catch {
      // Fallback: generate a simple reading without AI
      const fallbackReading = generateFallbackReading(filmList, writerIdentity);
      setTasteReading(fallbackReading.reading);
      setPersonality(fallbackReading.personality);
      setStep('reading');
      setTimeout(() => typeMessage(fallbackReading.reading), 200);
    }
  };

  const handleComplete = () => {
    const taste: KleoTasteProfile = {
      films: films.filter(f => f.trim()),
      filmAnalysis: tasteReading,
      writerIdentity: identity.trim(),
      personality,
      onboardedAt: Date.now(),
    };
    onComplete(taste);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#13120f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 560, padding: '40px 48px',
      }}>
        {/* Kleo identity */}
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c45c4a 0%, #8a3a2a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#13120f',
          }}>K</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#c45c4a', letterSpacing: '0.06em' }}>KLEO</span>
        </div>

        {/* Kleo speaks */}
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.7,
          color: '#d6ccb0', minHeight: 80, marginBottom: 32,
        }}>
          {typedText}
          {typedText.length > 0 && typedText.length < 200 && (
            <span style={{ opacity: 0.4, animation: 'blink 1s infinite' }}>|</span>
          )}
        </div>

        {/* Step content */}
        {step === 'intro' && (
          <button
            onClick={() => { setStep('films'); setTypedText(''); }}
            style={{
              padding: '10px 28px', fontSize: 13, fontWeight: 600,
              background: 'rgba(196, 92, 74, 0.1)', color: '#c45c4a',
              border: '1px solid rgba(196, 92, 74, 0.25)', borderRadius: 6,
              cursor: 'pointer', letterSpacing: '0.02em',
            }}
          >
            Let's go
          </button>
        )}

        {step === 'films' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {films.map((film, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  value={film}
                  onChange={e => {
                    const next = [...films];
                    next[i] = e.target.value;
                    setFilms(next);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && film.trim() && i < 4) {
                      inputRefs.current[i + 1]?.focus();
                    }
                    if (e.key === 'Enter' && i === 4 && filmsValid) {
                      handleFilmSubmit();
                    }
                  }}
                  placeholder={`Film ${i + 1}${i >= 3 ? ' (optional)' : ''}`}
                  autoFocus={i === 0}
                  style={{
                    padding: '10px 14px', fontSize: 15,
                    fontFamily: 'var(--font-serif)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, color: '#d6ccb0', outline: 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={handleFilmSubmit}
                disabled={!filmsValid}
                style={{
                  padding: '10px 28px', fontSize: 13, fontWeight: 600,
                  background: filmsValid ? 'rgba(196, 92, 74, 0.1)' : 'transparent',
                  color: filmsValid ? '#c45c4a' : '#4a4740',
                  border: `1px solid ${filmsValid ? 'rgba(196, 92, 74, 0.25)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 6, cursor: filmsValid ? 'pointer' : 'default',
                }}
              >
                These are mine
              </button>
              <span style={{ fontSize: 11, color: '#4a4740' }}>
                {films.filter(f => f.trim()).length}/5 — at least 3
              </span>
            </div>
          </div>
        )}

        {step === 'identity' && (
          <div>
            <textarea
              value={identity}
              onChange={e => setIdentity(e.target.value)}
              placeholder="I want to make people feel..."
              autoFocus
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', fontSize: 15,
                fontFamily: 'var(--font-serif)', lineHeight: 1.7,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, color: '#d6ccb0', outline: 'none',
                resize: 'none',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && identity.trim()) {
                  e.preventDefault();
                  handleIdentitySubmit();
                }
              }}
            />
            <button
              onClick={handleIdentitySubmit}
              disabled={!identity.trim()}
              style={{
                marginTop: 16, padding: '10px 28px', fontSize: 13, fontWeight: 600,
                background: identity.trim() ? 'rgba(196, 92, 74, 0.1)' : 'transparent',
                color: identity.trim() ? '#c45c4a' : '#4a4740',
                border: `1px solid ${identity.trim() ? 'rgba(196, 92, 74, 0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 6, cursor: identity.trim() ? 'pointer' : 'default',
              }}
            >
              That's what I'm after
            </button>
          </div>
        )}

        {step === 'analyzing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#c45c4a',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ fontSize: 13, color: '#5a5440', fontStyle: 'italic' }}>
              Kleo is reading you...
            </span>
          </div>
        )}

        {step === 'reading' && (
          <button
            onClick={handleComplete}
            style={{
              padding: '10px 28px', fontSize: 13, fontWeight: 600,
              background: 'rgba(196, 92, 74, 0.1)', color: '#c45c4a',
              border: '1px solid rgba(196, 92, 74, 0.25)', borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Let's write
          </button>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 0.4; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

// Fallback taste reading when API is unavailable
function generateFallbackReading(films: string[], identity: string): { reading: string; personality: KleoTasteProfile['personality'] } {
  const filmStr = films.join(', ');
  const reading = `Your choices tell me something — ${filmStr}. There's a pattern here. You're drawn to stories where characters are forced to confront who they really are, not who they pretend to be. That tension between the mask and the truth underneath — that's your territory. And what you said about wanting to write: "${identity}" — that's not a genre, that's a mission. I think we're going to work well together.`;

  // Simple heuristic for personality based on common film keywords
  const all = films.join(' ').toLowerCase();
  let personality: KleoTasteProfile['personality'] = 'gentle';
  if (all.match(/tarantino|pulp|kill bill|reservoir|hateful|django/)) personality = 'provocateur';
  else if (all.match(/nolan|inception|interstellar|memento|tenet|fincher|fight club|zodiac|gone girl/)) personality = 'analytical';
  else if (all.match(/malick|wong kar|tree of life|in the mood|stalker|tarkovsky/)) personality = 'poetic';

  return { reading, personality };
}
