# Precompilado — WASM binario pasa-through

Este ejemplo muestra cómo usar un archivo `.wasm` ya compilado sin volver a compilarlo: se copia a `src/` y el `ToolchainRouter` lo enruta a la estrategia `PrecompiledWasmStrategy` (validación de magic bytes + passthrough).

## Estructura

```
precompiled/
├── wapp.json            # Configuración sin toolchain (wasi: false)
└── src/
    └── main.wasm        # WASM binario (NO versionado — lo regenera test-examples.mjs)
```

## Cómo ejecutar

```bash
cd examples/precompiled
wapp build
./precompiled
```

Salida esperada (el binario proviene del ejemplo `basico`):

```
Hola desde AssemblyScript!
...
Factorial de 5 = 120.0
```

## Qué demuestra

- **Pasa-through**: un `.wasm` binario se enlaza directamente sin etapa de compilación.
- **Artefacto derivado**: `src/main.wasm` está en `.gitignore`. El script `scripts/test-examples.mjs` lo regenera compilando `basico` antes de correr los tests de integración (ver [cómo correr los tests de integración](../../docs/how-to/run-integration-tests.md)).
