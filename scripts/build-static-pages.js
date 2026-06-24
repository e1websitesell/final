// Firestore থেকে প্রোডাক্ট ডেটা পড়ে প্রতিটার জন্য static HTML পেজ বানায়
// (product/{id}.html), আর sitemap.xml + llms.txt আপডেট করে।
// GitHub Action থেকে অটোমেটিক চলে।
// ⚡ index1.html টেমপ্লেট পড়ে index.html তৈরি করে (স্ট্যাটিক)
// ⚡ shop.html ডায়নামিক থাকবে (জেনারেট করা হয় না)

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ডোমেইন কেনার পর এটা বদলে দিন
const SITE_URL = "https://e1websitesell.github.io/final"; // শেষে "/" নেই

const firebaseConfig = JSON.parse(
  await fs.readFile(path.join(__dirname, "firebase-config.json"), "utf-8")
);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchAllProducts() {
  const snap = await getDocs(collection(db, "products"));
  const products = [];
  snap.forEach((d) => products.push({ id: d.id, ...d.data() }));
  return products;
}

async function fetchSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    return snap.exists() ? snap.data() : {};
  } catch (e) {
    console.error("settings লোড করতে সমস্যা:", e);
    return {};
  }
}

async function fetchCategories() {
  const snap = await getDocs(collection(db, "categories"));
  const categories = [];
  snap.forEach((d) => categories.push({ id: d.id, ...d.data() }));
  return categories;
}

// ============================================================
// ১. প্রোডাক্ট পেজ (cheerio দিয়ে, আগের মতো)
// ============================================================
const ROOT_PAGES = [
  "index.html", "shop.html", "cart.html", "login.html", "account.html",
  "about.html", "contact.html", "privacy-policy.html", "terms.html", "return-refund-policy.html"
];

function fixTemplateDepth(html) {
  let fixed = html;
  fixed = fixed.replace(/from\s+"\.\/assets\//g, 'from "../assets/');
  ROOT_PAGES.forEach((page) => {
    fixed = fixed.split(`href="${page}`).join(`href="../${page}`);
  });
  return fixed;
}

function buildProductPage(fixedTemplate, product, shopName) {
  const $ = cheerio.load(fixedTemplate);

  const name = product.name_en || product.name_bn || "Product";
  const desc = (product.description_en || product.description_bn || "").slice(0, 160);
  const image = (product.images && product.images[0]) || "";
  const price = product.discountPrice || product.basePrice;

  $("title").text(`${name} — ${shopName}`);
  $("head").append(`<meta name="description" content="${escapeHtml(desc)}">`);
  $("head").append(`<meta property="og:title" content="${escapeHtml(name)}">`);
  $("head").append(`<meta property="og:description" content="${escapeHtml(desc)}">`);
  if (image) $("head").append(`<meta property="og:image" content="${escapeHtml(image)}">`);
  $("head").append(`<link rel="canonical" href="${SITE_URL}/product/${product.id}.html">`);

  const schemaJson = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: name,
    description: desc,
    image: product.images || [],
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: price,
      priceCurrency: "BDT",
      availability: "https://schema.org/InStock"
    },
    aggregateRating: product.reviewCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: product.avgRating || 0,
      reviewCount: product.reviewCount
    } : undefined
  }).replace(/</g, "\\u003c");
  $("head").append(`<script type="application/ld+json">${schemaJson}</script>`);

  $("#productName").text(name);
  $("#productDesc").text(product.description_en || product.description_bn || "");
  $("#priceNow").text("৳" + price);
  if (product.discountPrice) {
    $("#priceOld").text("৳" + product.basePrice).attr("style", "display:inline");
  }
  if (image) {
    $("#mainImage").attr("style", `background-image:url('${image}')`);
  }
  if (Array.isArray(product.images) && product.images.length) {
    const thumbHtml = product.images
      .map((img, i) =>
        `<div class="thumb${i === 0 ? " active" : ""}" data-img="${escapeHtml(img)}" style="background-image:url('${escapeHtml(img)}');"></div>`
      )
      .join("");
    $("#thumbStrip").html(thumbHtml);
  }
  $("#tagsRow").text((product.tags || []).join(" · "));

  return $.html();
}

