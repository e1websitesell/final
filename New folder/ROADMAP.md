# ই-কমার্স ওয়েবসাইট — মাস্টার রোডম্যাপ

> এই ফাইলটাই মেইন রেফারেন্স। কোড লেখার সময় কোনো ফিচার/ডিসিশন ভুলে গেলে এখানে ফিরে দেখতে হবে।

## ০. কোর ফিলোসফি
- **জেনেরিক টেমপ্লেট** — JIRO পারফিউম-স্পেসিফিক না, যেকোনো প্রোডাক্টের জন্য কপি-পেস্ট করে রিইউজ করা যাবে। নতুন শপ চালু করতে শুধু `firebase-config.js` + `settings/site` ডকুমেন্ট চেঞ্জ করলেই হবে।
- **হোস্টিং খরচ প্রায় শূন্য**: GitHub Pages (স্ট্যাটিক, ফ্রি) + Firebase ফ্রি টায়ার (Auth + Firestore)।
- **পেমেন্ট গেটওয়ে নাই** — সিকিউরিটি রিস্ক এড়াতে। অর্ডার ফ্লো: কাস্টমার "Order" চাপলে WhatsApp/Messenger-এ রিডাইরেক্ট হবে প্রোডাক্ট কোড সহ প্রি-ফিল্ড মেসেজ নিয়ে।
- **বাজেট-সচেতন**: যেখানে সম্ভব পেইড সার্ভিস এড়িয়ে ফ্রি/ক্লায়েন্ট-সাইড সলিউশন (যেমন Fuse.js সার্চ, Cloudinary ফ্রি টিয়ার)।

## ১. টেক স্ট্যাক
| স্তর | টুল |
|---|---|
| Hosting | GitHub Pages |
| Database / Auth | Firebase Firestore + Firebase Authentication |
| Image hosting | Cloudinary (ফ্রি টিয়ার, অটো-অপ্টিমাইজ/রিসাইজ) |
| সার্চ | Fuse.js (ক্লায়েন্ট-সাইড fuzzy search) |
| CSV পার্সিং | PapaParse |
| স্ট্যাটিক পেজ বিল্ড | GitHub Actions (cron, প্রতি ১৫-২০ মিনিট) |
| Analytics | Google Analytics (GA4) + Meta Pixel |

## ২. ফোল্ডার ও পেজ স্ট্রাকচার
```
shop-template/
├── index.html                  # হোমপেজ
├── shop.html                    # সব প্রোডাক্ট + সার্চ + ক্যাটাগরি ফিল্টার
├── product/                     # GitHub Action বিল্ড স্ক্রিপ্ট জেনারেট করবে প্রতিটার static page
│   └── {productSlug}.html
├── cart.html
├── login.html
├── account.html
├── about.html
├── contact.html
├── privacy-policy.html
├── terms.html
├── return-refund-policy.html
├── sitemap.xml                  # অটো-জেনারেটেড
├── robots.txt
├── llms.txt
├── CNAME                         # ডোমেইন কেনার পর যুক্ত হবে
│
├── admin/
│   ├── login.html
│   ├── dashboard.html            # পেন্ডিং অর্ডার লিস্ট, কুইক স্ট্যাটস
│   ├── products.html             # ম্যানুয়াল অ্যাড/এডিট/ডিলিট (ভ্যারিয়েন্ট সহ)
│   ├── upload-csv.html           # বাল্ক আপলোড
│   ├── categories.html
│   ├── coupons.html
│   ├── reviews.html              # মডারেশন (ডিলিট অনুপযুক্ত রিভিউ)
│   └── settings.html             # থিম, ডেলিভারি জোন, শপ ইনফো, ভাষা ডিফল্ট
│
├── assets/
│   ├── css/style.css
│   ├── js/
│   │   ├── firebase-config.js     # শপ-স্পেসিফিক, এটাই সোয়াপ করলে নতুন শপ
│   │   ├── translations.js        # BN/EN স্ট্রিং
│   │   ├── themes.js              # প্রিসেট থিম কনফিগ
│   │   ├── search.js              # Fuse.js লজিক
│   │   ├── cart.js
│   │   └── auth.js
│   └── images/ (ফলব্যাক, মূল ইমেজ Cloudinary-তে)
│
├── scripts/
│   └── build-static-pages.js     # প্রোডাক্ট পেজ + sitemap জেনারেট করে
│
└── .github/workflows/
    └── rebuild.yml                # cron শিডিউল
```

