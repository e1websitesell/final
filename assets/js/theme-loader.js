import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const FONT_MAP = {
  minimal: { family: "system-ui, -apple-system, sans-serif", url: null },
  "modern-sans": { family: "'Poppins', sans-serif", url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" },
  "classic-serif": { family: "'Playfair Display', serif", url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" },
  "bold-display": { family: "'Montserrat', sans-serif", url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800&display=swap" }
};

let cachedSettings = null;

function injectGA4(measurementId) {
  if (!measurementId || document.getElementById("ga4-script")) return;
  try {
    const script1 = document.createElement("script");
    script1.id = "ga4-script";
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script1);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", measurementId);
  } catch (e) {
    console.error("GA4 ইনজেক্ট করতে সমস্যা হয়েছে:", e);
  }
}

function injectMetaPixel(pixelId) {
  if (!pixelId || window.fbq) return;
  try {
    window.fbq = function () {
      window.fbq.callMethod
        ? window.fbq.callMethod.apply(window.fbq, arguments)
        : window.fbq.queue.push(arguments);
    };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = [];

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  } catch (e) {
    console.error("Meta Pixel ইনজেক্ট করতে সমস্যা হয়েছে:", e);
  }
}

export async function loadThemeAndSettings() {
  if (cachedSettings) return cachedSettings;

  let settings = {};
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    if (snap.exists()) settings = snap.data();
  } catch (e) {
    console.error("settings/site লোড করতে সমস্যা হয়েছে (Firebase config ঠিক আছে কিনা চেক করুন):", e);
  }

  const theme = settings.theme || {
    primaryColor: "#1a1d29", accentColor: "#6b7280",
    fontPair: "minimal", buttonShape: "sharp", homepageLayout: "grid"
  };
  const font = FONT_MAP[theme.fontPair] || FONT_MAP.minimal;

  if (font.url) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = font.url;
    document.head.appendChild(link);
  }

  document.documentElement.style.setProperty("--primary-color", theme.primaryColor);
  document.documentElement.style.setProperty("--accent-color", theme.accentColor);
  document.documentElement.style.setProperty("--site-font", font.family);
  document.documentElement.style.setProperty("--btn-radius", theme.buttonShape === "sharp" ? "4px" : "24px");

  injectGA4(settings.gaMeasurementId);
  injectMetaPixel(settings.metaPixelId);

  settings.theme = theme;
  cachedSettings = settings;
  return settings;
}

// ---------- ইকমার্স ইভেন্ট ট্র্যাকিং ----------
// loadThemeAndSettings() আগে কল হয়ে gtag/fbq ইনজেক্ট হয়ে থাকতে হবে,
// নাহলে window.gtag/window.fbq থাকবে না আর এই ফাংশনগুলো নীরবে কিছু করবে না (এরর দেবে না)।

export function trackAddToCart(item) {
  try {
    const value = (item.price || 0) * (item.qty || 1);
    if (window.gtag) {
      window.gtag("event", "add_to_cart", {
        currency: "BDT",
        value,
        items: [{
          item_id: item.productId,
          item_name: item.name,
          item_variant: item.variantName || undefined,
          price: item.price,
          quantity: item.qty || 1
        }]
      });
    }
    if (window.fbq) {
      window.fbq("track", "AddToCart", {
        content_ids: [item.productId],
        content_name: item.name,
        content_type: "product",
        currency: "BDT",
        value
      });
    }
  } catch (e) {
    console.error("AddToCart ইভেন্ট ট্র্যাক করতে সমস্যা হয়েছে:", e);
  }
}

export function trackPurchase(order) {
  try {
    const items = order.items || [];
    if (window.gtag) {
      window.gtag("event", "purchase", {
        transaction_id: order.orderId || "",
        currency: "BDT",
        value: order.totalAmount,
        shipping: order.deliveryCharge || 0,
        items: items.map((i) => ({
          item_id: i.productId,
          item_name: i.productName,
          item_variant: i.variantName || undefined,
          price: i.price,
          quantity: i.qty
        }))
      });
    }
    if (window.fbq) {
      window.fbq("track", "Purchase", {
        content_ids: items.map((i) => i.productId),
        content_type: "product",
        currency: "BDT",
        value: order.totalAmount
      });
    }
  } catch (e) {
    console.error("Purchase ইভেন্ট ট্র্যাক করতে সমস্যা হয়েছে:", e);
  }
}