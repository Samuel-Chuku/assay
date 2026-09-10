/**
 * Exports the latest verdict per agent to config/verdicts.json.
 *
 * The committed file is the baseline the site falls back to. The live copy is
 * served by the watcher, which derives it from the same function.
 *
 *   pnpm verdicts:export
 */
import 'dotenv/config';

import { writeFileSync } from 'node:fs';

import { collectVerdicts } from '../underwriter/exported';

const OUTPUT = 'config/verdicts.json';

function main(): void {
  const verdicts = collectVerdicts();

  writeFileSync(OUTPUT, `${JSON.stringify(verdicts, null, 2)}\n`);

  console.log(`Wrote ${verdicts.length} verdict(s) to ${OUTPUT}`);
  for (const v of verdicts) {
    console.log(
      `  agent ${v.agentId}  ${v.approve ? 'APPROVED' : 'REFUSED'}  by ${v.source}  hash ${v.reasoningHash.slice(0, 12)}…  verified`
    );
  }
}

main();
