const ZOMBOID_HELP = {
  MaxPlayers: 'Maximum simultaneous players. Higher values need more RAM.',
  PVP: 'Allow players to damage each other.',
  PauseEmpty: 'Pause the simulation when no players are online. Recommended for small groups.',
  XPMultiplier: '1.0 = normal XP gain. 2.0 = double XP. Higher values make progression faster.',
  LootRespawn: 'How often loot refreshes in looted containers.',
  HoursForLootRespawn: 'Real-world hours between loot respawn checks.',
  ZombieConfig: 'Preset difficulty profile for zombie behavior and population.',
  WorkshopItems: 'Managed automatically by the Workshop tab. Edit with caution.',
  Mods: 'Managed automatically by the Workshop tab. Edit with caution.',
  Map: 'Server map. Default is Muldraugh, KY. Add custom maps from Workshop.',
  SteamVAC: 'Valve Anti-Cheat. Recommended for public servers.'
};

const HELP_BY_TEMPLATE = {
  zomboid: ZOMBOID_HELP
};

export function getFieldHelp(templateId, field) {
  const templateHelp = HELP_BY_TEMPLATE[templateId];
  const key = field.iniKey || field.propKey || field.jsonKey || field.xmlTag || field.yamlKey || field.envVar;
  if (templateHelp && templateHelp[key]) return templateHelp[key];
  return field.description || null;
}
