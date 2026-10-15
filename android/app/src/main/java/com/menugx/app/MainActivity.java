package com.menugx.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MenuGXPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
