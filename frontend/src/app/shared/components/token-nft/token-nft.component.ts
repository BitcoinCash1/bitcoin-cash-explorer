import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-token-nft',
  templateUrl: './token-nft.component.html',
  styleUrls: ['./token-nft.component.scss'],
  standalone: false,
})
export class TokenNftComponent {
  @Input() token_nft_capability: string;
  @Input() token_nft_commitment: string;
}
