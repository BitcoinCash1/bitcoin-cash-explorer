import { BootstrapContext } from '@angular/platform-browser';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app/app.module';

const bootstrap = (context: BootstrapContext) =>
  platformBrowserDynamic().bootstrapModule(AppModule);

export default bootstrap;
