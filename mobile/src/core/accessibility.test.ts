import { MIN_TOUCH_TARGET, resolveReducedMotion } from './accessibility';

describe('accessibility helpers', () => {
  it('honors either system or user reduced motion', () => {
    expect(resolveReducedMotion(false, false)).toBe(false);
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(false, true)).toBe(true);
  });

  it('uses the Android recommended minimum target', () => {
    expect(MIN_TOUCH_TARGET).toBe(48);
  });
});
