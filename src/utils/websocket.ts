export const buildWebSocketUrl = (
  path: string,
  params: Record<string, string | number | null | undefined>,
  hostOverride?: string,
) => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = hostOverride || window.location.host;
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return `${protocol}://${host}${path}${queryString ? `?${queryString}` : ''}`;
};
