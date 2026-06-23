// Firebase কনফিগারেশন
// =====================================================
// Firebase Console > Project Settings > General > Your apps
// থেকে firebaseConfig অবজেক্টটা কপি করে নিচে পেস্ট করুন।
//
// IMPORTANT: নতুন শপের জন্য টেমপ্লেট রিইউজ করতে চাইলে
// শুধু এই ফাইলটা বদলে নতুন Firebase প্রজেক্টের কনফিগ দিলেই
// পুরো সাইট নতুন শপের ডেটাবেসে চলে যাবে। অন্য কোনো ফাইল
// বদলাতে হবে না।
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBkelhixQrQuf_1C57SnA8nM4oeFPYxauw",
  authDomain: "website-bd41c.firebaseapp.com",
  projectId: "website-bd41c",
  storageBucket: "website-bd41c.firebasestorage.app",
  messagingSenderId: "210806766574",
  appId: "1:210806766574:web:ebeeae0547995447332cff"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);