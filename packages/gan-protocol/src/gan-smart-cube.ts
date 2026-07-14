
import * as def from './gan-cube-definitions';
import { GanGen2CubeEncrypter, GanGen3CubeEncrypter, GanGen4CubeEncrypter } from './gan-cube-encrypter';
import {
    BluetoothDeviceWithMAC,
    GanCubeConnection,
    GanCubeCommand,
    GanCubeEvent,
    GanCubeMove,
    GanCubeClassicConnection,
    GanGen2ProtocolDriver,
    GanGen3ProtocolDriver,
    GanGen4ProtocolDriver
} from './gan-cube-protocol';

/** Iterate over all known GAN cube CICs to find Manufacturer Specific Data */
function getManufacturerDataBytes(manufacturerData: BluetoothManufacturerData | DataView): DataView | undefined {
    // Workaround for Bluefy browser which may return raw DataView directly instead of Map
    if (manufacturerData instanceof DataView) {
        return new DataView(manufacturerData.buffer.slice(2, 11));
    }
    for (const id of def.GAN_CIC_LIST) {
        if (manufacturerData.has(id)) {
            return new DataView(manufacturerData.get(id)!.buffer.slice(0, 9));
        }
    }
    return;
}

/** Extract MAC from last 6 bytes of Manufacturer Specific Data */
function extractMAC(manufacturerData: BluetoothManufacturerData): string {
    const mac: Array<string> = [];
    const dataView = getManufacturerDataBytes(manufacturerData);
    if (dataView && dataView.byteLength >= 6) {
        for (let i = 1; i <= 6; i++) {
            mac.push(dataView.getUint8(dataView.byteLength - i).toString(16).toUpperCase().padStart(2, "0"));
        }
    }
    return mac.join(":");
}

/** If browser supports Web Bluetooth watchAdvertisements() API, try to retrieve MAC address automatically */
async function autoRetrieveMacAddress(device: BluetoothDevice): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
        if (typeof device.watchAdvertisements != 'function') {
            resolve(null);
        }
        const abortController = new AbortController();
        const onAdvEvent = (evt: Event) => {
            device.removeEventListener("advertisementreceived", onAdvEvent);
            abortController.abort();
            const mac = extractMAC((evt as BluetoothAdvertisingEvent).manufacturerData);
            resolve(mac || null);
        };
        const onAbort = () => {
            device.removeEventListener("advertisementreceived", onAdvEvent);
            abortController.abort();
            resolve(null);
        };
        device.addEventListener("advertisementreceived", onAdvEvent);
        device.watchAdvertisements({ signal: abortController.signal }).catch(onAbort);
        setTimeout(onAbort, 10000);
    });
}

/**
 * Type representing function interface to implement custom MAC address provider
 * @param device Current BluetoothDevice selected by user.
 * @param isFallbackCall Flag indicating this is final and last resort call for MAC address.
 *                       If this flag is not set, custom provider can return null instead of MAC,
 *                       in such case library will try to read MAC automatically.
 */
type MacAddressProvider = (device: BluetoothDevice, isFallbackCall?: boolean) => Promise<string | null>;

/**
 * Initiate new connection with the GAN Smart Cube device
 * @param customMacAddressProvider Optional custom provider for cube MAC address
 * @returns Object representing connection API and state
 */
