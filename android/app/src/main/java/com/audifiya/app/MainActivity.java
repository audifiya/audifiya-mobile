package com.audifiya.app;

import com.audifiya.app.PlaybackServicePlugin;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlaybackServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}