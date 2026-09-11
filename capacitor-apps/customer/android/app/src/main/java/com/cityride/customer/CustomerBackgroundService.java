package com.cityride.customer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

public class CustomerBackgroundService extends Service {
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "customer_bg_channel";
            NotificationChannel channel = new NotificationChannel(channelId, "Customer Background", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);

            Notification notification = new Notification.Builder(this, channelId)
                    .setContentTitle("CityRide is Active")
                    .setContentText("Keeping connection alive")
                    .setSmallIcon(android.R.drawable.ic_dialog_info)
                    .build();
            startForeground(3001, notification);
        }
        return START_STICKY;
    }
}
