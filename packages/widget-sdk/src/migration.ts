import { z } from "zod";

/**
 * A single step that upgrades stored instance config between schema versions.
 * Steps must form a contiguous chain; the platform applies them in order.
 */
export type WidgetConfigMigrationStep = {
  fromVersion: number;
  toVersion: number;
  migrate: (config: unknown) => unknown;
};

export type WidgetConfigMigration = {
  /** Current schema version for newly written config. */
  currentVersion: number;
  steps: readonly WidgetConfigMigrationStep[];
};

export const widgetConfigVersionSchema = z.number().int().min(1);

export class WidgetConfigMigrationError extends Error {
  readonly fromVersion: number;
  readonly toVersion: number;

  constructor(message: string, fromVersion: number, toVersion: number) {
    super(message);
    this.name = "WidgetConfigMigrationError";
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
  }
}

/**
 * Migrates stored config from `fromVersion` up to `targetVersion` using ordered steps.
 */
export function migrateWidgetConfig(
  config: unknown,
  fromVersion: number,
  targetVersion: number,
  steps: readonly WidgetConfigMigrationStep[],
): unknown {
  if (fromVersion === targetVersion) {
    return config;
  }

  if (fromVersion > targetVersion) {
    throw new WidgetConfigMigrationError(
      `Cannot migrate config from v${fromVersion} down to v${targetVersion}`,
      fromVersion,
      targetVersion,
    );
  }

  let currentVersion = fromVersion;
  let currentConfig = config;

  while (currentVersion < targetVersion) {
    const step = steps.find((candidate) => candidate.fromVersion === currentVersion);
    if (!step) {
      throw new WidgetConfigMigrationError(
        `Missing migration step from v${currentVersion} toward v${targetVersion}`,
        currentVersion,
        targetVersion,
      );
    }

    if (step.toVersion <= step.fromVersion) {
      throw new WidgetConfigMigrationError(
        `Invalid migration step: v${step.fromVersion} → v${step.toVersion}`,
        step.fromVersion,
        step.toVersion,
      );
    }

    if (step.toVersion > targetVersion) {
      throw new WidgetConfigMigrationError(
        `Migration step v${step.fromVersion} → v${step.toVersion} overshoots target v${targetVersion}`,
        step.fromVersion,
        step.toVersion,
      );
    }

    currentConfig = step.migrate(currentConfig);
    currentVersion = step.toVersion;
  }

  return currentConfig;
}

/**
 * Parses config with optional migration when the stored schema version is behind.
 */
export function parseMigratedConfig<TSchema extends z.ZodType>(
  schema: TSchema,
  config: unknown,
  storedSchemaVersion: number,
  migration: WidgetConfigMigration,
): z.infer<TSchema> {
  const migrated = migrateWidgetConfig(
    config,
    storedSchemaVersion,
    migration.currentVersion,
    migration.steps,
  );
  return schema.parse(migrated);
}
