import Foundation
import CoreBluetooth

/// BLE Peripheral que expone el **Heart Rate Service estándar** (0x180D) con la
/// característica Heart Rate Measurement (0x2A37) en formato estándar
/// (`[flags=0x00, bpm_uint8]`). Igual que una banda pectoral / Garmin real, así
/// el hub (`ble_gateway.py`) no necesita ningún cambio de protocolo.
public final class HeartRatePeripheral: NSObject, CBPeripheralManagerDelegate {

    private let serviceUUID = CBUUID(string: "180D")
    private let measurementUUID = CBUUID(string: "2A37")
    private let localName: String

    private var manager: CBPeripheralManager!
    private var hrChar: CBMutableCharacteristic!
    private var poweredOn = false
    private var advertising = false
    private var serviceAdded = false

    public var onReady: (() -> Void)?
    public var onSubscribed: (() -> Void)?
    public var onUnsubscribed: (() -> Void)?
    /// Estado legible del adaptador para la GUI ("apagado", "sin permiso", ...).
    public var onBluetoothUnavailable: ((String) -> Void)?

    public init(localName: String) {
        self.localName = localName
        super.init()
        self.manager = CBPeripheralManager(delegate: self, queue: nil)
    }

    // MARK: - Control

    public func startAdvertising() {
        guard poweredOn, serviceAdded, !advertising else { return }
        manager.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
            CBAdvertisementDataLocalNameKey: localName,
        ])
        advertising = true
        log("[BLE] Advertising started (name=\(localName), service=180D)")
    }

    public func stopAdvertising() {
        guard advertising else { return }
        manager.stopAdvertising()
        advertising = false
        log("[BLE] Advertising stopped")
    }

    /// Corta de verdad la conexión con el central: quita el servicio (termina
    /// las suscripciones) y deja de anunciarse. `republish()` lo revierte.
    public func disconnectPeer() {
        stopAdvertising()
        manager.removeAllServices()
        serviceAdded = false
        log("[BLE] servicio removido — conexión con la Raspberry Pi terminada")
    }

    public func republish() {
        addServiceIfNeeded() // al terminar dispara onReady -> startAdvertising()
    }

    public func sendHeartRate(_ bpm: Int) {
        let value = Data([0x00, UInt8(clamping: bpm)])
        let sent = manager.updateValue(value, for: hrChar, onSubscribedCentrals: nil)
        log("[MEASUREMENT] bpm=\(bpm)\(sent ? "" : "  (buffer BLE lleno — reintenta el próximo tick)")")
    }

    // MARK: - CBPeripheralManagerDelegate

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        switch peripheral.state {
        case .poweredOn:
            poweredOn = true
            addServiceIfNeeded()
        case .unauthorized:
            let m = "permiso de Bluetooth denegado. Autorizá la app en Ajustes → Privacidad y seguridad → Bluetooth."
            log("[BLE] ERROR: \(m)")
            onBluetoothUnavailable?(m)
        case .poweredOff:
            log("[BLE] Bluetooth apagado.")
            onBluetoothUnavailable?("Bluetooth apagado.")
        default:
            log("[BLE] Estado Bluetooth: \(peripheral.state.rawValue)")
        }
    }

    private func addServiceIfNeeded() {
        guard !serviceAdded else { return }
        hrChar = CBMutableCharacteristic(
            type: measurementUUID,
            properties: [.notify, .read],
            value: nil,
            permissions: [.readable])
        let service = CBMutableService(type: serviceUUID, primary: true)
        service.characteristics = [hrChar]
        manager.add(service)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error = error {
            log("[BLE] ERROR agregando el servicio: \(error.localizedDescription)")
            return
        }
        serviceAdded = true
        log("[BLE] Heart Rate Service publicado")
        onReady?()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager,
                                  central: CBCentral,
                                  didSubscribeTo characteristic: CBCharacteristic) {
        log("[BLE] Raspberry Pi connected (central=\(central.identifier))")
        onSubscribed?()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager,
                                  central: CBCentral,
                                  didUnsubscribeFrom characteristic: CBCharacteristic) {
        log("[BLE] Raspberry Pi disconnected")
        onUnsubscribed?()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        request.value = Data([0x00, 0x50]) // 80 bpm por defecto ante un Read
        peripheral.respond(to: request, withResult: .success)
    }
}
