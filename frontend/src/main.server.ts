/// <reference types="@angular/localize" />

import { provideZoneChangeDetection } from '@angular/core';
import { BootstrapContext } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

const bootstrap = (context: BootstrapContext) =>
  context.platformRef.bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()],
  });

export default bootstrap;
