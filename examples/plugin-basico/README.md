# Plugin básico — Validador de código fuente

Este ejemplo muestra cómo crear un plugin simple que valida los archivos `.wasm.ts` antes de compilarlos.

## Estructura

```
plugin-basico/
├── wapp.json                # Configuración con plugin declarado
├── plugins/
│   └── validation-plugin.js # Plugin que valida código fuente
└── src/
    └── main.wasm.ts         # Módulo AssemblyScript de ejemplo
```

## Cómo ejecutar

```bash
cd examples/plugin-basico
wapp build
```

## Qué hace el plugin

El plugin se engancha en la fase `BeforeModuleCompile` del pipeline y verifica que todos los archivos fuente tengan al menos una función exportada. Si encuentra un archivo sin exports, muestra una advertencia pero no detiene la compilación.

## Configuración en wapp.json

```json
{
  "plugins": [
    {
      "id": "validation-plugin",
      "enabled": true,
      "path": "./plugins/validation-plugin.js"
    }
  ]
}
```
