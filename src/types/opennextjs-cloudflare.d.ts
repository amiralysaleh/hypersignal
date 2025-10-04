declare module '@opennextjs/cloudflare' {
  interface CloudflareContext<TEnv = CloudflareBindings> {
    env?: TEnv;
  }

  interface GetCloudflareContextOptions {
    async?: boolean;
  }

  export function getCloudflareContext<TEnv = CloudflareBindings>(
    options?: GetCloudflareContextOptions
  ): CloudflareContext<TEnv> | undefined;

  export function initOpenNextCloudflareForDev(): void;

  export function defineCloudflareConfig<TConfig = Record<string, unknown>>(
    config?: TConfig
  ): TConfig;
}
