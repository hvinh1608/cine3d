import { useWindowDimensions } from 'react-native';

export const breakpoints = Object.freeze({
  compact: 0,
  medium: 600,
  expanded: 840,
  wide: 1200,
});

export type WindowClass = 'compact' | 'medium' | 'expanded' | 'wide';

export function getWindowClass(width: number): WindowClass {
  if (width >= breakpoints.wide) return 'wide';
  if (width >= breakpoints.expanded) return 'expanded';
  if (width >= breakpoints.medium) return 'medium';
  return 'compact';
}

export function getGridColumns(width: number, minimumCardWidth = 156, gutter = 16): number {
  const contentWidth = Math.min(Math.max(width, 0), 1200);
  return Math.max(2, Math.min(6, Math.floor((contentWidth + gutter) / (minimumCardWidth + gutter))));
}

export function getContentWidth(width: number): number {
  return Math.min(width, width >= breakpoints.expanded ? 1200 : width);
}

export function useResponsiveLayout() {
  const dimensions = useWindowDimensions();
  const windowClass = getWindowClass(dimensions.width);
  return {
    ...dimensions,
    windowClass,
    isLandscape: dimensions.width > dimensions.height,
    isTablet: dimensions.width >= breakpoints.medium,
    contentWidth: getContentWidth(dimensions.width),
    columns: getGridColumns(dimensions.width),
  };
}

/** Poster grid sizing: 3 columns on phones, responsive on larger screens, cards fill the row. */
export function useMovieGridLayout(horizontalPadding = 16, gap = 8) {
  const layout = useResponsiveLayout();
  const columns = layout.isTablet ? layout.columns : 3;
  const cardWidth = Math.floor(
    (layout.contentWidth - horizontalPadding * 2 - gap * (columns - 1)) / columns,
  );
  return { ...layout, gridColumns: columns, cardWidth };
}
