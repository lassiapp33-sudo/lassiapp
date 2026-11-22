import { requireNativeModule } from 'expo-modules-core';

// Interface native. La data est passée en string JSON (sérialisée côté index.ts)
// pour éviter toute ambiguïté de conversion de records imbriqués sur les deux OS.
interface LassiKeyboardNativeModule {
  setMerchantData(json: string): Promise<void>;
  clearMerchantData(): Promise<void>;
  isKeyboardEnabled(): Promise<boolean | null>;
  openKeyboardSettings(): Promise<void>;
  showKeyboardPicker(): Promise<void>;
}

// Fallback no-op : tant que le binaire natif du clavier n'est pas build (ex: app
// servie en OTA sur un APK qui ne contient pas encore le module), l'import ne doit
// JAMAIS jeter. On expose une implémentation neutre.
const fallback: LassiKeyboardNativeModule = {
  setMerchantData: async () => {},
  clearMerchantData: async () => {},
  isKeyboardEnabled: async () => null,
  openKeyboardSettings: async () => {},
  showKeyboardPicker: async () => {},
};

let native: LassiKeyboardNativeModule;
try {
  native = requireNativeModule<LassiKeyboardNativeModule>('LassiKeyboard');
} catch {
  native = fallback;
}

export default native;
