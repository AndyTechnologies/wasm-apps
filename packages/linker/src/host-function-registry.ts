import type { RegisteredHostFunction, HostFunctionGenerator } from '@wasm-apps/types';

export class HostFunctionRegistry {
  private functions = new Map<string, HostFunctionGenerator>();

  register(module: string, name: string, generator: HostFunctionGenerator): void {
    const key = `${module}.${name}`;
    this.functions.set(key, generator);
  }

  get(module: string, name: string): HostFunctionGenerator | undefined {
    return this.functions.get(`${module}.${name}`);
  }

  has(module: string, name: string): boolean {
    return this.functions.has(`${module}.${name}`);
  }

  getAll(): RegisteredHostFunction[] {
    const result: RegisteredHostFunction[] = [];
    for (const [key, generator] of this.functions) {
      const dot = key.indexOf('.');
      result.push({
        module: key.slice(0, dot),
        name: key.slice(dot + 1),
        generator,
      });
    }
    return result;
  }

  getKnownHostImports(): string[] {
    return Array.from(this.functions.keys());
  }

  clear(): void {
    this.functions.clear();
  }
}

export const hostFunctionRegistry = new HostFunctionRegistry();
