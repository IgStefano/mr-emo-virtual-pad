import { z } from 'zod';

export const appInfoSchema = z.strictObject({ version: z.string() });
export type AppInfo = z.infer<typeof appInfoSchema>;
export interface DesktopApi {
  getAppInfo: () => Promise<AppInfo>;
}
export const appInfoChannel = 'app:info';
