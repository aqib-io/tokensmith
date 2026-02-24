import { useCallback, useContext, useSyncExternalStore } from 'react';
import type { TokenManager } from '../core/types';
import { TokenSmithContext } from './provider';
import type { UseAuthReturn } from './types';

/**
 * Subscribes to auth state. Re-renders on every auth change.
 * Must be used inside a {@link TokenProvider}.
 *
 * @example
 * ```tsx
 * const { isAuthenticated, user, logout } = useAuth<MyUser>();
 * ```
 */
export function useAuth<
  TUser = Record<string, unknown>,
>(): UseAuthReturn<TUser> {
  const manager = useContext(TokenSmithContext);
  if (manager === null)
    throw new Error('useAuth must be used within <TokenProvider>');

  const typedManager = manager as TokenManager<TUser>;

  const subscribe = useCallback(
    (callback: () => void) => typedManager.onAuthChange(() => callback()),
    [typedManager]
  );

  const state = useSyncExternalStore(
    subscribe,
    () => typedManager.getState(),
    () => typedManager.getState()
  );

  const getAccessToken = useCallback(
    () => typedManager.getAccessToken(),
    [typedManager]
  );
  const logout = useCallback(() => typedManager.logout(), [typedManager]);

  return { ...state, getAccessToken, logout };
}

/**
 * Returns the raw {@link TokenManager} from context. Prefer {@link useAuth}
 * for component state. Must be used inside a {@link TokenProvider}.
 */
export function useTokenManager<
  TUser = Record<string, unknown>,
>(): TokenManager<TUser> {
  const manager = useContext(TokenSmithContext);
  if (manager === null)
    throw new Error('useTokenManager must be used within <TokenProvider>');
  return manager as TokenManager<TUser>;
}
