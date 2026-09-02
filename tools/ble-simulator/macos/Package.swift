// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "SafePlaceSim",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "SafePlaceSim",
            path: "Sources/SafePlaceSim",
            // Info.plist NO es un resource: solo se embebe en el binario vía
            // el linker (-sectcreate) para que macOS muestre el prompt de
            // permiso de Bluetooth. SwiftPM prohíbe Info.plist como resource.
            exclude: ["Info.plist"],
            linkerSettings: [
                // Embebe el Info.plist en el binario para que macOS muestre el
                // prompt de permiso de Bluetooth (NSBluetoothAlwaysUsageDescription).
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Sources/SafePlaceSim/Info.plist",
                ]),
            ]
        )
    ]
)
