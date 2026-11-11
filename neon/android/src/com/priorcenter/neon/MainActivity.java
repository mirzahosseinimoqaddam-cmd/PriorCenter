package com.priorcenter.neon;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;

/**
 * Full-screen WebView around the bundled NEON page, served from inside the app at https://neon.local/.
 * Nothing ever goes online: any other host is refused.
 */
public class MainActivity extends Activity {
    private static final String HOST = "neon.local";
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); // games shouldn't dim mid-play
        getWindow().setStatusBarColor(Color.parseColor("#04000e"));
        getWindow().setNavigationBarColor(Color.parseColor("#04000e"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#04000e"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !HOST.equals(r.getUrl().getHost()); // never navigate away from the app
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return new WebResourceResponse("text/plain", "utf-8", 404, "Offline", null, null);
                String path = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
                if (path.contains("..")) return null;
                try {
                    String m = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".png") ? "image/png" : "application/octet-stream";
                    return new WebResourceResponse(m, m.startsWith("text") ? "utf-8" : null, getAssets().open(path));
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
                }
            }
        });
        // the page hands over its reminder plan; Android shows it even when the app is closed
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void plan(String json) { Reminders.save(MainActivity.this, json); }

            @JavascriptInterface
            public void askPermission() {
                if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
            }
        }, "NeonNative");
        setContentView(web);
        immersive();
        if (state != null) web.restoreState(state);
        else web.loadUrl("https://" + HOST + "/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.neonBack && window.neonBack()", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String r) { if (!"true".equals(r)) finish(); }
        });
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); immersive(); }

    /** Full screen for games: system bars hide and come back with a swipe. */
    private void immersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) { c.hide(WindowInsets.Type.systemBars()); c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
