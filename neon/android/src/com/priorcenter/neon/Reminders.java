package com.priorcenter.neon;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Smart reminders, fully offline. The page writes a plan (time, title, text for the next week) whenever it opens or a
 * game ends; this posts the next one when it is due, then books the one after. Plans survive a reboot.
 */
public class Reminders extends BroadcastReceiver {
    private static final String CH = "neon";
    private static final String ACTION = "com.priorcenter.neon.REMIND";

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("neon", Context.MODE_PRIVATE); }

    static void save(Context c, String json) { prefs(c).edit().putString("plan", json).apply(); schedule(c); }

    /** Books an alarm for the earliest reminder still in the future (or cancels if there is none). */
    static void schedule(Context c) {
        PendingIntent pi = PendingIntent.getBroadcast(c, 1, new Intent(c, Reminders.class).setAction(ACTION),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        long next = Long.MAX_VALUE, now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(prefs(c).getString("plan", "[]"));
            for (int i = 0; i < a.length(); i++) { long t = a.getJSONObject(i).getLong("at"); if (t > now && t < next) next = t; }
        } catch (Exception e) { next = Long.MAX_VALUE; }
        if (next == Long.MAX_VALUE) am.cancel(pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, pi);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (ACTION.equals(i.getAction())) post(c);
        schedule(c);
    }

    private static void post(Context c) {
        long now = System.currentTimeMillis();
        JSONObject due = null;
        try {
            JSONArray a = new JSONArray(prefs(c).getString("plan", "[]")), keep = new JSONArray();
            for (int i = 0; i < a.length(); i++) {
                JSONObject o = a.getJSONObject(i);
                if (o.getLong("at") <= now + 60_000) { if (due == null || o.getLong("at") > due.getLong("at")) due = o; } else keep.put(o);
            }
            prefs(c).edit().putString("plan", keep.toString()).apply();
            if (due == null || now - due.getLong("at") > 6 * 3600_000L) return; // stale (phone was off): skip quietly
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(CH, "Reminders", NotificationManager.IMPORTANCE_DEFAULT));
            PendingIntent open = PendingIntent.getActivity(c, 2, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE);
            String body = due.getString("body");
            Notification n = new Notification.Builder(c, CH)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(0xFFFF2BD6)
                .setContentTitle(due.getString("title"))
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
            nm.notify(7, n);
        } catch (Exception e) { /* a bad plan never crashes the phone's alarm */ }
    }
}
