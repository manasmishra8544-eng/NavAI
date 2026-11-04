package in.navai.saathi;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int VOICE_REQUEST = 41;
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());

        webView.addJavascriptInterface(new SaathiBridge(this), "SaathiAndroid");
        webView.loadUrl("file:///android_asset/index.html");

        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 42);
        }
    }

    public class SaathiBridge {
        private final Context context;

        SaathiBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void startVoice() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN");
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "hi-IN");
                    intent.putExtra(RecognizerIntent.EXTRA_PROMPT,
                            "Say a command to NavAI Saathi");
                    startActivityForResult(intent, VOICE_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(context, "Voice recognition unavailable",
                            Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void openApp(String app) {
            runOnUiThread(() -> launchApp(app));
        }

        @JavascriptInterface
        public void setAlarm(long atMillis, String label) {
            if (atMillis <= System.currentTimeMillis()) {
                toast("Choose a future time");
                return;
            }

            AlarmManager manager =
                    (AlarmManager) getSystemService(ALARM_SERVICE);

            if (Build.VERSION.SDK_INT >= 31 &&
                    !manager.canScheduleExactAlarms()) {
                startActivity(new Intent(
                        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM));
                toast("Allow exact alarms, then try again");
                return;
            }

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("label",
                    label == null || label.trim().isEmpty()
                            ? "NavAI Saathi alarm" : label);

            int requestCode = (int) (atMillis % Integer.MAX_VALUE);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT |
                            PendingIntent.FLAG_IMMUTABLE);

            if (Build.VERSION.SDK_INT >= 23) {
                manager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP, atMillis, pendingIntent);
            } else {
                manager.setExact(
                        AlarmManager.RTC_WAKEUP, atMillis, pendingIntent);
            }

            toast("Alarm scheduled");
        }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                } catch (Exception e) {
                    toast("Unable to open link");
                }
            });
        }

        private void toast(String message) {
            runOnUiThread(() ->
                    Toast.makeText(context, message, Toast.LENGTH_LONG).show());
        }
    }

    private void launchApp(String app) {
        String name = app == null ? "" : app.toLowerCase(Locale.ROOT).trim();

        try {
            Intent intent = null;

            switch (name) {
                case "gallery":
                case "photos":
                    intent = new Intent(Intent.ACTION_VIEW);
                    intent.setType("image/*");
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.setType("image/*");
                    break;

                case "camera":
                    intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    break;

                case "youtube":
                    intent = getPackageManager()
                            .getLaunchIntentForPackage("com.google.android.youtube");
                    break;

                case "whatsapp":
                    intent = getPackageManager()
                            .getLaunchIntentForPackage("com.whatsapp");
                    break;

                case "chrome":
                    intent = getPackageManager()
                            .getLaunchIntentForPackage("com.android.chrome");
                    break;

                case "maps":
                    intent = getPackageManager()
                            .getLaunchIntentForPackage("com.google.android.apps.maps");
                    break;

                case "settings":
                    intent = new Intent(Settings.ACTION_SETTINGS);
                    break;

                case "wifi":
                    intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
                    break;

                case "bluetooth":
                    intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                    break;

                case "phone":
                case "dialer":
                    intent = new Intent(Intent.ACTION_DIAL);
                    break;

                default:
                    toast("I don't recognise that app yet");
                    return;
            }

            if (intent == null) {
                toast("That app is not installed or unavailable");
                return;
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);

        } catch (Exception e) {
            toast("Could not open that app");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == VOICE_REQUEST &&
                resultCode == RESULT_OK && data != null) {

            ArrayList<String> results =
                    data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);

            if (results != null && !results.isEmpty()) {
                String spoken = results.get(0);
                String json = org.json.JSONObject.quote(spoken);

                webView.evaluateJavascript(
                        "window.onNativeVoiceResult && window.onNativeVoiceResult("
                                + json + ")", null);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}