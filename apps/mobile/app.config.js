const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { expo } = require('./app.json');

module.exports = ({ config }) => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const googleServicesFile = './google-services.json';
  const hasGoogleServicesFile = existsSync(resolve(__dirname, googleServicesFile));

  return {
    ...expo,
    ...config,
    extra: {
      ...expo.extra,
      ...config.extra,
      eas: {
        ...expo.extra?.eas,
        ...config.extra?.eas,
        ...(projectId ? { projectId } : {}),
      },
    },
    android: {
      ...expo.android,
      ...config.android,
      ...(hasGoogleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
