'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

export type MoodId = 'silence' | 'rain' | 'night' | 'cafe' | 'fire' | 'ocean';

interface Mood {
  id: MoodId;
  label: string;
  icon: string;
}

const MOODS: Mood[] = [
  { id: 'silence', label: 'Silence', icon: '—' },
  { id: 'rain', label: 'Rain', icon: '~' },
  { id: 'night', label: 'Night', icon: '*' },
  { id: 'cafe', label: 'Cafe', icon: '.' },
  { id: 'fire', label: 'Fireplace', icon: '^' },
  { id: 'ocean', label: 'Ocean', icon: '=' },
];

interface AmbientPlayerProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function AmbientPlayer({ isOpen, onToggle }: AmbientPlayerProps) {
  const [activeMood, setActiveMood] = useState<MoodId>('silence');
  const [volume, setVolume] = useState(0.3);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ source: AudioBufferSourceNode | OscillatorNode; gain: GainNode }[]>([]);

  const stopAll = useCallback(() => {
    for (const n of nodesRef.current) {
      try { n.source.stop(); } catch { /* already stopped */ }
      n.gain.disconnect();
    }
    nodesRef.current = [];
  }, []);

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Create colored noise buffer
  const createNoise = useCallback((ctx: AudioContext, seconds: number, color: 'white' | 'brown' | 'pink') => {
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(2, sr * seconds, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        if (color === 'white') {
          data[i] = white * 0.5;
        } else if (color === 'brown') {
          b0 = (b0 + (0.02 * white)) / 1.02;
          data[i] = b0 * 3.5;
        } else {
          // Pink noise (Voss-McCartney approximation)
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }
    }
    return buf;
  }, []);

  const playMood = useCallback((mood: MoodId) => {
    stopAll();
    if (mood === 'silence') return;

    const ctx = getCtx();

    if (mood === 'rain') {
      // Brown noise + low-pass filter = rain
      const buf = createNoise(ctx, 10, 'brown');
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      nodesRef.current.push({ source, gain });
    }

    if (mood === 'night') {
      // Deep drone: two low oscillators slightly detuned
      for (const freq of [55, 58]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.value = volume * 0.4;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        nodesRef.current.push({ source: osc, gain });
      }
      // Add very faint pink noise
      const buf = createNoise(ctx, 10, 'pink');
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = volume * 0.08;
      source.connect(gain).connect(ctx.destination);
      source.start();
      nodesRef.current.push({ source, gain });
    }

    if (mood === 'cafe') {
      // Pink noise (filtered) = murmur of conversations
      const buf = createNoise(ctx, 10, 'pink');
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600;
      bp.Q.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.value = volume * 0.6;
      source.connect(bp).connect(gain).connect(ctx.destination);
      source.start();
      nodesRef.current.push({ source, gain });
    }

    if (mood === 'fire') {
      // Crackle: filtered noise with amplitude modulation
      const buf = createNoise(ctx, 10, 'white');
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3000;
      bp.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.value = volume * 0.15;
      // LFO for crackle effect
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = volume * 0.1;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      source.connect(bp).connect(gain).connect(ctx.destination);
      source.start();
      nodesRef.current.push({ source, gain });
      // Warm base drone
      const drone = ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 80;
      const dGain = ctx.createGain();
      dGain.gain.value = volume * 0.12;
      drone.connect(dGain).connect(ctx.destination);
      drone.start();
      nodesRef.current.push({ source: drone, gain: dGain });
    }

    if (mood === 'ocean') {
      // Layered brown noise with slow LFO on filter = waves
      const buf = createNoise(ctx, 10, 'brown');
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      // Slow sweep for wave feel
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(lp).connect(gain).connect(ctx.destination);
      source.start();
      nodesRef.current.push({ source, gain });
    }
  }, [volume, stopAll, getCtx, createNoise]);

  // Update volume on running nodes
  useEffect(() => {
    // Re-play mood to apply volume (simpler than adjusting each node)
    if (activeMood !== 'silence') {
      playMood(activeMood);
    }
  }, [volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stopAll]);

  const handleMoodClick = (mood: MoodId) => {
    setActiveMood(mood);
    playMood(mood);
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-full mt-1 z-20 border rounded-lg p-4 w-64"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border-2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-text-3 mb-3">Mood</div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {MOODS.map(mood => (
          <button
            key={mood.id}
            onClick={() => handleMoodClick(mood.id)}
            className="flex flex-col items-center gap-1 py-2 px-1 rounded-md cursor-pointer transition-all text-center"
            style={{
              backgroundColor: activeMood === mood.id ? 'rgba(196,92,74,0.1)' : 'transparent',
              borderColor: activeMood === mood.id ? 'rgba(196,92,74,0.2)' : 'transparent',
              border: '1px solid',
              color: activeMood === mood.id ? '#c45c4a' : '#8a8578',
            }}
          >
            <span className="text-lg leading-none">{mood.icon}</span>
            <span className="text-[9px] uppercase tracking-wider">{mood.label}</span>
          </button>
        ))}
      </div>
      {activeMood !== 'silence' && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-3 mb-2">Volume</div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-full accent-gold h-1"
            style={{ accentColor: '#c45c4a' }}
          />
        </div>
      )}
    </div>
  );
}
