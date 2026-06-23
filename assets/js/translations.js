// সাইটের সব বহুভাষিক টেক্সট এখানে থাকবে।
// নতুন কোনো UI স্ট্রিং লাগলে এখানে bn আর en দুই ভাষাতেই যুক্ত করতে হবে।

export const translations = {
  bn: {
    home: "হোম",
    shop: "শপ",
    cart: "কার্ট",
    login: "লগইন",
    account: "অ্যাকাউন্ট",
    search_placeholder: "প্রোডাক্ট খুঁজুন...",
    featured_products: "ফিচার্ড প্রোডাক্ট",
    categories: "ক্যাটাগরি",
    shop_now: "শপ করুন",
    add_to_cart: "কার্টে যুক্ত করুন",
    view_all: "সব দেখুন"
  },
  en: {
    home: "Home",
    shop: "Shop",
    cart: "Cart",
    login: "Login",
    account: "Account",
    search_placeholder: "Search products...",
    featured_products: "Featured Products",
    categories: "Categories",
    shop_now: "Shop Now",
    add_to_cart: "Add to Cart",
    view_all: "View All"
  }
};

export function getLang() {
  return localStorage.getItem("siteLang") || "bn";
}

export function setLang(lang) {
  localStorage.setItem("siteLang", lang);
}

export function t(key) {
  const lang = getLang();
  return (translations[lang] && translations[lang][key]) || translations.bn[key] || key;
}

export function applyTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });
}