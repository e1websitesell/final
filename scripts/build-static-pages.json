// Firestore থেকে প্রোডাক্ট ডেটা পড়ে প্রতিটার জন্য static HTML পেজ বানায়
// (product/{id}.html), আর sitemap.xml + llms.txt আপডেট করে।
// GitHub Action থেকে অটোমেটিক চলে।

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ডোমেইন কেনার পর এটা বদলে দিন
const SITE_URL = "https://e1websitesell.github.io/final/";

// product/{id}.html ফোল্ডারের ভিতরে থাকবে (রুট থেকে এক লেভেল গভীরে),
// তাই product.html টেমপ্লেটের রুট-রিলেটিভ লিংক/ইমপোর্ট পাথগুলোয়
// "../" প্রিফিক্স যুক্ত করতে হবে — নাহলে হোম/শপ লিংক আর Firebase
// কনফিগ ইমপোর্ট ভুল জায়গায় খুঁজবে।
const ROOT_PAGES = [
  "index.html", "shop.html", "cart.html", "login.html", "account.html",
  "about.html", "contact.html", "privacy-policy.html", "terms.html", "return-refund-policy.html"
];

function fixTemplateDepth(html) {
  let fixed = html;
  // <script type="module"> এর ভিতরের ইমপোর্ট পাথ ঠিক করা
  fixed = fixed.replace(/from\s+"\.\/assets\//g, 'from "../assets/');
  // নেভ/ফুটার লিংক ঠিক করা
  ROOT_PAGES.forEach((page) => {
    fixed = fixed.split(`href="${page}`).join(`href="../${page}`);
  });
  return fixed;
}

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
    console.error("settings লোড করতে সমস্যা হয়েছে:", e);
    return {};
  }
}

async function fetchCategories() {
  const snap = await getDocs(collection(db, "categories"));
  const categories = [];
  snap.forEach((d) => categories.push({ id: d.id, ...d.data() }));
  return categories;
}

function buildProductSchema(product) {
  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name_en || product.name_bn,
    description: product.description_en || product.description_bn || "",
    image: product.images || [],
    sku: product.id,
    offers: {
      "@type": "Offer",
      price: product.discountPrice || product.basePrice,
      priceCurrency: "BDT",
      availability: "https://schema.org/InStock"
    }
  };
  if (product.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.avgRating || 0,
      reviewCount: product.reviewCount
    };
  }
  return schema;
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

  const schemaJson = JSON.stringify(buildProductSchema(product)).replace(/</g, "\\u003c");
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

async function main() {
  console.log("Fetching data from Firestore...");
  const [products, settings, categories] = await Promise.all([
    fetchAllProducts(),
    fetchSettings(),
    fetchCategories()
  ]);
  console.log(`Found ${products.length} products.`);

  const shopName = settings.shopName_en || settings.shopName_bn || "Shop";
  const rawTemplate = await fs.readFile(path.join(ROOT, "product.html"), "utf-8");
  const fixedTemplate = fixTemplateDepth(rawTemplate);

  const productDir = path.join(ROOT, "product");
  await fs.mkdir(productDir, { recursive: true });

  for (const product of products) {
    const html = buildProductPage(fixedTemplate, product, shopName);
    await fs.writeFile(path.join(productDir, `${product.id}.html`), html, "utf-8");
  }
  console.log("Static product pages written.");

  await fs.writeFile(path.join(ROOT, "sitemap.xml"), buildSitemap(products), "utf-8");
  console.log("sitemap.xml written.");

  await fs.writeFile(path.join(ROOT, "llms.txt"), buildLlmsTxt(settings, categories, products), "utf-8");
  console.log("llms.txt written.");
}

main().catch((err) => {
  console.error("Build script failed:", err);
  process.exit(1);
});