// ============================================================
// ২. ইনডেক্স পেজ – index1.html টেমপ্লেট পড়ে index.html বানায়
// ============================================================
async function buildIndexPageFromTemplate(settings, categories, products) {
  const templatePath = path.join(ROOT, "index1.html");
  let template;
  try {
    template = await fs.readFile(templatePath, "utf-8");
  } catch (e) {
    console.error("⚠️ index1.html পাওয়া যায়নি। ডিফল্ট টেমপ্লেট ব্যবহার করা হচ্ছে।");
    return buildFallbackIndex(settings, categories, products);
  }

  const $ = cheerio.load(template);

  // ----- ১. মেটা ডেটা -----
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";
  $("title").text(shopName);
  $('meta[name="description"]').attr("content", settings.heroText_en || settings.heroText_bn || "");
  $('link[rel="canonical"]').attr("href", SITE_URL);

  // ----- ২. শপের নাম ও লোগো -----
  $("#shopNameText").text(shopName);
  $("#footerShopName").text(shopName);
  if (settings.logoUrl) {
    $("#logoImg").attr("src", settings.logoUrl).attr("style", "display:inline-block;");
  }

  // ----- ৩. হিরো ব্যানার -----
  const bannerImages = settings.bannerImages || [];
  const heroSlides = $("#heroSlides");
  if (bannerImages.length > 0) {
    heroSlides.html(bannerImages.map((url, i) =>
      `<div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${escapeHtml(url)}')"></div>`
    ).join(""));
  }

  // ----- ৪. হিরো টেক্সট -----
  $("#heroTitle").text(settings.heroText_en || settings.heroText_bn || "");

  // ----- ৫. ক্যাটাগরি গ্রিড -----
  const categoryGrid = $("#categoryGrid");
  const categoryEmpty = $("#categoryEmpty");
  const defaultImage = 'https://via.placeholder.com/400x200?text=No+Image';
  if (categories.length > 0) {
    const catHTML = categories.map(c => {
      const name = c.name_bn || c.name_en || c.slug;
      const imgUrl = c.imageUrl && c.imageUrl.trim() !== '' ? c.imageUrl : defaultImage;
      return `<a href="shop.html?category=${encodeURIComponent(c.slug)}" class="category-card" style="background-image:url('${escapeHtml(imgUrl)}')"><span>${escapeHtml(name)}</span></a>`;
    }).join("");
    categoryGrid.html(catHTML);
    // Cheerio-তে .hide() নেই, তাই .remove() অথবা css('display','none')
    if (categoryEmpty.length) {
      categoryEmpty.css('display', 'none');
    }
  } else {
    categoryGrid.html('<p class="muted">কোনো ক্যাটাগরি নেই</p>');
    if (categoryEmpty.length) {
      categoryEmpty.css('display', 'none');
    }
  }

  // ----- ৬. ফিচার্ড প্রোডাক্ট -----
  const productGrid = $("#productGrid");
  const productEmpty = $("#productEmpty");
  const featuredProducts = products.slice(0, 8);
  if (featuredProducts.length > 0) {
    const prodHTML = featuredProducts.map(p => {
      const name = p.name_bn || p.name_en || "Product";
      const img = (p.images && p.images[0]) || "";
      const price = p.discountPrice
        ? `<span class="price-now">৳${p.discountPrice}</span> <span class="price-old">৳${p.basePrice}</span>`
        : `<span class="price-now">৳${p.basePrice}</span>`;
      const stars = p.avgRating ? "★".repeat(Math.round(p.avgRating)) : "";
      return `<a href="product/${p.id}.html" class="product-card">
        <div class="product-img" style="background-image:url('${escapeHtml(img)}')"></div>
        <div class="product-info">
          <div class="product-name">${escapeHtml(name)}</div>
          ${stars ? `<div class="product-stars">${stars}</div>` : ''}
          <div class="product-price">${price}</div>
        </div>
      </a>`;
    }).join("");
    productGrid.html(prodHTML);
    if (productEmpty.length) {
      productEmpty.css('display', 'none');
    }
  } else {
    productGrid.html('<p class="muted">কোনো প্রোডাক্ট নেই</p>');
    if (productEmpty.length) {
      productEmpty.css('display', 'none');
    }
  }

  // ----- ৭. ল্যাঙ্গুয়েজ টগলের জন্য স্ট্যাটিক JS -----
  const staticScript = `
  <script>
    // =========================================================
    // 🔥 স্ট্যাটিক ইনডেক্স – ল্যাঙ্গুয়েজ টগল (রিলোড ছাড়া)
    // =========================================================
    const translations = {
      bn: {
        home: "হোম",
        shop: "শপ",
        cart: "কার্ট",
        login: "লগইন",
        shop_now: "শপ করুন",
        categories: "ক্যাটাগরি",
        featured: "ফিচার্ড প্রোডাক্ট"
      },
      en: {
        home: "Home",
        shop: "Shop",
        cart: "Cart",
        login: "Login",
        shop_now: "Shop Now",
        categories: "Categories",
        featured: "Featured Products"
      }
    };

    function getLang() {
      return localStorage.getItem('siteLang') || 'bn';
    }

    function setLang(lang) {
      localStorage.setItem('siteLang', lang);
    }

    function applyTranslations() {
      const lang = getLang();
      const t = translations[lang] || translations.bn;
      document.getElementById('navHome').textContent = t.home;
      document.getElementById('navShop').textContent = t.shop;
      document.getElementById('navCart').textContent = t.cart;
      document.getElementById('navLogin').textContent = t.login;
      document.getElementById('ctaBtn').textContent = t.shop_now;
      document.getElementById('categoriesTitle').textContent = t.categories;
      document.getElementById('featuredTitle').textContent = t.featured;
      document.getElementById('langToggle').textContent = lang === 'bn' ? 'English' : 'বাংলা';
    }

    document.getElementById('langToggle').addEventListener('click', function() {
      const newLang = getLang() === 'bn' ? 'en' : 'bn';
      setLang(newLang);
      applyTranslations();
      updateBadge();
    });

    function updateBadge() {
      const badge = document.getElementById('cartBadge');
      if (!badge) return;
      try {
        const cart = JSON.parse(localStorage.getItem('localCart') || '[]');
        const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      } catch(e) {}
    }

    document.addEventListener('DOMContentLoaded', function() {
      applyTranslations();
      updateBadge();
      document.getElementById('footerYear').textContent = new Date().getFullYear();
    });
  <\/script>
  `;

  // <script type="module"> ... </script> সরিয়ে static script বসাই
  $('script[type="module"]').remove();
  $('body').append(staticScript);

  return $.html();
}

