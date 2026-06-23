
const CLOUDINARY_ACCOUNTS = {
  account1: {
    cloudName: "dj4uyo4rv",
    uploadPreset: "webweb",
    isActive: true  // ← এখানে true/false দিয়ে কন্ট্রোল করুন
  },
  account2: {
    cloudName: "your_second_cloud_name",
    uploadPreset: "your_second_preset",
    isActive: false   // ← এখানে true/false দিয়ে কন্ট্রোল করুন
  },
  account3: {
    cloudName: "your_third_cloud_name",
    uploadPreset: "your_third_preset",
    isActive: false   // ← এখানে true/false দিয়ে কন্ট্রোল করুন
  }
};

// active অ্যাকাউন্ট খুঁজে বের করুন
function getActiveAccount() {
  for (const key in CLOUDINARY_ACCOUNTS) {
    if (CLOUDINARY_ACCOUNTS[key].isActive) {
      return CLOUDINARY_ACCOUNTS[key];
    }
  }
  return CLOUDINARY_ACCOUNTS.account1; // fallback
}

const active = getActiveAccount();
export const CLOUDINARY_CLOUD_NAME = active.cloudName;
export const CLOUDINARY_UPLOAD_PRESET = active.uploadPreset;