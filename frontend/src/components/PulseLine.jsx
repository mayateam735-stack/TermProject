// Animated heartbeat / ECG brand visual for the auth screens.
// A faint baseline trace with an indigo pulse that sweeps across it on a loop.
const TRACE = "M0,24 H78 l7,-15 l8,30 l6,-15 H150 l9,-11 l8,22 l6,-11 H240";

export default function PulseLine() {
  return (
    <svg
      className="pulse-line"
      viewBox="0 0 240 48"
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pulseGradient" x1="0" y1="0" x2="240" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f6df5" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path className="pulse-base" d={TRACE} stroke="#e2e8f0" />
      <path className="pulse-trace" d={TRACE} stroke="url(#pulseGradient)" />
    </svg>
  );
}
