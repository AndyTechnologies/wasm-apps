# Proyecto completo — Calculadora WASM

Este ejemplo muestra un proyecto real con múltiples módulos AssemblyScript, plugin de métricas y configuración avanzada.

## Estructura

```
proyecto-completo/
├── wapp.json                    # Configuración completa
├── plugins/
│   └── metrics-plugin.js        # Plugin que registra métricas de compilación
├── src/
│   ├── main.wasm.ts             # Punto de entrada
│   └── math.wasm.ts             # Módulo de operaciones matemáticas
├── config/
│   └── (documentación de configuración adicional)
└── README.md
```

## Cómo ejecutar

```bash
cd examples/proyecto-completo
wapp build
./calculadora
```

## Características

- **Múltiples módulos**: `main.wasm.ts` importa funciones de `math.wasm.ts`
- **Plugin de métricas**: registra tiempos de compilación y tamaño de binario
- **Configuración completa**: wapp.json con todas las opciones documentadas
- **WASI deshabilitado**: usa imports `env` directos para simplicidad

## Dependencias entre módulos

```
main.wasm.ts  ──importa──>  math.wasm.ts
                              ├── add(a, b)
                              ├── multiply(a, b)
                              └── fibonacci(n)
```
