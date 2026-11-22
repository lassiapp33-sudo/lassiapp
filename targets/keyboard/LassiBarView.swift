import UIKit

// Barre LASSI : rangée de "puces" au-dessus du clavier. Chaque puce insère un
// texte (puces vitrine) ou une réponse de vente, {lien} résolu vers la vitrine.

final class LassiBarView: UIView {

  private let scroll = UIScrollView()
  private let stack = UIStackView()
  private var merchant: MerchantData?
  private let onInsert: (String) -> Void

  // Charte LASSI
  private let navy = UIColor(red: 0x14/255, green: 0x15/255, blue: 0x2A/255, alpha: 1)
  private let yellow = UIColor(red: 0xFD/255, green: 0xCF/255, blue: 0x34/255, alpha: 1)
  private let green = UIColor(red: 0x25/255, green: 0xD3/255, blue: 0x66/255, alpha: 1)

  init(onInsert: @escaping (String) -> Void) {
    self.onInsert = onInsert
    super.init(frame: .zero)
    setup()
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) non supporté") }

  private func setup() {
    backgroundColor = navy
    scroll.showsHorizontalScrollIndicator = false
    scroll.translatesAutoresizingMaskIntoConstraints = false
    addSubview(scroll)

    stack.axis = .horizontal
    stack.spacing = 8
    stack.alignment = .center
    stack.isLayoutMarginsRelativeArrangement = true
    stack.layoutMargins = UIEdgeInsets(top: 6, left: 10, bottom: 6, right: 10)
    stack.translatesAutoresizingMaskIntoConstraints = false
    scroll.addSubview(stack)

    NSLayoutConstraint.activate([
      scroll.leadingAnchor.constraint(equalTo: leadingAnchor),
      scroll.trailingAnchor.constraint(equalTo: trailingAnchor),
      scroll.topAnchor.constraint(equalTo: topAnchor),
      scroll.bottomAnchor.constraint(equalTo: bottomAnchor),
      stack.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
      stack.topAnchor.constraint(equalTo: scroll.topAnchor),
      stack.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
      stack.heightAnchor.constraint(equalTo: scroll.heightAnchor),
    ])
  }

  func configure(with merchant: MerchantData?) {
    self.merchant = merchant
    stack.arrangedSubviews.forEach { $0.removeFromSuperview() }

    guard let m = merchant else {
      addChip(title: "Ouvre LASSI pour activer", insert: nil, bg: UIColor.darkGray)
      return
    }

    // Puces vitrine (jaune) puis réponses rapides (vert).
    for chip in m.chips {
      addChip(title: "\(chip.emoji) \(chip.label)",
              insert: SharedStore.resolve(chip.insert, url: m.vitrineUrl),
              bg: yellow, fg: navy)
    }
    for reply in m.quickReplies {
      addChip(title: reply.label,
              insert: SharedStore.resolve(reply.text, url: m.vitrineUrl),
              bg: green, fg: .white)
    }
  }

  private func addChip(title: String, insert: String?, bg: UIColor, fg: UIColor = .white) {
    let btn = UIButton(type: .system)
    btn.setTitle(title, for: .normal)
    btn.setTitleColor(fg, for: .normal)
    btn.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
    btn.backgroundColor = bg
    btn.layer.cornerRadius = 15
    btn.contentEdgeInsets = UIEdgeInsets(top: 7, left: 14, bottom: 7, right: 14)
    btn.isEnabled = insert != nil
    if let text = insert {
      btn.addAction(UIAction { [weak self] _ in self?.onInsert(text) }, for: .touchUpInside)
    }
    stack.addArrangedSubview(btn)
  }
}
