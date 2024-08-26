/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import ts from 'typescript';

import {DtsMetadataReader, MetadataReader} from '../../../../../compiler-cli/src/ngtsc/metadata';
import {PartialEvaluator} from '../../../../../compiler-cli/src/ngtsc/partial_evaluator';
import {NgtscProgram} from '../../../../../compiler-cli/src/ngtsc/program';
import {TypeScriptReflectionHost} from '../../../../../compiler-cli/src/ngtsc/reflection';

import assert from 'assert';
import {ProgramInfo} from '../../../utils/tsurge/program_info';
import {ResourceLoader} from '../../../../../compiler-cli/src/ngtsc/annotations';
import {NgCompiler} from '../../../../../compiler-cli/src/ngtsc/core';
import {ReferenceEmitter} from '../../../../../compiler-cli/src/ngtsc/imports';
import {isShim} from '../../../../../compiler-cli/src/ngtsc/shims';
import {TemplateTypeChecker} from '../../../../../compiler-cli/src/ngtsc/typecheck/api';

/**
 * Interface containing the analysis information
 * for an Angular program to be migrated.
 */
export interface AnalysisProgramInfo extends ProgramInfo<NgtscProgram> {
  // List of source files in the program.
  sourceFiles: ts.SourceFile[];
  // List of all files in the program, including external `d.ts`.
  programFiles: readonly ts.SourceFile[];
  reflector: TypeScriptReflectionHost;
  typeChecker: ts.TypeChecker;
  templateTypeChecker: TemplateTypeChecker;
  metaRegistry: MetadataReader;
  dtsMetadataReader: DtsMetadataReader;
  evaluator: PartialEvaluator;
  refEmitter: ReferenceEmitter;
  resourceLoader: ResourceLoader;
}

/**
 * Prepares migration analysis for the given program.
 *
 * Unlike {@link createAndPrepareAnalysisProgram} this does not create the program,
 * and can be used for integrations with e.g. the language service.
 */
export function prepareAnalysisInfo(
  userProgram: ts.Program,
  compiler: NgCompiler,
  programAbsoluteRootPaths?: string[],
) {
  // Get template type checker & analyze sync.
  const templateTypeChecker = compiler.getTemplateTypeChecker();

  // Generate all type check blocks.
  templateTypeChecker.generateAllTypeCheckBlocks();

  const {refEmitter, metaReader} = compiler['ensureAnalyzed']();
  const typeChecker = userProgram.getTypeChecker();

  const reflector = new TypeScriptReflectionHost(typeChecker);
  const evaluator = new PartialEvaluator(reflector, typeChecker, null);
  const dtsMetadataReader = new DtsMetadataReader(typeChecker, reflector);
  const resourceLoader = compiler['resourceManager'];

  // Optional filter for testing. Allows for simulation of parallel execution
  // even if some tsconfig's have overlap due to sharing of TS sources.
  // (this is commonly not the case in g3 where deps are `.d.ts` files).
  const limitToRootNamesOnly = process.env['LIMIT_TO_ROOT_NAMES_ONLY'] === '1';
  if (limitToRootNamesOnly) {
    assert(
      programAbsoluteRootPaths !== undefined,
      'Expected absolute root paths when limiting to root names.',
    );
  }

  const programFiles = userProgram.getSourceFiles();
  const sourceFiles = programFiles.filter(
    (f) =>
      !f.isDeclarationFile &&
      // Note `isShim` will work for the initial program, but for TCB programs, the shims are no longer annotated.
      !isShim(f) &&
      !f.fileName.endsWith('.ngtypecheck.ts') &&
      // Optional replacement filter. Allows parallel execution in case
      // some tsconfig's have overlap due to sharing of TS sources.
      // (this is commonly not the case in g3 where deps are `.d.ts` files).
      (!limitToRootNamesOnly || programAbsoluteRootPaths!.includes(f.fileName)),
  );

  return {
    programFiles,
    sourceFiles,
    metaRegistry: metaReader,
    dtsMetadataReader,
    evaluator,
    reflector,
    typeChecker,
    refEmitter,
    templateTypeChecker,
    resourceLoader,
  };
}
