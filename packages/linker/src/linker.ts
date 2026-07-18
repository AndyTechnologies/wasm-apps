import type { WasmModuleInfo, ResolvedLink, ResolvedModule, ModuleMatchingStrategy } from '@wasm-apps/types';
import { LinkerError } from '@wasm-apps/types';

interface Edge {
  from: string;
  to: string;
}

/**
 * Construye el grafo de dependencias entre módulos WASM usando imports/exports.
 * Un módulo A depende de B si A importa funciones del módulo B.
 */
function buildDependencyGraph(
  modules: WasmModuleInfo[],
  matching: ModuleMatchingStrategy,
): { graph: Map<string, Set<string>>; nameToModule: Map<string, WasmModuleInfo> } {
  const nameToModule = new Map<string, WasmModuleInfo>();
  for (const mod of modules) {
    const name = matching === 'file-name' ? mod.fileName.replace(/\.wasm$/i, '').replace(/.*[/\\]/, '') : mod.fileName;
    nameToModule.set(name, mod);
  }

  const graph = new Map<string, Set<string>>();
  for (const [name] of nameToModule) {
    graph.set(name, new Set());
  }

  for (const mod of modules) {
    const modName = matching === 'file-name' ? mod.fileName.replace(/\.wasm$/i, '').replace(/.*[/\\]/, '') : mod.fileName;

    for (const imp of mod.imports) {
      const depName = imp.module;
      if (nameToModule.has(depName) && depName !== modName) {
        graph.get(modName)!.add(depName);
      }
    }
  }

  return { graph, nameToModule };
}

/**
 * Orden topológico (algoritmo de Kahn) en el grafo de dependencias.
 * Lanza LinkerError al detectar un ciclo.
 */
function topologicalSort(graph: Map<string, Set<string>>, nameToModule: Map<string, WasmModuleInfo>, matching: ModuleMatchingStrategy): ResolvedModule[] {
  const inDegree = new Map<string, number>();
  const reverseDeps = new Map<string, Set<string>>();

  for (const [name] of graph) {
    inDegree.set(name, 0);
    reverseDeps.set(name, new Set());
  }

  for (const [name, deps] of graph) {
    for (const dep of deps) {
      if (dep !== name) {
        inDegree.set(name, (inDegree.get(name) || 0) + 1);
        reverseDeps.get(dep)?.add(name);
      }
    }
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: ResolvedModule[] = [];
  let index = 0;

  while (queue.length > 0) {
    const name = queue.shift()!;
    const module = nameToModule.get(name)!;

    sorted.push({
      module,
      index: index++,
      instanceName: name,
    });

    for (const dependent of reverseDeps.get(name) || []) {
      const newDegree = (inDegree.get(dependent) || 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== nameToModule.size) {
    throw new LinkerError('Dependency cycle detected between WASM modules', {
      resolved: sorted.length,
      total: nameToModule.size,
    });
  }

  return sorted;
}

/**
 * Construye el mapa de exports desde nombre de módulo a entradas de exportación.
 * También registra el orden de los módulos para la instanciación.
 * Solo se incluyen exports de función; los exports de memoria/tabla/global se omiten
 * del mapa de exports porque no se instancian mediante wasmtime_linker.
 */
function buildExportMap(sortedModules: ResolvedModule[]): Map<string, { instance: string; name: string }> {
  const exportMap = new Map<string, { instance: string; name: string }>();

  for (const mod of sortedModules) {
    for (const exp of mod.module.exports) {
      if (exp.kind === 'function') {
        exportMap.set(`${mod.instanceName}.${exp.name}`, {
          instance: mod.instanceName,
          name: exp.name,
        });
      }
    }
  }

  return exportMap;
}

/**
 * Resuelve dependencias entre módulos WASM usando topological sort.
 *
 * Estrategias de matching:
 * - `name-only`: los imports deben coincidir exactamente con el nombre del módulo
 * - `file-name`: se usa el nombre del archivo (sin extensión) como identificador
 *
 * @returns Orden de instanciación y mapa de exports disponibles.
 */
export function resolveDependencies(modules: WasmModuleInfo[], matching: ModuleMatchingStrategy = 'name-only'): ResolvedLink {
  if (modules.length === 0) {
    throw new LinkerError('No modules provided for dependency resolution');
  }

  const { graph, nameToModule } = buildDependencyGraph(modules, matching);
  const order = topologicalSort(graph, nameToModule, matching);
  const exportMap = buildExportMap(order);

  return { order, exportMap };
}
