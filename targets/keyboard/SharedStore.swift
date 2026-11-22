import Foundation

// Lecture des données marchand écrites par l'app principale dans l'App Group.
// Doit correspondre à APP_GROUP / KEY_MERCHANT du bridge natif (LassiKeyboardModule.swift).

let APP_GROUP = "group.com.lassiapp.lassiapp"
let KEY_MERCHANT = "merchant_data"

struct KeyboardChip: Decodable {
  let id: String
  let emoji: String
  let label: String
  let insert: String
}

struct QuickReply: Decodable {
  let id: String
  let label: String
  let text: String
}

struct KeyboardBackground: Decodable {
  let type: String   // "color" | "image"
  let value: String?
  let uri: String?
}

struct MerchantData: Decodable {
  let vitrineUrl: String
  let shopName: String
  let chips: [KeyboardChip]
  let quickReplies: [QuickReply]
  let background: KeyboardBackground?
}

enum SharedStore {
  /// Lit et décode les données marchand depuis l'App Group. nil si absent.
  static func loadMerchant() -> MerchantData? {
    guard
      let defaults = UserDefaults(suiteName: APP_GROUP),
      let json = defaults.string(forKey: KEY_MERCHANT),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(MerchantData.self, from: data)
  }

  /// Remplace {lien} par l'URL de la vitrine dans un texte à insérer.
  static func resolve(_ text: String, url: String) -> String {
    return text.replacingOccurrences(of: "{lien}", with: url)
  }
}
