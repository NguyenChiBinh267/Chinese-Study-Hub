export const technicalDirectory: string;
export function technicalState(): {
  database: string;
  ownerId: string;
  runtimeUrl: string;
};
export function setupTechnicalDatabase(): Promise<void>;
export function resetTechnicalRows(): Promise<void>;
