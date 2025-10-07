declare module '@opennextjs/cloudflare' {
  // The real package provides rich typings, but for type-checking we only need the shapes we consume.
  export function initOpenNextCloudflareForDev(...args: any[]): Promise<void> | void;
  export function defineCloudflareConfig(...args: any[]): any;
  export function getCloudflareContext(...args: any[]): {
    env: unknown;
  };
}