async function connectGanCube(customMacAddressProvider?: MacAddressProvider): Promise<GanCubeConnection> {

    // Request user for the bluetooth device (popup selection dialog)
    const device: BluetoothDeviceWithMAC = await navigator.bluetooth.requestDevice(
        {
            filters: [
                { namePrefix: "GAN" },
                { namePrefix: "MG" },
                { namePrefix: "AiCube" }
            ],
            optionalServices: [def.GAN_GEN2_SERVICE, def.GAN_GEN3_SERVICE, def.GAN_GEN4_SERVICE, 'device_information'],
            optionalManufacturerData: def.GAN_CIC_LIST
        }
    );

    // Retrieve cube MAC address via advertisements first (before GATT connection, because GATT connection stops advertisements)
    let mac = (customMacAddressProvider && await customMacAddressProvider(device, false))
        || await autoRetrieveMacAddress(device);

    // Connect to GATT
    const gatt = await device.gatt!.connect();

    if (!mac) {
        // Fallback: Try reading MAC from System ID via GATT
        try {
            const infoService = await gatt.getPrimaryService('device_information');
            const sysIdChar = await infoService.getCharacteristic('system_id');
            const sysId = new Uint8Array((await sysIdChar.readValue()).buffer);
            if (sysId.length >= 6) {
                const macBytes: Array<string> = [];
                for (let i = 0; i < 6; i++) {
                    macBytes.push(sysId[sysId.length - 1 - i].toString(16).toUpperCase().padStart(2, "0"));
                }
                mac = macBytes.join(":");
            } else {
                console.warn("GAN Cube System ID was too short:", sysId);
            }
        } catch (e) {
            console.error("Failed to read GAN Cube System ID (0x2A23):", e);
        }
    }

    if (!mac && customMacAddressProvider) {
        // Final fallback: ask user
        mac = await customMacAddressProvider(device, true);
    }

    if (!mac)
        throw new Error('Unable to determine cube MAC address, connection is not possible!');
    device.mac = mac;

    // Create encryption salt from MAC address bytes placed in reverse order
    const salt = new Uint8Array(device.mac.split(/[:-\s]+/).map((c) => parseInt(c, 16)).reverse());

    // Get device primary services for protocol driver setup
    const services = await gatt.getPrimaryServices();

    let conn: GanCubeConnection | null = null;

    // Resolve type of connected cube device and setup appropriate encryption / protocol driver
    for (const service of services) {
        const serviceUUID = service.uuid.toLowerCase();
        if (serviceUUID == def.GAN_GEN2_SERVICE) {
            const commandCharacteristic = await service.getCharacteristic(def.GAN_GEN2_COMMAND_CHARACTERISTIC);
            const stateCharacteristic = await service.getCharacteristic(def.GAN_GEN2_STATE_CHARACTERISTIC);
            const key = device.name?.startsWith('AiCube') ? def.GAN_ENCRYPTION_KEYS[1] : def.GAN_ENCRYPTION_KEYS[0];
            const encrypter = new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
            const driver = new GanGen2ProtocolDriver();
            conn = await GanCubeClassicConnection.create(device, commandCharacteristic, stateCharacteristic, encrypter, driver);
            break;
        } else if (serviceUUID == def.GAN_GEN3_SERVICE) {
            const commandCharacteristic = await service.getCharacteristic(def.GAN_GEN3_COMMAND_CHARACTERISTIC);
            const stateCharacteristic = await service.getCharacteristic(def.GAN_GEN3_STATE_CHARACTERISTIC);
            const key = def.GAN_ENCRYPTION_KEYS[0];
            const encrypter = new GanGen3CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
            const driver = new GanGen3ProtocolDriver();
            conn = await GanCubeClassicConnection.create(device, commandCharacteristic, stateCharacteristic, encrypter, driver);
            break;
        } else if (serviceUUID == def.GAN_GEN4_SERVICE) {
            const commandCharacteristic = await service.getCharacteristic(def.GAN_GEN4_COMMAND_CHARACTERISTIC);
            const stateCharacteristic = await service.getCharacteristic(def.GAN_GEN4_STATE_CHARACTERISTIC);
            const key = def.GAN_ENCRYPTION_KEYS[0];
            const encrypter = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), salt);
            const driver = new GanGen4ProtocolDriver();
            conn = await GanCubeClassicConnection.create(device, commandCharacteristic, stateCharacteristic, encrypter, driver);
            break;
        }
    }

    if (!conn)
        throw new Error("Can't find target BLE services - wrong or unsupported cube device model");

    return conn;

}

export type {
    MacAddressProvider,
    GanCubeConnection,
    GanCubeCommand,
    GanCubeEvent,
    GanCubeMove
};

export {
    connectGanCube
};

