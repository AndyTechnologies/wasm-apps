import os from 'node:os';
import type { ResolvedLink, WasmImportFuncType, WasmModuleInfo, MountSpec } from '@wasm-apps/types';
import { LinkerError } from '@wasm-apps/types';
import { hostFunctionRegistry } from './host-function-registry.js';
import { renderTemplate } from './template-renderer.js';
import type {
  NunjucksTemplateContext,
  TemplateModuleEntry,
  TemplateHostFunctionEntry,
  TemplateGlobalEntry,
  TemplateExportEntry,
  TemplateMountEntry,
} from './template-context.js';

/**
 * Permisos WASI para preopens.
 *
 * wasmtime v46 usa flags simples: 1 = READ, 2 = WRITE. El bitmask de rights
 * preview1 (bits 9-26 para dir, 0-8/21-23/27 para file) es rechazado por
 * `wasi_config_preopen_dir` (devuelve false y el preopen falla silenciosamente),
 * por lo que los preopens se configuran con permisos completos (READ|WRITE).
 */
export const WASI_DIR_PERMS = 1 | 2; // READ | WRITE sobre el directorio
export const WASI_FILE_PERMS = 1 | 2; // READ | WRITE sobre los archivos

const VALTYPE_TO_CPP: Record<string, string> = {
  i32: 'ValType::i32()',
  i64: 'ValType::i64()',
  f32: 'ValType::f32()',
  f64: 'ValType::f64()',
};

const VALTYPE_TO_SET: Record<string, string> = {
  i32: 'Val(int32_t(',
  i64: 'Val(int64_t(',
  f32: 'Val(float(',
  f64: 'Val(double(',
};

const MATH_CONSTANTS: Record<string, string> = {
  'Math.E': '2.718281828459045',
  'Math.LN2': '0.6931471805599453',
  'Math.LN10': '2.302585092994046',
  'Math.LOG2E': '1.4426950408889634',
  'Math.LOG10E': '0.4342944819032518',
  'Math.PI': '3.141592653589793',
  'Math.SQRT1_2': '0.7071067811865476',
  'Math.SQRT2': '1.4142135623730951',
};

interface ModuleBuffer {
  varName: string;
  lenVar: string;
  bytes: Buffer;
  moduleVar: string;
  instanceVar: string;
}

function funcTypeCpp(params: string[], results: string[]): string {
  const p = params.map((t) => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  const r = results.map((t) => VALTYPE_TO_CPP[t] || 'ValType::i32()').join(', ');
  return `FuncType::from_iters(std::vector<ValType>{${p}}, std::vector<ValType>{${r}})`;
}

function defaultResultCode(results: string[]): string {
  if (results.length === 0) return '    return std::monostate{};';
  return results.map((t, i) => `    results[${i}] = ${VALTYPE_TO_SET[t] || 'Val(int32_t('}0));`).join(os.EOL) + os.EOL + '    return std::monostate{};';
}

function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function escapeCppString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\0/g, '\\0').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function formatHexBytes(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    const chunk = hex.slice(i, Math.min(i + 64, hex.length));
    const byteParts: string[] = [];
    for (let j = 0; j < chunk.length; j += 2) {
      byteParts.push('0x' + chunk.slice(j, j + 2));
    }
    parts.push('    ' + byteParts.join(','));
  }
  return parts.join(',' + os.EOL);
}

function buildModuleBuffers(modules: ResolvedLink['order']): ModuleBuffer[] {
  return modules.map((m) => ({
    varName: `wasm_bytes_${m.index}`,
    lenVar: `wasm_len_${m.index}`,
    bytes: m.module.buffer,
    moduleVar: `mod${m.index}`,
    instanceVar: `instance${m.index}`,
  }));
}

function buildNeededGlobals(modules: ResolvedLink['order']): Map<string, { module: string; name: string }> {
  const neededGlobals = new Map<string, { module: string; name: string }>();
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.module === 'wasi_snapshot_preview1' || imp.module === 'wasi_unstable') continue;
      if (imp.kind === 'global') {
        const key = `${imp.module}.${imp.name}`;
        if (!neededGlobals.has(key)) {
          neededGlobals.set(key, { module: imp.module, name: imp.name });
        }
      }
    }
  }
  return neededGlobals;
}

