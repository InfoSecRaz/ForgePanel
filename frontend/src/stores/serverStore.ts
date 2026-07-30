import { create } from 'zustand';
import type { Server, ServerState, ServerHealth } from '../types';

interface ServerStore {
  servers: Server[];
  setServers: (servers: Server[]) => void;
  updateState: (serverId: string, state: ServerState, health?: ServerHealth) => void;
  updateStats: (serverId: string, cpu: number, ram: number, players: number, health?: ServerHealth) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  setServers: (servers) => set({ servers }),
  updateState: (serverId, state, health) =>
    set((s) => ({
      servers: s.servers.map((srv) =>
        srv.id === serverId ? { ...srv, state, ...(health ? { health } : {}) } : srv
      )
    })),
  updateStats: (serverId, cpu, ram, players, health) =>
    set((s) => ({
      servers: s.servers.map((srv) =>
        srv.id === serverId
          ? { ...srv, _cpu: cpu, _ram: ram, _players: players, ...(health ? { health } : {}) }
          : srv
      )
    }))
}));
