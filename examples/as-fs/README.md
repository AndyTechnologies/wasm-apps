# AS FS — Preopens WASI desde AssemblyScript

Este ejemplo muestra cómo leer un archivo de un directorio montado (`mounts` de `wapp.json`) usando los bindings `console` y `fs` desde AssemblyScript.

## Estructura

```
as-fs/
├── wapp.json            # wasi: true + mounts: [{ host: "data", guest: "/mnt/data" }]
├── data/
│   └── greeting.txt     # Archivo montado en /mnt/data/greeting.txt
└── src/
    └── main.wasm.ts     # Lee /mnt/data/greeting.txt con readFile
```

## Cómo ejecutar

```bash
cd examples/as-fs
wapp build
./as-fs
```

Salida esperada:

```
Opening file...
Hello from the mounted directory!
```

## Qué demuestra

- **Preopens WASI**: el host `data` se monta en `/mnt/data` con permisos completos (READ|WRITE).
- **Bindings inyectadas**: `import { readFile } from 'fs'` y `import { log } from 'console'` se reescriben automáticamente a los bindings del compilador (`rewriteBindingImports`) — no hay copias locales en `src/`.
- **Decodificación UTF-8**: `String.UTF8.decode(data)` convierte el contenido del archivo a string.
