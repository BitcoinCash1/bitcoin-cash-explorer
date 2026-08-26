const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

export function resolveBcmrIconUrl(icon?: string): string | null {
  if (!icon) return null;
  if (icon.startsWith('ipfs://')) {
    return IPFS_GATEWAY + icon.slice('ipfs://'.length);
  }
  return icon;
}
