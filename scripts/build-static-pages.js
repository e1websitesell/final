// scripts/build-static-pages.js
// =====================================================
// স্ট্যাটিক পেজ জেনারেটর – প্রোডাক্ট + ইনডেক্স + শপ
// GitHub Action প্রতি ২০ মিনিটে রান করবে
// =====================================================

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SITE_URL = "https://e1websitesell.github.io/final"; // আপনার URL

// =============================================
// ১. ফায়ারবেস কনফিগ ও হেল্পার (আগের মতো)
// =============================================
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

// =============================================
// ২. ডেটা ফেচ (আগের মতো)
// =============================================
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

// =============================================
// ৩. প্রোডাক্ট পেজ বিল্ড (✅ সম্পূর্ণ অপরিবর্তিত – আপনার আগের কোড)
// =============================================
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

  // প্রোডাক্ট ডিটেইল ইনজেক্ট (আপনার আগের কোডের মতো)
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

// =============================================
// ৪. ইনডেক্স পেজ বিল্ড (নতুন – স্ট্যাটিক)
// =============================================
function buildIndexPage(settings, categories, products) {
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";
  const heroText = settings.heroText_en || settings.heroText_bn || "";
  const bannerImages = settings.bannerImages || [];

  const categoryHTML = categories.map(c => {
    const name = c.name_bn || c.name_en || c.slug;
    return `<a href="shop.html?category=${encodeURIComponent(c.slug)}" class="category-card" style="background-image:url('${escapeHtml(c.imageUrl || '')}')"><span>${escapeHtml(name)}</span></a>`;
  }).join('');

  const productHTML = products.slice(0, 8).map(p => {
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
  }).join('');

  const bannerHTML = bannerImages.map((url, i) =>
    `<div class="hero-slide ${i === 0 ? 'active' : ''}" style="background-image:url('${escapeHtml(url)}')"></div>`
  ).join('');

  // CSS ও HTML স্ট্রাকচার (আপনার index.html-এর মতো)
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
        <span>${escapeHtml(shopName)}</span>
      </a>
      <nav class="main-nav">
        <a href="index.html">হোম</a>
        <a href="shop.html">শপ</a>
        <a href="cart.html" class="cart-link">
          <span>কার্ট</span>
          <span id="cartBadge" class="cart-badge" style="display:none;">0</span>
        </a>
        <a href="login.html">লগইন</a>
      </nav>
      <button id="langToggle" class="lang-toggle">English</button>
    </div>
  </header>

  <section class="hero">
    <div class="hero-slides">${bannerHTML}</div>
    <div class="hero-overlay">
      <h1>${escapeHtml(heroText)}</h1>
      <a href="shop.html" class="cta-btn">শপ করুন</a>
    </div>
  </section>

  <section class="section">
    <h2>ক্যাটাগরি</h2>
    <div class="category-grid">${categoryHTML || '<p class="muted">কোনো ক্যাটাগরি নেই</p>'}</div>
  </section>

  <section class="section">
    <h2>ফিচার্ড প্রোডাক্ট</h2>
    <div class="product-grid">${productHTML || '<p class="muted">কোনো প্রোডাক্ট নেই</p>'}</div>
  </section>

  <footer class="site-footer">
    <div class="footer-inner">
      <span>${escapeHtml(shopName)} © ${new Date().getFullYear()}</span>
      <div class="footer-links">
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="privacy-policy.html">Privacy Policy</a>
      </div>
    </div>
  </footer>

  <script>
    // কার্ট ব্যাজ
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
    updateBadge();
    // ভাষা টগল
    document.getElementById('langToggle')?.addEventListener('click', () => {
      const lang = localStorage.getItem('siteLang') === 'bn' ? 'en' : 'bn';
      localStorage.setItem('siteLang', lang);
      location.reload();
    });
  </script>
</body>
</html>`;
}

// =============================================
// ৫. শপ পেজ বিল্ড (নতুন – স্ট্যাটিক)
// =============================================
function buildShopPage(products, categories, settings) {
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";

  const categoryPills = categories.map(c => {
    const name = c.name_bn || c.name_en || c.slug;
    return `<button type="button" class="pill" data-slug="${escapeHtml(c.slug)}">${escapeHtml(name)}</button>`;
  }).join('');

  const productHTML = products.map(p => {
    const name = p.name_bn || p.name_en || "Product";
    const img = (p.images && p.images[0]) || "";
    const price = p.discountPrice
      ? `<span class="price-now">৳${p.discountPrice}</span> <span class="price-old">৳${p.basePrice}</span>`
      : `<span class="price-now">৳${p.basePrice}</span>`;
    const stars = p.avgRating ? "★".repeat(Math.round(p.avgRating)) : "";
    const addBtn = !p.hasVariants
      ? `<button type="button" class="quick-add" data-id="${p.id}">কার্টে যুক্ত করুন</button>`
      : '';
    return `<div class="product-card-wrap">
      <a href="product/${p.id}.html" class="product-card">
        <div class="product-img" style="background-image:url('${escapeHtml(img)}')"></div>
        <div class="product-info">
          <div class="product-name">${escapeHtml(name)}</div>
          ${stars ? `<div class="product-stars">${stars}</div>` : ''}
          <div class="product-price">${price}</div>
        </div>
      </a>
      ${addBtn}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>শপ — ${escapeHtml(shopName)}</title>
<meta name="description" content="সব প্রোডাক্ট এক জায়গায়">
<link rel="canonical" href="${SITE_URL}/shop.html">
<script src="https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js"></script>
<style>
  /* ====== আপনার shop.html-এর সব CSS ====== */
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
  .page-inner { max-width: 1140px; margin: 0 auto; padding: 32px 20px 60px; }
  .page-title { font-size: 24px; font-weight: 700; margin: 0 0 24px; }
  .filter-bar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .search-box { flex: 1; min-width: 220px; }
  .search-box input { width: 100%; padding: 11px 16px; border: 1px solid var(--line); border-radius: var(--btn-radius); font-size: 14.5px; font-family: inherit; }
  .category-pills { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { border: 1px solid var(--line); background: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13.5px; cursor: pointer; font-family: inherit; }
  .pill.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
  .results-label { font-size: 13px; color: var(--ink-soft); margin-bottom: 18px; min-height: 16px; }
  .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 22px; }
  .product-card-wrap { display: flex; flex-direction: column; gap: 8px; }
  .product-img { width: 100%; height: 200px; border-radius: 10px; background-size: cover; background-position: center; background-color: var(--bg); }
  .product-info { padding-top: 4px; }
  .product-name { font-size: 14.5px; font-weight: 600; margin-bottom: 4px; }
  .product-stars { color: #d97706; font-size: 12.5px; margin-bottom: 4px; }
  .price-now { font-weight: 700; color: var(--ink); }
  .price-old { text-decoration: line-through; color: var(--ink-soft); font-size: 13px; margin-left: 6px; }
  .quick-add { border: 1px solid var(--line); background: #fff; color: var(--primary-color); padding: 8px; border-radius: var(--btn-radius); font-size: 13px; cursor: pointer; font-family: inherit; }
  .quick-add:hover { background: var(--bg); }
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
        <span>${escapeHtml(shopName)}</span>
      </a>
      <nav class="main-nav">
        <a href="index.html">হোম</a>
        <a href="shop.html">শপ</a>
        <a href="cart.html" class="cart-link">
          <span>কার্ট</span>
          <span id="cartBadge" class="cart-badge" style="display:none;">0</span>
        </a>
        <a href="login.html">লগইন</a>
      </nav>
      <button id="langToggle" class="lang-toggle">English</button>
    </div>
  </header>

  <main class="page-inner">
    <h1 class="page-title">শপ</h1>
    <div class="filter-bar">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="প্রোডাক্ট খুঁজুন...">
      </div>
    </div>
    <div class="category-pills" id="categoryPills">
      <button type="button" class="pill active" data-slug="">সব</button>
      ${categoryPills}
    </div>
    <div class="results-label" id="resultsLabel"></div>
    <div class="product-grid" id="productGrid">
      ${productHTML || '<p class="muted">কোনো প্রোডাক্ট নেই</p>'}
    </div>
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <span>${escapeHtml(shopName)} © ${new Date().getFullYear()}</span>
      <div class="footer-links">
        <a href="about.html">About</a>
        <a href="contact.html">Contact</a>
        <a href="privacy-policy.html">Privacy Policy</a>
      </div>
    </div>
  </footer>

  <script>
    // ---------- সার্চ, ফিল্টার, কার্ট – ক্লায়েন্ট-সাইড ----------
    const allProducts = ${JSON.stringify(products.map(p => ({
      id: p.id,
      name_bn: p.name_bn || '',
      name_en: p.name_en || '',
      tags: p.tags || [],
      category: p.category || '',
      hasVariants: p.hasVariants || false,
      images: p.images || [],
      basePrice: p.basePrice || 0,
      discountPrice: p.discountPrice || null,
      avgRating: p.avgRating || 0
    })))};

    const fuse = new Fuse(allProducts, {
      keys: ['name_bn', 'name_en', 'tags'],
      threshold: 0.4,
      ignoreLocation: true
    });

    let selectedCategory = new URLSearchParams(location.search).get('category') || '';

    function renderProducts(results) {
      const grid = document.getElementById('productGrid');
      let empty = document.getElementById('productEmpty');
      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'productEmpty';
        empty.className = 'muted';
        empty.style.display = 'none';
        grid.parentNode.appendChild(empty);
      }
      if (results.length === 0) {
        grid.innerHTML = '';
        empty.textContent = 'কোনো প্রোডাক্ট পাওয়া যায়নি।';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      grid.innerHTML = results.map(p => {
        const name = p.name_bn || p.name_en || 'Product';
        const img = (p.images && p.images[0]) || '';
        const price = p.discountPrice
          ? '<span class="price-now">৳' + p.discountPrice + '</span> <span class="price-old">৳' + p.basePrice + '</span>'
          : '<span class="price-now">৳' + p.basePrice + '</span>';
        const stars = p.avgRating ? '★'.repeat(Math.round(p.avgRating)) : '';
        const addBtn = !p.hasVariants
          ? '<button type="button" class="quick-add" data-id="' + p.id + '">কার্টে যুক্ত করুন</button>'
          : '';
        return '<div class="product-card-wrap">' +
          '<a href="product/' + p.id + '.html" class="product-card">' +
            '<div class="product-img" style="background-image:url(' + img + ')"></div>' +
            '<div class="product-info">' +
              '<div class="product-name">' + name + '</div>' +
              (stars ? '<div class="product-stars">' + stars + '</div>' : '') +
              '<div class="product-price">' + price + '</div>' +
            '</div>' +
          '</a>' +
          addBtn +
        '</div>';
      }).join('');

      document.querySelectorAll('.quick-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const product = allProducts.find(p => p.id === btn.dataset.id);
          if (!product) return;
          const name = product.name_bn || product.name_en || 'Product';
          const cart = JSON.parse(localStorage.getItem('localCart') || '[]');
          const existing = cart.find(i => i.productId === product.id && i.variantCode === product.id);
          if (existing) existing.qty += 1;
          else cart.push({ productId: product.id, variantCode: product.id, variantName: '', name, price: product.discountPrice || product.basePrice, image: (product.images && product.images[0]) || '', qty: 1 });
          localStorage.setItem('localCart', JSON.stringify(cart));
          const badge = document.getElementById('cartBadge');
          if (badge) {
            const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
          }
          btn.textContent = 'যুক্ত হয়েছে ✓';
          setTimeout(() => { btn.textContent = 'কার্টে যুক্ত করুন'; }, 1500);
        });
      });
    }

    function applyFilters() {
      const searchTerm = document.getElementById('searchInput').value.trim();
      let results = allProducts;
      if (searchTerm) results = fuse.search(searchTerm).map(r => r.item);
      if (selectedCategory) results = results.filter(p => p.category === selectedCategory);

      const label = document.getElementById('resultsLabel');
      const parts = [];
      const catName = document.querySelector('.pill[data-slug="' + selectedCategory + '"]')?.textContent || '';
      if (selectedCategory && catName) parts.push(catName);
      if (searchTerm) parts.push('সার্চ: ' + searchTerm);
      label.textContent = parts.length ? parts.join(' · ') + ' (' + results.length + ')' : '';
      renderProducts(results);
    }

    document.querySelectorAll('.pill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedCategory = btn.dataset.slug;
        applyFilters();
      });
    });

    document.getElementById('searchInput').addEventListener('input', applyFilters);

    if (selectedCategory) {
      const pill = document.querySelector('.pill[data-slug="' + selectedCategory + '"]');
      if (pill) {
        document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
        pill.classList.add('active');
      }
    }
    applyFilters();

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
    updateBadge();
    document.getElementById('langToggle')?.addEventListener('click', () => {
      const lang = localStorage.getItem('siteLang') === 'bn' ? 'en' : 'bn';
      localStorage.setItem('siteLang', lang);
      location.reload();
    });
  </script>
