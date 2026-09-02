import Foundation

// ─── Argumentos ──────────────────────────────────────────────────────

var scenarioPath = "../shared/scenarios/normal.json"
var localName = "SafePlace-Sim"

var argv = Array(CommandLine.arguments.dropFirst())
var i = 0
while i < argv.count {
    switch argv[i] {
    case "--scenario":
        guard i + 1 < argv.count else { fatalError("--scenario necesita un path") }
        scenarioPath = argv[i + 1]; i += 2
    case "--name":
        guard i + 1 < argv.count else { fatalError("--name necesita un valor") }
        localName = argv[i + 1]; i += 2
    case "--help", "-h":
        print("""
        SafePlaceSim — wearable BLE simulado (Heart Rate Service estándar)

        uso: safeplace-sim --scenario <archivo.json> [--name <BLE local name>]

        escenarios en ../shared/scenarios/ :
          normal.json          medición válida, sin alerta       (CP-E2E-01)
          fatigue.json         FC alta sostenida                 (CP-E2E-02)
          overexertion.json    FC muy alta                       (CP-E2E-03)
          inactivity.json      emite y se desconecta             (CP-E2E-04)
          connection-loss.json se desconecta y reconecta         (resiliencia hub / H0007)
          invalid.json         FC fuera de rango biológico       (RF-04 / H0008)
        """)
        exit(0)
    default:
        i += 1
    }
}

// ─── Carga del escenario ─────────────────────────────────────────────

let scenario: Scenario
do {
    scenario = try Scenario.load(path: scenarioPath)
} catch {
    FileHandle.standardError.write(
        "No se pudo cargar el escenario '\(scenarioPath)': \(error)\n".data(using: .utf8)!)
    exit(1)
}

log("[SCENARIO] \(scenario.name) — \(scenario.description ?? "")")
log("[SCENARIO] intervalo \(scenario.intervalSeconds)s · duración \(scenario.durationSeconds)s · HR base \(scenario.heartRate.base) ± \(scenario.heartRate.jitter)")

// ─── Ejecución ───────────────────────────────────────────────────────

let peripheral = HeartRatePeripheral(localName: localName)

var elapsed = 0
var emitted = 0
var emitting = true
var firedActions = Set<Int>()
var timer: Timer?
var started = false

func stopTimer() { timer?.invalidate(); timer = nil }

peripheral.onReady = {
    peripheral.startAdvertising()
    log("[SIM] esperando que la Raspberry Pi se conecte y se suscriba…")
}

peripheral.onSubscribed = {
    guard !started else { return }
    started = true
    log("[SCENARIO] \(scenario.name) started")

    let t = Timer(timeInterval: TimeInterval(scenario.intervalSeconds), repeats: true) { _ in
        // acciones programadas (disconnect / reconnect)
        for (idx, a) in scenario.actions.enumerated()
        where !firedActions.contains(idx) && elapsed >= a.atSeconds {
            firedActions.insert(idx)
            switch a.action {
            case "disconnect":
                log("[SCENARIO] acción @\(a.atSeconds)s: disconnect (deja de emitir y se desconecta)")
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
            emitted += 1
        }
        elapsed += scenario.intervalSeconds

        if elapsed >= scenario.durationSeconds && !scenario.loop {
            log("[SCENARIO] completed — \(emitted) mediciones emitidas")
            stopTimer()
            log("[SIM] escenario terminado. El estado BLE queda como está. Ctrl-C para salir.")
        }
    }
    RunLoop.main.add(t, forMode: .common)
    timer = t
}

signal(SIGINT) { _ in
    log("[SIM] saliendo")
    exit(0)
}

RunLoop.main.run()
