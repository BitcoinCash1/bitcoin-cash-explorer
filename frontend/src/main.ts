import { provideZoneChangeDetection } from '@angular/core';
/// <reference types="@angular/localize" />

import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

platformBrowser()
  .bootstrapModule(AppModule, {
    applicationProviders: [provideZoneChangeDetection()],
  })
  .catch((err) => console.error(err));
