import SwiftUI
import AppKit
import SafePlaceSimKit

struct ContentView: View {
    @EnvironmentObject private var model: SimController

    var body: some View {
        HSplitView {
            sidebar
                .frame(minWidth: 260, idealWidth: 300, maxWidth: 380)
            console
                .frame(minWidth: 420)
        }
        .toolbar {
            ToolbarItem(placement: .principal) { StatusBadge(state: model.state) }
        }
    }

    // MARK: - Panel izquierdo

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Escenarios")
                .font(.headline)
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 8)

            List(selection: $model.selectedID) {
                ForEach(model.scenarios) { entry in
                    ScenarioRow(entry: entry).tag(entry.id)
                }
            }
            .listStyle(.inset)

            Divider()

            controls
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    model.start()
                } label: {
                    Label(model.isBusy ? "Reiniciar" : "Iniciar", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                }
                .keyboardShortcut(.return, modifiers: [])
                .disabled(model.selection == nil)

                Button(role: .destructive) {
                    model.stop()
                } label: {
                    Label("Detener", systemImage: "stop.fill")
                        .frame(maxWidth: .infinity)
                }
                .disabled(!model.isBusy && model.state != .finished)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            metrics

            if let warn = model.bluetoothWarning {
                Label(warn, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundColor(.orange)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let err = model.loadError {
                Label(err, systemImage: "xmark.octagon.fill")
                    .font(.caption)
                    .foregroundColor(.red)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
    }

    private var metrics: some View {
        VStack(spacing: 6) {
            metricRow("Escenario", model.runningScenario ?? "—")
            metricRow("Tiempo", Self.mmss(model.elapsed))
            metricRow("Mediciones", "\(model.emitted)")
            metricRow("Última FC", model.lastBpm.map { "\($0) BPM" } ?? "—")
        }
        .font(.callout)
    }

    private func metricRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).foregroundColor(.secondary)
            Spacer()
            Text(value).fontWeight(.medium).monospacedDigit()
        }
    }

    // MARK: - Consola de logs

    private var console: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Logs").font(.headline)
                Spacer()
                Button {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.logText, forType: .string)
                } label: { Label("Copiar", systemImage: "doc.on.doc") }
                Button {
                    model.clearLogs()
                } label: { Label("Limpiar", systemImage: "trash") }
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .padding(10)

            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        ForEach(model.logs) { line in
                            Text(line.formatted)
                                .font(.system(.caption, design: .monospaced))
                                .textSelection(.enabled)
                                .foregroundColor(color(for: line.text))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(line.id)
                        }
                    }
                    .padding(10)
                }
                .background(Color(nsColor: .textBackgroundColor))
                .onChange(of: model.logs.count) { _ in
                    if let last = model.logs.last {
                        withAnimation(.linear(duration: 0.1)) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }

    private func color(for text: String) -> Color {
        if text.contains("ERROR") || text.contains("denegado") { return .red }
        if text.contains("[MEASUREMENT]") { return .primary }
        if text.contains("[BLE]") { return .blue }
        if text.contains("[SCENARIO]") { return .purple }
        if text.contains("[SIM]") { return .secondary }
        return .primary
    }

    private static func mmss(_ s: Int) -> String {
        String(format: "%02d:%02d", s / 60, s % 60)
    }
}

// MARK: - Subvistas

private struct ScenarioRow: View {
    let entry: ScenarioEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                Text(entry.title).fontWeight(.medium)
                if !entry.caso.isEmpty {
                    Text(entry.caso)
                        .font(.caption2)
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .background(Color.secondary.opacity(0.15))
                        .clipShape(Capsule())
                }
            }
            if !entry.detail.isEmpty {
                Text(entry.detail)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 3)
    }
}

private struct StatusBadge: View {
    let state: RunnerState

    private var label: String {
        switch state {
        case .idle: return "Inactivo"
        case .advertising: return "Anunciando · esperando hub"
        case .connected: return "Hub conectado"
        case .running: return "Emitiendo"
        case .finished: return "Escenario terminado"
        case .stopped: return "Detenido"
        }
    }

    private var tint: Color {
        switch state {
        case .idle, .stopped: return .secondary
        case .advertising: return .orange
        case .connected, .running: return .green
        case .finished: return .blue
        }
    }

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(tint).frame(width: 8, height: 8)
            Text(label).font(.callout).fontWeight(.medium)
        }
        .padding(.horizontal, 10).padding(.vertical, 4)
        .background(tint.opacity(0.12))
        .clipShape(Capsule())
    }
}
