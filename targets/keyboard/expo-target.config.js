/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'keyboard',
  name: 'LassiKeyboard',
  deploymentTarget: '16.0',
  // Même App Group que l'app principale → l'extension lit les données marchand
  // écrites par le bridge natif (lien vitrine, réponses rapides).
  entitlements: {
    'com.apple.security.application-groups': ['group.com.lassiapp.lassiapp'],
  },
};
