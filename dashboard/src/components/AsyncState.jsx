export function AsyncState({ loading, error, skeleton = null, children }) {
  if (loading) return skeleton || <p className="text-sm text-muted">Loading...</p>;
  if (error) return <p className="text-sm text-neon-red">{error}</p>;
  return children;
}
