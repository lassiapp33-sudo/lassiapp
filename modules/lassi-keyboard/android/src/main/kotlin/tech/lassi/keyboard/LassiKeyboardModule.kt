package tech.lassi.keyboard

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Nom du fichier SharedPreferences lu par LassiKeyboardService (IME).
// Même package applicatif → accès direct, aucune permission requise.
const val PREFS_NAME = "lassi_keyboard"
const val KEY_MERCHANT = "merchant_data"

class LassiKeyboardModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context indisponible" }

  override fun definition() = ModuleDefinition {
    Name("LassiKeyboard")

    AsyncFunction("setMerchantData") { json: String ->
      prefs().edit().putString(KEY_MERCHANT, json).apply()
    }

    AsyncFunction("clearMerchantData") {
      prefs().edit().remove(KEY_MERCHANT).apply()
    }

    AsyncFunction("isKeyboardEnabled") {
      val expected = "${context.packageName}/tech.lassi.keyboard.LassiKeyboardService"
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        Settings.Secure.ENABLED_INPUT_METHODS
      ) ?: ""
      enabled.split(":").any { it.equals(expected, ignoreCase = true) }
    }

    AsyncFunction("openKeyboardSettings") {
      val intent = Intent(Settings.ACTION_INPUT_METHOD_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    AsyncFunction("showKeyboardPicker") {
      val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
      imm.showInputMethodPicker()
    }
  }

  private fun prefs() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
