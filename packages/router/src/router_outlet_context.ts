/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {ComponentRef, EnvironmentInjector, Injectable} from '@angular/core';

import {RouterOutletContract} from './directives/router_outlet';
import {ActivatedRoute} from './router_state';
import {getClosestRouteInjector} from './utils/config';

/**
 * Store contextual information about a `RouterOutlet`
 *
 * @publicApi
 */
export class OutletContext {
  outlet: RouterOutletContract | null = null;
  route: ActivatedRoute | null = null;
  children = new ChildrenOutletContexts(this.rootInjector);
  attachRef: ComponentRef<any> | null = null;
  get injector(): EnvironmentInjector {
    return getClosestRouteInjector(this.route?.snapshot) ?? this.rootInjector;
  }
  // TODO(atscott): Only here to avoid a "breaking" change in a patch/minor. Remove in v19.
  set injector(_: EnvironmentInjector) {}

  constructor(private readonly rootInjector: EnvironmentInjector) {}
}

/**
 * Store contextual information about the children (= nested) `RouterOutlet`
 *
 * @publicApi
 */
@Injectable({providedIn: 'root'})
export class ChildrenOutletContexts {
  // contexts for child outlets, by name.
  private contexts = new Map<string, OutletContext>();

  /** @nodoc */
  constructor(private rootInjector: EnvironmentInjector) {}

  /** Called when a `RouterOutlet` directive is instantiated */
  onChildOutletCreated(childName: string, outlet: RouterOutletContract): void {
    const context = this.getOrCreateContext(childName);
    context.outlet = outlet;
    this.contexts.set(childName, context);
  }

  /**
   * Called when a `RouterOutlet` directive is destroyed.
   * We need to keep the context as the outlet could be destroyed inside a NgIf and might be
   * re-created later.
   */
  onChildOutletDestroyed(childName: string): void {
    const context = this.getContext(childName);
    if (context) {
      context.outlet = null;
      context.attachRef = null;
    }
  }

  /**
   * Called when the corresponding route is deactivated during navigation.
   * Because the component get destroyed, all children outlet are destroyed.
   */
  onOutletDeactivated(): Map<string, OutletContext> {
    const contexts = this.contexts;
    this.contexts = new Map();
    return contexts;
  }

  onOutletReAttached(contexts: Map<string, OutletContext>) {
    this.contexts = contexts;
  }

  getOrCreateContext(childName: string): OutletContext {
    let context = this.getContext(childName);

    if (!context) {
      context = new OutletContext(this.rootInjector);
      this.contexts.set(childName, context);
    }

    return context;
  }

  getContext(childName: string): OutletContext | null {
    return this.contexts.get(childName) || null;
  }
}
