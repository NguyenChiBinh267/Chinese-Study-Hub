export const localDirectory: string;
export const migrationFile: string;
export function migrationDigest(): string;
export function adminConfig(database?: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};
export function migrate(database?: string, down?: boolean): Promise<void>;
