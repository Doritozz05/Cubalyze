import { createStore } from 'zustand/vanilla';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionState {
  status: ConnectionStatus;
  deviceName: string | null;
  deviceModel: string | null;
  batteryLevel: number | null;
  error: string | null;

  setConnecting: () => void;
  setConnected: (deviceName: string, deviceModel: string) => void;
  setDisconnected: (error?: string) => void;
  setReconnecting: () => void;
  setBatteryLevel: (level: number) => void;
  reset: () => void;
}

const initialState = {
  status: 'disconnected' as ConnectionStatus,
  deviceName: null as string | null,
  deviceModel: null as string | null,
  batteryLevel: null as number | null,
  error: null as string | null,
};

export const createConnectionStore = () => {
  return createStore<ConnectionState>((set) => ({
    ...initialState,

    setConnecting: () => set({ status: 'connecting', error: null }),

    setConnected: (deviceName, deviceModel) =>
      set({
        status: 'connected',
        deviceName,
        deviceModel,
        batteryLevel: null,
        error: null,
      }),

    setDisconnected: (error) =>
      set({
        status: 'disconnected',
        deviceName: null,
        deviceModel: null,
        batteryLevel: null,
        error: error ?? null,
      }),

    setReconnecting: () => set({ status: 'reconnecting', error: null }),

    setBatteryLevel: (level) => set({ batteryLevel: level }),

    reset: () => set(initialState),
  }));
};

export const connectionStore = createConnectionStore();
