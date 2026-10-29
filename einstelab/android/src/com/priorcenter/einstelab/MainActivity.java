package com.priorcenter.einstelab;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Full-screen WebView around the bundled EinsteLab page; keys and progress live in its local storage. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#05060d"));
        getWindow().setNavigationBarColor(Color.parseColor("#0a0f1d"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#05060d"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        // stay inside the app: nothing outside the bundled page is opened
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !r.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // Back leaves a lab first, then closes the app
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var l=document.getElementById('lab');if(l&&!l.hidden){document.getElementById('bBack').click();return 1}return 0})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if ("0".equals(v)) MainActivity.super.onBackPressed();
                }
            });
    }
}
