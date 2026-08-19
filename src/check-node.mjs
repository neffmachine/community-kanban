// Importing this checks the Node version and exits if it is too old.
//
// It has to be a side effect of the import, not a function the entry point
// calls: ES modules evaluate all imports before running any of the importing
// file's body, so by the time a called check ran, node:sqlite would already
// have failed to load with a message nobody can act on.
//
// Entry points import this FIRST, before anything version-dependent.
import { isSupported, versionMessage } from './node-version.mjs';

if (!isSupported(process.version)) {
  console.error(versionMessage(process.version));
  process.exit(1);
}
