import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createTokenManager } from '@/core';
import { createTokenSmithPlugin, TokenSmithKey, useTokenManager } from '@/vue';

describe('createTokenSmithPlugin', () => {
  it('provides the manager instance to descendants', () => {
    const manager = createTokenManager({ storage: 'memory' });
    let injectedManager: unknown;

    const Child = defineComponent({
      setup() {
        injectedManager = useTokenManager();
        return () => null;
      },
    });

    const wrapper = mount(Child, {
      global: { plugins: [createTokenSmithPlugin(manager)] },
    });

    expect(injectedManager).toBe(manager);
    wrapper.unmount();
    manager.destroy();
  });

  it('exposes TokenSmithKey as the injection key', () => {
    expect(typeof TokenSmithKey).toBe('symbol');
  });
});

describe('useTokenManager', () => {
  it('returns the provided manager instance', () => {
    const manager = createTokenManager({ storage: 'memory' });
    let result: unknown;

    const Child = defineComponent({
      setup() {
        result = useTokenManager();
        return () => null;
      },
    });

    const wrapper = mount(Child, {
      global: { plugins: [createTokenSmithPlugin(manager)] },
    });

    expect(result).toBe(manager);
    wrapper.unmount();
    manager.destroy();
  });

  it('throws when plugin is not installed', () => {
    const Child = defineComponent({
      setup() {
        useTokenManager();
        return () => null;
      },
    });

    expect(() => mount(Child)).toThrow(
      'useTokenManager requires createTokenSmithPlugin to be installed'
    );
  });
});
