import Foundation
import CoreBluetooth

func log(_ msg: String) {
    let ts = ISO8601DateFormatter().string(from: Date())
    print("\(ts) \(msg)")
    fflush(stdout)
}

/// BLE Peripheral que expone el **Heart Rate Service estándar** (0x180D) con la
/// característica Heart Rate Measurement (0x2A37) en formato estándar
/// (`[flags=0x00, bpm_uint8]`). Igual que una banda pectoral / Garmin real, así
/// el hub (`ble_gateway.py`) no necesita ningún cambio de protocolo.
final class HeartRatePeripheral: NSObject, CBPeripheralManagerDelegate {

    private let serviceUUID = CBUUID(string: "180D")
    private let measurementUUID = CBUUID(string: "2A37")
    private let localName: String

    private var manager: CBPeripheralManager!
    private var hrChar: CBMutableCharacteristic!
    private var poweredOn = false
    private var advertising = false
    private var serviceAdded = false

    var onReady: (() -> Void)?
    var onSubscribed: (() -> Void)?
    var onUnsubscribed: (() -> Void)?

    init(localName: String) {
        self.localName = localName
        super.init()
        self.manager = CBPeripheralManager(delegate: self, queue: nil)
    }

    // MARK: - Control

    func startAdvertising() {
        guard poweredOn, serviceAdded, !advertising else { return }
        manager.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
            CBAdvertisementDataLocalNameKey: localName,
        ])
        advertising = true
        log("[BLE] Advertising started (name=\(localName), service=180D)")
    }

    func stopAdvertising() {
        guard advertising else { return }
        manager.stopAdvertising()
        advertising = false
        log("[BLE] Advertising stopped")
    }

    /// Corta de verdad la conexión con el central: quita el servicio (termina
    /// las suscripciones) y deja de anunciarse. `republish()` lo revierte.
    func disconnectPeer() {
        stopAdvertising()
        manager.removeAllServices()
        serviceAdded = false
        log("[BLE] servicio removido — conexión con la Raspberry Pi terminada")
    }

    func republish() {
        addServiceIfNeeded() // al terminar dispara onReady -> startAdvertising()
    }

    func sendHeartRate(_ bpm: Int) {
        let value = Data([0x00, UInt8(clamping: bpm)])
        let sent = manager.updateValue(value, for: hrChar, onSubscribedCentrals: nil)
        log("[MEASUREMENT] bpm=\(bpm)\(sent ? "" : "  (buffer BLE lleno — reintenta el próximo tick)")")
    }

    // MARK: - CBPeripheralManagerDelegate

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        switch peripheral.state {
        case .poweredOn:
            poweredOn = true
            addServiceIfNeeded()
        case .unauthorized:
            log("[BLE] ERROR: permiso de Bluetooth denegado. Autorizá la Terminal en Ajustes → Privacidad y seguridad → Bluetooth.")
        case .poweredOff:
            log("[BLE] Bluetooth apagado.")
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

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error = error {
            log("[BLE] ERROR agregando el servicio: \(error.localizedDescription)")
            return
        }
        serviceAdded = true
        log("[BLE] Heart Rate Service publicado")
        onReady?()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager,
                           central: CBCentral,
                           didSubscribeTo characteristic: CBCharacteristic) {
        log("[BLE] Raspberry Pi connected (central=\(central.identifier))")
        onSubscribed?()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager,
                           central: CBCentral,
                           didUnsubscribeFrom characteristic: CBCharacteristic) {
        log("[BLE] Raspberry Pi disconnected")
        onUnsubscribed?()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        request.value = Data([0x00, 0x50]) // 80 bpm por defecto ante un Read
        peripheral.respond(to: request, withResult: .success)
    }
}
