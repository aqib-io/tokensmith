import type { AuthState } from '../core/types';

export interface UseAuthReturn<TUser = Record<string, unknown>>
  extends AuthState<TUser> {
  getAccessToken: () => Promise<string | null>;
  logout: () => void;
}