// ============================================================
// ফ্যালব্যাক: index1.html না থাকলে ডিফল্ট ইনডেক্স তৈরি
// ============================================================
function buildFallbackIndex(settings, categories, products) {
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";
  const heroText = settings.heroText_en || settings.heroText_bn || "";
  const bannerImages = settings.bannerImages || [];
  const defaultImage = 'https://via.placeholder.com/400x200?text=No+Image';

  const categoryHTML = categories.map(c => {
    const name = c.name_bn || c.name_en || c.slug;
    const imgUrl = c.imageUrl && c.imageUrl.trim() !== '' ? c.imageUrl : defaultImage;
    return `<a href="shop.html?category=${encodeURIComponent(c.slug)}" class="category-card" style="background-image:url('${escapeHtml(imgUrl)}')"><span>${escapeHtml(name)}</span></a>`;
  }).join('');

  const productHTML = products.slice(0, 8).map(p => {
    const name = p.name_bn || p.name_en || "Product";
    const img = (p.images && p.images[0]) || '';
    const price = p.discountPrice ? `<span class="price-now">৳${p.discountPrice}</span> <span class="price-old">৳${p.basePrice}</span>` : `<span class="price-now">৳${p.basePrice}</span>`;
    const stars = p.avgRating ? "★".repeat(Math.round(p.avgRating)) : "";
    return `<a href="product/${p.id}.html" class="product-card"><div class="product-img" style="background-image:url('${escapeHtml(img)}')"></div><div class="product-info"><div class="product-name">${escapeHtml(name)}</div>${stars ? `<div class="product-stars">${stars}</div>` : ''}<div class="product-price">${price}</div></div></a>`;
  }).join('');

  const bannerHTML = bannerImages.map((url, i) =>
    `<div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${escapeHtml(url)}')"></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(shopName)}</title>
<meta name="description" content="${escapeHtml(settings.heroText_en || settings.heroText_bn || '')}">
<link rel="canonical" href="${SITE_URL}/">
<style>
  /* ====== আপনার index.html-এর সব CSS ====== */
  :root { --primary-color: #1a1d29; --accent-color: #6b7280; --site-font: system-ui, sans-serif; --btn-radius: 8px; --ink: #1a1d29; --ink-soft: #6b7280; --line: #e5e7eb; --bg: #f7f7f9; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: var(--site-font); color: var(--ink); background: #fff; }
  a { text-decoration: none; color: inherit; }
  .muted { color: var(--ink-soft); font-size: 14px; }
  .site-header { border-bottom: 1px solid var(--line); position: sticky; top: 0; background: #fff; z-index: 10; }
  .header-inner { max-width: 1140px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .brand { display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 700; }
  .brand img { height: 34px; width: auto; }
  .main-nav { display: flex; align-items: center; gap: 26px; font-size: 14.5px; font-weight: 500; }
  .cart-link { position: relative; }
  .cart-badge { position: absolute; top: -9px; right: -14px; background: var(--accent-color); color: #fff; font-size: 11px; min-width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px; }
  .lang-toggle { border: 1px solid var(--line); background: #fff; padding: 7px 14px; border-radius: var(--btn-radius); font-size: 13px; cursor: pointer; font-family: inherit; }
  .hero { position: relative; height: 420px; overflow: hidden; color: #fff; background: var(--primary-color); }
  .hero-slides { position: absolute; inset: 0; }
  .hero-slide { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0; transition: opacity 1.2s ease; }
  .hero-slide.active { opacity: 1; }
  .hero::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.55)); }
  .hero-overlay { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 24px; }
  .hero-overlay h1 { font-size: 34px; margin: 0 0 22px; max-width: 600px; font-weight: 700; }
  .cta-btn { background: var(--accent-color); color: #fff; padding: 13px 30px; border-radius: var(--btn-radius); font-size: 15px; font-weight: 600; }
  .section { max-width: 1140px; margin: 0 auto; padding: 50px 20px; }
  .section h2 { font-size: 22px; margin: 0 0 22px; font-weight: 700; }
  .category-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
  .category-card { height: 120px; border-radius: 12px; background-size: cover; background-position: center; background-color: var(--bg); display: flex; align-items: flex-end; padding: 14px; color: #fff; font-weight: 600; font-size: 15px; position: relative; overflow: hidden; }
  .category-card::before { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,0.25); }
  .category-card span { position: relative; z-index: 1; }
  .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px; }
  .product-card { display: block; }
  .product-img { width: 100%; height: 200px; border-radius: 10px; background-size: cover; background-position: center; background-color: var(--bg); }
  .product-info { padding-top: 10px; }
  .product-name { font-size: 14.5px; font-weight: 600; margin-bottom: 4px; }
  .product-stars { color: #d97706; font-size: 12.5px; margin-bottom: 4px; }
  .price-now { font-weight: 700; color: var(--ink); }
  .price-old { text-decoration: line-through; color: var(--ink-soft); font-size: 13px; margin-left: 6px; }
  .site-footer { border-top: 1px solid var(--line); padding: 28px 20px; margin-top: 40px; }
  .footer-inner { max-width: 1140px; margin: 0 auto; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; font-size: 13.5px; color: var(--ink-soft); }
  .footer-links { display: flex; gap: 18px; }
</style>
</head>
<body>
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="brand">
        ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" alt="" style="height:34px;">` : ''}
        <span id="shopNameText">${escapeHtml(shopName)}</span>
      </a>
      <nav class="main-nav">
        <a href="index.html" id="navHome">হোম</a>
        <a href="shop.html" id="navShop">শপ</a>
        <a href="cart.html" class="cart-link">
          <span id="navCart">কার্ট</span>
          <span id="cartBadge" class="cart-badge" style="display:none;">0</span>
        </a>
        <a href="login.html" id="navLogin">লগইন</a>
      </nav>
      <button id="langToggle" class="lang-toggle">English</button>
    </div>
  </header>

  <section class="hero">
    <div class="hero-slides">${bannerHTML}</div>
    <div class="hero-overlay">
      <h1 id="heroTitle">${escapeHtml(heroText)}</h1>
      <a href="shop.html" class="cta-btn" id="ctaBtn">শপ করুন</a>
    </div>
  </section>

  <section class="section">
    <h2 id="categoriesTitle">ক্যাটাগরি</h2>
    <div class="category-grid">${categoryHTML || '<p class="muted">কোনো ক্যাটাগরি নেই</p>'}</div>
  </section>

  <section class="section">
    <h2 id="featuredTitle">ফিচার্ড প্রোডাক্ট</h2>
    <div class="product-grid">${productHTML || '<p class="muted">কোনো প্রোডাক্ট নেই</p>'}</div>
  </section>

  <footer class="site-footer">
    <div class="footer-inner">
      <span id="footerShopName">${escapeHtml(shopName)}</span> © <span id="footerYear"></span>
      <div class="footer-links">
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="privacy-policy.html">Privacy Policy</a>
      </div>
    </div>
  </footer>

  <script>
    // =========================================================
    // 🔥 ট্রান্সলেশন (বাংলা/ইংরেজি) – রিলোড ছাড়াই কাজ করবে
    // =========================================================
    const translations = {
      bn: {
        home: "হোম",
        shop: "শপ",
        cart: "কার্ট",
        login: "লগইন",
        shop_now: "শপ করুন",
        categories: "ক্যাটাগরি",
        featured: "ফিচার্ড প্রোডাক্ট"
      },
      en: {
        home: "Home",
        shop: "Shop",
        cart: "Cart",
        login: "Login",
        shop_now: "Shop Now",
        categories: "Categories",
        featured: "Featured Products"
      }
    };

    function getLang() {
      return localStorage.getItem('siteLang') || 'bn';
    }

    function setLang(lang) {
      localStorage.setItem('siteLang', lang);
    }

    function applyTranslations() {
      const lang = getLang();
      const t = translations[lang] || translations.bn;
      document.getElementById('navHome').textContent = t.home;
      document.getElementById('navShop').textContent = t.shop;
      document.getElementById('navCart').textContent = t.cart;
      document.getElementById('navLogin').textContent = t.login;
      document.getElementById('ctaBtn').textContent = t.shop_now;
      document.getElementById('categoriesTitle').textContent = t.categories;
      document.getElementById('featuredTitle').textContent = t.featured;
      document.getElementById('langToggle').textContent = lang === 'bn' ? 'English' : 'বাংলা';
    }

    document.getElementById('langToggle').addEventListener('click', function() {
      const newLang = getLang() === 'bn' ? 'en' : 'bn';
      setLang(newLang);
      applyTranslations();
      updateBadge();
    });

    function updateBadge() {
      const badge = document.getElementById('cartBadge');
      if (!badge) return;
      try {
        const cart = JSON.parse(localStorage.getItem('localCart') || '[]');
        const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      } catch(e) {}
    }

    document.addEventListener('DOMContentLoaded', function() {
      applyTranslations();
      updateBadge();
      document.getElementById('footerYear').textContent = new Date().getFullYear();
    });
  <\/script>
</body>
</html>`;
}

// ============================================================
// ৩. sitemap ও llms.txt
// ============================================================
function buildSitemap(products) {
  const staticPages = [
    "", "shop.html", "about.html", "contact.html",
    "privacy-policy.html", "terms.html", "return-refund-policy.html"
  ];
  const urls = staticPages.map((p) => `${SITE_URL}/${p}`);
  products.forEach((p) => urls.push(`${SITE_URL}/product/${p.id}.html`));

  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildLlmsTxt(settings, categories, products) {
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";
  const desc = settings.heroText_en || settings.heroText_bn || "";
  const categoryLines = categories
    .map((c) => `- ${c.name_en || c.name_bn}: ${SITE_URL}/shop.html?category=${c.slug}`)
    .join("\n");

  return (
    `# ${shopName}\n\n${desc}\n\n` +
    `## Pages\n- Shop: ${SITE_URL}/shop.html\n- About: ${SITE_URL}/about.html\n- Contact: ${SITE_URL}/contact.html\n\n` +
    `## Categories\n${categoryLines}\n\n` +
    `## Products\n${products.length} products available. See sitemap.xml for the full list.\n`
  );
}

