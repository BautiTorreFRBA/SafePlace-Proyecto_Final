import Foundation

/// Un escenario disponible en disco, con metadatos para la lista de la GUI.
struct ScenarioEntry: Identifiable, Hashable {
    let id: String          // nombre de archivo sin extensión
    let path: String
    let title: String       // "name" del JSON
    let detail: String      // "description" del JSON
    let caso: String        // etiqueta de caso E2E, derivada del nombre

    static func == (l: ScenarioEntry, r: ScenarioEntry) -> Bool { l.path == r.path }
    func hash(into h: inout Hasher) { h.combine(path) }
}

enum ScenarioCatalog {

    /// Etiqueta de caso por nombre de archivo (solo para mostrar).
    private static let casos: [String: String] = [
        "normal": "CP-E2E-01",
        "fatigue": "CP-E2E-02",
        "overexertion": "CP-E2E-03",
        "inactivity": "CP-E2E-04",
        "connection-loss": "H0007 · resiliencia",
        "invalid": "RF-04 / H0008",
    ]

    /// Busca la carpeta `shared/scenarios` probando rutas relativas al
    /// directorio de trabajo (así funciona con `swift run` desde `macos/`) y al
    /// ejecutable (así funciona un binario movido).
    static func scenariosDirectory() -> URL? {
        var candidates: [URL] = []
        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        candidates.append(cwd.appendingPathComponent("../shared/scenarios"))
        candidates.append(cwd.appendingPathComponent("shared/scenarios"))
        candidates.append(cwd.appendingPathComponent("tools/ble-simulator/shared/scenarios"))

        let exe = URL(fileURLWithPath: CommandLine.arguments.first ?? "")
            .deletingLastPathComponent()
        candidates.append(exe.appendingPathComponent("../../../shared/scenarios"))
        candidates.append(exe.appendingPathComponent("../shared/scenarios"))

        for c in candidates {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: c.path, isDirectory: &isDir), isDir.boolValue {
                return c.standardizedFileURL
            }
        }
        return nil
    }

    static func load() -> [ScenarioEntry] {
        guard let dir = scenariosDirectory() else { return [] }
        let files = (try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: nil)) ?? []

        var out: [ScenarioEntry] = []
        for url in files where url.pathExtension == "json" {
            let id = url.deletingPathExtension().lastPathComponent
            var title = id
            var detail = ""
            if let data = try? Data(contentsOf: url),
               let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                title = (obj["name"] as? String) ?? id
                detail = (obj["description"] as? String) ?? ""
            }
            out.append(ScenarioEntry(
                id: id, path: url.path, title: title, detail: detail,
                caso: casos[id] ?? ""))
        }
        // Orden estable por caso E2E conocido, después alfabético.
        let orden = Array(casos.keys)
        return out.sorted {
            let a = orden.firstIndex(of: $0.id) ?? Int.max
            let b = orden.firstIndex(of: $1.id) ?? Int.max
            return a == b ? $0.id < $1.id : a < b
        }
    }
}
