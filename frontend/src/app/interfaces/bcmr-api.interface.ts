/**
 * Spec schema: https://cashtokens.org/bcmr-v2.schema.json
 *
 * We are only using the ChainSnapshot part of the schema.
 */

// URI mapping type for identity-related URIs
export interface URIs {
  [key: string]: string;
}

// Extensions type for additional metadata
export interface Extensions {
  [key: string]:
    | string
    | { [key: string]: string }
    | { [key: string]: { [key: string]: string } };
}

// Token information for chain's native currency
export interface ChainToken {
  symbol: string;
  decimals?: number;
  category?: string;
}

// ChainSnapshot interface based on the BCMR v2 schema
export interface BcmrMetadata {
  name: string;
  description?: string;
  extensions?: Extensions;
  splitId?: string;
  status?: 'active' | 'burned' | 'inactive';
  tags?: string[];
  token: ChainToken;
  uris?: URIs;
  is_nft?: boolean;
}
