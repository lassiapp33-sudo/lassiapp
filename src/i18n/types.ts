export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqSection {
  category: string;
  items: FaqItem[];
}
export interface StepItem {
  title: string;
  desc: string;
}

export interface Translations {
  nav: {
    home: string;
    favorites: string;
    messages: string;
    profile: string;
    dashboard: string;
    debts: string;
    orders: string;
  };
  common: {
    cancel: string;
    gallery: string;
    camera: string;
    error: string;
    photoProfile: string;
    photoUpdateError: string;
    comingSoon: string;
    paymentsComingSoon: string;
    addressesComingSoon: string;
    open: string;
    closed: string;
    vip: string;
  };
  profile: {
    myProfile: string;
    myAccount: string;
    client: string;
    merchant: string;
    merchantVip: string;
    myActivity: string;
    myBusiness: string;
    preferences: string;
    helpAccount: string;
    myOrders: string;
    myOrdersSub: string;
    myFavorites: string;
    noFavorites: string;
    favoriteOne: string;
    favoritesMany: string;
    myPayments: string;
    myPaymentsSub: string;
    myStore: string;
    myStoreSub: string;
    myVisibility: string;
    myVisibilitySub: string;
    myRevenue: string;
    myRevenueSub: string;
    notifications: string;
    notificationsSub: string;
    language: string;
    myAddresses: string;
    inviteFriend: string;
    inviteFriendSub: string;
    merchantNumber: string;
    merchantNumberSub: string;
    helpSupport: string;
    whatsapp: string;
    whatsappSub: string;
    logout: string;
    deleteAccount: string;
    version: string;
    versionPro: string;
  };
  help: {
    title: string;
    howItWorks: string;
    faq: string;
    needHelp: string;
    contactWa: string;
    clientSteps: StepItem[];
    merchantSteps: StepItem[];
    clientFaq: FaqSection[];
    merchantFaq: FaqSection[];
  };
  lang: {
    modalTitle: string;
    fr: string;
    en: string;
  };
  auth: {
    welcomeBack: string;
    welcomeBackSub: string;
    phoneLabel: string;
    phonePlaceholder: string;
    passwordLabel: string;
    forgotPassword: string;
    loginBtn: string;
    noAccount: string;
    createAccount: string;
    roleTitle: string;
    roleSub: string;
    clientRole: string;
    clientRoleDesc: string;
    merchantRole: string;
    merchantRoleDesc: string;
    alreadyAccount: string;
    signIn: string;
    registerTitle: string;
    registerSub: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    registerBtn: string;
    hasAccount: string;
    nameLabel: string;
  };
  home: {
    explore: string;
    nearby: string;
    noShops: string;
    search: string;
    searchPlaceholder: string;
    searchTitle: string;
    allResults: string;
    noResults: string;
  };
  favorites: {
    title: string;
    all: string;
    tangana: string;
    stores: string;
    hair: string;
    empty: string;
    emptySub: string;
  };
  category: {
    allShopsPrefix: string;
    allShopsSuffix: string;
    registered: string;
    registeredPlural: string;
    noShops: string;
    availableSlot: string;
    nearFilter: string;
    topFilter: string;
    openFilter: string;
  };
}
