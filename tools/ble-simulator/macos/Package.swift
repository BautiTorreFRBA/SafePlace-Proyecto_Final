// swift-tools-version:5.7
import PackageDescription

// Info.plist NO es un resource (SwiftPM lo prohíbe): se embebe en cada binario
// vía el linker (-sectcreate __TEXT __info_plist) para que macOS muestre el
// prompt de permiso de Bluetooth (NSBluetoothAlwaysUsageDescription).
func infoPlistLinkerFlags(_ path: String) -> [LinkerSetting] {
    [
        .unsafeFlags([
            "-Xlinker", "-sectcreate",
            "-Xlinker", "__TEXT",
            "-Xlinker", "__info_plist",
            "-Xlinker", path,
        ]),
    ]
}

let package = Package(
    name: "SafePlaceSim",
    platforms: [.macOS(.v12)],
    products: [
        // CLI headless (automatización E2E, CI, uso sin pantalla).
        .executable(name: "SafePlaceSim", targets: ["SafePlaceSim"]),
        // App con interfaz (selección de escenario, logs en vivo, Start/Stop).
        .executable(name: "SafePlaceSimApp", targets: ["SafePlaceSimApp"]),
    ],
    targets: [
        // Motor compartido: BLE peripheral + carga de escenarios + loop de emisión.
        .target(
            name: "SafePlaceSimKit",
            path: "Sources/SafePlaceSimKit"
        ),
        .executableTarget(
            name: "SafePlaceSim",
            dependencies: ["SafePlaceSimKit"],
            path: "Sources/SafePlaceSim",
            exclude: ["Info.plist"],
            linkerSettings: infoPlistLinkerFlags("Sources/SafePlaceSim/Info.plist")
        ),
        .executableTarget(
            name: "SafePlaceSimApp",
            dependencies: ["SafePlaceSimKit"],
            path: "Sources/SafePlaceSimApp",
            exclude: ["Info.plist"],
            linkerSettings: infoPlistLinkerFlags("Sources/SafePlaceSimApp/Info.plist")
        ),
    ]
)
