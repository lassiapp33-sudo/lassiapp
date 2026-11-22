import UIKit

// Contrôleur principal de l'extension clavier LASSI.
// Compose : barre LASSI (puces vitrine + réponses) au-dessus d'un clavier AZERTY.

class KeyboardViewController: UIInputViewController {

  private var bar: LassiBarView!
  private var keyboard: AzertyKeyboardView!
  private var heightConstraint: NSLayoutConstraint?

  override func viewDidLoad() {
    super.viewDidLoad()

    let navy = UIColor(red: 0x14/255, green: 0x15/255, blue: 0x2A/255, alpha: 1)
    view.backgroundColor = navy

    bar = LassiBarView(onInsert: { [weak self] text in
      self?.textDocumentProxy.insertText(text)
    })
    bar.translatesAutoresizingMaskIntoConstraints = false

    keyboard = AzertyKeyboardView()
    keyboard.delegate = self
    keyboard.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(bar)
    view.addSubview(keyboard)

    NSLayoutConstraint.activate([
      bar.topAnchor.constraint(equalTo: view.topAnchor),
      bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      bar.heightAnchor.constraint(equalToConstant: 46),

      keyboard.topAnchor.constraint(equalTo: bar.bottomAnchor),
      keyboard.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      keyboard.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      keyboard.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }

  override func viewWillAppear(_ animated: Bool) {
    super.viewWillAppear(animated)
    // Hauteur totale du clavier (barre + 4 rangées).
    if heightConstraint == nil {
      let h = view.heightAnchor.constraint(equalToConstant: 46 + 230)
      h.priority = .defaultHigh
      h.isActive = true
      heightConstraint = h
    }
    // Recharge les données marchand à chaque apparition (synchro récente de l'app).
    bar.configure(with: SharedStore.loadMerchant())
  }
}

extension KeyboardViewController: AzertyKeyboardDelegate {
  func insert(_ text: String) {
    textDocumentProxy.insertText(text)
  }
  func deleteBackward() {
    textDocumentProxy.deleteBackward()
  }
  func nextKeyboard() {
    advanceToNextInputMode()
  }
}
