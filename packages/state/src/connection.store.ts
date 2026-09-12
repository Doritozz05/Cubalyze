import { createStore } from 'zustand/vanilla';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionState {
  status: ConnectionStatus;
  deviceName: string | null;
  deviceModel: string | null;
  /**
   * Bluetooth address of the connected cube, exactly as the adapter read it.
   * Raw on purpose: canonicalising it is the Locker's job (`normalizeSmartId`),
   * and the protocol walks the bytes backwards, so the value here is not
   * necessarily in the printed order.
   */
  deviceMac: string | null;
  batteryLevel: number | null;
  error: string | null;

  setConnecting: () => void;
  setConnected: (deviceName: string, deviceModel: string) => void;
  /**
   * What the cube answers about itself AFTER connecting (model, address).
   *
   * `setConnected` fires the moment the link is up, which is before the cube
   * has answered the hardware request, so `deviceModel` starts as the adapter's
   * placeholder (`"SmartCube"`). This is how that placeholder gets corrected —
   * previously nothing did, and the panel kept showing "SmartCube" forever.
   */
  setHardware: (info: { model?: string | null; mac?: string | null }) => void;
  setDisconnected: (error?: string) => void;
  setReconnecting: () => void;
  setBatteryLevel: (level: number) => void;
  reset: () => void;
}

const initialState = {
  status: 'disconnected' as ConnectionStatus,
  deviceName: null as string | null,
  deviceModel: null as string | null,
  deviceMac: null as string | null,
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

    setHardware: (info) =>
      set((state) => {
        // A hardware answer can land after the cube is already gone (a queued
        // event, or a user disconnect mid-handshake). Re-populating the device
        // fields then would leave the UI describing a cube that is not there,
        // so anything arriving while disconnected is dropped.
        if (state.status === 'disconnected') return state;

        const model = info.model ?? null;
        const mac = info.mac ?? null;
        const modelChanged = Boolean(model) && model !== state.deviceModel;
        const macChanged = Boolean(mac) && mac !== state.deviceMac;
        // Returning the same object is what makes zustand skip the notification,
        // so a repeated hardware answer does not re-render every subscriber.
        if (!modelChanged && !macChanged) return state;

        return {
          ...(modelChanged ? { deviceModel: model } : {}),
          ...(macChanged ? { deviceMac: mac } : {}),
        };
      }),

    setDisconnected: (error) =>
      set({
        status: 'disconnected',
        deviceName: null,
        deviceModel: null,
        // Cleared with the rest: a surviving address would describe a cube that
        // is no longer connected, and the Locker's link reads it.
        deviceMac: null,
        batteryLevel: null,
        error: error ?? null,
      }),

    setReconnecting: () => set({ status: 'reconnecting', error: null }),

    setBatteryLevel: (level) => set({ batteryLevel: level }),

    reset: () => set(initialState),
  }));
};

export const connectionStore = createConnectionStore();
