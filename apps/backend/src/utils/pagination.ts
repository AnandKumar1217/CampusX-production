export function pagination(query: Record<string, unknown>, max = 50) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(max, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
