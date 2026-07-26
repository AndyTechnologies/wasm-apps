#!/usr/bin/env node
/**
 * rmlui-bindgen — Code generator for RmlUI multi-language bindings
 *
 * Parses rmlui-abi.h and generates:
 *   - Rust extern "C" declarations + safe wrappers (rmlui_bindings.rs)
 *   - AssemblyScript @external imports + wrappers (rmlui-bindings.ts)
 *
 * Usage:
 *   node scripts/rmlui-bindgen/index.mjs \
 *     --header packages/types/src/rmlui-abi.h \
 *     --output-rust packages/types/src/rmlui_bindings.rs \
 *     --output-as packages/types/src/rmlui-bindings.ts
 */

import fs from 'node:fs';
import path from 'node:path';

// ── CLI Argument Parsing ─────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { header: '', rust: '', as: '' };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--header':       args.header = argv[++i]; break;
      case '--output-rust':  args.rust = argv[++i]; break;
      case '--output-as':    args.as = argv[++i]; break;
      case '--help':
        console.log(`Usage: node index.mjs --header <file.h> --output-rust <file.rs> --output-as <file.ts>`);
        process.exit(0);
    }
  }
  if (!args.header || !args.rust || !args.as) {
    console.error('ERROR: --header, --output-rust, and --output-as are required');
    console.error('Usage: node index.mjs --header <file.h> --output-rust <file.rs> --output-as <file.ts>');
    process.exit(1);
  }
  return args;
}

// ── C Header Parsing ────────────────────────────────────────────────────

const C_TO_RUST_TYPE = new Map([
  ['void',                 '()'],
  ['int32_t',              'i32'],
  ['int',                  'i32'],
  ['Rml_ContextId',        'i32'],
  ['Rml_ElementId',        'i32'],
  ['Rml_DocumentId',       'i32'],
  ['Rml_CallbackId',       'i32'],
  ['char*',                '*mut c_char'],
  ['const char*',          '*const c_char'],
  ['const void*',          '*const c_void'],
]);

const C_TO_AS_TYPE = new Map([
  ['void',                 'void'],
  ['int32_t',              'i32'],
  ['int',                  'i32'],
  ['Rml_ContextId',        'i32'],
  ['Rml_ElementId',        'i32'],
  ['Rml_DocumentId',       'i32'],
  ['Rml_CallbackId',       'i32'],
  ['const char*',          'string'],
  ['const void*',          'i32'],
]);

/**
 * Parse a C type string like "const char*", "int32_t", "Rml_ContextId"
 * into its base type name (without const/ptr).
 */
function baseTypeName(raw) {
  return raw.replace(/\bconst\s+/g, '').replace(/\s*\*/g, '').trim();
}

/**
 * Normalize whitespace in a type+name pair.
 */
function cleanParamToken(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Parse a function declaration line into { returnType, funcName, params[] }.
 * Returns null if the line is not a function declaration.
 */
function parseFuncDecl(line) {
  // Match: <return_type> <func_name>(<params>);
  // Return type may include "const" prefix and "*" suffix.
  const m = line.match(
    /^(const\s+)?(\w+(?:\s+\w+)?(?:\s*\*)?)\s+(Rml_\w+|RmlUI_\w+)\(([^)]*)\)\s*;/
  );
  if (!m) return null;

  const constPrefix = m[1] || '';
  const rawReturn = (constPrefix + m[2]).replace(/\s+/g, ' ').trim();
  const funcName = m[3];
  const paramsStr = m[4].trim();

  // Parse params
  const params = [];
  if (paramsStr) {
    for (const token of paramsStr.split(',')) {
      const p = cleanParamToken(token);
      // Match: [const] <type>[*] <name>
      const pm = p.match(/^(const\s+)?(\w+(?:\s*\*)?)\s+(\w+)$/);
      if (pm) {
        const pConst = pm[1] || '';
        const pType = (pConst + pm[2]).replace(/\s+/g, ' ').trim();
        params.push({ type: pType, name: pm[3] });
      }
    }
  }

  return { returnType: rawReturn, funcName, params };
}

