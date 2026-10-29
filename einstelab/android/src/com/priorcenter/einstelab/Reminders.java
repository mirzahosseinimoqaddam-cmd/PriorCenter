package com.priorcenter.einstelab;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.Calendar;
import java.util.TimeZone;

/** Formula reminders at 07:00, 12:00 and 22:00 Tehran time. Each alarm posts one and books the next. */
public class Reminders extends BroadcastReceiver {
    private static final int[] HOURS = {7, 12, 22};
    private static final String CH = "formulas";
    private static final String[][] F = {
        {"Newton's second law · F = m·a", "قانون دوم نیوتون · F = m·a"},
        {"Mass–energy · E = m·c²", "هم‌ارزی جرم و انرژی · E = m·c²"},
        {"Waves · v = f·λ", "موج · v = f·λ"},
        {"Ohm's law · V = I·R", "قانون اهم · V = I·R"},
        {"Coulomb's law · F = k·q₁q₂ / r²", "قانون کولن · F = k·q₁q₂ / r²"},
        {"Snell's law · n₁ sin θ₁ = n₂ sin θ₂", "قانون اسنل · n₁ sin θ₁ = n₂ sin θ₂"},
        {"Lens equation · 1/f = 1/d₀ + 1/dᵢ", "معادلهٔ عدسی · 1/f = 1/d₀ + 1/dᵢ"},
        {"Field of a wire · B = μ₀I / 2πr", "میدان سیم · B = μ₀I / 2πr"},
        {"Momentum · p = m·v", "تکانه · p = m·v"},
        {"Pendulum · T = 2π√(L/g)", "آونگ · T = 2π√(L/g)"},
        {"Kinetic energy · K = ½·m·v²", "انرژی جنبشی · K = ½·m·v²"},
        {"Free fall · v = √(2gh)", "سقوط آزاد · v = √(2gh)"},
        {"Electric power · P = V·I", "توان الکتریکی · P = V·I"},
        {"Doppler · f′ = f·v / (v − vₛ)", "اثر دوپلر · f′ = f·v / (v − vₛ)"},
        {"Sound level · β = 10 log(I/I₀)", "تراز شدت صوت · β = 10 log(I/I₀)"},
    };

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("einstelab", Context.MODE_PRIVATE); }

    static void schedule(Context c) {
        Calendar now = Calendar.getInstance(TimeZone.getTimeZone("Asia/Tehran"));
        Calendar next = null;
        for (int d = 0; d < 2 && next == null; d++)
            for (int h : HOURS) {
                Calendar t = (Calendar) now.clone();
                t.add(Calendar.DAY_OF_YEAR, d);
                t.set(Calendar.HOUR_OF_DAY, h); t.set(Calendar.MINUTE, 0); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
                if (t.after(now)) { next = t; break; }
            }
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Reminders.class).setAction("com.priorcenter.einstelab.REMIND"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        ((AlarmManager) c.getSystemService(Context.ALARM_SERVICE)).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if ("com.priorcenter.einstelab.REMIND".equals(i.getAction())) post(c);
        schedule(c);
    }

    private static void post(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        boolean fa = !"en".equals(prefs(c).getString("lang", "fa"));
        nm.createNotificationChannel(new NotificationChannel(CH, fa ? "یادآور فرمول" : "Formula reminders", NotificationManager.IMPORTANCE_DEFAULT));
        int n = prefs(c).getInt("next", 0);
        prefs(c).edit().putInt("next", (n + 1) % F.length).apply();
        String body = (fa ? "یادآور فرمول امروز: " : "Here is your formula reminder: ") + F[n][fa ? 1 : 0];
        PendingIntent open = PendingIntent.getActivity(c, 2, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification note = new Notification.Builder(c, CH)
            .setSmallIcon(android.R.drawable.star_on)
            .setContentTitle("EinsteLab")
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build();
        nm.notify(100 + n, note);
    }
}
