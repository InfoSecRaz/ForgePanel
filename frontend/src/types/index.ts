export type ServerState =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'installing'
  | 'restarting'
  | 'crashed';

export interface ServerHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  reasons?: string[];
}

export interface Server {
  id: string;
  name: string;
  game_id: string;
  category?: string;
  health?: ServerHealth;
  state: ServerState;
  port: number;
  ram_limit_mb: number;
  cpu_limit_percent: number;
  disk_limit_gb: number;
  maxPlayers?: number;
  updated_at?: string;
  created_at?: string;
  install_branch?: string;
  playit_enabled?: boolean;
  playit_public_address?: string;
  diskUsedMb?: number;
  // live stats — injected by socket
  _cpu?: number;
  _ram?: number;
  _players?: number;
  // customization
  custom_color?: string;
  custom_icon?: string;
  custom_tagline?: string;
}

export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface HostStats {
  totalRamMb: number;
  cpuCores: number;
  totalDiskGb: number;
}

export interface ActivityEvent {
  id: string;
  eventType: string;
  description: string;
  username?: string;
  ipAddress?: string;
  occurredAt: string;
}

export interface ToastItem {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface TemplatePort {
  port: number;
  primary?: boolean;
}

export interface TemplateField {
  envVar: string;
  label: string;
  type: 'text' | 'number' | 'bool' | 'select' | 'password';
  default?: string | number | boolean;
  readonly?: boolean;
  requiresRestart?: boolean;
  options?: string[];
  description?: string;
  iniKey?: string;
  propKey?: string;
  jsonKey?: string;
  xmlTag?: string;
  yamlKey?: string;
}

export interface InstallOption {
  key: string;
  label: string;
  type: 'select' | 'text';
  default?: string;
  options?: Array<{ value: string; label: string }>;
  description?: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  ports?: TemplatePort[];
  fields?: TemplateField[];
  installOptions?: InstallOption[];
  installNotes?: string;
  wineRequired?: boolean;
  anon?: boolean;
  defaultRamMb?: number;
}

export interface Permission {
  server_id: string;
  can_start: boolean;
  can_stop: boolean;
  can_restart: boolean;
  can_console: boolean;
  can_files: boolean;
  can_config: boolean;
}

// Socket event payloads
export interface StateChangePayload {
  serverId: string;
  state: ServerState;
  health?: ServerHealth;
}

export interface StatsUpdatePayload {
  serverId: string;
  cpu: number;
  ram: number;
  players: number;
  health?: ServerHealth;
}

export interface ActivityNewPayload {
  serverId: string;
  event: ActivityEvent;
}

export interface PlayerJoinPayload {
  serverId: string;
  playerName: string;
}

export interface PlayerLeavePayload {
  serverId: string;
  playerName: string;
}
