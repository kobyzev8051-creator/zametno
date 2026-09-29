// «Заметно» — заметки и дела. © 2026 Кобызев С. Е. Все права защищены.
package ru.kobyzev.zametno;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class); // системная печать / «Сохранить как PDF»
        super.onCreate(savedInstanceState);
    }
}