## ৩. Firestore স্কিমা

### `products/{productId}`
| ফিল্ড | টাইপ | নোট |
|---|---|---|
| name_bn, name_en | string | |
| description_bn, description_en | string | |
| basePrice | number | BDT |
| discountPrice | number | অপশনাল |
| category | string | categories-এর slug |
| images | array<string> | Cloudinary URL |
| tags | array<string> | সার্চ সাহায্যের জন্য |
| hasVariants | boolean | |
| variants | array<object> | `{variantName, productCode, priceOverride, inStock}` |
| avgRating | number | reviews থেকে ক্যালকুলেটেড |
| reviewCount | number | |
| createdAt | timestamp | |

ভ্যারিয়েন্ট না থাকলে `hasVariants: false`, productId নিজেই ডিফল্ট কোড হিসেবে ইউজ হবে।

### `products/{productId}/reviews/{reviewId}`
- userId, userName, rating (1-5), comment, createdAt
- ক্লায়েন্ট-সাইড ট্রানজেকশনে প্রোডাক্টের avgRating/reviewCount আপডেট হবে নতুন রিভিউ এলে

### `categories/{categoryId}`
- name_bn, name_en, slug, imageUrl

### `users/{uid}`
- name, phone, email
- সাব: `users/{uid}/cart/{cartItemId}` → `{productId, variantCode, variantName, quantity, priceSnapshot}`

### `admins/{uid}`
- `{ role: "admin" }` — ক্লায়েন্ট থেকে রাইট ব্লকড, Firebase Console থেকে ম্যানুয়াল অ্যাড

### `coupons/{couponCode}`
- **ডকুমেন্ট আইডি = কুপন কোড নিজেই** (যেমন `coupons/SAVE10`) — এতে ক্লায়েন্ট থেকে নির্দিষ্ট কোড `get` করে ভ্যালিডেট করা যাবে, কিন্তু পুরো কালেকশন `list` করে সব কোড দেখে ফেলা যাবে না (সিকিউরিটি রুলসে `list` শুধু অ্যাডমিনের জন্য)
- ফিল্ড: discountType ("percentage"/"fixed"), discountValue, minOrderAmount, expiryDate, usageLimit, active

### `orders/{orderId}` (অর্ডার লগ, পেমেন্ট না হলেও ট্র্যাকিংয়ের জন্য)
- items: array of `{productId, productName, variantCode, variantName, qty, price}` — **প্রোডাক্ট/ভ্যারিয়েন্টের নাম অর্ডারের সময় স্ন্যাপশট নিয়ে রাখা হবে**, যাতে পরে প্রোডাক্ট এডিট/ডিলিট হলেও পুরোনো অর্ডার হিস্ট্রি ঠিক থাকে
- totalAmount, couponCode, status: "pending"/"completed"/"cancelled", customerUid (অপশনাল), createdAt

### `settings/site` (একটাই ডকুমেন্ট)
- shopName_bn, shopName_en, whatsappNumber, facebookPageLink, logoUrl
- activeTheme (preset key বা "custom1"/"custom2"), customPresets: `{custom1: {...}, custom2: {...}}`
- currency: "BDT"
- deliveryZones: array of `{zoneName, charge}`
- defaultLanguage: "bn"/"en"

## ৪. থিম সিস্টেম
- ৪-৫ বিল্ট-ইন প্রিসেট (Minimal, Modern, Premium/Luxury, Bold/Colorful + ১টা) — `themes.js`-এ ফিক্সড কোড
- গ্রানুলার কন্ট্রোল: প্রাইমারি/অ্যাকসেন্ট কালার, ফন্ট পেয়ার, বাটন শেইপ, হোমপেজ লেআউট
- ২টা কাস্টম স্লট — গ্রানুলার কন্ট্রোল দিয়ে বানানো লুক `settings/site.customPresets`-এ সেভ করা যাবে, পরে এক ক্লিকে রিইউজ

## ৫. বিলিংগুয়াল (BN/EN)
- হেডারে টগল বাটন, `translations.js`-এ সব স্ট্রিং, পছন্দ localStorage-এ সেভ

