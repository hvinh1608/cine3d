import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from './ui';

jest.mock('@/core/accessibility', () => ({
  MIN_TOUCH_TARGET: 48,
  useAccessibilityPreferences: () => ({ reduceMotion: true, reduceTransparency: false }),
}));

describe('Screen', () => {
  it('exposes a stable native selector', async () => {
    const view = await render(
      <Screen testID="release-validation-screen">
        <Text>Ready</Text>
      </Screen>,
    );

    expect(view.getByTestId('release-validation-screen')).toBeTruthy();
    expect(view.getByText('Ready')).toBeTruthy();
  });
});
