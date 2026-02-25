import { render, screen } from '@testing-library/react';
import { createTokenManager } from '@/core';
import { TokenProvider, useTokenManager } from '@/react';

describe('TokenProvider', () => {
  it('renders children', () => {
    const manager = createTokenManager({ storage: 'memory' });
    render(
      <TokenProvider manager={manager}>
        <span>child content</span>
      </TokenProvider>
    );
    expect(screen.getByText('child content')).toBeTruthy();
    manager.destroy();
  });

  it('provides the manager instance to descendants via context', () => {
    const manager = createTokenManager({ storage: 'memory' });
    let contextManager: unknown;

    function Consumer() {
      contextManager = useTokenManager();
      return null;
    }

    render(
      <TokenProvider manager={manager}>
        <Consumer />
      </TokenProvider>
    );

    expect(contextManager).toBe(manager);
    manager.destroy();
  });
});
