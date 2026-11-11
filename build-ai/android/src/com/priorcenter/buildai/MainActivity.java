package com.priorcenter.buildai;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Full-screen WebView around the bundled Build AI page. Everything runs on the phone:
 * the page and model are served from inside the app at https://buildai.local/, nothing goes online.
 */
public class MainActivity extends Activity {
    private static final String HOST = "buildai.local";
    private static final int PICK_MODEL = 7;
    private WebView web;

    private File importedModel() { return new File(getFilesDir(), "model.bin"); }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.parseColor("#0d0f17"));
        getWindow().setNavigationBarColor(Color.parseColor("#0d0f17"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0d0f17"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return !HOST.equals(r.getUrl().getHost()); // never leave the app
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return new WebResourceResponse("text/plain", "utf-8", 404, "Offline", null, null);
                String path = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
                if (path.contains("..")) return null;
                try {
                    InputStream in;
                    if (path.equals("model.bin") && importedModel().exists()) in = new FileInputStream(importedModel());
                    else in = getAssets().open(path);
                    return new WebResourceResponse(mime(path), mime(path).startsWith("text") ? "utf-8" : null, in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null);
                }
            }
        });
        web.addJavascriptInterface(new Bridge(), "BuildNative");
        setContentView(web);
        if (Build.VERSION.SDK_INT < 29 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1);
        if (state != null) web.restoreState(state);
        else web.loadUrl("https://" + HOST + "/index.html");
    }

    private static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    class Bridge {
        @JavascriptInterface
        public void pickModel() {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            startActivityForResult(i, PICK_MODEL);
        }

        @JavascriptInterface
        public String sharePng(String base64, String name) {
            if (Build.VERSION.SDK_INT < 29) return savePng(base64, name); // older phones: save only
            try {
                Uri uri = store(base64, name);
                Intent send = new Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
                        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(Intent.createChooser(send, "Build AI"));
                return "ok";
            } catch (Exception e) {
                return "Could not share: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public String savePng(String base64, String name) {
            try {
                byte[] png = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    store(base64, name);
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "BuildAI");
                    dir.mkdirs();
                    try (OutputStream o = new FileOutputStream(new File(dir, name))) { o.write(png); }
                }
                return "ok";
            } catch (Exception e) {
                return "Could not save: " + e.getMessage();
            }
        }
    }

    /** Writes the PNG to Pictures/BuildAI (Android 10+) and returns its content address. */
    private Uri store(String base64, String name) throws IOException {
        byte[] png = Base64.decode(base64, Base64.DEFAULT);
        ContentValues v = new ContentValues();
        v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/BuildAI");
        Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new IOException("no storage");
        try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(png); }
        return uri;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != PICK_MODEL || res != RESULT_OK || data == null || data.getData() == null) return;
        boolean ok = false;
        File tmp = new File(getFilesDir(), "model.tmp");
        try (InputStream in = getContentResolver().openInputStream(data.getData()); OutputStream out = new FileOutputStream(tmp)) {
            byte[] head = new byte[4];
            int n = in.read(head);
            if (n == 4 && head[0] == 'B' && head[1] == 'A' && head[2] == 'I' && head[3] == '1') {
                out.write(head);
                byte[] buf = new byte[1 << 16];
                int r;
                while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                ok = true;
            }
        } catch (IOException e) {
            ok = false;
        }
        if (ok) ok = tmp.renameTo(importedModel());
        else tmp.delete();
        web.evaluateJavascript("window.onModelImported(" + ok + ")", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }
}
