const { withAppDelegate } = require('@expo/config-plugins');

// Fix pour useFrameworks:static — Firebase swizzling ne capture pas
// didRegisterForRemoteNotificationsWithDeviceToken → APNs token jamais reçu.
// Ce plugin injecte l'appel manuel dans AppDelegate avant d'appeler super
// (super = ExpoAppDelegate qui notifie expo-notifications).
const FIREBASE_APNS_BRIDGE = `
- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [FIRMessaging messaging].APNSToken = deviceToken;
  [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}
`;

module.exports = function withFirebaseAPNSBridge(config) {
  return withAppDelegate(config, (config) => {
    let src = config.modResults.contents;

    if (src.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
      // Méthode déjà présente — injecter l'appel Firebase en premier
      src = src.replace(
        /(-\s*\(void\)\s*application:\s*\(UIApplication\s*\*\)\s*\w+\s+didRegisterForRemoteNotificationsWithDeviceToken:\s*\(NSData\s*\*\)\s*\w+\s*\{)/,
        '$1\n  [FIRMessaging messaging].APNSToken = deviceToken;'
      );
    } else {
      // Méthode absente — l'ajouter avant @end avec appel super
      src = src.replace(/@end\s*$/, FIREBASE_APNS_BRIDGE + '\n@end');
    }

    config.modResults.contents = src;
    return config;
  });
};
