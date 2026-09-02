import Foundation

struct HeartRateSpec: Decodable {
    var base: Int
    var jitter: Int
    var min: Int
    var max: Int

    enum CodingKeys: String, CodingKey { case base, jitter, min, max }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        base = try c.decode(Int.self, forKey: .base)
        jitter = try c.decodeIfPresent(Int.self, forKey: .jitter) ?? 0
        min = try c.decodeIfPresent(Int.self, forKey: .min) ?? 30
        max = try c.decodeIfPresent(Int.self, forKey: .max) ?? 220
    }
}

/// Acción programada dentro del escenario (para pérdida / reanudación de conexión).
struct ScenarioAction: Decodable {
    var atSeconds: Int
    /// "disconnect" (deja de anunciarse) | "reconnect" (vuelve a anunciarse)
    var action: String

    enum CodingKeys: String, CodingKey {
        case atSeconds
        case action = "do"
    }
}

struct Scenario: Decodable {
    var name: String
    var description: String?
    var intervalSeconds: Int
    var durationSeconds: Int
    var heartRate: HeartRateSpec
    var loop: Bool
    var actions: [ScenarioAction]

    enum CodingKeys: String, CodingKey {
        case name, description, intervalSeconds, durationSeconds, heartRate, loop, actions
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        intervalSeconds = try c.decode(Int.self, forKey: .intervalSeconds)
        durationSeconds = try c.decode(Int.self, forKey: .durationSeconds)
        heartRate = try c.decode(HeartRateSpec.self, forKey: .heartRate)
        loop = try c.decodeIfPresent(Bool.self, forKey: .loop) ?? false
        actions = try c.decodeIfPresent([ScenarioAction].self, forKey: .actions) ?? []
    }

    static func load(path: String) throws -> Scenario {
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Scenario.self, from: data)
    }

    /// BPM para la lectura actual, con jitter y clamp al rango biológico del escenario.
    func nextBpm() -> Int {
        let j = heartRate.jitter == 0 ? 0 : Int.random(in: -heartRate.jitter...heartRate.jitter)
        return Swift.max(heartRate.min, Swift.min(heartRate.max, heartRate.base + j))
    }
}
