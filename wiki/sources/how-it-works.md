# Fuente: Cómo funciona la toolchain

**Ruta**: `docs/explanation/how-it-works.md`
**Propósito**: Explicación general del pipeline de 3 etapas.

## Contenido extraído

- Etapa 1: Compilador AS → WASM (assemblyscript/asc programático)
- Etapa 2: Linker WASM → ejecutable nativo (parseo, resolución, codegen C++, compilación cmake-js)
- Etapa 3: Orquestador wapp (coordina el pipeline con wapp.json)
- Justificación del enfoque: acceso completo al sistema, binario pequeño, multiplataforma, herramientas familiares

Ver [[overview|Overview]] para la síntesis.
