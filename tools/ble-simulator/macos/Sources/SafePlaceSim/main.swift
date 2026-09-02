import Foundation
import SafePlaceSimKit

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

        Para una interfaz visual: swift run SafePlaceSimApp
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

// ─── Ejecución ───────────────────────────────────────────────────────

let runner = ScenarioRunner(localName: localName)
runner.onFinished = {
    log("[SIM] escenario terminado. El estado BLE queda como está. Ctrl-C para salir.")
}
runner.start(scenario: scenario)

signal(SIGINT) { _ in
    log("[SIM] saliendo")
    exit(0)
}

RunLoop.main.run()
