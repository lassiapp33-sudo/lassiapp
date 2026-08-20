module.exports = {
  dependencies: {
    // ML Kit pod (GoogleMLKit 8.0.0) conflicts with @react-native-firebase 25.x (Firebase iOS SDK 11).
    // Excluded from iOS auto-linking; Android keeps native linking.
    '@react-native-ml-kit/text-recognition': {
      platforms: {
        ios: null,
      },
    },
  },
};
