import { ConfigContext, ExpoConfig } from 'expo/config';

/** El plugin nativo se habilita solo con configuración real de Google Cloud. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const webId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const iosScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    name: config.name ?? 'Fixly',
    slug: config.slug ?? 'mobile',
    plugins: [
      ...(config.plugins ?? []),
      'expo-sharing',
      ['expo-location', {
        locationWhenInUsePermission: 'Permite usar tu ubicación cuando eliges compartirla en un servicio.',
        locationAlwaysAndWhenInUsePermission: 'Comparte tu ubicación con tu cliente solo durante el trayecto que actives.',
        isIosBackgroundLocationEnabled: process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO === 'true',
        isAndroidBackgroundLocationEnabled: process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO === 'true',
        isAndroidForegroundServiceEnabled: process.env.EXPO_PUBLIC_GPS_SEGUNDO_PLANO === 'true',
      }],
      ...(webId && iosScheme && process.env.EXPO_PUBLIC_GOOGLE_NATIVE_ENABLED === 'true'
        ? [['react-native-nitro-google-signin', { iosUrlScheme: iosScheme }] as [string, { iosUrlScheme: string }]] : []),
    ],
    ios: { ...config.ios, ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}) },
    android: { ...config.android, ...(process.env.ANDROID_PACKAGE ? { package: process.env.ANDROID_PACKAGE } : {}) },
  };
};
