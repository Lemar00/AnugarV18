/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import fs from 'fs';
import path from 'path';
import {executeAnalyzePhase} from '../../../../utils/tsurge/executors/analyze_exec';
import {executeMergePhase} from '../../../../utils/tsurge/executors/merge_exec';
import {executeMigratePhase} from '../../../../utils/tsurge/executors/migrate_exec';
import {SignalInputMigration} from '../migration';
import {writeMigrationReplacements} from '../write_replacements';
import {CompilationUnitData} from './unit_data';

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const migration = new SignalInputMigration();

  if (mode === 'extract') {
    const analyzeResult = await executeAnalyzePhase(migration, path.resolve(args[0]));
    process.stdout.write(JSON.stringify(analyzeResult));
  } else if (mode === 'merge') {
    const mergedResult = await executeMergePhase(
      migration,
      await Promise.all(
        args.map((p) =>
          fs.promises
            .readFile(path.resolve(p), 'utf8')
            .then((data) => JSON.parse(data) as CompilationUnitData),
        ),
      ),
    );

    process.stdout.write(JSON.stringify(mergedResult));
  } else if (mode === 'migrate') {
    const replacements = await executeMigratePhase(
      migration,
      JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')) as CompilationUnitData,
      path.resolve(args[0]),
    );

    writeMigrationReplacements(replacements);
  }
}
