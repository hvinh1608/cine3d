import { adminUiReducer, filterAndPage, initialAdminUiState } from './reducer';

describe('admin UI reducer and status filtering', () => {
  it('resets list state when changing sections and filters', () => {
    const paged = adminUiReducer(initialAdminUiState, { type: 'page', page: 3 });
    const searched = adminUiReducer(paged, { type: 'search', search: 'vinh' });
    expect(searched.localPage).toBe(1);
    expect(adminUiReducer({ ...searched, status: 'PENDING' }, { type: 'section', section: 'vip' })).toEqual({
      ...initialAdminUiState, section: 'vip',
    });
  });
  it('filters status/search and bounds local paging', () => {
    const result = filterAndPage(
      [{ name: 'Alpha', status: 'PENDING' }, { name: 'Beta', status: 'PAID' }],
      'alp', 'PENDING', (item) => item.name, (item) => item.status, 9, 1,
    );
    expect(result).toMatchObject({ total: 1, page: 1, totalPages: 1, items: [{ name: 'Alpha', status: 'PENDING' }] });
  });
});
