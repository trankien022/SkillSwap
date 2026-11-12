module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [{
      // Jitsi's config parser uses Worklets Core, not Expo/Reanimated Worklets.
      // Keep Expo's default transform for the app and gesture/navigation libraries.
      test: (filename) => typeof filename === 'string' && /[/\\]@jitsi[/\\]react-native-sdk[/\\]/.test(filename),
      presets: [['babel-preset-expo', { worklets: false, reanimated: false }]],
      plugins: ['react-native-worklets-core/plugin'],
    }],
  };
};
