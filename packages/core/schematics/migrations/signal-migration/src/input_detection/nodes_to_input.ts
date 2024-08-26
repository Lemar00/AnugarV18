/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import ts from 'typescript';
import {MigrationHost} from '../migration_host';
import {isInputContainerNode} from '../input_detection/input_node';
import {getInputDescriptor} from '../utils/input_id';
import {KnownInputInfo, KnownInputs} from './known_inputs';

/**
 * Attempts to resolve the known `@Input` metadata for the given
 * type checking symbol. Returns `null` if it's not for an input.
 */
export function attemptRetrieveInputFromSymbol(
  host: MigrationHost,
  memberSymbol: ts.Symbol,
  knownInputs: KnownInputs,
): KnownInputInfo | null {
  // Even for declared classes from `.d.ts`, the value declaration
  // should exist and point to the property declaration.
  if (
    memberSymbol.valueDeclaration !== undefined &&
    isInputContainerNode(memberSymbol.valueDeclaration)
  ) {
    const member = memberSymbol.valueDeclaration;
    // If the member itself is an input that is being migrated, we
    // do not need to check, as overriding would be fine then— like before.
    const memberInputDescr = isInputContainerNode(member) ? getInputDescriptor(host, member) : null;
    return memberInputDescr !== null ? knownInputs.get(memberInputDescr) ?? null : null;
  }
  return null;
}
