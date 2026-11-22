package tech.lassi.keyboard

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.inputmethod.InputMethodManager

// Activité-tremplin invisible pilotée par des intents lassikb:// depuis l'app JS
// (via Linking.openURL) ou depuis la notification persistante. Injectée dans le
// module app par le config-plugin withLassiKeyboardAndroid.
//
//   lassikb://switch    → ouvre le sélecteur de clavier système (choisir LASSI)
//   lassikb://notif-on  → affiche la notification persistante de bascule
//   lassikb://notif-off → retire la notification
class KeyboardControlActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    when (intent?.data?.host) {
      "switch" -> showPicker()
      "notif-on" -> postNotification()
      "notif-off" -> cancelNotification()
    }
    finish()
  }

  private fun showPicker() {
    (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.showInputMethodPicker()
  }

  private fun postNotification() {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Clavier LASSI", NotificationManager.IMPORTANCE_LOW)
      channel.setShowBadge(false)
      nm.createNotificationChannel(channel)
    }

    val switchIntent = Intent(this, KeyboardControlActivity::class.java).apply {
      data = Uri.parse("lassikb://switch")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    else PendingIntent.FLAG_UPDATE_CURRENT
    val pi = PendingIntent.getActivity(this, 1, switchIntent, flags)

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
      Notification.Builder(this, CHANNEL_ID) else @Suppress("DEPRECATION") Notification.Builder(this)

    val notif = builder
      .setContentTitle("Clavier LASSI prêt")
      .setContentText("Appuie pour partager ta vitrine — bascule sur le clavier LASSI")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(pi)
      .addAction(Notification.Action.Builder(0, "Basculer sur LASSI", pi).build())
      .build()

    nm.notify(NOTIF_ID, notif)
  }

  private fun cancelNotification() {
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIF_ID)
  }

  companion object {
    private const val CHANNEL_ID = "lassi_keyboard_switch"
    private const val NOTIF_ID = 4815
  }
}