/**
 * Parse the entire header file and return an array of function declarations.
 */
function parseHeader(filePath) {
  const src = fs.readFileSync(filePath, 'utf-8');
  // Strip block comments and single-line comments
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const funcs = [];
  for (const line of clean.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const decl = parseFuncDecl(trimmed);
    if (decl) funcs.push(decl);
  }
  return funcs;
}

// ── Rust Code Generation ────────────────────────────────────────────────

/**
 * Convert a C function name to Rust snake_case for the safe wrapper.
 * e.g. "Rml_CreateContext" → "rml_create_context"
 *       "RmlUI_ProcessSdlEvents" → "rml_ui_process_sdl_events"
 */
function toRustSnake(name) {
  // Handle RmlUI_ prefix specially
  let s = name.replace(/^RmlUI_/, 'rml_ui_').replace(/^Rml_/, 'rml_');
  // Convert remaining CamelCase to snake_case
  s = s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  return s;
}

/**
 * Determine if a Rust return type is a string pointer (const char*).
 */
function isRustStringReturn(retType) {
  return retType.includes('char*');
}

/**
 * Determine if a Rust return type is a plain i32 (or handle typedef → i32)
 * that carries an error code when < 0.
 */
function isRustErrorReturn(retType) {
  if (retType === 'void' || retType === '()') return false;
  if (isRustStringReturn(retType)) return false;
  return true;
}

function mapRustType(cType) {
  return C_TO_RUST_TYPE.get(cType) || 'i32';
}

function mapRustParam(p) {
  const rt = mapRustType(p.type);
  return `${p.name}: ${rt}`;
}

/**
 * Generate the full Rust bindings file content.
 */