// ============================================================
// ৪. মেইন ফাংশন
// ============================================================
async function main() {
  console.log("🚀 স্ট্যাটিক পেজ জেনারেট করা শুরু...");

  const [products, settings, categories] = await Promise.all([
    fetchAllProducts(),
    fetchSettings(),
    fetchCategories()
  ]);

  console.log(`📦 প্রোডাক্ট: ${products.length}, ক্যাটাগরি: ${categories.length}`);
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";

  // --- ১. প্রোডাক্ট পেজ ---
  const productDir = path.join(ROOT, "product");
  await fs.mkdir(productDir, { recursive: true });

  const rawTemplate = await fs.readFile(path.join(ROOT, "product.html"), "utf-8");
  const fixedTemplate = fixTemplateDepth(rawTemplate);

  for (const product of products) {
    const html = buildProductPage(fixedTemplate, product, shopName);
    await fs.writeFile(path.join(productDir, `${product.id}.html`), html, "utf-8");
  }
  console.log("✅ প্রোডাক্ট পেজ তৈরি হয়েছে");

  // --- ২. ইনডেক্স পেজ (index1.html থেকে) ---
  const indexHTML = await buildIndexPageFromTemplate(settings, categories, products);
  await fs.writeFile(path.join(ROOT, "index.html"), indexHTML, "utf-8");
  console.log("✅ index.html (স্ট্যাটিক) তৈরি হয়েছে – index1.html টেমপ্লেট থেকে");

  // --- ৩. shop.html ডায়নামিক থাকবে ---
  console.log("⏩ shop.html ডায়নামিক ভার্সনেই থাকবে (জেনারেট করা হয়নি)");

  // --- ৪. sitemap.xml ---
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), buildSitemap(products), "utf-8");
  console.log("✅ sitemap.xml তৈরি হয়েছে");

  // --- ৫. llms.txt ---
  await fs.writeFile(path.join(ROOT, "llms.txt"), buildLlmsTxt(settings, categories, products), "utf-8");
  console.log("✅ llms.txt তৈরি হয়েছে");

  console.log("🎉 সব পেজ তৈরি সম্পন্ন!");
  console.log("📌 index1.html (ডায়নামিক) → index.html (স্ট্যাটিক) তৈরি হয়েছে!");
}

main().catch((err) => {
  console.error("❌ বিল্ড ফেইল:", err);
  process.exit(1);
});
