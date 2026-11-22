package tech.lassi.keyboard

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.inputmethodservice.InputMethodService
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject

// Clavier vendeur LASSI (Android) : barre LASSI (puces vitrine + réponses de
// vente) au-dessus d'un clavier AZERTY programmatique. Lit les données marchand
// dans les SharedPreferences "lassi_keyboard" (écrites par le bridge natif).
// Pas d'autocorrection en V1 — moteur avancé greffable plus tard.
class LassiKeyboardService : InputMethodService() {

  private val navy = Color.parseColor("#14152A")
  private val keyBg = Color.parseColor("#2A2C52")
  private val specialBg = Color.parseColor("#1E2040")
  private val yellow = Color.parseColor("#FDCF34")
  private val green = Color.parseColor("#25D366")

  private var shifted = true
  private var mode = Mode.LETTERS
  private lateinit var root: LinearLayout
  private lateinit var keysContainer: LinearLayout

  private enum class Mode { LETTERS, NUMBERS, SYMBOLS }

  override fun onCreateInputView(): View {
    root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(navy)
      layoutParams = ViewGroup.LayoutParams(MATCH, WRAP)
    }
    root.addView(buildBar())
    keysContainer = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(4), dp(6), dp(4), dp(6))
    }
    root.addView(keysContainer)
    renderKeys()
    return root
  }

  override fun onStartInputView(info: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
    super.onStartInputView(info, restarting)
    // Recharge la barre à chaque ouverture (données marchand possiblement à jour).
    (root.getChildAt(0) as? HorizontalScrollView)?.let {
      root.removeViewAt(0)
      root.addView(buildBar(), 0)
    }
  }

  // ── Barre LASSI ─────────────────────────────────────────────────────────────
  private fun buildBar(): HorizontalScrollView {
    val scroll = HorizontalScrollView(this).apply {
      isHorizontalScrollBarEnabled = false
      setBackgroundColor(navy)
      layoutParams = LinearLayout.LayoutParams(MATCH, dp(46))
    }
    val row = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(10), dp(6), dp(10), dp(6))
    }
    val merchant = loadMerchant()
    if (merchant == null) {
      row.addView(chip("Ouvre LASSI pour activer", null, Color.DKGRAY, Color.WHITE))
    } else {
      val url = merchant.optString("vitrineUrl", "")
      merchant.optJSONArray("chips")?.let { arr ->
        for (i in 0 until arr.length()) {
          val c = arr.getJSONObject(i)
          val label = "${c.optString("emoji")} ${c.optString("label")}"
          row.addView(chip(label, resolve(c.optString("insert"), url), yellow, navy))
        }
      }
      merchant.optJSONArray("quickReplies")?.let { arr ->
        for (i in 0 until arr.length()) {
          val r = arr.getJSONObject(i)
          row.addView(chip(r.optString("label"), resolve(r.optString("text"), url), green, Color.WHITE))
        }
      }
    }
    scroll.addView(row)
    return scroll
  }

  private fun chip(title: String, insert: String?, bg: Int, fg: Int): Button {
    return Button(this).apply {
      text = title
      setTextColor(fg)
      isAllCaps = false
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
      background = pill(bg, dp(15).toFloat())
      setPadding(dp(14), dp(5), dp(14), dp(5))
      minWidth = 0; minimumWidth = 0; minHeight = 0; minimumHeight = 0
      val lp = LinearLayout.LayoutParams(WRAP, WRAP)
      lp.marginEnd = dp(8)
      layoutParams = lp
      isEnabled = insert != null
      insert?.let { txt -> setOnClickListener { currentInputConnection?.commitText(txt, 1) } }
    }
  }

  // ── Clavier AZERTY ──────────────────────────────────────────────────────────
  private fun letterRows() = listOf(
    listOf("a","z","e","r","t","y","u","i","o","p"),
    listOf("q","s","d","f","g","h","j","k","l","m"),
    listOf("w","x","c","v","b","n","'"),
  )
  private fun numberRows() = listOf(
    listOf("1","2","3","4","5","6","7","8","9","0"),
    listOf("-","/",":",";","(",")","€","&","@","\""),
    listOf(".",",","?","!","'"),
  )
  private fun symbolRows() = listOf(
    listOf("[","]","{","}","#","%","^","*","+","="),
    listOf("_","\\","|","~","<",">","$","£","¥","•"),
    listOf(".",",","?","!","'"),
  )

  private fun renderKeys() {
    keysContainer.removeAllViews()
    val rows = when (mode) {
      Mode.LETTERS -> letterRows()
      Mode.NUMBERS -> numberRows()
      Mode.SYMBOLS -> symbolRows()
    }
    rows.forEachIndexed { i, keys ->
      val hs = rowLayout()
      if (i == 2) {
        if (mode == Mode.LETTERS) {
          hs.addView(specialKey(if (shifted) "⇧" else "⇪", 1.4f) { shifted = !shifted; renderKeys() })
        } else {
          hs.addView(specialKey(if (mode == Mode.NUMBERS) "#+=" else "123", 1.4f) {
            mode = if (mode == Mode.NUMBERS) Mode.SYMBOLS else Mode.NUMBERS; renderKeys()
          })
        }
      }
      keys.forEach { hs.addView(charKey(it)) }
      if (i == 2) {
        hs.addView(specialKey("⌫", 1.4f) { currentInputConnection?.deleteSurroundingText(1, 0) })
      }
      keysContainer.addView(hs)
    }
    // 4e rangée.
    val bottom = rowLayout()
    bottom.addView(specialKey(if (mode == Mode.LETTERS) "123" else "ABC", 1.6f) {
      mode = if (mode == Mode.LETTERS) Mode.NUMBERS else Mode.LETTERS; renderKeys()
    })
    bottom.addView(specialKey("🌐", 1.2f) { showPicker() })
    bottom.addView(specialKey("espace", 5f) { currentInputConnection?.commitText(" ", 1) })
    bottom.addView(specialKey("retour", 2f, yellow, navy) { currentInputConnection?.commitText("\n", 1) })
    keysContainer.addView(bottom)
  }

  private fun rowLayout() = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    val lp = LinearLayout.LayoutParams(MATCH, dp(48))
    lp.topMargin = dp(6)
    layoutParams = lp
  }

  private fun charKey(key: String): Button {
    val display = if (mode == Mode.LETTERS && shifted) key.uppercase() else key
    return baseKey(display, keyBg, Color.WHITE, 1f) {
      currentInputConnection?.commitText(display, 1)
      if (mode == Mode.LETTERS && shifted) { shifted = false; renderKeys() }
    }
  }

  private fun specialKey(title: String, weight: Float, bg: Int = specialBg, fg: Int = Color.WHITE, onClick: () -> Unit): Button {
    return baseKey(title, bg, fg, weight, onClick).apply { setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f) }
  }

  private fun baseKey(title: String, bg: Int, fg: Int, weight: Float, onClick: () -> Unit): Button {
    return Button(this).apply {
      text = title
      setTextColor(fg)
      isAllCaps = false
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
      background = pill(bg, dp(6).toFloat())
      val lp = LinearLayout.LayoutParams(0, MATCH, weight)
      lp.marginStart = dp(2); lp.marginEnd = dp(2)
      layoutParams = lp
      minWidth = 0; minimumWidth = 0; minHeight = 0; minimumHeight = 0
      setPadding(0, 0, 0, 0)
      includeFontPadding = false
      setOnClickListener { onClick() }
    }
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────────
  private fun showPicker() {
    (getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.showInputMethodPicker()
  }

  private fun loadMerchant(): JSONObject? {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_MERCHANT, null) ?: return null
    return try { JSONObject(raw) } catch (e: Exception) { null }
  }

  private fun resolve(text: String, url: String) = text.replace("{lien}", url)

  private fun pill(color: Int, radius: Float) = GradientDrawable().apply {
    setColor(color)
    cornerRadius = radius
  }

  private fun dp(v: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  companion object {
    private const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
    private const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT
  }
}
