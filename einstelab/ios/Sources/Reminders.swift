import Foundation
import UserNotifications

/// Formula reminders at 07:00, 12:00 and 22:00 Tehran time. iOS keeps at most 64 pending,
/// so the next 60 are booked on every launch, each with the next formula in turn.
enum Reminders {
    static let hours = [7, 12, 22]
    static let formulas: [(en: String, fa: String)] = [
        ("Newton's second law · F = m·a", "قانون دوم نیوتون · F = m·a"),
        ("Mass–energy · E = m·c²", "هم‌ارزی جرم و انرژی · E = m·c²"),
        ("Waves · v = f·λ", "موج · v = f·λ"),
        ("Ohm's law · V = I·R", "قانون اهم · V = I·R"),
        ("Coulomb's law · F = k·q₁q₂ / r²", "قانون کولن · F = k·q₁q₂ / r²"),
        ("Snell's law · n₁ sin θ₁ = n₂ sin θ₂", "قانون اسنل · n₁ sin θ₁ = n₂ sin θ₂"),
        ("Lens equation · 1/f = 1/d₀ + 1/dᵢ", "معادلهٔ عدسی · 1/f = 1/d₀ + 1/dᵢ"),
        ("Field of a wire · B = μ₀I / 2πr", "میدان سیم · B = μ₀I / 2πr"),
        ("Momentum · p = m·v", "تکانه · p = m·v"),
        ("Pendulum · T = 2π√(L/g)", "آونگ · T = 2π√(L/g)"),
        ("Kinetic energy · K = ½·m·v²", "انرژی جنبشی · K = ½·m·v²"),
        ("Free fall · v = √(2gh)", "سقوط آزاد · v = √(2gh)"),
        ("Electric power · P = V·I", "توان الکتریکی · P = V·I"),
        ("Doppler · f′ = f·v / (v − vₛ)", "اثر دوپلر · f′ = f·v / (v − vₛ)"),
        ("Sound level · β = 10 log(I/I₀)", "تراز شدت صوت · β = 10 log(I/I₀)"),
    ]

    static func setUp() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            if granted { schedule() }
        }
    }

    static func schedule() {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        let fa = UserDefaults.standard.string(forKey: "lang") != "en"
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Asia/Tehran") ?? .current
        let now = Date()
        let start = UserDefaults.standard.integer(forKey: "next")
        var k = 0
        for day in 0..<21 {
            for hour in hours where k < 60 {
                guard let base = cal.date(byAdding: .day, value: day, to: now),
                      let when = cal.date(bySettingHour: hour, minute: 0, second: 0, of: base),
                      when > now else { continue }
                let f = formulas[(start + k) % formulas.count]
                let content = UNMutableNotificationContent()
                content.title = "EinsteLab"
                content.body = (fa ? "یادآور فرمول امروز: " : "Here is your formula reminder: ") + (fa ? f.fa : f.en)
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: when.timeIntervalSince(now), repeats: false)
                center.add(UNNotificationRequest(identifier: "formula-\(k)", content: content, trigger: trigger))
                k += 1
            }
        }
        UserDefaults.standard.set((start + 1) % formulas.count, forKey: "next")
    }
}
