import type { Context, ReactElement, ReactNode } from 'react';
import { createContext } from 'react';
import type { TokenManager } from '../core/types';

export const TokenSmithContext: Context<TokenManager | null> =
  createContext<TokenManager | null>(null);

interface TokenProviderProps {
  manager: TokenManager;
  children: ReactNode;
}

export function TokenProvider({
  manager,
  children,
}: TokenProviderProps): ReactElement {
  return (
    <TokenSmithContext.Provider value={manager}>
      {children}
    </TokenSmithContext.Provider>
  );
}
