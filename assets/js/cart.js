// আপাতত লোকাল (localStorage) কার্ট — লগইন করা ইউজারের জন্য Firestore sync
// account.html/cart.html বানানোর সময় যুক্ত হবে।

const CART_KEY = "localCart";

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

export function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.qty || 1), 0);
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((i) => i.productId === item.productId && i.variantCode === item.variantCode);
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({ ...item, qty: item.qty || 1 });
  }
  saveCart(cart);
  return cart;
}

export function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-flex" : "none";
}