const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

const CRASHLYTICS_CLASSPATH = "classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.7'";
const CRASHLYTICS_PLUGIN = "apply plugin: 'com.google.firebase.crashlytics'";

function withCrashlyticsClasspath(config) {
  return withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('firebase-crashlytics-gradle')) {
      c.modResults.contents = c.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n        ${CRASHLYTICS_CLASSPATH}`
      );
    }
    return c;
  });
}

function withCrashlyticsApplyPlugin(config) {
  return withAppBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('com.google.firebase.crashlytics')) {
      c.modResults.contents += `\n${CRASHLYTICS_PLUGIN}\n`;
    }
    return c;
  });
}

module.exports = function withFirebaseCrashlyticsGradle(config) {
  config = withCrashlyticsClasspath(config);
  config = withCrashlyticsApplyPlugin(config);
  return config;
};
