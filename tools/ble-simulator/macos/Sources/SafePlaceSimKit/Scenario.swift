import Foundation

public struct HeartRateSpec: Decodable, Sendable {
    public var base: Int
    public var jitter: Int
    public var min: Int
    public var max: Int

    enum CodingKeys: String, CodingKey { case base, jitter, min, max }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        base = try c.decode(Int.self, forKey: .base)
        jitter = try c.decodeIfPresent(Int.self, forKey: .jitter) ?? 0
        min = try c.decodeIfPresent(Int.self, forKey: .min) ?? 30
        max = try c.decodeIfPresent(Int.self, forKey: .max) ?? 220
    }
}

/// Acción programada dentro del escenario (para pérdida / reanudación de conexión).
public struct ScenarioAction: Decodable, Sendable {
    public var atSeconds: Int
    /// "disconnect" (deja de anunciarse) | "reconnect" (vuelve a anunciarse)
    public var action: String

    enum CodingKeys: String, CodingKey {
        case atSeconds
        case action = "do"
    }
}

public struct Scenario: Decodable, Sendable {
    public var name: String
    public var description: String?
    public var intervalSeconds: Int
    public var durationSeconds: Int
    public var heartRate: HeartRateSpec
    public var loop: Bool
    public var actions: [ScenarioAction]

    enum CodingKeys: String, CodingKey {
        case name, description, intervalSeconds, durationSeconds, heartRate, loop, actions
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        intervalSeconds = try c.decode(Int.self, forKey: .intervalSeconds)
        durationSeconds = try c.decode(Int.self, forKey: .durationSeconds)
        heartRate = try c.decode(HeartRateSpec.self, forKey: .heartRate)
        loop = try c.decodeIfPresent(Bool.self, forKey: .loop) ?? false
        actions = try c.decodeIfPresent([ScenarioAction].self, forKey: .actions) ?? []
    }

    public static func load(path: String) throws -> Scenario {
        let url = URL(fileURLWithPath: path)
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(Scenario.self, from: data)
    }

    /// BPM para la lectura actual, con jitter y clamp al rango biológico del escenario.
    public func nextBpm() -> Int {
        let j = heartRate.jitter == 0 ? 0 : Int.random(in: -heartRate.jitter...heartRate.jitter)
        return Swift.max(heartRate.min, Swift.min(heartRate.max, heartRate.base + j))
    }
}
