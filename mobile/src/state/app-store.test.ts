import { useAppStore } from './app-store';

describe('profile state', () => {
  it('switches and clears the active profile', () => {
    const profile = { id: 'p1', name: 'Trẻ em', isKids: true, hasPin: true };
    useAppStore.getState().setActiveProfile(profile);
    expect(useAppStore.getState().session.activeProfile).toEqual(profile);
    useAppStore.getState().setActiveProfile(null);
    expect(useAppStore.getState().session.activeProfile).toBeNull();
  });
});
