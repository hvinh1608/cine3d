export function mapPlansToProducts<T extends { code: string }>(plans: T[], productIds: string[]) {
  const byCode = new Map(plans.map((plan) => [plan.code.toLowerCase(), plan]));
  return productIds.map((productId) => ({
    productId,
    plan: byCode.get(productId.split('.').at(-1)?.replace(/^vip_/, '').toLowerCase() || ''),
  }));
}
