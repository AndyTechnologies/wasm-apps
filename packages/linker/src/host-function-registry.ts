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

  hasByName(name: string): boolean {
    const dot = name.lastIndexOf('.');
    const searchName = dot >= 0 ? name.slice(dot + 1) : name;
    for (const key of this.functions.keys()) {
      const kdot = key.lastIndexOf('.');
      const keyName = kdot >= 0 ? key.slice(kdot + 1) : key;
      if (keyName === searchName) return true;
    }
    return false;
  }

  getByName(name: string): { module: string; generator: HostFunctionGenerator } | undefined {
    const dot = name.lastIndexOf('.');
    const searchName = dot >= 0 ? name.slice(dot + 1) : name;
    for (const [key, generator] of this.functions) {
      const kdot = key.lastIndexOf('.');
      const keyName = kdot >= 0 ? key.slice(kdot + 1) : key;
      if (keyName === searchName) return { module: key.slice(0, kdot), generator };
    }
    return undefined;
  }

  getKnownHostImports(): string[] {
    return Array.from(this.functions.keys());
  }

  clear(): void {
    this.functions.clear();
  }
}

export const hostFunctionRegistry = new HostFunctionRegistry();
