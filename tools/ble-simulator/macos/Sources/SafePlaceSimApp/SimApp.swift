import SwiftUI
import AppKit

/// `swift run SafePlaceSimApp` lanza un ejecutable sin bundle: sin esto, la
/// ventana puede quedar detrás y sin ícono en el Dock.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

@main
struct SimApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var model = SimController()

    var body: some Scene {
        WindowGroup("SafePlace · Simulador de Wearable") {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 760, minHeight: 500)
        }
    }
}
