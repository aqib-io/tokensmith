import type { DeepReadonly, Ref } from 'vue';
import type { AuthState } from '../core/types';

export interface UseAuthReturn<TUser = Record<string, unknown>> {
  state: DeepReadonly<Ref<AuthState<TUser>>>;
  getAccessToken: () => Promise<string | null>;
  logout: () => void;
}
