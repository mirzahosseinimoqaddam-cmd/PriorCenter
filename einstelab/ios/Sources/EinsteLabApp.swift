import SwiftUI
import WebKit
import Security

private let ink = UIColor(red: 0.02, green: 0.024, blue: 0.05, alpha: 1)

@main
struct EinsteLabApp: App {
    var body: some Scene {
        WindowGroup {
            LabView()
                .ignoresSafeArea()
                .background(Color(ink))
                .onAppear { Reminders.setUp() }
        }
    }
}

/// Full-screen web view around the bundled EinsteLab page; keys and progress live in its local storage.
struct LabView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "lang")
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__deviceId='\(DeviceID.value)';", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = ink
        web.scrollView.backgroundColor = ink
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = context.coordinator
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        // the page reports its language so reminders come in the same language
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if let lang = message.body as? String {
                UserDefaults.standard.set(lang, forKey: "lang")
                Reminders.schedule()
            }
        }

        // stay inside the app: nothing outside the bundled page is opened
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(action.request.url?.isFileURL == true ? .allow : .cancel)
        }
    }
}

/// An id for this iPhone kept in the Keychain, which survives deleting and reinstalling the app.
enum DeviceID {
    static let value: String = {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: "einstelab", kSecAttrAccount as String: "device",
                                    kSecReturnData as String: true]
        var item: CFTypeRef?
        if SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
           let data = item as? Data, let id = String(data: data, encoding: .utf8) { return id }
        let id = UUID().uuidString
        let add: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                  kSecAttrService as String: "einstelab", kSecAttrAccount as String: "device",
                                  kSecValueData as String: Data(id.utf8),
                                  kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        SecItemAdd(add as CFDictionary, nil)
        return id
    }()
}
