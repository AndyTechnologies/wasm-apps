# Template personalizada — Nunjucks custom

Este ejemplo muestra cómo personalizar el código C++ generado por el linker apuntando `linker.templatePath` a un directorio con templates Nunjucks propios.

## Estructura

```
custom-template/
├── wapp.json            # linker.templatePath: "./templates"
├── templates/
│   └── main.c.njk       # Template Nunjucks personalizado
└── src/
    └── main.wasm.ts     # Módulo AssemblyScript de ejemplo
```

## Cómo ejecutar

```bash
cd examples/custom-template
wapp build
./custom-template
```

Salida esperada:

```
Template personalizada funciona!
```

## Qué demuestra

- **Templates personalizables**: `linker.templatePath` apunta al template custom; los partials no definidos caen en los built-in del linker.
- **Contexto Nunjucks**: el template recibe `moduleName`, `modules` (arrays de bytes), host functions, etc.
- **Invalidación por templateHash**: modificar el template regenera el C++ automáticamente.

Ver [cómo funciona la toolchain](../../docs/explanation/how-it-works.md) para el mecanismo completo.
