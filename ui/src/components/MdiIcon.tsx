// Named import: @mdi/react@1.x is CJS, and its default export resolves to the
// whole module namespace under Vite's interop (not the component). The named
// `Icon` export is the actual forwardRef component.
import { Icon } from '@mdi/react';
import {
  mdiAccountOutline,
  mdiBatteryCharging,
  mdiBrain,
  mdiCalendarMonth,
  mdiCogOutline,
  mdiCup,
  mdiEmoticonOutline,
  mdiFaceWomanOutline,
  mdiFoodApple,
  mdiHeartOutline,
  mdiHelpCircleOutline,
  mdiLightningBolt,
  mdiPencilOutline,
  mdiPill,
  mdiReload,
  mdiSkateboarding,
  mdiSleep,
  mdiStomach,
  mdiThermometer,
  mdiWater,
  mdiWaterOutline,
} from '@mdi/js';

/**
 * Renders a Material Design Icon by name. We keep a curated registry of the
 * icons the app actually uses (nav + seeded categories) rather than importing
 * all of `@mdi/js` (~1.3 MB of path data, none of it tree-shakeable). Unknown
 * names fall back to a help icon - extend the registry as new icons are needed.
 */
const REGISTRY: Record<string, string> = {
  'account-outline': mdiAccountOutline,
  'calendar-month': mdiCalendarMonth,
  'cog-outline': mdiCogOutline,
  'pencil-outline': mdiPencilOutline,
  reload: mdiReload,
  skateboarding: mdiSkateboarding,
  water: mdiWater,
  // Seeded symptom-category icons.
  'water-outline': mdiWaterOutline,
  thermometer: mdiThermometer,
  'heart-outline': mdiHeartOutline,
  'lightning-bolt': mdiLightningBolt,
  'emoticon-outline': mdiEmoticonOutline,
  'battery-charging': mdiBatteryCharging,
  sleep: mdiSleep,
  'face-woman-outline': mdiFaceWomanOutline,
  brain: mdiBrain,
  'food-apple': mdiFoodApple,
  stomach: mdiStomach,
  pill: mdiPill,
  cup: mdiCup,
};

export function MdiIcon({ name, size = 1, color }: { name: string; size?: number; color?: string }) {
  const path = REGISTRY[name] ?? mdiHelpCircleOutline;
  return <Icon path={path} size={size} color={color} />;
}
