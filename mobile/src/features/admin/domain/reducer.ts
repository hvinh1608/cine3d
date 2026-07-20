import type { AdminSection } from './types';

export interface AdminUiState {
  section: AdminSection;
  search: string;
  status: string;
  localPage: number;
}
export type AdminUiAction =
  | { type: 'section'; section: AdminSection }
  | { type: 'search'; search: string }
  | { type: 'status'; status: string }
  | { type: 'page'; page: number }
  | { type: 'reset' };

export const initialAdminUiState: AdminUiState = { section: 'dashboard', search: '', status: 'all', localPage: 1 };
export function adminUiReducer(state: AdminUiState, action: AdminUiAction): AdminUiState {
  switch (action.type) {
    case 'section': return { ...initialAdminUiState, section: action.section };
    case 'search': return { ...state, search: action.search, localPage: 1 };
    case 'status': return { ...state, status: action.status, localPage: 1 };
    case 'page': return { ...state, localPage: Math.max(1, action.page) };
    case 'reset': return initialAdminUiState;
  }
}

export function filterAndPage<T>(
  items: T[],
  search: string,
  status: string,
  searchable: (item: T) => string,
  statusOf: (item: T) => string,
  page: number,
  pageSize = 20,
) {
  const needle = search.trim().toLocaleLowerCase('vi');
  const filtered = items.filter((item) =>
    (!needle || searchable(item).toLocaleLowerCase('vi').includes(needle))
    && (status === 'all' || statusOf(item) === status),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  return { items: filtered.slice((safePage - 1) * pageSize, safePage * pageSize), total: filtered.length, page: safePage, totalPages };
}
