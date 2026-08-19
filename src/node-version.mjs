// Node version rules, kept pure so they can be tested.
//
// The app leans on two things that only exist in Node 22+: the built-in
// node:sqlite module and `--env-file`. Shops run whatever Node came with the
// box, so this is the most likely thing to go wrong on someone else's machine.
export const MIN_MAJOR = 22;

export function nodeMajor(version) {
  return parseInt(String(version).replace(/^v/, '').split('.')[0], 10);
}

export function isSupported(version) {
  const major = nodeMajor(version);
  return Number.isFinite(major) && major >= MIN_MAJOR;
}

export function versionMessage(version) {
  return [
    '',
    `  This needs Node ${MIN_MAJOR} or newer — you have ${version}.`,
    '',
    '  Node 22 added the built-in database support this app uses, so there is',
    '  no way around it. Installing it takes a minute:',
    '',
    '    macOS / Linux:  https://nodejs.org  (download the LTS installer)',
    '    or with brew:   brew install node',
    '    Windows:        https://nodejs.org  (download the LTS installer)',
    '',
    '  Then check it took, and try again:',
    '',
    '    node --version',
    '',
  ].join('\n');
}
