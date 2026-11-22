import UIKit

// Clavier AZERTY programmatique minimal mais complet : lettres, majuscules,
// chiffres/symboles, espace, retour, suppression, touche globe (clavier suivant).
// Pas d'autocorrection (V1) — le moteur avancé (KeyboardKit) pourra se greffer après.

protocol AzertyKeyboardDelegate: AnyObject {
  func insert(_ text: String)
  func deleteBackward()
  func nextKeyboard()
}

final class AzertyKeyboardView: UIView {

  weak var delegate: AzertyKeyboardDelegate?

  private enum Mode { case letters, numbers, symbols }
  private var mode: Mode = .letters
  private var shifted = true

  private let rootStack = UIStackView()

  private let navy = UIColor(red: 0x14/255, green: 0x15/255, blue: 0x2A/255, alpha: 1)
  private let keyBg = UIColor(red: 0x2A/255, green: 0x2C/255, blue: 0x52/255, alpha: 1)
  private let specialBg = UIColor(red: 0x1E/255, green: 0x20/255, blue: 0x40/255, alpha: 1)

  override init(frame: CGRect) {
    super.init(frame: frame)
    setup()
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) non supporté") }

  private func setup() {
    backgroundColor = navy
    rootStack.axis = .vertical
    rootStack.distribution = .fillEqually
    rootStack.spacing = 7
    rootStack.translatesAutoresizingMaskIntoConstraints = false
    rootStack.isLayoutMarginsRelativeArrangement = true
    rootStack.layoutMargins = UIEdgeInsets(top: 7, left: 4, bottom: 7, right: 4)
    addSubview(rootStack)
    NSLayoutConstraint.activate([
      rootStack.leadingAnchor.constraint(equalTo: leadingAnchor),
      rootStack.trailingAnchor.constraint(equalTo: trailingAnchor),
      rootStack.topAnchor.constraint(equalTo: topAnchor),
      rootStack.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    render()
  }

  // ── Dispositions ──────────────────────────────────────────────────────────
  private func letterRows() -> [[String]] {
    [["a","z","e","r","t","y","u","i","o","p"],
     ["q","s","d","f","g","h","j","k","l","m"],
     ["w","x","c","v","b","n","'"]]
  }
  private func numberRows() -> [[String]] {
    [["1","2","3","4","5","6","7","8","9","0"],
     ["-","/",":",";","(",")","€","&","@","\""],
     [".",",","?","!","'"]]
  }
  private func symbolRows() -> [[String]] {
    [["[","]","{","}","#","%","^","*","+","="],
     ["_","\\","|","~","<",">","$","£","¥","•"],
     [".",",","?","!","'"]]
  }

  private func render() {
    rootStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

    let rows: [[String]]
    switch mode {
    case .letters: rows = letterRows()
    case .numbers: rows = numberRows()
    case .symbols: rows = symbolRows()
    }

    // 3 rangées de caractères.
    for (i, row) in rows.enumerated() {
      let hs = makeRow()
      // 3e rangée : shift (lettres) / bascule symboles (chiffres) à gauche, delete à droite.
      if i == 2 {
        if mode == .letters {
          hs.addArrangedSubview(specialKey(title: shifted ? "⇧" : "⇪", flex: 1.4) { [weak self] in
            self?.shifted.toggle(); self?.render()
          })
        } else {
          hs.addArrangedSubview(specialKey(title: mode == .numbers ? "#+=" : "123", flex: 1.4) { [weak self] in
            self?.mode = (self?.mode == .numbers) ? .symbols : .numbers; self?.render()
          })
        }
      }
      for key in row {
        hs.addArrangedSubview(charKey(key))
      }
      if i == 2 {
        hs.addArrangedSubview(specialKey(title: "⌫", flex: 1.4) { [weak self] in
          self?.delegate?.deleteBackward()
        })
      }
      rootStack.addArrangedSubview(hs)
    }

    // 4e rangée : 123/ABC, globe, espace, retour.
    let bottom = makeRow()
    bottom.addArrangedSubview(specialKey(title: mode == .letters ? "123" : "ABC", flex: 1.6) { [weak self] in
      self?.mode = (self?.mode == .letters) ? .numbers : .letters; self?.render()
    })
    bottom.addArrangedSubview(specialKey(title: "🌐", flex: 1.2) { [weak self] in
      self?.delegate?.nextKeyboard()
    })
    bottom.addArrangedSubview(specialKey(title: "espace", flex: 5) { [weak self] in
      self?.delegate?.insert(" ")
    })
    bottom.addArrangedSubview(specialKey(title: "retour", flex: 2, bg: UIColor(red: 0xFD/255, green: 0xCF/255, blue: 0x34/255, alpha: 1), fg: navy) { [weak self] in
      self?.delegate?.insert("\n")
    })
    rootStack.addArrangedSubview(bottom)
  }

  private func makeRow() -> UIStackView {
    let hs = UIStackView()
    hs.axis = .horizontal
    hs.distribution = .fillProportionally
    hs.spacing = 5
    return hs
  }

  private func charKey(_ key: String) -> UIButton {
    let display = (mode == .letters && shifted) ? key.uppercased() : key
    let btn = baseKey(title: display, bg: keyBg, fg: .white, flex: 1)
    btn.addAction(UIAction { [weak self] _ in
      guard let self = self else { return }
      self.delegate?.insert(display)
      if self.mode == .letters && self.shifted {
        self.shifted = false
        self.render()
      }
    }, for: .touchUpInside)
    return btn
  }

  private func specialKey(title: String, flex: CGFloat, bg: UIColor? = nil, fg: UIColor = .white, action: @escaping () -> Void) -> UIButton {
    let btn = baseKey(title: title, bg: bg ?? specialBg, fg: fg, flex: flex)
    btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
    btn.addAction(UIAction { _ in action() }, for: .touchUpInside)
    return btn
  }

  private func baseKey(title: String, bg: UIColor, fg: UIColor, flex: CGFloat) -> UIButton {
    let btn = UIButton(type: .system)
    btn.setTitle(title, for: .normal)
    btn.setTitleColor(fg, for: .normal)
    btn.titleLabel?.font = .systemFont(ofSize: 20, weight: .regular)
    btn.backgroundColor = bg
    btn.layer.cornerRadius = 6
    btn.setContentHuggingPriority(.defaultLow, for: .horizontal)
    // Largeur proportionnelle via priorité de contenu + distribution fillProportionally.
    btn.widthAnchor.constraint(greaterThanOrEqualToConstant: 0).isActive = true
    if flex != 1 {
      // Astuce : on force une largeur intrinsèque plus grande pour les touches spéciales.
      btn.contentEdgeInsets = UIEdgeInsets(top: 0, left: 6 * flex, bottom: 0, right: 6 * flex)
    }
    return btn
  }
}
