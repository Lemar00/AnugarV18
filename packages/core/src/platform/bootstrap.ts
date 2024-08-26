/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import {Subscription} from 'rxjs';

import {PROVIDED_NG_ZONE} from '../change_detection/scheduling/ng_zone_scheduling';
import {EnvironmentInjector, R3Injector} from '../di/r3_injector';
import {ErrorHandler} from '../error_handler';
import {RuntimeError, RuntimeErrorCode} from '../errors';
import {DEFAULT_LOCALE_ID} from '../i18n/localization';
import {LOCALE_ID} from '../i18n/tokens';
import {ImagePerformanceWarning} from '../image_performance_warning';
import {Type} from '../interface/type';
import {PLATFORM_DESTROY_LISTENERS} from './platform_destroy_listeners';
import {setLocaleId} from '../render3/i18n/i18n_locale_id';
import {NgZone} from '../zone/ng_zone';

import {ApplicationInitStatus} from '../application/application_init';
import {_callAndReportToErrorHandler, ApplicationRef, remove} from '../application/application_ref';
import {PROVIDED_ZONELESS} from '../change_detection/scheduling/zoneless_scheduling';
import {Injector} from '../di';
import {InternalNgModuleRef, NgModuleRef} from '../linker/ng_module_factory';
import {stringify} from '../util/stringify';

export interface ModuleBootstrapConfig<M> {
  moduleRef: InternalNgModuleRef<M>;
  allPlatformModules: NgModuleRef<unknown>[];
}

export interface ApplicationBootstrapConfig {
  r3Injector: R3Injector;
  platformInjector: Injector;
  rootComponent: Type<unknown> | undefined;
}

function isApplicationBootstrapConfig(
  config: ApplicationBootstrapConfig | ModuleBootstrapConfig<unknown>,
): config is ApplicationBootstrapConfig {
  return !!(config as ApplicationBootstrapConfig).platformInjector;
}

export function bootstrap<M>(
  moduleBootstrapConfig: ModuleBootstrapConfig<M>,
): Promise<NgModuleRef<M>>;
export function bootstrap(
  applicationBootstrapConfig: ApplicationBootstrapConfig,
): Promise<ApplicationRef>;
export function bootstrap<M>(
  config: ModuleBootstrapConfig<M> | ApplicationBootstrapConfig,
): Promise<ApplicationRef> | Promise<NgModuleRef<M>> {
  const envInjector = isApplicationBootstrapConfig(config)
    ? config.r3Injector
    : config.moduleRef.injector;
  const ngZone = envInjector.get(NgZone);
  return ngZone.run(() => {
    if (isApplicationBootstrapConfig(config)) {
      config.r3Injector.resolveInjectorInitializers();
    } else {
      config.moduleRef.resolveInjectorInitializers();
    }
    const exceptionHandler = envInjector.get(ErrorHandler, null);
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (exceptionHandler === null) {
        const errorMessage = isApplicationBootstrapConfig(config)
          ? 'No `ErrorHandler` found in the Dependency Injection tree.'
          : 'No ErrorHandler. Is platform module (BrowserModule) included';
        throw new RuntimeError(
          RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP,
          errorMessage,
        );
      }
      if (envInjector.get(PROVIDED_ZONELESS) && envInjector.get(PROVIDED_NG_ZONE)) {
        throw new RuntimeError(
          RuntimeErrorCode.PROVIDED_BOTH_ZONE_AND_ZONELESS,
          'Invalid change detection configuration: ' +
            'provideZoneChangeDetection and provideExperimentalZonelessChangeDetection cannot be used together.',
        );
      }
    }

    let onErrorSubscription: Subscription;
    ngZone.runOutsideAngular(() => {
      onErrorSubscription = ngZone.onError.subscribe({
        next: (error: any) => {
          exceptionHandler!.handleError(error);
        },
      });
    });

    if (isApplicationBootstrapConfig(config)) {
      // If the whole platform is destroyed, invoke the `destroy` method
      // for all bootstrapped applications as well.
      const destroyListener = () => envInjector.destroy();
      const onPlatformDestroyListeners = config.platformInjector.get(PLATFORM_DESTROY_LISTENERS);
      onPlatformDestroyListeners.add(destroyListener);

      envInjector.onDestroy(() => {
        onErrorSubscription.unsubscribe();
        onPlatformDestroyListeners.delete(destroyListener);
      });
    } else {
      config.moduleRef.onDestroy(() => {
        remove(config.allPlatformModules, config.moduleRef);
        onErrorSubscription.unsubscribe();
      });
    }

    return _callAndReportToErrorHandler(exceptionHandler!, ngZone, () => {
      const initStatus = envInjector.get(ApplicationInitStatus);
      initStatus.runInitializers();

      return initStatus.donePromise.then(() => {
        // If the `LOCALE_ID` provider is defined at bootstrap then we set the value for ivy
        const localeId = envInjector.get(LOCALE_ID, DEFAULT_LOCALE_ID);
        setLocaleId(localeId || DEFAULT_LOCALE_ID);
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          const imagePerformanceService = envInjector.get(ImagePerformanceWarning);
          imagePerformanceService.start();
        }

        if (isApplicationBootstrapConfig(config)) {
          const appRef = envInjector.get(ApplicationRef);
          if (config.rootComponent !== undefined) {
            appRef.bootstrap(config.rootComponent);
          }
          return appRef;
        } else {
          moduleDoBootstrap(config.moduleRef, config.allPlatformModules);
          return config.moduleRef;
        }
      });
    });
  });
}

function moduleDoBootstrap(
  moduleRef: InternalNgModuleRef<any>,
  allPlatformModules: NgModuleRef<unknown>[],
): void {
  const appRef = moduleRef.injector.get(ApplicationRef);
  if (moduleRef._bootstrapComponents.length > 0) {
    moduleRef._bootstrapComponents.forEach((f) => appRef.bootstrap(f));
  } else if (moduleRef.instance.ngDoBootstrap) {
    moduleRef.instance.ngDoBootstrap(appRef);
  } else {
    throw new RuntimeError(
      RuntimeErrorCode.BOOTSTRAP_COMPONENTS_NOT_FOUND,
      ngDevMode &&
        `The module ${stringify(moduleRef.instance.constructor)} was bootstrapped, ` +
          `but it does not declare "@NgModule.bootstrap" components nor a "ngDoBootstrap" method. ` +
          `Please define one of these.`,
    );
  }
  allPlatformModules.push(moduleRef);
}
