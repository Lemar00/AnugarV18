/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {ExternalLink} from '@angular/docs';
import {RouterLink} from '@angular/router';
import {GITHUB, X, MEDIUM, YOUTUBE} from './../../constants/links';

@Component({
  selector: 'footer[adev-footer]',
  standalone: true,
  imports: [CommonModule, ExternalLink, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  readonly GITHUB = GITHUB;
  readonly X = X;
  readonly YOUTUBE = YOUTUBE;
  readonly MEDIUM = MEDIUM;
}
