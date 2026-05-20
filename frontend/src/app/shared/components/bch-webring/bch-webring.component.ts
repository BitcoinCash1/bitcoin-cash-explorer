import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface WebringSite {
  url: string;
  name: string;
  owner: string;
}

@Component({
  selector: 'app-bch-webring',
  standalone: false,
  template: `
    <div class="webring" *ngIf="current">
      <h2>BCH Webring</h2>
      <p>
        You are visiting <a [href]="current.url">{{ current.name }}</a> by
        {{ current.owner }}
      </p>
      <nav class="nav">
        <a [href]="prev?.url">&#8592; Prev</a>
        <a [href]="random?.url">Random</a>
        <a [href]="next?.url">Next &#8594;</a>
      </nav>
    </div>
    <div class="webring" *ngIf="notFound">
      <p>Site not found in the webring.</p>
    </div>
  `,
  styleUrls: ['./bch-webring.component.scss'],
})
export class BchWebringComponent implements OnInit {
  @Input() site: string;

  current: WebringSite | null = null;
  prev: WebringSite | null = null;
  next: WebringSite | null = null;
  random: WebringSite | null = null;
  notFound = false;

  private readonly dataUrl = `https://raw.githubusercontent.com/BitcoinCash1/bch-webring/refs/heads/main/webring.json`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<WebringSite[]>(this.dataUrl).subscribe((sites) => {
      const index = sites.findIndex((s) => s.url === this.site);
      if (index === -1) {
        this.notFound = true;
        return;
      }
      this.current = sites[index];
      this.prev = sites[index === 0 ? sites.length - 1 : index - 1];
      this.next = sites[index === sites.length - 1 ? 0 : index + 1];
      this.random = sites[Math.floor(Math.random() * sites.length)];
    });
  }
}
