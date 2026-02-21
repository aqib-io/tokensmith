import type { Context, ReactElement, ReactNode } from 'react';
import { createContext } from 'react';
import type { TokenManager } from '../core/types';

export const TokenSmithContext: Context<TokenManager | null> =
  createContext<TokenManager | null>(null);

interface TokenProviderProps<TUser = Record<string, unknown>> {
  manager: TokenManager<TUser>;
  children: ReactNode;
}

export function TokenProvider<TUser = Record<string, unknown>>({
  manager,
  children,
}: TokenProviderProps<TUser>): ReactElement {
  return (
    <TokenSmithContext.Provider value={manager as TokenManager}>
      {children}
    </TokenSmithContext.Provider>
  );
}
