import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTokenManager } from '@/core';
import type { TokenManager } from '@/core/types';
import { TokenProvider, useAuth } from '@/react';
import { createTestJwt } from '../helpers/create-test-jwt';

const makeWrapper = (manager: TokenManager<Record<string, unknown>>) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <TokenProvider manager={manager}>{children}</TokenProvider>;
  };

describe('useAuth', () => {
  it('returns unauthenticated initial state', () => {
    const manager = createTokenManager({ storage: 'memory' });
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.error).toBeNull();
    manager.destroy();
  });

  it('returns authenticated state when tokens are set on the manager before render', () => {
    const manager = createTokenManager({ storage: 'memory' });
    const token = createTestJwt();
    manager.setTokens({ accessToken: token });

    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe(token);
    expect(result.current.user).not.toBeNull();
    manager.destroy();
  });

  it('re-renders when the manager state changes', () => {
    const manager = createTokenManager({ storage: 'memory' });
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      manager.setTokens({ accessToken: createTestJwt() });
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      manager.logout();
    });
    expect(result.current.isAuthenticated).toBe(false);

    manager.destroy();
  });

  it('throws a descriptive error when used outside <TokenProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within <TokenProvider>'
    );
  });

  it('getAccessToken resolves to the stored access token', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    const token = createTestJwt();
    manager.setTokens({ accessToken: token });

    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    const fetched = await result.current.getAccessToken();
    expect(fetched).toBe(token);
    manager.destroy();
  });

  it('logout transitions auth state to unauthenticated', () => {
    const manager = createTokenManager({ storage: 'memory' });
    manager.setTokens({ accessToken: createTestJwt() });

    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    manager.destroy();
  });

  it('does not cause infinite re-renders', () => {
    const manager = createTokenManager({ storage: 'memory' });
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(manager),
    });

    expect(result.current.isAuthenticated).toBe(false);
    manager.destroy();
  });
});
