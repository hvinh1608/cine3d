import { mapPlansToProducts } from './billing-mapping';

describe('billing mapping', () => {
  it('maps configured Google product suffixes to server plan codes', () => {
    const plans = [{ code: 'MONTHLY', id: 'one' }, { code: 'YEARLY', id: 'two' }];
    expect(mapPlansToProducts(plans, ['vn.cine3d.vip_monthly', 'vn.cine3d.vip_yearly'])).toEqual([
      { productId: 'vn.cine3d.vip_monthly', plan: plans[0] },
      { productId: 'vn.cine3d.vip_yearly', plan: plans[1] },
    ]);
  });
  it('does not invent a plan for an unmapped product', () => {
    expect(mapPlansToProducts([{ code: 'MONTHLY' }], ['vn.cine3d.vip_unknown'])[0]?.plan).toBeUndefined();
  });
});
