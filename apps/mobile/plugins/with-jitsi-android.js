/* eslint-disable @typescript-eslint/no-require-imports */
// `expo/config-plugins` is the public re-export of @expo/config-plugins and is the
// documented import path for a config plugin. Depending on the internal package
// directly is undeclared (ADR-005) and would need its own lockfile entry; `expo`
// is already declared, so this path keeps the plugin inside the declared set.
const { withGradleProperties, withProjectBuildGradle } = require('expo/config-plugins');

/** Jitsi Android SDK requires API 26 or newer. */
function withJitsiAndroid(config) {
  config = withGradleProperties(config, (mod) => {
    const properties = mod.modResults;
    const minSdk = properties.find(
      (property) => property.type === 'property' && property.key === 'android.minSdkVersion',
    );

    if (minSdk) {
      minSdk.value = '26';
    } else {
      properties.push({ type: 'property', key: 'android.minSdkVersion', value: '26' });
    }

    return mod;
  });

  return withProjectBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes('gradlePluginVersion')) {
      mod.modResults.contents +=
        '\n// Required by the Jitsi React Native SDK Android module.\next.gradlePluginVersion = "8.12.0"\n';
    }
    return mod;
  });
}

module.exports = withJitsiAndroid;
