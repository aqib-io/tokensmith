import type { Ref } from 'vue';
import { inject, onScopeDispose, readonly, ref } from 'vue';
import type { AuthState, TokenManager } from '../core/types';
import { TokenSmithKey } from './plugin';
import type { UseAuthReturn } from './types';

export function useAuth<
  TUser = Record<string, unknown>,
>(): UseAuthReturn<TUser> {
  const manager = inject(TokenSmithKey);
  if (!manager)
    throw new Error('useAuth requires createTokenSmithPlugin to be installed');

  const typedManager = manager as TokenManager<TUser>;
  const state = ref(typedManager.getState()) as Ref<AuthState<TUser>>;

  const unsubscribe = typedManager.onAuthChange((newState) => {
    state.value = newState;
  });

  onScopeDispose(unsubscribe);

  return {
    state: readonly(state),
    getAccessToken: () => typedManager.getAccessToken(),
    logout: () => typedManager.logout(),
  };
}

export function useTokenManager<
  TUser = Record<string, unknown>,
>(): TokenManager<TUser> {
  const manager = inject(TokenSmithKey);
  if (!manager)
    throw new Error(
      'useTokenManager requires createTokenSmithPlugin to be installed'
    );
  return manager as TokenManager<TUser>;
}
