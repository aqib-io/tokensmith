import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import { createTokenManager } from '@/core';
import type { TokenManager } from '@/core/types';
import type { UseAuthReturn } from '@/vue';
import { createTokenSmithPlugin, useAuth } from '@/vue';
import { createTestJwt } from '../helpers/create-test-jwt';

function mountWithPlugin<TUser = Record<string, unknown>>(
  manager: TokenManager<TUser>,
  setup: () => unknown
) {
  const Child = defineComponent({ setup, render: () => null });
  return mount(Child, {
    global: {
      plugins: [createTokenSmithPlugin(manager)],
    },
  });
}

describe('useAuth', () => {
  it('returns unauthenticated initial state', () => {
    const manager = createTokenManager({ storage: 'memory' });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    expect(result!.state.value.isAuthenticated).toBe(false);
    expect(result!.state.value.user).toBeNull();
    expect(result!.state.value.accessToken).toBeNull();
    expect(result!.state.value.isRefreshing).toBe(false);
    expect(result!.state.value.error).toBeNull();

    wrapper.unmount();
    manager.destroy();
  });

  it('returns authenticated state when tokens are pre-set', () => {
    const manager = createTokenManager({ storage: 'memory' });
    const token = createTestJwt();
    manager.setTokens({ accessToken: token });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    expect(result!.state.value.isAuthenticated).toBe(true);
    expect(result!.state.value.accessToken).toBe(token);
    expect(result!.state.value.user).not.toBeNull();

    wrapper.unmount();
    manager.destroy();
  });

  it('reactively updates when manager state changes', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    expect(result!.state.value.isAuthenticated).toBe(false);

    manager.setTokens({ accessToken: createTestJwt() });
    await nextTick();
    expect(result!.state.value.isAuthenticated).toBe(true);

    manager.logout();
    await nextTick();
    expect(result!.state.value.isAuthenticated).toBe(false);

    wrapper.unmount();
    manager.destroy();
  });

  it('getAccessToken resolves to the stored token', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    const token = createTestJwt();
    manager.setTokens({ accessToken: token });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    const fetched = await result!.getAccessToken();
    expect(fetched).toBe(token);

    wrapper.unmount();
    manager.destroy();
  });

  it('logout transitions to unauthenticated', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    manager.setTokens({ accessToken: createTestJwt() });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    expect(result!.state.value.isAuthenticated).toBe(true);

    result!.logout();
    await nextTick();

    expect(result!.state.value.isAuthenticated).toBe(false);
    expect(result!.state.value.user).toBeNull();

    wrapper.unmount();
    manager.destroy();
  });

  it('cleans up subscription on scope dispose', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    let result: UseAuthReturn | undefined;

    const wrapper = mountWithPlugin(manager, () => {
      result = useAuth();
    });

    wrapper.unmount();

    manager.setTokens({ accessToken: createTestJwt() });
    await nextTick();

    expect(result!.state.value.isAuthenticated).toBe(false);

    manager.destroy();
  });

  it('multiple components sharing useAuth all receive updates', async () => {
    const manager = createTokenManager({ storage: 'memory' });
    let resultA: UseAuthReturn | undefined;
    let resultB: UseAuthReturn | undefined;

    const ChildA = defineComponent({
      setup() {
        resultA = useAuth();
        return () => null;
      },
    });

    const ChildB = defineComponent({
      setup() {
        resultB = useAuth();
        return () => null;
      },
    });

    const Parent = defineComponent({
      setup() {
        return () => [h(ChildA), h(ChildB)];
      },
    });

    const wrapper = mount(Parent, {
      global: {
        plugins: [createTokenSmithPlugin(manager)],
      },
    });

    expect(resultA!.state.value.isAuthenticated).toBe(false);
    expect(resultB!.state.value.isAuthenticated).toBe(false);

    manager.setTokens({ accessToken: createTestJwt() });
    await nextTick();

    expect(resultA!.state.value.isAuthenticated).toBe(true);
    expect(resultB!.state.value.isAuthenticated).toBe(true);

    wrapper.unmount();
    manager.destroy();
  });

  it('throws when plugin is not installed', () => {
    const Child = defineComponent({
      setup() {
        useAuth();
        return () => null;
      },
    });

    expect(() => mount(Child)).toThrow(
      'useAuth requires createTokenSmithPlugin to be installed'
    );
  });
});
