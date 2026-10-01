export function AsyncState({ loading, error, children }) {
  if (loading) return <p className="text-sm text-muted">Loading...</p>;
  if (error) return <p className="text-sm text-neon-red">{error}</p>;
  return children;
}
