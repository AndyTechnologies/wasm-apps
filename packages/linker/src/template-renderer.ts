import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import type { NunjucksTemplateContext } from './template-context.js';
import { LinkerError } from '@wasm-apps/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TEMPLATE_DIR = path.resolve(__dirname, '../templates');

/**
 * Filtro Nunjucks: escapa un string para usarlo como string literal C++.
 */
function escapeCpp(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\0/g, '\\0').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

/**
 * Filtro Nunjucks: sanitiza un nombre para usarlo como identificador C++.
 */
function sanitizeIdentifier(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

/**
 * Renderiza el template C++ principal usando Nunjucks.
 *
 * @param context - Datos estructurados para el template.
 * @param templatePath - Ruta opcional a un directorio de templates personalizados.
 *                       Si no se provee, usa los templates built-in en `templates/`.
 * @returns Código C++ generado.
 * @throws LinkerError si el template principal no se encuentra.
 */
export function renderTemplate(context: NunjucksTemplateContext, templatePath?: string): string {
  const templateDir = templatePath ? path.resolve(templatePath) : DEFAULT_TEMPLATE_DIR;

  // If a custom template path was explicitly provided, verify the template exists
  if (templatePath) {
    const mainTemplate = path.join(templateDir, 'main.c.njk');
    if (!fs.existsSync(mainTemplate)) {
      throw new LinkerError(`Template main.c.njk not found in custom path: ${templateDir}`, { code: 'TEMPLATE_NOT_FOUND', templateDir });
    }
  }

  const env = nunjucks.configure(templateDir, {
    autoescape: false,
    noCache: true,
  });

  // Registrar filtros personalizados
  env.addFilter('escapeCpp', escapeCpp);
  env.addFilter('sanitizeId', sanitizeIdentifier);

  try {
    return nunjucks.render('main.c.njk', context);
  } catch (err) {
    throw new LinkerError(`Error al renderizar template: ${(err as Error).message}`, { templateDir });
  }
}
