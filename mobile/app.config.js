const fs = require('fs');

module.exports = ({ config }) => {
  const androidServices = process.env.GOOGLE_SERVICES_FILE || './google-services.json';
  const iosServices = process.env.GOOGLE_SERVICE_INFO_FILE || './GoogleService-Info.plist';

  return {
    ...config,
    android: {
      ...config.android,
      ...(fs.existsSync(androidServices) ? { googleServicesFile: androidServices } : {}),
    },
    ios: {
      ...config.ios,
      ...(fs.existsSync(iosServices) ? { googleServicesFile: iosServices } : {}),
    },
  };
};
