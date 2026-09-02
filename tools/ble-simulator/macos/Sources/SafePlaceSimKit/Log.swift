import Foundation

/// Una línea de log con timestamp. La GUI la muestra en su consola; el CLI
/// solo la imprime a stdout.
public struct LogLine: Identifiable, Sendable {
    public let id = UUID()
    public let timestamp: Date
    public let text: String

    public init(timestamp: Date = Date(), text: String) {
        self.timestamp = timestamp
        self.text = text
    }

    /// `2026-09-02T11:04:35Z  [BLE] ...` — mismo formato que usaba el CLI.
    public var formatted: String {
        "\(LogLine.isoFormatter.string(from: timestamp)) \(text)"
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

/// Sumidero opcional de logs. La GUI lo conecta para recibir cada línea; el
/// CLI lo deja en `nil` y `log()` solo escribe a stdout.
public var logSink: ((LogLine) -> Void)?

/// Punto único de logging del simulador. Imprime a stdout (para el CLI y para
/// `swift run` de la app) y además notifica al `logSink` si hay uno.
public func log(_ msg: String) {
    let entry = LogLine(text: msg)
    print(entry.formatted)
    fflush(stdout)
    logSink?(entry)
}
