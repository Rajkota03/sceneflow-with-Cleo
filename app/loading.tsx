export default function Loading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#13120f' }}
    >
      <div
        className="text-xs uppercase tracking-[0.3em]"
        style={{ color: '#4a4535', animation: 'pulse 2s ease-in-out infinite' }}
      >
        SceneFlow
      </div>
    </div>
  );
}