</body>
</html>`;
}

// =============================================
// ৬. মেইন ফাংশন (প্রোডাক্ট + ইনডেক্স + শপ)
// =============================================
async function main() {
  console.log("🚀 স্ট্যাটিক পেজ জেনারেট করা শুরু...");

  const [products, settings, categories] = await Promise.all([
    fetchAllProducts(),
    fetchSettings(),
    fetchCategories()
  ]);

  console.log(`📦 প্রোডাক্ট: ${products.length}, ক্যাটাগরি: ${categories.length}`);
  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";

  // --- ১. প্রোডাক্ট পেজ (✅ আগের মতোই, টেমপ্লেট ব্যবহার করে) ---
  const productDir = path.join(ROOT, "product");
  await fs.mkdir(productDir, { recursive: true });

  const rawTemplate = await fs.readFile(path.join(ROOT, "product.html"), "utf-8");
  const fixedTemplate = fixTemplateDepth(rawTemplate);

  for (const product of products) {
    const html = buildProductPage(fixedTemplate, product, shopName);
    await fs.writeFile(path.join(productDir, `${product.id}.html`), html, "utf-8");
  }
  console.log("✅ প্রোডাক্ট পেজ তৈরি হয়েছে");

  // --- ২. ইনডেক্স পেজ (নতুন স্ট্যাটিক) ---
  const indexHTML = buildIndexPage(settings, categories, products);
  await fs.writeFile(path.join(ROOT, "index.html"), indexHTML, "utf-8");
  console.log("✅ index.html (স্ট্যাটিক) তৈরি হয়েছে");

  // --- ৩. শপ পেজ (নতুন স্ট্যাটিক) ---
  const shopHTML = buildShopPage(products, categories, settings);
  await fs.writeFile(path.join(ROOT, "shop.html"), shopHTML, "utf-8");
  console.log("✅ shop.html (স্ট্যাটিক) তৈরি হয়েছে");

  // --- ৪. sitemap.xml ---
  const staticPages = ["", "shop.html", "about.html", "contact.html", "privacy-policy.html", "terms.html", "return-refund-policy.html"];
  const urls = staticPages.map(p => `${SITE_URL}/${p}`);
  products.forEach(p => urls.push(`${SITE_URL}/product/${p.id}.html`));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>`;
  await fs.writeFile(path.join(ROOT, "sitemap.xml"), sitemap, "utf-8");
  console.log("✅ sitemap.xml তৈরি হয়েছে");

  // --- ৫. llms.txt ---
  const llms = `# ${shopName}\n\n${settings.heroText_en || settings.heroText_bn || ''}\n\n## Pages\n- Shop: ${SITE_URL}/shop.html\n- About: ${SITE_URL}/about.html\n- Contact: ${SITE_URL}/contact.html\n\n## Categories\n${categories.map(c => `- ${c.name_en || c.name_bn}: ${SITE_URL}/shop.html?category=${c.slug}`).join("\n")}\n\n## Products\n${products.length} products available. See sitemap.xml for the full list.`;
  await fs.writeFile(path.join(ROOT, "llms.txt"), llms, "utf-8");
  console.log("✅ llms.txt তৈরি হয়েছে");

  console.log("🎉 সব পেজ তৈরি সম্পন্ন!");
}

main().catch(err => {
  console.error("❌ বিল্ড ফেইল:", err);
  process.exit(1);
});
