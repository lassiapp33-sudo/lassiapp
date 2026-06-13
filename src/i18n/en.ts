import { Translations } from './types';

const en: Translations = {
  nav: {
    home: 'Home',
    favorites: 'Favorites',
    messages: 'Messages',
    profile: 'Profile',
    dashboard: 'Dashboard',
    debts: 'Debts',
    orders: 'Orders',
  },
  common: {
    cancel: 'Cancel',
    gallery: 'Gallery',
    camera: 'Camera',
    error: 'Error',
    photoProfile: 'Profile photo',
    photoUpdateError: 'Unable to update photo. Please try again.',
    comingSoon: 'Coming soon',
    paymentsComingSoon: 'Your payment history is coming very soon.',
    addressesComingSoon: 'Address management is coming very soon.',
    open: 'Open',
    closed: 'Closed',
    vip: 'VIP',
  },
  profile: {
    myProfile: 'My profile',
    myAccount: 'My account',
    client: '👤 Client',
    merchant: '🏪 Merchant',
    merchantVip: '🏪 Merchant · Top 3 VIP',
    myActivity: 'My activity',
    myBusiness: 'My business',
    preferences: 'Preferences',
    helpAccount: 'Help & account',
    myOrders: 'My orders',
    myOrdersSub: 'History & tracking',
    myFavorites: 'My favorites',
    noFavorites: 'No favorites',
    favoriteOne: 'business saved',
    favoritesMany: 'businesses saved',
    myPayments: 'My payments',
    myPaymentsSub: 'Receipts & Wave/OM history',
    myStore: 'My store',
    myStoreSub: 'Products, photos, hours',
    myVisibility: 'Visibility',
    myVisibilitySub: '3 ways to get noticed',
    myRevenue: 'My revenue',
    myRevenueSub: 'Reports & statistics',
    notifications: 'Notifications',
    notificationsSub: 'New orders, reminders',
    language: 'Language',
    myAddresses: 'My addresses',
    inviteFriend: 'Invite a friend',
    inviteFriendSub: 'Share Lassi with your loved ones',
    merchantNumber: 'My merchant number',
    merchantNumberSub: 'Wave / Orange Money',
    helpSupport: 'Help & support',
    whatsapp: 'Contact customer service',
    whatsappSub: 'Fast response via WhatsApp',
    logout: 'Log out',
    deleteAccount: 'Delete my account',
    version: 'LASSİ v1.0.0',
    versionPro: 'LASSİ Pro v1.0.0',
  },
  help: {
    title: 'Help & support',
    howItWorks: 'How it works',
    faq: 'FAQ',
    needHelp: 'Still need help?',
    contactWa: 'Contact us on WhatsApp',
    clientSteps: [
      { title: 'Choose a business', desc: 'Explore shops near you by category or free search.' },
      {
        title: 'Select your items',
        desc: 'Add items or services to your cart and indicate your preferences.',
      },
      {
        title: 'Pay with Wave or Orange Money',
        desc: 'Pay securely in a few seconds from your phone.',
      },
    ],
    merchantSteps: [
      {
        title: 'Create your storefront',
        desc: 'Add photos, services and prices to attract customers around you.',
      },
      {
        title: 'Receive and confirm orders',
        desc: 'You are notified in real time. Confirm or decline each order from the app.',
      },
      {
        title: 'Get paid via Wave or Orange Money',
        desc: 'Payment is secure and direct, with no middleman.',
      },
    ],
    clientFaq: [
      {
        category: 'Orders',
        items: [
          {
            q: 'How do I place an order?',
            a: 'Choose a business, select your items, confirm and pay via Wave or Orange Money.',
          },
          {
            q: 'How do I track my order?',
            a: 'Go to "My orders" from your profile → History & tracking.',
          },
          {
            q: 'Can I cancel an order?',
            a: "Yes, as long as the merchant hasn't confirmed it. Contact them directly via chat.",
          },
        ],
      },
      {
        category: 'Payment',
        items: [
          {
            q: 'Which payment methods are accepted?',
            a: 'Wave and Orange Money. More options coming soon.',
          },
          { q: 'Where can I see my receipts?', a: 'Profile → "My payments" → Receipts & history.' },
          {
            q: 'My payment failed?',
            a: 'Check your balance and retry. If the problem persists, contact LASSI customer service.',
          },
        ],
      },
      {
        category: 'Businesses & Favorites',
        items: [
          {
            q: 'How do I save a business?',
            a: 'Tap the star ☆ on the business page. It will appear in your Favorites.',
          },
          {
            q: 'How do I find a business near me?',
            a: 'The home screen automatically shows businesses based on your GPS location.',
          },
        ],
      },
      {
        category: 'Account',
        items: [
          {
            q: 'How do I edit my profile?',
            a: 'Go to Profile → tap the pencil icon next to your photo.',
          },
          { q: 'How do I change the language?', a: 'Profile → Preferences → Language.' },
        ],
      },
    ],
    merchantFaq: [
      {
        category: 'My storefront',
        items: [
          {
            q: 'How do I create my storefront?',
            a: 'Enter your name, photos, services and prices in the "My store" section of your profile.',
          },
          {
            q: 'How do I add or edit my products?',
            a: 'Store management → Add / Edit. Changes are visible immediately.',
          },
          {
            q: 'How do I take good photos?',
            a: 'Clear, well-lit photos that clearly show your work or products.',
          },
        ],
      },
      {
        category: 'Received orders',
        items: [
          {
            q: 'How do I see new orders?',
            a: 'You receive an immediate notification, then find them in the "Orders" section.',
          },
          { q: 'How do I confirm or decline an order?', a: 'Open the order → Confirm or Decline.' },
          {
            q: "What if I can't fulfill an order?",
            a: 'Decline it quickly to notify the customer and protect your reputation.',
          },
        ],
      },
      {
        category: 'Payments & Revenue',
        items: [
          {
            q: 'How do I receive my money?',
            a: 'Via Wave or Orange Money according to the terms agreed with the customer.',
          },
          {
            q: 'Where can I see my revenue?',
            a: 'In the "My revenue" section from your merchant profile.',
          },
          {
            q: 'When do I get paid?',
            a: 'Once the order is fulfilled and confirmed by both sides.',
          },
        ],
      },
      {
        category: 'My account',
        items: [
          {
            q: 'How do I edit my info?',
            a: 'Profile → pencil icon. You can edit your name, photo and number.',
          },
          {
            q: 'How do I manage my hours?',
            a: 'From your store management → Hours & availability section.',
          },
        ],
      },
    ],
  },
  lang: {
    modalTitle: 'Langue / Language',
    fr: 'Français',
    en: 'English',
  },
  auth: {
    welcomeBack: 'Good to see\nyou again 👋',
    welcomeBackSub: 'Log in to find your neighborhood.',
    phoneLabel: 'Phone number',
    phonePlaceholder: '78 137 61 61',
    passwordLabel: 'Password',
    forgotPassword: 'Forgot password?',
    loginBtn: 'Log in',
    noAccount: 'No account yet? ',
    createAccount: 'Create an account',
    roleTitle: 'Welcome 🤴🏾👸🏾\nYou are here to…',
    roleSub: 'Choose your profile to get started.',
    clientRole: 'I am a Client',
    clientRoleDesc: 'Discover, order and pay near me',
    merchantRole: 'I am a Merchant',
    merchantRoleDesc: 'Manage my business, debts and sales',
    alreadyAccount: 'Already have an account? ',
    signIn: 'Log in',
    registerTitle: 'Create an account',
    registerSub: 'Join thousands of businesses in your neighborhood.',
    namePlaceholder: 'Your first name',
    emailPlaceholder: 'your@email.com',
    registerBtn: 'Create my account',
    hasAccount: 'Already have an account? ',
    nameLabel: 'Full name',
  },
  home: {
    explore: 'Explore your neighborhood',
    nearby: '📍 Right near you',
    noShops: 'No businesses found yet.',
    search: 'Search',
    searchPlaceholder: 'Search a business, a dish…',
    searchTitle: 'Search',
    allResults: '📋 All results',
    noResults: 'No results for this search.',
  },
  favorites: {
    title: 'My favorites',
    all: 'All',
    tangana: 'Tangana',
    stores: 'Shops',
    hair: 'Barbers',
    empty: 'No favorites yet',
    emptySub: 'Explore businesses and tap ☆ to save them.',
  },
  category: {
    allShopsPrefix: 'All',
    allShopsSuffix: 's',
    registered: 'registered',
    registeredPlural: 'registered',
    noShops: 'No businesses registered in this category.',
    availableSlot: 'Available slot',
    nearFilter: 'Nearest',
    topFilter: 'Top rated',
    openFilter: 'Open now',
  },
};

export default en;
