package com.audifiya.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered BEFORE super.onCreate().
        registerPlugin(PlaybackServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
