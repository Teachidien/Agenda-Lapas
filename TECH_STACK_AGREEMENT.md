# Dokumen Perencanaan Tech Stack & Persiapan Environment
**Aplikasi:** Pencatatan Agenda (Internal Organisasi / Lapas)

---

## 1. Ringkasan Kesepakatan Tech Stack

| Komponen | Teknologi yang Dipilih | Keterangan |
| :--- | :--- | :--- |
| **Penggunaan** | Internal Organisasi | Fokus pada keamanan akses, role user, serta manajemen agenda internal. |
| **Frontend Framework** | **Vite + React (TypeScript)** | Pemilihan stack modern, cepat, dan ringan. |
| **Styling & UI** | **Tailwind CSS / Vanilla CSS** | Desain UI modern dan responsif (dapat menggunakan panduan/inspirasi Stitch AI). |
| **Database** | **Google Cloud Firestore** | Database NoSQL real-time dari Firebase. |
| **Backend / Auth** | **Firebase Auth** | Autentikasi user internal. |
| **Hosting** | **Firebase Hosting** | Hosting cepat, aman (HTTPS otomatis), dan terintegrasi penuh. |
| **CI / CD** | **GitHub Actions + Firebase Hosting Action** | Deployment otomatis setiap kali ada push/PR ke repository GitHub. |

---

## 2. Kebutuhan Tools & Software yang Harus Diinstall

Karena komputer ini belum memiliki peranti pengembangan, berikut tools yang akan dipasang:

1. **Git** (Version Control System)
2. **Node.js (LTS Version)** & **npm** (JavaScript Runtime & Package Manager)
3. **Firebase CLI** (`firebase-tools` via npm)

---

## 3. Langkah Selanjutnya (Action Plan)

1. Mengunduh dan menginstall Node.js & Git menggunakan `winget` di PowerShell.
2. Memverifikasi instalasi Node.js, npm, dan Git.
3. Inisialisasi project **Vite + React** di project ini (`d:\aplikasi agenda lapas`).
4. Install **Firebase CLI** dan integrasi Firebase.
5. Konfigurasi **GitHub Actions** (`.github/workflows/deploy.yml`) untuk CI/CD otomatis ke Firebase Hosting saat ada update kode di repository GitHub.
