import { render, screen } from '@testing-library/react-native';

import { Home } from './index';

describe('Home', () => {
  it('shows the Prisme wordmark', async () => {
    await render(<Home />);

    expect(screen.getByText('Prisme')).toBeTruthy();
  });
});
