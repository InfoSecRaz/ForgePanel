const { z } = require('zod');

const createServerSchema = z.object({
  name: z.string().min(1),
  gameId: z.string().min(1),
  port: z.number().int().positive().optional(),
  queryPort: z.number().int().positive().optional(),
  ramLimitMb: z.number().int().positive().optional(),
  cpuLimitPercent: z.number().nonnegative().optional(),
  diskLimitGb: z.number().positive().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  installOptionValues: z.record(z.string(), z.unknown()).optional(),
  customColor: z.string().nullable().optional(),
  customIcon: z.string().nullable().optional(),
  customTagline: z.string().nullable().optional()
});

const updateServerSchema = z.object({
  name: z.string().min(1).optional(),
  ramLimitMb: z.number().int().positive().optional(),
  cpuLimitPercent: z.number().nonnegative().optional(),
  diskLimitGb: z.number().positive().optional(),
  autoRestart: z.boolean().optional(),
  autoRestartDelay: z.number().int().nonnegative().optional(),
  discordWebhookUrl: z.string().nullable().optional(),
  discordBotChannelId: z.string().nullable().optional(),
  discordChatRelay: z.boolean().optional(),
  discordStatusChannelId: z.string().nullable().optional(),
  customColor: z.string().nullable().optional(),
  customIcon: z.string().nullable().optional(),
  customTagline: z.string().nullable().optional()
});

const saveConfigSchema = z.object({
  raw: z.string().optional(),
  fields: z.record(z.string(), z.unknown()).optional()
});

module.exports = { createServerSchema, updateServerSchema, saveConfigSchema };