function generateRust(funcs) {
  const lines = [];

  lines.push('// Auto-generated by scripts/rmlui-bindgen — DO NOT EDIT');
  lines.push('// Source: packages/types/src/rmlui-abi.h');
  lines.push('');
  lines.push('use std::ffi::{CStr, CString};');
  lines.push('use std::os::raw::c_char;');
  lines.push('');
  lines.push('// ── Error Codes ────────────────────────────────────────────────────');
  lines.push('');
  lines.push('#[repr(i32)]');
  lines.push('#[derive(Debug, Clone, Copy, PartialEq, Eq)]');
  lines.push('pub enum RmluiError {');
  lines.push('    Ok = 0,');
  lines.push('    InvalidHandle = -1,');
  lines.push('    NullParam = -2,');
  lines.push('    OutOfMemory = -3,');
  lines.push('    Unsupported = -4,');
  lines.push('    Internal = -5,');
  lines.push('}');
  lines.push('');
  lines.push('impl From<i32> for RmluiError {');
  lines.push('    fn from(code: i32) -> Self {');
  lines.push('        match code {');
  lines.push('            -1 => RmluiError::InvalidHandle,');
  lines.push('            -2 => RmluiError::NullParam,');
  lines.push('            -3 => RmluiError::OutOfMemory,');
  lines.push('            -4 => RmluiError::Unsupported,');
  lines.push('            -5 => RmluiError::Internal,');
  lines.push('            _  => RmluiError::Ok,');
  lines.push('        }');
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('// ── Raw extern "C" Declarations ─────────────────────────────────────');
  lines.push('');
  lines.push('extern "C" {');

  for (const f of funcs) {
    const rustRet = mapRustType(f.returnType);
    const rustParams = f.params.map(mapRustParam).join(', ');
    lines.push(`    fn ${f.funcName}(${rustParams}) -> ${rustRet};`);
  }

  lines.push('}');
  lines.push('');
  lines.push('// ── Safe Wrapper Functions ──────────────────────────────────────────');
  lines.push('');

  for (const f of funcs) {
    const fnName = toRustSnake(f.funcName);
    const retType = f.returnType;
    const hasBufArg = f.params.some(p => p.type === 'const void*');

    // Build doc comment
    lines.push(`/// Safe wrapper around \`${f.funcName}\`.`);

    // Build function signature
    const rustParams = f.params.map(p => {
      if (p.type === 'const char*') return `${p.name}: &str`;
      if (p.type === 'const void*') return `${p.name}: &[u8]`;
      return `${p.name}: ${mapRustType(p.type)}`;
    }).join(', ');

    // Return type
    let rustRet = '()';
    if (isRustErrorReturn(retType)) {
      // Functions returning i32/handles → Result
      if (hasBufArg) {
        // Buffer loaders like Rml_LoadFontFromBuffer return i32
        rustRet = `Result<i32, RmluiError>`;
      } else if (baseTypeName(retType).startsWith('Rml_') || retType === 'int32_t' || retType === 'int') {
        rustRet = `Result<i32, RmluiError>`;
      } else {
        rustRet = `Result<i32, RmluiError>`;
      }
    } else if (isRustStringReturn(retType)) {
      rustRet = `Result<Option<String>, RmluiError>`;
    }

    lines.push(`pub fn ${fnName}(${rustParams}) -> ${rustRet} {`);

    // Build call
    const callArgs = f.params.map(p => {
      if (p.type === 'const char*') {
        // Convert &str to CString, handle NUL errors
        return `CString::new(${p.name}).map_err(|_| RmluiError::NullParam)?.as_ptr()`;
      }
      if (p.type === 'const void*') {
        // Pass pointer and length
        // For Load*FromBuffer functions, we pass data pointer
        return `${p.name}.as_ptr() as *const std::ffi::c_void`;
      }
      return p.name;
    }).join(', ');

    if (retType === 'void') {
      // Void function: just call
      lines.push(`    unsafe { ${f.funcName}(${callArgs}) }`);
      lines.push('}');
    } else if (isRustStringReturn(retType)) {
      // String return
      lines.push(`    let ptr = unsafe { ${f.funcName}(${callArgs}) };`);
      lines.push('    if ptr.is_null() {');
      lines.push('        Ok(None)');
      lines.push('    } else {');
      lines.push('        let s = unsafe { CStr::from_ptr(ptr) };');
      lines.push('        Ok(Some(s.to_string_lossy().into_owned()))');
      lines.push('    }');
      lines.push('}');
    } else {
      // i32/handle return: check for error
      const rawCall = f.params.length > 0
        ? `unsafe { ${f.funcName}(${callArgs}) }`
        : `unsafe { ${f.funcName}() }`;
      lines.push(`    let result = ${rawCall};`);
      lines.push('    if result >= 0 {');
      lines.push('        Ok(result)');
      lines.push('    } else {');
      lines.push('        Err(RmluiError::from(result))');
      lines.push('    }');
      lines.push('}');
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ── AssemblyScript Code Generation ──────────────────────────────────────

/**
 * Convert C function name to AS camelCase for wrapper.
 * e.g. "Rml_CreateContext" → "createContext"
 *       "RmlUI_ProcessSdlEvents" → "processSdlEvents"
 */
function toAsCamel(name) {
  let s = name.replace(/^RmlUI_/, '').replace(/^Rml_/, '');
  // First char lowercase
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function mapAsType(cType) {
  return C_TO_AS_TYPE.get(cType) || 'i32';
}

function mapAsParam(p) {
  return `${p.name}: ${mapAsType(p.type)}`;
}

/**
 * Determine if a function returns a value that can be 0 (success) / negative (error).
 */
function isAsErrorReturn(retType) {
  return retType !== 'void' && !retType.includes('char*');
}

/**
 * Generate the full AssemblyScript bindings file content.
 */
function generateAs(funcs) {
  const lines = [];

  lines.push('// Auto-generated by scripts/rmlui-bindgen — DO NOT EDIT');
  lines.push('// Source: packages/types/src/rmlui-abi.h');
  lines.push('');
  lines.push('// ── Raw @external Imports ──────────────────────────────────────────');
  lines.push('');

  for (const f of funcs) {
    const asRet = mapAsType(f.returnType);
    const asParams = f.params.map(mapAsParam).join(', ');
    lines.push('// @external("env", "' + f.funcName + '")');
    if (asRet === 'void') {
      lines.push(`export declare function raw${f.funcName}(${asParams}): void;`);
    } else {
      lines.push(`export declare function raw${f.funcName}(${asParams}): ${asRet};`);
    }
    lines.push('');
  }

  lines.push('// ── TypeScript/AssemblyScript Wrappers ─────────────────────────────');
  lines.push('');
  lines.push('// Error codes matching rmlui-abi.h');
  lines.push('export const RMLUI_OK: i32 = 0;');
  lines.push('export const RMLUI_ERR_INVALID_HANDLE: i32 = -1;');
  lines.push('export const RMLUI_ERR_NULL_PARAM: i32 = -2;');
  lines.push('export const RMLUI_ERR_OUT_OF_MEMORY: i32 = -3;');
  lines.push('export const RMLUI_ERR_UNSUPPORTED: i32 = -4;');
  lines.push('export const RMLUI_ERR_INTERNAL: i32 = -5;');
  lines.push('');

  for (const f of funcs) {
    const wrapperName = toAsCamel(f.funcName);
    const retType = f.returnType;
    const asRet = mapAsType(retType);

    // Determine if the result needs error checking
    const hasErrorReturn = isAsErrorReturn(retType);
    const hasStringReturn = retType.includes('char*') && !retType.includes('void*');

    // Build params
    const asParams = f.params.map(p => {
      if (p.type === 'const void*') return `${p.name}: i32`;
      return `${p.name}: ${mapAsType(p.type)}`;
    }).join(', ');

    let wrapperRet = asRet;
    if (hasStringReturn) {
      // String returns → the raw function returns a pointer (i32),
      // wrapper returns string
      wrapperRet = 'string';
    }

    lines.push(`/** Safe wrapper around \`${f.funcName}\`. */`);
    if (retType === 'void') {
      lines.push(`export function ${wrapperName}(${asParams}): void {`);
      lines.push(`  raw${f.funcName}(${f.params.map(p => p.name).join(', ')});`);
      lines.push('}');
    } else if (hasStringReturn) {
      // String return — the raw returns an i32 pointer to WASM memory
      // Use loadString or simple pointer read
      lines.push(`export function ${wrapperName}(${asParams}): string {`);
      lines.push(`  const ptr = raw${f.funcName}(${f.params.map(p => p.name).join(', ')});`);
      lines.push('  if (ptr === 0) return "";');
      lines.push('  // Read null-terminated string from WASM memory at ptr');
      lines.push('  let result = "";');
      lines.push('  let i = ptr;');
      lines.push('  while (load<u8>(i) !== 0) {');
      lines.push('    result += String.fromCharCode(load<u8>(i));');
      lines.push('    i++;');
      lines.push('  }');
      lines.push('  return result;');
      lines.push('}');
    } else {
      // i32/handle return
      lines.push(`export function ${wrapperName}(${asParams}): i32 {`);
      lines.push(`  const result = raw${f.funcName}(${f.params.map(p => p.name).join(', ')});`);
      lines.push('  if (result < 0) {');
      lines.push('    // Caller should check return value');
      lines.push('    return result;');
      lines.push('  }');
      lines.push('  return result;');
      lines.push('}');
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  const funcs = parseHeader(path.resolve(args.header));

  if (funcs.length === 0) {
    console.error('ERROR: No function declarations found in header');
    process.exit(1);
  }

  // Generate Rust file
  const rustCode = generateRust(funcs);
  const rustPath = path.resolve(args.rust);
  fs.mkdirSync(path.dirname(rustPath), { recursive: true });
  fs.writeFileSync(rustPath, rustCode, 'utf-8');
  console.log(`✓ Wrote ${rustPath} (${funcs.length} functions)`);

  // Generate AS file
  const asCode = generateAs(funcs);
  const asPath = path.resolve(args.as);
  fs.mkdirSync(path.dirname(asPath), { recursive: true });
  fs.writeFileSync(asPath, asCode, 'utf-8');
  console.log(`✓ Wrote ${asPath} (${funcs.length} functions)`);
}

main();
