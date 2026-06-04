// Tiny Node ESM loader that resolves extensionless relative imports as
// `.ts` files. The project's TypeScript code uses bundler-style module
// resolution (no explicit extensions) and we keep the existing source
// untouched; this loader only affects the `node --test` runner.
//
// This module self-registers as an ESM loader via `module.register`, so
// the `npm test` script only needs to `--import` it once.

import { register } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath, dirname } from 'node:path';

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts'];

register(new URL(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (isSpecifierEligible(specifier, context.parentURL)) {
    const resolved = tryResolveWithExtensions(specifier, context.parentURL);
    if (resolved) {
      return nextResolve(resolved, context);
    }
  }
  return nextResolve(specifier, context);
}

function isSpecifierEligible(specifier, parentURL) {
  if (!parentURL) return false;
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return false;
  if (/\.[mc]?[jt]sx?$/.test(specifier)) return false;
  return true;
}

function tryResolveWithExtensions(specifier, parentURL) {
  const parentPath = dirname(fileURLToPath(parentURL));
  const absoluteBase = resolvePath(parentPath, specifier);
  for (const extension of TS_EXTENSIONS) {
    const candidate = absoluteBase + extension;
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  for (const extension of TS_EXTENSIONS) {
    const candidate = absoluteBase + '/index' + extension;
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return existsSync(path);
  }
}
