import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { TokenDetailsComponent } from './token-details/token-details.component';
import { SharedModule } from '@app/shared/shared.module';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/',
    pathMatch: 'full',
  },
  {
    path: ':category',
    component: TokenDetailsComponent,
    data: {
      ogImage: true,
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TokenRoutingModule {}

@NgModule({
  imports: [CommonModule, TokenRoutingModule, SharedModule],
  declarations: [TokenDetailsComponent],
  exports: [TokenRoutingModule],
})
export class TokenModule {}