## ৬. কোর ফিচার চেকলিস্ট
- [ ] CSV বাল্ক প্রোডাক্ট আপলোড
- [ ] Fuzzy search (বানান ভুলেও রেজাল্ট)
- [ ] ক্যাটাগরি ফিল্টার
- [ ] কার্ট (ভ্যারিয়েন্ট-অ্যাওয়্যার, localStorage + Firestore sync)
- [ ] কাস্টমার অ্যাকাউন্ট (Firebase Auth)
- [ ] রিভিউ/রেটিং + অ্যাডমিন মডারেশন
- [ ] কুপন কোড (কার্টে অ্যাপ্লাই, WhatsApp মেসেজে ফাইনাল টোটাল)
- [ ] ডেলিভারি জোন-ভিত্তিক চার্জ (অ্যাডমিন কনফিগারেবল)
- [ ] অর্ডার লগিং (pending status, অ্যাডমিন ড্যাশবোর্ডে দেখা যাবে)
- [ ] লিগ্যাল পেজ (Privacy/Terms/Return Policy/About/Contact)

## ৭. SEO + GEO প্ল্যান
- **মূল ইস্যু**: AI ক্রলার (GPTBot, PerplexityBot, ClaudeBot) সাধারণত JS রান করে না, তাই প্রোডাক্ট পেজ স্ট্যাটিক HTML হতে হবে
- **সমাধান**: GitHub Action (১৫-২০ মিনিট পর পর) Firestore থেকে ডেটা পড়ে প্রতিটা প্রোডাক্টের static HTML + sitemap.xml জেনারেট করবে
- `robots.txt`: Googlebot, Bingbot + GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot অ্যালাও
- `llms.txt`: সাইট ওভারভিউ, AI সিস্টেমের জন্য
- Schema (JSON-LD): Product + AggregateRating, Organization, BreadcrumbList, FAQPage
- Google Search Console: `<head>`-এ মেটা ট্যাগ ভেরিফিকেশন

## ৮. Firestore সিকিউরিটি রুলস (মূল আইডিয়া)
- `products`, `categories`, `settings`, `coupons` → পাবলিক read, অ্যাডমিন-only write
- `users/{uid}` → শুধু নিজের ডেটা read/write
- `admins` → ক্লায়েন্ট write সম্পূর্ণ ব্লকড
- `reviews` → authenticated ইউজার write করতে পারবে নিজের রিভিউ, ডিলিট নিজের বা অ্যাডমিনের
- `orders` → কাস্টমার নিজের অর্ডার পড়তে পারবে, অ্যাডমিন সবগুলো পড়তে/আপডেট করতে পারবে

## ৯. পেন্ডিং/বাকি
- ডোমেইন এখনো কেনা হয়নি — কেনার পর `CNAME` ফাইল + DNS রেকর্ড + Search Console ভেরিফিকেশন করতে হবে
- লিগ্যাল পেজের আসল কন্টেন্ট জেনেরিক টেমপ্লেট টেক্সট দিয়ে শুরু হবে, পরে কাস্টমাইজ করা যাবে

## ১০. বিল্ড অর্ডার (কোডিং সিকোয়েন্স)
1. Firebase প্রজেক্ট + ফোল্ডার স্ট্রাকচার + `firebase-config.js`
2. Firestore সিকিউরিটি রুলস
3. অ্যাডমিন লগইন + প্রোডাক্ট CRUD (ম্যানুয়াল)
4. CSV বাল্ক আপলোড
5. কাস্টমার-ফেসিং: হোম, শপ, প্রোডাক্ট পেজ (থিম সিস্টেম সহ)
6. সার্চ + ক্যাটাগরি ফিল্টার
7. কার্ট + WhatsApp checkout ফ্লো
8. কাস্টমার অ্যাকাউন্ট (Firebase Auth)
9. রিভিউ + কুপন সিস্টেম
10. লিগ্যাল পেজ + ডেলিভারি সেটিংস
11. SEO/GEO: বিল্ড স্ক্রিপ্ট, sitemap, robots.txt, llms.txt, schema markup
12. Analytics ইন্টিগ্রেশন
13. পলিশ, রেসপনসিভ টেস্টিং, লঞ্চ
