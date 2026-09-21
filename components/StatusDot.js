export default function StatusDot({ tone, children, pulse = false }) {
  return (
    <span className={`status-badge status-badge-${tone}`}>
      <span className={`status-dot status-dot-${tone} ${pulse ? "pulse" : ""}`} aria-hidden="true" />
      {children}
    </span>
  );
}
