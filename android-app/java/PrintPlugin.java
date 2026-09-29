// «Заметно» — заметки и дела. © 2026 Кобызев С. Е. Все права защищены.
package ru.kobyzev.zametno;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Печать страницы через системную печать Android.
 * В окне печати есть «Сохранить как PDF». Нужна потому, что window.print()
 * внутри приложения Android не работает.
 */
@CapacitorPlugin(name = "NotesPrint")
public class PrintPlugin extends Plugin {

    @PluginMethod
    public void print(PluginCall call) {
        String name = call.getString("name", "Заметно");
        getActivity().runOnUiThread(() -> {
            WebView webView = getBridge().getWebView();
            PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            printManager.print(name, webView.createPrintDocumentAdapter(name), new PrintAttributes.Builder().build());
            call.resolve();
        });
    }
}
