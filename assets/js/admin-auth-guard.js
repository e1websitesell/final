// admin-auth-guard.js
// =====================================================
// প্রতিটা অ্যাডমিন পেজে এই একই মডিউল ইউজ হবে, যাতে
// অথেনটিকেশন/অ্যাডমিন-চেক লজিক বার বার আলাদাভাবে লিখতে
// না হয় (এক জায়গায় বাগ ফিক্স করলে সব পেজে ফিক্স হয়ে যাবে)
// =====================================================

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * এই ফাংশনটা একটা Promise রিটার্ন করে যা ভেরিফাইড অ্যাডমিন
 * ইউজার অবজেক্ট দিয়ে রিজলভ হয়। অ্যাডমিন না হলে / লগইন না
 * থাকলে অটোমেটিক login.html-এ রিডাইরেক্ট করে দেয় এবং
 * Promise কখনো রিজলভ হয় না (পেজের বাকি কোড আর চলবে না)।
 */
export function requireAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (adminSnap.exists()) {
          resolve(user);
        } else {
          await signOut(auth);
          window.location.href = "login.html";
        }
      } catch (err) {
        // Firestore রিড ফেইল করলে (পারমিশন/নেটওয়ার্ক ইস্যু) সেফ সাইডে থেকে লগইনে পাঠানো
        window.location.href = "login.html";
      }
    });
  });
}

export async function adminLogout() {
  await signOut(auth);
  window.location.href = "login.html";
}