function buildHostFunctionList(
  modules: ResolvedLink['order'],
  importTypeMap: Map<string, WasmImportFuncType>,
): Array<{ name: string; module: string; params: string[]; results: string[] }> {
  const hostFuncs: Array<{ name: string; module: string; params: string[]; results: string[] }> = [];
  const seen = new Set<string>();
  for (const mod of modules) {
    for (const imp of mod.module.imports) {
      if (imp.kind !== 'function') continue;
      const key = `${imp.module}.${imp.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (imp.module === 'env' || hostFunctionRegistry.has(imp.module, imp.name) || hostFunctionRegistry.has('env', imp.name)) {
        const ft = importTypeMap.get(key);
        if (!ft) {
          const byName = hostFunctionRegistry.getByName(imp.name);
          if (byName) {
            const altKey = `${byName.module}.${imp.name}`;
            const altFt = importTypeMap.get(altKey);
            if (altFt) {
              hostFuncs.push({ name: imp.name, module: imp.module, params: altFt.params, results: altFt.results });
            }
          }
          continue;
        }
        hostFuncs.push({ name: imp.name, module: imp.module, params: ft.params, results: ft.results });
      }
    }
  }
  return hostFuncs;
}

/**
 * Construye un NunjucksTemplateContext a partir de los parámetros de generateCCode.
 * Esto reemplaza las funciones generatePreamble/generateStringReader/etc.
 */
function buildTemplateContext(
  link: ResolvedLink,
  entryPoint: string,
  wasi: boolean,
  importFuncTypes?: WasmImportFuncType[],
  mounts: MountSpec[] = [],
): NunjucksTemplateContext {
  const modules = link.order;
  const moduleBuffers = buildModuleBuffers(modules);
  const neededGlobals = buildNeededGlobals(modules);

  const importTypeMap = new Map<string, WasmImportFuncType>();
  if (importFuncTypes) {
    for (const ft of importFuncTypes) {
      importTypeMap.set(`${ft.module}.${ft.name}`, ft);
    }
  }

  const hostFuncs = buildHostFunctionList(modules, importTypeMap);
  const entryModule = findEntryModule(link, entryPoint);

  // Construir entries de módulos
  const templateModules: TemplateModuleEntry[] = moduleBuffers.map((mb, idx) => {
    const mod = modules[idx];
    return {
      index: mb.varName === `wasm_bytes_${idx}` ? idx : idx,
      varName: mb.varName,
      lenVar: mb.lenVar,
      moduleVar: mb.moduleVar,
      instanceVar: mb.instanceVar,
      bufferHex: formatHexBytes(mb.bytes),
      bufferLength: mb.bytes.length,
      exports:
        mod.module.exports.length > 0
          ? mod.module.exports.map(
              (exp) =>
                ({
                  name: exp.name,
                  kind: exp.kind,
                  escapedName: escapeCppString(exp.name),
                  safeName: sanitizeIdentifier(exp.name),
                }) satisfies TemplateExportEntry,
            )
          : undefined,
    };
  });

  // Construir entries de funciones host
  const templateHostFunctions: TemplateHostFunctionEntry[] = hostFuncs.map((func) => {
    let generator = hostFunctionRegistry.get(func.module, func.name);
    if (!generator) {
      const byName = hostFunctionRegistry.getByName(func.name);
      if (byName) generator = byName.generator;
    }
    const body = generator ? generator(func.params, func.results) : defaultResultCode(func.results);
    return {
      module: func.module,
      name: func.name,
      escapedModule: escapeCppString(func.module),
      escapedName: escapeCppString(func.name),
      params: func.params,
      results: func.results,
      body,
      funcTypeCpp: funcTypeCpp(func.params, func.results),
    };
  });

  // Construir entries de globales
  const templateGlobals: TemplateGlobalEntry[] = [];
  for (const [, gl] of neededGlobals) {
    const mathConst = MATH_CONSTANTS[gl.name];
    const valStr = mathConst !== undefined ? `Val(double(${mathConst}))` : 'Val(int32_t(0))';
    templateGlobals.push({
      module: gl.module,
      name: gl.name,
      escapedModule: escapeCppString(gl.module),
      escapedName: escapeCppString(gl.name),
      cppValue: valStr,
    });
  }

  // Construir entries de preopens WASI
  const templateMounts: TemplateMountEntry[] = mounts.map((mount) => ({
    host: escapeCppString(mount.host),
    guest: escapeCppString(mount.guest),
    dirPerms: WASI_DIR_PERMS,
    filePerms: WASI_FILE_PERMS,
  }));

  return {
    moduleName: 'wasm-linker',
    entryPoint: entryModule,
    entryFunctionName: entryPoint,
    escapedEntryFunctionName: escapeCppString(entryPoint),
    wasi,
    wasmtimeVersion: '46.0.1',
    modules: templateModules,
    hostFunctions: templateHostFunctions,
    globals: templateGlobals,
    mounts: templateMounts,
  };
}

export function findEntryModule(link: ResolvedLink, entryPoint: string): string {
  for (const mod of link.order) {
    const found = mod.module.exports.some((e) => e.name === entryPoint && e.kind === 'function');
    if (found) return `instance${mod.index}`;
  }
  throw new LinkerError(`No se encontro la funcion de entrada '${entryPoint}' en ningun modulo.`);
}

export function validateEntryExport(link: ResolvedLink, entryPoint: string): void {
  for (const mod of link.order) {
    if (mod.module.exports.some((e) => e.name === entryPoint)) return;
  }
  throw new LinkerError(`No se encontro la exportacion '${entryPoint}' en ningun modulo compilado.`);
}

export function generateCCode(link: ResolvedLink, entryPoint: string, wasi: boolean, importFuncTypes?: WasmImportFuncType[], mounts: MountSpec[] = []): string {
  const context = buildTemplateContext(link, entryPoint, wasi, importFuncTypes, mounts);
  return renderTemplate(context);
}
