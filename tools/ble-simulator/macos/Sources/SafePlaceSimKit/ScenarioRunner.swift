import Foundation

public enum RunnerState: String, Sendable {
    case idle          // sin escenario cargado
    case advertising   // anunciándose, esperando que el hub se suscriba
    case connected     // hub suscripto, a punto de emitir
    case running       // emitiendo mediciones
    case finished      // escenario no-loop terminó (sigue anunciándose)
    case stopped       // detenido manualmente
}

public struct RunnerProgress: Sendable {
    public let state: RunnerState
    public let elapsedSeconds: Int
    public let emitted: Int
    public let lastBpm: Int?
    public let scenarioName: String?
}

/// Corre un `Scenario` sobre un `HeartRatePeripheral`: espera la suscripción del
/// hub, emite mediciones cada `intervalSeconds`, ejecuta las acciones
/// programadas (disconnect/reconnect) y corta al llegar a `durationSeconds`
/// salvo `loop`. Lo comparten el CLI y la GUI.
///
/// Todo corre en el hilo principal (los callbacks de CoreBluetooth con
/// `queue: nil` y el Timer sobre `RunLoop.main` ya lo están).
public final class ScenarioRunner {

    private let peripheral: HeartRatePeripheral

    private var scenario: Scenario?
    private var timer: Timer?
    private var elapsed = 0
    private var emitted = 0
    private var emitting = true
    private var firedActions = Set<Int>()
    private var state: RunnerState = .idle {
        didSet { notify() }
    }
    private var lastBpm: Int?

    /// Progreso para la UI (estado, tiempo, contador, última FC).
    public var onProgress: ((RunnerProgress) -> Void)?
    /// El escenario no-loop terminó de emitir.
    public var onFinished: (() -> Void)?
    /// Bluetooth no disponible (apagado / sin permiso), con mensaje legible.
    public var onBluetoothUnavailable: ((String) -> Void)?

    public init(localName: String) {
        peripheral = HeartRatePeripheral(localName: localName)

        peripheral.onReady = { [weak self] in
            self?.peripheral.startAdvertising()
            if self?.state == .idle || self?.state == .stopped {
                self?.state = .advertising
            }
            log("[SIM] esperando que la Raspberry Pi se conecte y se suscriba…")
        }
        peripheral.onSubscribed = { [weak self] in
            self?.startLoop()
        }
        peripheral.onUnsubscribed = { [weak self] in
            guard let self = self else { return }
            if self.state == .running || self.state == .connected {
                self.state = .advertising
            }
        }
        peripheral.onBluetoothUnavailable = { [weak self] msg in
            self?.onBluetoothUnavailable?(msg)
        }
    }

    // MARK: - API

    /// Carga un escenario y empieza a anunciarse. Si ya había uno corriendo lo
    /// detiene primero. La emisión arranca cuando el hub se suscribe.
    public func start(scenario: Scenario) {
        stopTimer()
        self.scenario = scenario
        elapsed = 0
        emitted = 0
        emitting = true
        firedActions = []
        lastBpm = nil

        log("[SCENARIO] \(scenario.name) — \(scenario.description ?? "")")
        log("[SCENARIO] intervalo \(scenario.intervalSeconds)s · duración \(scenario.durationSeconds)s · HR base \(scenario.heartRate.base) ± \(scenario.heartRate.jitter)\(scenario.loop ? " · loop" : "")")

        peripheral.republish()
        state = .advertising
    }

    /// Detiene la emisión y corta la conexión con el hub. `start()` la reanuda.
    public func stop() {
        guard scenario != nil else { return }
        stopTimer()
        emitting = false
        peripheral.disconnectPeer()
        log("[SIM] escenario detenido manualmente")
        state = .stopped
        scenario = nil
    }

    // MARK: - Loop

    private func startLoop() {
        guard let scenario = scenario, timer == nil else {
            state = .connected
            return
        }
        state = .running
        log("[SCENARIO] \(scenario.name) started")

        let t = Timer(timeInterval: TimeInterval(scenario.intervalSeconds), repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
        tick() // primera lectura inmediata
    }

    private func tick() {
        guard let scenario = scenario else { return }

        for (idx, a) in scenario.actions.enumerated()
        where !firedActions.contains(idx) && elapsed >= a.atSeconds {
            firedActions.insert(idx)
            switch a.action {
            case "disconnect":
                log("[SCENARIO] acción @\(a.atSeconds)s: disconnect")
                emitting = false
                peripheral.disconnectPeer()
            case "reconnect":
                log("[SCENARIO] acción @\(a.atSeconds)s: reconnect")
                emitting = true
                peripheral.republish()
            default:
                log("[SCENARIO] acción desconocida: \(a.action)")
            }
        }

        if emitting {
            let bpm = scenario.nextBpm()
            peripheral.sendHeartRate(bpm)
            lastBpm = bpm
            emitted += 1
        }
        elapsed += scenario.intervalSeconds
        notify()

        if elapsed >= scenario.durationSeconds && !scenario.loop {
            log("[SCENARIO] completed — \(emitted) mediciones emitidas")
            stopTimer()
            state = .finished
            onFinished?()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func notify() {
        onProgress?(RunnerProgress(
            state: state,
            elapsedSeconds: elapsed,
            emitted: emitted,
            lastBpm: lastBpm,
            scenarioName: scenario?.name
        ))
    }
}
