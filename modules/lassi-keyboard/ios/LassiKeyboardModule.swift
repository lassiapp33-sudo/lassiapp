import ExpoModulesCore
import UIKit

// App Group partagé entre l'app et l'extension clavier.
// Doit correspondre à l'entitlement déclaré par le config-plugin iOS.
let APP_GROUP = "group.tech.lassi.app"
let KEY_MERCHANT = "merchant_data"

public class LassiKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LassiKeyboard")

    AsyncFunction("setMerchantData") { (json: String) in
      sharedDefaults()?.set(json, forKey: KEY_MERCHANT)
    }

    AsyncFunction("clearMerchantData") {
      sharedDefaults()?.removeObject(forKey: KEY_MERCHANT)
    }

    // iOS n'expose pas de façon fiable la liste des claviers activés → inconnu.
    AsyncFunction("isKeyboardEnabled") { () -> Any? in
      return nil
    }

    AsyncFunction("openKeyboardSettings") {
      DispatchQueue.main.async {
        if let url = URL(string: UIApplication.openSettingsURLString) {
          UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
      }
    }

    // Pas d'équivalent iOS au sélecteur Android → no-op.
    AsyncFunction("showKeyboardPicker") { }
  }
}

private func sharedDefaults() -> UserDefaults? {
  return UserDefaults(suiteName: APP_GROUP)
}
