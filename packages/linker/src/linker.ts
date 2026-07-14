import path from 'node:path';
import {
  WasmModuleInfo,
  WasmExport,
  ResolvedModule,
  ResolvedLink,
  ModuleMatchingStrategy,
  LinkerError
} from '@wasm-apps/types';

const KNOWN_HOST_IMPORTS = new Set([
  'env.abort',
  'env.seed',
  'env.trace',
]);

export function resolveDependencies(
  modules: WasmModuleInfo[],
  strategy: ModuleMatchingStrategy,
): ResolvedLink {
  const availableExports = new Map<string, { module: WasmModuleInfo; export: WasmExport }>();

  for (const mod of modules) {
    const fileBase = path.parse(mod.fileName).name;
    for (const exp of mod.exports) {
      const key = strategy === 'name-only' ? exp.name : `${fileBase}:${exp.name}`;
      if (availableExports.has(key)) {
        throw new LinkerError(`Conflicto: la exportacion '${key}' esta definida en varios modulos.`);
      }
      availableExports.set(key, { module: mod, export: exp });
    }
  }

  const dependencies = new Map<WasmModuleInfo, WasmModuleInfo[]>();
  for (const mod of modules) {
    const deps: WasmModuleInfo[] = [];
    for (const imp of mod.imports) {
      if (imp.module === 'wasi_snapshot_preview1' || imp.module === 'wasi_unstable') {
        continue;
      }
      if (KNOWN_HOST_IMPORTS.has(`${imp.module}.${imp.name}`)) {
        continue;
      }
      const lookupKey = strategy === 'name-only' ? imp.name : `${imp.module}:${imp.name}`;
      const expInfo = availableExports.get(lookupKey);
      if (!expInfo) {
        if (imp.module === 'env') continue;
        throw new LinkerError(`Importacion no resuelta: '${imp.module}.${imp.name}' requerida por ${mod.fileName}`);
      }
      if (expInfo.module !== mod) {
        deps.push(expInfo.module);
      }
    }
    dependencies.set(mod, deps);
  }

  const inDegree = new Map<WasmModuleInfo, number>();
  for (const mod of modules) inDegree.set(mod, 0);
  for (const [mod, deps] of dependencies.entries()) {
    inDegree.set(mod, deps.length);
  }

  const queue: WasmModuleInfo[] = [];
  for (const [mod, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(mod);
  }

  const order: WasmModuleInfo[] = [];
  while (queue.length > 0) {
    const mod = queue.shift()!;
    order.push(mod);
    for (const [other, deps] of dependencies.entries()) {
      if (deps.includes(mod)) {
        const newDeg = (inDegree.get(other) || 0) - 1;
        inDegree.set(other, newDeg);
        if (newDeg === 0) queue.push(other);
      }
    }
  }

  if (order.length !== modules.length) {
    throw new LinkerError('Dependencia circular detectada entre los modulos .wasm.');
  }

  const resolvedOrder: ResolvedModule[] = order.map((mod, idx) => ({
    module: mod,
    index: idx,
    instanceName: `instance${idx}`,
  }));

  const exportMap = new Map<string, { instance: string; name: string }>();
  for (const resMod of resolvedOrder) {
    for (const exp of resMod.module.exports) {
      const fileBase = path.parse(resMod.module.fileName).name;
      const key = strategy === 'name-only' ? exp.name : `${fileBase}:${exp.name}`;
      if (!exportMap.has(key)) {
        exportMap.set(key, { instance: resMod.instanceName, name: exp.name });
      }
    }
  }

  return { order: resolvedOrder, exportMap };
}
