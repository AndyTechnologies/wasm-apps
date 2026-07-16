# Plugin avanzado — Función host personalizada

Este ejemplo muestra cómo crear un plugin que registra una función host personalizada y utiliza múltiples hooks del pipeline.

## Estructura

```
plugin-avanzado/
├── wapp.json                    # Configuración del proyecto
├── plugins/
│   └── custom-host-plugin.js    # Plugin con función host + hooks
└── src/
    └── main.wasm.ts             # Módulo que usa la función host
```

## Cómo ejecutar

```bash
cd examples/plugin-avanzado
wapp build
```

## Qué hace el plugin

1. **Registra una función host personalizada** llamada `env.multiply_by_two` que acepta un `i32` y devuelve `i32 * 2`. La implementación C++ multiplica el valor por 2 directamente.

2. **Hook en `BeforeModuleCompile`**: logea los archivos fuente que se van a compilar.

3. **Hook en `AfterLink`**: muestra el tamaño del binario generado.

## Función host personalizada

La función `env.multiply_by_two` está disponible desde AssemblyScript como:

```typescript
declare function multiply_by_two(x: i32): i32;
```

Toma un entero y devuelve el doble de su valor.
