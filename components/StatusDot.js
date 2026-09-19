export default function StatusDot({ tone, children }) {
  return (
    <span className="status-badge">
      <span className={`status-dot status-dot-${tone}`} aria-hidden="true" />
      {children}
    </span>
  );
}
