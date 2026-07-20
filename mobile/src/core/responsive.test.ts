import { getContentWidth, getGridColumns, getWindowClass } from './responsive';

describe('responsive helpers', () => {
  it('classifies phone, tablet, expanded and wide widths', () => {
    expect(getWindowClass(390)).toBe('compact');
    expect(getWindowClass(600)).toBe('medium');
    expect(getWindowClass(840)).toBe('expanded');
    expect(getWindowClass(1200)).toBe('wide');
  });

  it('bounds content width and grid columns for foldables', () => {
    expect(getContentWidth(1600)).toBe(1200);
    expect(getGridColumns(390)).toBe(2);
    expect(getGridColumns(900)).toBeGreaterThanOrEqual(4);
    expect(getGridColumns(2000)).toBe(6);
  });
});
