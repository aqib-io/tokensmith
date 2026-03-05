import type { InjectionKey, Plugin } from 'vue';
import type { TokenManager } from '../core/types';

export const TokenSmithKey: InjectionKey<TokenManager> = Symbol('tokensmith');

export function createTokenSmithPlugin<TUser = Record<string, unknown>>(
  manager: TokenManager<TUser>
): Plugin {
  return {
    install(app) {
      app.provide(TokenSmithKey, manager as TokenManager);
    },
  };
}
