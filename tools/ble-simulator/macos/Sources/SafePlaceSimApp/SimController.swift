import Foundation
import Combine
import SafePlaceSimKit

/// Estado observable para la UI. Envuelve `ScenarioRunner` del kit y publica
/// su progreso + el stream de logs.
@MainActor
final class SimController: ObservableObject {

    @Published var scenarios: [ScenarioEntry] = []
    @Published var selectedID: String?

    var selection: ScenarioEntry? {
        scenarios.first { $0.id == selectedID }
    }

    @Published var state: RunnerState = .idle
    @Published var elapsed: Int = 0
    @Published var emitted: Int = 0
    @Published var lastBpm: Int?
    @Published var runningScenario: String?

    @Published var logs: [LogLine] = []
    @Published var bluetoothWarning: String?
    @Published var loadError: String?

    private let localName = "SafePlace-Sim"
    private lazy var runner = ScenarioRunner(localName: localName)
    private let maxLogLines = 3000

    init() {
        logSink = { [weak self] line in
            Task { @MainActor in self?.appendLog(line) }
        }
        runner.onProgress = { [weak self] p in
            Task { @MainActor in
                self?.state = p.state
                self?.elapsed = p.elapsedSeconds
                self?.emitted = p.emitted
                self?.lastBpm = p.lastBpm
                self?.runningScenario = p.scenarioName
            }
        }
        runner.onBluetoothUnavailable = { [weak self] msg in
            Task { @MainActor in self?.bluetoothWarning = msg }
        }
        reloadScenarios()
    }

    // MARK: - Acciones de la UI

    func reloadScenarios() {
        scenarios = ScenarioCatalog.load()
        if selectedID == nil { selectedID = scenarios.first?.id }
        if scenarios.isEmpty {
            loadError = "No encontré la carpeta shared/scenarios. Ejecutá desde tools/ble-simulator/macos."
        } else {
            loadError = nil
        }
    }

    func start() {
        guard let entry = selection else { return }
        do {
            let scenario = try Scenario.load(path: entry.path)
            logs.removeAll()
            bluetoothWarning = nil
            runner.start(scenario: scenario)
        } catch {
            loadError = "No se pudo cargar '\(entry.title)': \(error)"
        }
    }

    func stop() {
        runner.stop()
    }

    func clearLogs() {
        logs.removeAll()
    }

    var logText: String {
        logs.map(\.formatted).joined(separator: "\n")
    }

    var isBusy: Bool {
        state == .advertising || state == .connected || state == .running
    }

    // MARK: -

    private func appendLog(_ line: LogLine) {
        logs.append(line)
        if logs.count > maxLogLines {
            logs.removeFirst(logs.count - maxLogLines)
        }
    }
}
