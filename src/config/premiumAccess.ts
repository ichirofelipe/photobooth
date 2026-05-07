import type {
  PremiumFeature,
  PremiumPaymentConfig,
  PremiumUnlockTarget,
} from '@/types';

export const premiumAccessConfig: PremiumPaymentConfig = {
  mode: 'manual',
  futureGatewayNote: 'Online checkout will be available in a future update.',
  supportNote:
    'After payment is verified manually, an activation key will be sent back to you. Enter that key below to unlock the feature on this device.',
  contactMethods: [
    {
      id: 'facebook-page',
      label: 'Facebook Page',
      kind: 'facebook',
      value: 'https://facebook.com/your-page',
      href: 'https://facebook.com/your-page',
      buttonLabel: 'Open Facebook',
      details: 'Message the page and mention which premium feature you want to unlock.',
    },
    {
      id: 'messenger',
      label: 'Messenger',
      kind: 'messenger',
      value: 'https://m.me/your-page',
      href: 'https://m.me/your-page',
      buttonLabel: 'Open Messenger',
      details: 'Send your proof of payment here for the fastest manual verification.',
    },
    {
      id: 'email',
      label: 'Email',
      kind: 'email',
      value: 'your@email.com',
      href: 'mailto:your@email.com?subject=Photobooth%20Premium%20Activation',
      buttonLabel: 'Send Email',
      details: 'Include your device ID and the feature you are unlocking.',
    },
    {
      id: 'gcash',
      label: 'GCash',
      kind: 'gcash',
      value: '0917-000-0000',
      details: 'Send payment to this number, then send the receipt screenshot through one of the contact channels above.',
    },
    {
      id: 'maya',
      label: 'Maya',
      kind: 'maya',
      value: '0917-000-0000',
      details: 'If you use Maya, send proof of payment after transfer so the activation key can be issued manually.',
    },
    {
      id: 'payment-note',
      label: 'Payment Note',
      kind: 'note',
      value: 'Include your device ID, chosen feature, and your name in the message when sending proof of payment.',
    },
  ],
  targets: {
    qr_download: {
      title: 'Unlock QR Download',
      summary:
        'Unlock guest QR download access after printing so guests can open the QR page and save their copy.',
      includes: ['qr_download'],
    },
    template_editor: {
      title: 'Unlock Template Editor',
      summary:
        'Unlock the Template Editor so you can create, edit, and manage your custom templates on this device.',
      includes: ['template_editor'],
    },
    premium_bundle: {
      title: 'Unlock Premium Features',
      summary:
        'Unlock both QR Download and Template Editor with one activation key when you purchase the premium bundle.',
      includes: ['qr_download', 'template_editor'],
    },
  },
};

export function isPremiumUnlockTarget(value: unknown): value is PremiumUnlockTarget {
  return typeof value === 'string' && value in premiumAccessConfig.targets;
}

export function premiumTargetConfig(target: PremiumUnlockTarget) {
  return premiumAccessConfig.targets[target];
}

export function premiumFeaturesForTarget(target: PremiumUnlockTarget): PremiumFeature[] {
  return [...premiumAccessConfig.targets[target].includes];
}
