import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword
} from 'firebase/auth';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, getSecondaryAuth } from './services/firebase';
import './App.css';

// ---- TIPE DATA ----
interface Agenda {
  id: string;
  nomorUrut?: number; // Auto generate (1, 2, 3...)
  nomorSurat: string; // Nomor Surat
  tanggal: string; // Tanggal Surat / Agenda (YYYY-MM-DD)
  alamatSurat: string; // Alamat Surat (Tujuan / Pengirim)
  keteranganIsiSurat: string; // Keterangan Isi Surat
  // Properti pendukung / backward compatibility
  date?: string;
  location?: string;
  title?: string;
  description?: string;
  time?: string;
  timeEnd?: string;
  responsible?: string;
  division?: string;
  status?: string;
  createdAt?: any;
}

interface Officer {
  id: string;
  username: string;
  name: string;
  nip?: string;
  division: string;
  role: 'Super Admin' | 'Admin' | 'Petugas';
  status: 'Aktif' | 'Nonaktif';
}

// ---- HELPERS ----
const todayStr = new Date().toISOString().split('T')[0];
const todayDisplay = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();

const divisionColor = (div: string) => {
  if (div === 'KPR') return 'division-tag tag-kpr';
  if (div === 'Pengelolaan') return 'division-tag tag-pengelolaan';
  return 'division-tag tag-pelayan';
};

// ================================================================
// MAIN APP
// ================================================================
export default function App() {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Login form ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // --- Navigation ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'users' | 'reports' | 'guide'>('dashboard');

  // --- Realtime Data ---
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);

  // --- Agenda Filters ---
  const [agendaSearch, setAgendaSearch] = useState('');
  const [agendaTabFilter, setAgendaTabFilter] = useState<'all' | 'today' | 'upcoming' | 'archive'>('all');

  // --- Modals ---
  const [showAddAgendaModal, setShowAddAgendaModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);

  // --- Agenda Form ---
  const emptyAgendaForm = {
    nomorSurat: '',
    tanggal: todayStr,
    alamatSurat: '',
    keteranganIsiSurat: '',
    division: 'KPR'
  };
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);

  // --- User Form ---
  const [userForm, setUserForm] = useState({ username: '', name: '', nip: '', division: 'KPR', role: 'Petugas' as Officer['role'], password: '' });
  const [userCreateLoading, setUserCreateLoading] = useState(false);

  // --- Profile Modal & Security State ---
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', nip: '', division: 'KPR' });
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');

  // ---- Dynamic Logged In Officer Info ----
  const currentUsername = currentUser?.email?.split('@')[0] || '';
  const currentOfficer = officers.find(o => 
    o.username.toLowerCase() === currentUsername.toLowerCase() || 
    (o as any).email === currentUser?.email
  );

  const userDisplayName = currentOfficer?.name || currentUsername || 'Petugas';
  const userRole = currentOfficer?.role || (currentUsername.toLowerCase() === 'glubis' ? 'Super Admin' : 'Petugas');
  const userNip = userRole === 'Super Admin' ? '' : (currentOfficer?.nip || currentUsername.toUpperCase());
  const userDivision = currentOfficer?.division || 'KPR';

  const openProfileModal = () => {
    setProfileForm({
      name: currentOfficer?.name || userDisplayName,
      nip: currentOfficer?.nip || (userNip.startsWith('NIP.') ? userNip.replace('NIP.', '').trim() : userNip),
      division: currentOfficer?.division || userDivision
    });
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    setPasswordSuccessMsg('');
    setPasswordErrorMsg('');
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveLoading(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');
    try {
      if (currentOfficer) {
        await updateDoc(doc(db, 'officers', currentOfficer.id), {
          name: profileForm.name,
          nip: profileForm.nip,
          division: profileForm.division
        });
      } else {
        await addDoc(collection(db, 'officers'), {
          username: currentUsername,
          name: profileForm.name,
          nip: profileForm.nip,
          division: profileForm.division,
          role: userRole,
          email: currentUser?.email,
          status: 'Aktif',
          createdAt: serverTimestamp()
        });
      }
      setProfileSuccessMsg('✅ Profil berhasil diperbarui!');
    } catch (err: any) {
      setProfileErrorMsg('❌ Gagal memperbarui profil: ' + err.message);
    } finally {
      setProfileSaveLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg('');
    setPasswordSuccessMsg('');
    if (passwordForm.newPassword.length < 6) {
      setPasswordErrorMsg('Password minimal 6 karakter!');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrorMsg('Konfirmasi password tidak cocok!');
      return;
    }
    setPasswordChangeLoading(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, passwordForm.newPassword);
        setPasswordSuccessMsg('✅ Password berhasil diubah!');
        setPasswordForm({ newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPasswordErrorMsg('🔒 Demi keamanan, silakan Logout dan Login kembali sebelum mengubah password.');
      } else {
        setPasswordErrorMsg('❌ Gagal mengubah password: ' + err.message);
      }
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // ---- Firebase Listeners ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { setCurrentUser(user); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'agendas'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda));
      data.sort((a, b) => (a.nomorUrut || 0) - (b.nomorUrut || 0));
      setAgendas(data);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'officers'), orderBy('username', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setOfficers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Officer)));
    });
    return () => unsub();
  }, [currentUser]);

  // ---- Auth Actions ----
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    const email = username.includes('@') ? username : `${username.trim()}@sinora.internal`;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setUsername(''); setPassword('');
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setLoginError('ID User atau Password tidak valid. Silakan coba lagi.');
      } else {
        setLoginError('Terjadi kesalahan: ' + err.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => { try { await signOut(auth); } catch {/* ignore */} };

  // ---- CRUD Agenda ----
  const canModifyAgenda = (a: Agenda) => {
    const creatorUser = ((a as any).createdByUsername || a.responsible || (a as any).createdByName || '').toLowerCase();
    const uname = currentUsername.toLowerCase();
    const dname = userDisplayName.toLowerCase();
    const uid = currentUser?.uid;

    if ((a as any).createdByUid && uid && (a as any).createdByUid === uid) {
      return true;
    }
    return (
      creatorUser === uname ||
      creatorUser === dname ||
      (currentOfficer && creatorUser === currentOfficer.username.toLowerCase())
    );
  };

  const openAddModal = () => {
    setEditingAgenda(null);
    setAgendaForm({ ...emptyAgendaForm });
    setShowAddAgendaModal(true);
  };

  const openEditModal = (a: Agenda) => {
    if (!canModifyAgenda(a)) {
      alert(`❌ Akses Ditolak!\nAgenda ini diinputkan oleh "${(a as any).createdByName || a.responsible || 'pengguna lain'}". Anda hanya dapat mengedit agenda yang Anda inputkan sendiri.`);
      return;
    }
    setEditingAgenda(a);
    setAgendaForm({
      nomorSurat: a.nomorSurat || '',
      tanggal: a.tanggal || a.date || todayStr,
      alamatSurat: a.alamatSurat || a.location || '',
      keteranganIsiSurat: a.keteranganIsiSurat || a.title || a.description || '',
      division: a.division || 'KPR'
    });
    setShowAddAgendaModal(true);
  };

  const saveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAgenda) {
        if (!canModifyAgenda(editingAgenda)) {
          alert('❌ Akses Ditolak! Anda tidak memiliki izin untuk mengedit agenda milik pengguna lain.');
          return;
        }
        await updateDoc(doc(db, 'agendas', editingAgenda.id), {
          nomorSurat: agendaForm.nomorSurat,
          tanggal: agendaForm.tanggal,
          date: agendaForm.tanggal, // sync legacy date
          alamatSurat: agendaForm.alamatSurat,
          location: agendaForm.alamatSurat, // sync legacy location
          keteranganIsiSurat: agendaForm.keteranganIsiSurat,
          title: agendaForm.keteranganIsiSurat, // sync legacy title
          division: agendaForm.division
        });
      } else {
        // Auto generate Nomor Urut
        const nextNoUrut = agendas.length > 0 ? (Math.max(...agendas.map(a => a.nomorUrut || 0)) + 1) : 1;
        await addDoc(collection(db, 'agendas'), {
          nomorUrut: nextNoUrut,
          nomorSurat: agendaForm.nomorSurat,
          tanggal: agendaForm.tanggal,
          date: agendaForm.tanggal,
          alamatSurat: agendaForm.alamatSurat,
          location: agendaForm.alamatSurat,
          keteranganIsiSurat: agendaForm.keteranganIsiSurat,
          title: agendaForm.keteranganIsiSurat,
          division: agendaForm.division,
          responsible: userDisplayName,
          createdByName: userDisplayName,
          createdByUsername: currentUsername,
          createdByUid: currentUser?.uid,
          createdAt: serverTimestamp()
        });
      }
      setShowAddAgendaModal(false);
      setEditingAgenda(null);
    } catch (err: any) { alert('Gagal menyimpan: ' + err.message); }
  };

  const deleteAgenda = async (a: Agenda) => {
    if (!canModifyAgenda(a)) {
      alert(`❌ Akses Ditolak!\nAgenda ini diinputkan oleh "${(a as any).createdByName || a.responsible || 'pengguna lain'}". Anda hanya dapat menghapus agenda yang Anda inputkan sendiri.`);
      return;
    }
    if (window.confirm(`Hapus agenda "${a.nomorSurat || a.keteranganIsiSurat}"?`)) {
      try { await deleteDoc(doc(db, 'agendas', a.id)); } catch (err: any) { alert('Gagal menghapus: ' + err.message); }
    }
  };

  // ---- CRUD Officers ----
  const saveOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.password || userForm.password.length < 6) {
      alert('Password minimal 6 karakter!');
      return;
    }
    setUserCreateLoading(true);
    try {
      // 1. Buat akun Firebase Auth menggunakan secondary app
      const secondaryAuth = getSecondaryAuth();
      const email = `${userForm.username}@sinora.internal`;
      await createUserWithEmailAndPassword(secondaryAuth, email, userForm.password);
      await secondaryAuth.signOut();

      // 2. Simpan profil petugas ke Firestore
      await addDoc(collection(db, 'officers'), {
        username: userForm.username,
        name: userForm.name,
        nip: userForm.nip,
        division: userForm.division,
        role: userForm.role,
        email: email,
        status: 'Aktif',
        createdAt: serverTimestamp()
      });

      setShowAddUserModal(false);
      setUserForm({ username: '', name: '', nip: '', division: 'KPR', role: 'Petugas', password: '' });
      alert(`✅ Akun petugas "${userForm.username}" berhasil dibuat!\nEmail login: ${email}`);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        alert('❌ Username sudah dipakai. Coba username lain.');
      } else {
        alert('❌ Gagal membuat akun: ' + err.message);
      }
    } finally {
      setUserCreateLoading(false);
    }
  };

  const openEditOfficer = (officer: Officer) => {
    setEditingOfficer(officer);
    setUserForm({ username: officer.username, name: officer.name, nip: officer.nip || '', division: officer.division, role: officer.role, password: '' });
    setShowEditUserModal(true);
  };

  const updateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficer) return;
    try {
      await updateDoc(doc(db, 'officers', editingOfficer.id), {
        name: userForm.name,
        nip: userForm.nip,
        division: userForm.division,
        role: userForm.role
      });
      setShowEditUserModal(false);
      setEditingOfficer(null);
      setUserForm({ username: '', name: '', nip: '', division: 'KPR', role: 'Petugas', password: '' });
    } catch (err: any) { alert('❌ Gagal memperbarui: ' + err.message); }
  };

  const deleteOfficer = async (id: string, name: string) => {
    if (!window.confirm(`Hapus akun petugas "${name}"? Akun login mereka tidak ikut terhapus.`)) return;
    try {
      await deleteDoc(doc(db, 'officers', id));
    } catch (err: any) { alert('❌ Gagal menghapus: ' + err.message); }
  };

  // ---- Filtered Agenda ----
  const filteredAgendas = agendas.filter(item => {
    const s = (agendaSearch || '').toLowerCase();
    const tgl = item.tanggal || item.date || '';
    const nomSurat = item.nomorSurat || '';
    const altSurat = item.alamatSurat || item.location || '';
    const ket = item.keteranganIsiSurat || item.title || '';

    const matchSearch = !s || nomSurat.toLowerCase().includes(s) || altSurat.toLowerCase().includes(s) || ket.toLowerCase().includes(s);
    let matchTab = true;
    if (agendaTabFilter === 'today') matchTab = tgl === todayStr;
    if (agendaTabFilter === 'upcoming') matchTab = tgl >= todayStr;
    if (agendaTabFilter === 'archive') matchTab = tgl < todayStr;
    return matchSearch && matchTab;
  });

  // ---- Stats ----
  const totalSurat = agendas.length;
  const totalPetugas = officers.length;
  const todayAgendas = agendas.filter(a => (a.tanggal || a.date || '') === todayStr);

  // ================================================================
  // LOADING SCREEN
  // ================================================================
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined spin">sync</span>
          <p style={{ fontSize: 14, color: '#737686', marginTop: 8 }}>Memuat Sistem SINORA...</p>
        </div>
      </div>
    );
  }

  // ================================================================
  // LOGIN PAGE
  // ================================================================
  if (!currentUser) {
    return (
      <div className="login-page">
        <div className="login-container">
          {/* Card Utama */}
          <div className="login-card">
            {/* Header: Logo + Judul */}
            <header className="login-header">
              <div className="login-logo-box">
                <span className="material-symbols-outlined">shield</span>
              </div>
              <div>
                <h1 className="login-title">SINORA</h1>
                <p className="login-subtitle">Rutan Kelas IIB Painan</p>
              </div>
            </header>

            {/* Form Login */}
            <form className="login-form" onSubmit={handleLogin}>
              {loginError && (
                <div className="login-error">
                  <span className="material-symbols-outlined">error</span>
                  {loginError}
                </div>
              )}

              <div className="form-field">
                <label className="form-label" htmlFor="username">ID USER / NIP</label>
                <div className="input-group">
                  <span className="material-symbols-outlined">badge</span>
                  <input
                    id="username"
                    type="text"
                    placeholder="Masukkan NIP Anda"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="password">PASSWORD</label>
                <div className="input-group">
                  <span className="material-symbols-outlined">lock</span>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  style={{ background: 'none', border: 'none', color: '#004ac6', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Lupa Password?
                </button>
              </div>

              <button type="submit" className="login-btn" disabled={loginLoading}>
                {loginLoading ? (
                  <>
                    <span className="material-symbols-outlined spin" style={{ fontSize: 18 }}>sync</span>
                    MEMPROSES...
                  </>
                ) : (
                  <>
                    MASUK SISTEM
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>login</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Info */}
            <footer className="login-footer">
              <div className="login-info">
                <span className="material-symbols-outlined">info</span>
                <p>Akses terbatas khusus akun resmi bentukan Admin. Harap hubungi bagian TI jika Anda mengalami kendala saat login.</p>
              </div>
            </footer>
          </div>

          {/* Divider Bawah */}
          <div className="login-divider">
            <hr /><span>Rutan Kelas IIB Painan</span><hr />
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // DASHBOARD UTAMA (Setelah Login)
  // ================================================================

  return (
    <div className="app-layout">
      {/* ==================== SIDEBAR ==================== */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <span className="material-symbols-outlined">shield</span>
          </div>
          <div>
            <div className="sidebar-brand-name">SINORA</div>
            <div className="sidebar-brand-sub">Rutan Kelas IIB Painan</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {[
            { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
            { key: 'agenda', icon: 'event_note', label: 'Agenda' },
            ...(userRole === 'Super Admin' ? [{ key: 'users', icon: 'group', label: 'Kelola Pengguna' }] : []),
            { key: 'reports', icon: 'description', label: 'Reports' },
            { key: 'guide', icon: 'menu_book', label: 'Panduan' },
          ].map(item => (
            <button
              key={item.key}
              className={`sidebar-nav-item${activeTab === item.key ? ' active' : ''}`}
              onClick={() => setActiveTab(item.key as any)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Add Agenda Quick Button */}
        <button className="sidebar-add-btn" onClick={openAddModal}>
          <span className="material-symbols-outlined">add</span>
          Add New Agenda
        </button>

        {/* User Info */}
        <div className="sidebar-user" onClick={openProfileModal} style={{ cursor: 'pointer' }} title="Klik untuk Edit Profil & Password">
          <div className="sidebar-user-avatar">{userDisplayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{userDisplayName}</div>
            <div className="sidebar-user-role">{userRole}</div>
          </div>
          <button className="sidebar-logout-btn" onClick={(e) => { e.stopPropagation(); handleLogout(); }} title="Keluar">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="main-content">
        {/* TOP BAR */}
        <header className="topbar">
          <div className="topbar-search">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Cari kegiatan, surat, atau petugas..." readOnly />
          </div>
          <div className="topbar-user">
            <div className="topbar-user-info" onClick={openProfileModal} style={{ cursor: 'pointer' }} title="Edit Profil">
              <strong>{userDisplayName}</strong>
              {userRole === 'Super Admin' ? (
                <span style={{ color: '#004ac6', fontWeight: 700 }}>Super Admin</span>
              ) : (
                <span>NIP: {userNip || '-'}</span>
              )}
            </div>
            <div className="topbar-user-avatar" onClick={openProfileModal} style={{ cursor: 'pointer' }} title="Edit Profil">
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#004ac6' }}>person</span>
            </div>
            <button className="topbar-logout-btn" style={{ background: '#e0e7ff', color: '#004ac6', border: 'none' }} onClick={openProfileModal} title="Edit Profil & Keamanan">
              <span className="material-symbols-outlined">manage_accounts</span>
              Edit Profil
            </button>
            <button className="topbar-logout-btn" onClick={handleLogout}>
              <span className="material-symbols-outlined">logout</span>
              Logout
            </button>
          </div>
        </header>

        {/* ==================== PAGE CONTENT ==================== */}
        <div className="page-content">

          {/* ======================== DASHBOARD ======================== */}
          {activeTab === 'dashboard' && (
            <>
              {/* Page Header */}
              <div className="page-header">
                <div>
                  <h2>SINORA</h2>
                  <p>Sistem Informasi Penomoran Surat Administrasi di Rumah Tahanan Negara Kelas IIB Painan. By : Septi Agnes Putri</p>
                </div>
                <button className="add-agenda-btn" onClick={openAddModal}>
                  <span className="material-symbols-outlined">add_circle</span>
                  + TAMBAH AGENDA BARU
                </button>
              </div>

              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card blue">
                  <div className="stat-label">Total Seluruh Arsip Surat</div>
                  <div className="stat-number">{String(totalSurat).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">folder</span>Surat tercatat dalam sistem</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-label">Total Petugas Aktif</div>
                  <div className="stat-number">{String(totalPetugas).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">group</span>Terdaftar di sistem</div>
                </div>
              </div>

              {/* Dashboard Grid */}
              <div className="dashboard-grid">
                {/* Today's Agenda Timeline */}
                <div className="agenda-today">
                  <div className="agenda-today-header">
                    <h3>Agenda Hari Ini</h3>
                    <span className="date-badge">{todayDisplay}</span>
                  </div>

                  {todayAgendas.length === 0 ? (
                    <div className="empty-state">
                      <span className="material-symbols-outlined">event_busy</span>
                      <p>Belum ada agenda hari ini</p>
                      <small>Klik "+ Tambah Agenda Baru" untuk menambahkan kegiatan</small>
                    </div>
                  ) : (
                    <div className="timeline">
                      {todayAgendas.map((item) => (
                        <div key={item.id} className="timeline-item">
                          <div className="timeline-indicator">
                            <div className="timeline-dot">
                              <span className="material-symbols-outlined">mail</span>
                            </div>
                            <div className="timeline-line"></div>
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-row">
                              <div>
                                <div className="timeline-time">No. Surat: {item.nomorSurat || '-'}</div>
                                <div className="timeline-title">{item.keteranganIsiSurat || item.title || '-'}</div>
                              </div>
                            </div>
                            <div className="timeline-meta">
                              <span><span className="material-symbols-outlined">markunread_mailbox</span>Tujuan/Pengirim: {item.alamatSurat || item.location || '-'}</span>
                              <span><span className="material-symbols-outlined">person</span>Penginput: {(item as any).createdByName || item.responsible || 'Admin'}</span>
                              <span><span className="material-symbols-outlined">calendar_today</span>{item.tanggal || item.date}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Panel */}
                <div className="right-panel">
                  <div className="panel-card">
                    <h4>Arsip Surat Terbaru</h4>
                    {agendas.slice(-4).reverse().length === 0 ? (
                      <div style={{ color: '#737686', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Belum ada arsip surat.</div>
                    ) : (
                      agendas.slice(-4).reverse().map(item => (
                        <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f4ff' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0d1c2e' }}>{item.keteranganIsiSurat || item.title || '-'}</div>
                          <div style={{ fontSize: 11, color: '#737686', marginTop: 2 }}>{item.tanggal || item.date} · No: {item.nomorSurat || '-'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ======================== AGENDA MANAGEMENT ======================== */}
          {activeTab === 'agenda' && (
            <>
              <div className="page-header">
                <div>
                  <h2>Kelola Agenda</h2>
                  <p>Daftar seluruh kegiatan dan agenda Rutan Kelas IIB Painan.</p>
                </div>
                <button className="add-agenda-btn" onClick={openAddModal}>
                  <span className="material-symbols-outlined">add</span>
                  + Tambah Agenda
                </button>
              </div>

              {/* Filter Bar */}
              <div className="filter-bar">
                <div className="search-box">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    placeholder="Cari agenda, lokasi, atau penanggung jawab..."
                    value={agendaSearch}
                    onChange={e => setAgendaSearch(e.target.value)}
                  />
                </div>
                <div className="tab-group">
                  {[
                    { key: 'all', label: 'Semua' },
                    { key: 'today', label: 'Hari Ini' },
                    { key: 'upcoming', label: 'Mendatang' },
                    { key: 'archive', label: 'Arsip' },
                  ].map(t => (
                    <button key={t.key} className={`tab-btn${agendaTabFilter === t.key ? ' active' : ''}`} onClick={() => setAgendaTabFilter(t.key as any)}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Data Table */}
              <div className="data-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>No. Urut</th>
                      <th>Nomor Surat</th>
                      <th>Tanggal</th>
                      <th>Alamat Surat</th>
                      <th>Keterangan Isi Surat</th>
                      <th>Divisi</th>
                      <th>Penginput Agenda</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#737686' }}>
                          Tidak ada agenda surat yang sesuai.
                        </td>
                      </tr>
                    ) : filteredAgendas.map((agenda, index) => {
                      const isOwner = canModifyAgenda(agenda);
                      const creatorName = (agenda as any).createdByName || agenda.responsible || (agenda as any).createdByUsername || 'Admin';
                      return (
                        <tr key={agenda.id}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#004ac6' }}>
                            {agenda.nomorUrut || index + 1}
                          </td>
                          <td>
                            <div className="td-primary">{agenda.nomorSurat || '-'}</div>
                          </td>
                          <td>
                            <div className="td-primary">{agenda.tanggal || agenda.date}</div>
                          </td>
                          <td>
                            <div className="td-primary">{agenda.alamatSurat || agenda.location || '-'}</div>
                          </td>
                          <td>
                            <div className="td-primary">{agenda.keteranganIsiSurat || agenda.title || '-'}</div>
                          </td>
                          <td><span className={divisionColor(agenda.division || '')}>{agenda.division || 'Umum'}</span></td>
                          <td>
                            <div className="td-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0d1c2e' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#004ac6' }}>account_circle</span>
                              <strong>{creatorName}</strong>
                            </div>
                          </td>
                          <td>
                            {isOwner ? (
                              <div className="action-btns">
                                <button className="action-btn edit" onClick={() => openEditModal(agenda)} title="Edit Agenda Saya">
                                  <span className="material-symbols-outlined">edit</span>
                                </button>
                                <button className="action-btn delete" onClick={() => deleteAgenda(agenda)} title="Hapus Agenda Saya">
                                  <span className="material-symbols-outlined">delete</span>
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} title="Terkunci: Hanya penginput yang dapat mengedit/menghapus agenda ini">
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
                                Terkunci
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ======================== KELOLA PENGGUNA (Super Admin Only) ======================== */}
          {activeTab === 'users' && userRole === 'Super Admin' && (
            <>
              <div className="user-page-header">
                <div><h2>Kelola Pengguna</h2><p>Daftar akun petugas dan admin yang terdaftar di sistem SINORA.</p></div>
                <button className="add-agenda-btn" onClick={() => setShowAddUserModal(true)}>
                  <span className="material-symbols-outlined">person_add</span>
                  + Buat Akun Baru
                </button>
              </div>

              <div className="data-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Nama Lengkap</th>
                      <th>NIP</th>
                      <th>Divisi</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Super Admin Bawaan - tidak bisa dihapus/diedit */}
                    <tr style={{ background: '#eff4ff' }}>
                      <td className="td-primary" style={{ color: '#004ac6' }}>glubis</td>
                      <td>Gilang Lubis</td>
                      <td><span style={{ color: '#94a3b8', fontSize: 13 }}>—</span></td>
                      <td><span style={{ color: '#94a3b8', fontSize: 13 }}>—</span></td>
                      <td><span style={{ background: '#004ac6', color: 'white', padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>Super Admin</span></td>
                      <td><span className="status-badge status-selesai" style={{ fontSize: 10 }}>Aktif</span></td>
                      <td style={{ textAlign: 'center', color: '#b0b0c0', fontSize: 11 }}>—</td>
                    </tr>
                    {officers.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#737686' }}>Belum ada petugas terdaftar. Klik "+ Buat Akun Baru".</td>
                      </tr>
                    )}
                    {officers.map(user => (
                      <tr key={user.id}>
                        <td className="td-primary">{user.username}</td>
                        <td>{user.name}</td>
                        <td>{user.nip || '-'}</td>
                        <td>{user.role === 'Super Admin' ? <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span> : <span className={divisionColor(user.division)}>{user.division}</span>}</td>
                        <td><span style={{ background: '#e6eeff', color: '#004ac6', padding: '2px 8px', fontSize: 11, fontWeight: 700, borderRadius: 4 }}>{user.role}</span></td>
                        <td><span className="status-badge status-selesai" style={{ fontSize: 10 }}>{user.status}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="action-btn edit" onClick={() => openEditOfficer(user)} title="Edit">
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button className="action-btn delete" onClick={() => deleteOfficer(user.id, user.name || user.username)} title="Hapus">
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ======================== REPORTS ======================== */}
          {activeTab === 'reports' && (
            <>
              <div className="page-header">
                <div><h2>Laporan & Cetak</h2><p>Rekapitulasi agenda resmi Rutan Kelas IIB Painan.</p></div>
              </div>
              <div className="report-wrap">
                <div className="report-header-bar">
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>Pratinjau Laporan</h3>
                    <p style={{ fontSize: 13, color: '#737686', marginTop: 2 }}>Laporan Rekapitulasi Agenda Rutan Kelas IIB Painan</p>
                  </div>
                  <button className="print-btn" onClick={() => window.print()}>
                    <span className="material-symbols-outlined">print</span>
                    Cetak / Download PDF
                  </button>
                </div>

                {/* Report Container */}
                <div className="kop-surat">
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, textTransform: 'uppercase', marginBottom: 20, color: '#0d1c2e' }}>
                    Laporan Rekapitulasi Agenda Rutan Kelas IIB Painan
                  </div>

                  <table className="kop-table">
                    <thead>
                      <tr>
                        <th>No. Urut</th>
                        <th>Nomor Surat</th>
                        <th>Tanggal</th>
                        <th>Alamat Surat</th>
                        <th>Keterangan Isi Surat</th>
                        <th>Divisi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agendas.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#737686' }}>Belum ada agenda surat tercatat.</td></tr>
                      ) : agendas.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.nomorUrut || idx + 1}</td>
                          <td>{item.nomorSurat || '-'}</td>
                          <td>{item.tanggal || item.date}</td>
                          <td>{item.alamatSurat || item.location || '-'}</td>
                          <td style={{ fontWeight: 700 }}>{item.keteranganIsiSurat || item.title || '-'}</td>
                          <td>{item.division || 'Umum'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ======================== BUKU PANDUAN PETUGAS ======================== */}
          {activeTab === 'guide' && (
            <>
              <div className="page-header">
                <div>
                  <h2>Buku Panduan Petugas</h2>
                  <p>Panduan praktis penggunaan aplikasi SINORA untuk Petugas Rutan Kelas IIB Painan.</p>
                </div>
                <button className="print-btn" onClick={() => window.print()}>
                  <span className="material-symbols-outlined">print</span>
                  Cetak / Download PDF
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                {/* 1. Akses & Login */}
                <div className="panel-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#004ac6' }}>login</span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0d1c2e' }}>1. Akses & Login Sistem</h3>
                  </div>
                  <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    Masuk menggunakan <strong>ID User / NIP</strong> dan <strong>Password</strong> akun petugas Anda.
                  </p>
                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #004ac6', marginTop: '12px' }}>
                    <ol style={{ margin: 0, paddingLeft: '16px', fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                      <li>Buka alamat web SINORA di browser (Chrome/Edge).</li>
                      <li>Ketikkan Username atau NIP resmi Anda pada kolom <strong>ID USER / NIP</strong>.</li>
                      <li>Ketikkan kata sandi, lalu klik <strong>MASUK SISTEM</strong>.</li>
                    </ol>
                  </div>
                </div>

                {/* 2. Menginput Agenda Surat */}
                <div className="panel-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#004ac6' }}>edit_note</span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0d1c2e' }}>2. Cara Menginput Surat & Agenda Baru</h3>
                  </div>
                  <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    Setiap surat masuk, surat keluar, atau agenda kegiatan harus dicatatkan agar memperoleh <strong>Nomor Urut Otomatis</strong> dari sistem.
                  </p>
                  <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '8px', borderLeft: '4px solid #004ac6', marginTop: '12px' }}>
                    <ol style={{ margin: 0, paddingLeft: '16px', fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                      <li>Klik tombol <strong>+ TAMBAH AGENDA BARU</strong> di bagian atas atau sidebar.</li>
                      <li>Ketik <strong>Nomor Surat</strong> (Contoh: <code>W.13.PAS.PAS.12-UM.01.01-102</code>).</li>
                      <li>Pilih <strong>Tanggal</strong> surat atau jadwal kegiatan.</li>
                      <li>Ketik <strong>Alamat Surat</strong> (Instansi Pengirim / Tujuan).</li>
                      <li>Ketik <strong>Keterangan Isi Surat</strong> (Perihal ringkas).</li>
                      <li>Pilih <strong>Divisi</strong> pengelola (<code>KPR</code>, <code>Pengelolaan</code>, atau <code>Pelayanan Tahanan / Kamtib</code>).</li>
                      <li>Klik <strong>Simpan Agenda</strong>. Sistem akan membuatkan Nomor Urut secara otomatis.</li>
                    </ol>
                  </div>
                </div>

                {/* 3. Pencarian & Filter Surat */}
                <div className="panel-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#004ac6' }}>search</span>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#0d1c2e' }}>3. Pencarian, Filter & Kalender Kegiatan</h3>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: 14, color: '#334155', lineHeight: 1.7 }}>
                    <li><strong>Pencarian Surat:</strong> Ketikkan nomor surat, perihal, atau instansi pada kolom pencarian di menu <strong>Agenda</strong>.</li>
                    <li><strong>Filter Tab:</strong> Gunakan tab <em>Hari Ini</em>, <em>Mendatang</em>, atau <em>Arsip</em> untuk menyaring tampilan.</li>
                    <li><strong>Kalender Agenda:</strong> Pilih menu <strong>Calendar</strong> untuk melihat agenda kegiatan harian dalam tampilan kalender bulanan.</li>
                  </ul>
                </div>

                {/* 4. Perbaikan Data & Bantuan */}
                <div className="panel-card" style={{ padding: '24px', background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#2563eb' }}>help</span>
                    <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e40af' }}>Kendala Input / Lupa Password?</h4>
                  </div>
                  <p style={{ fontSize: 14, color: '#1e3a8a', margin: 0, lineHeight: 1.6 }}>
                    Jika ada kesalahan input yang tidak bisa diubah atau terjadi kendala saat login, silakan laporkan ke bagian Pengelola IT / Admin Rutan Kelas IIB Painan.
                  </p>
                </div>
              </div>
            </>
          )}

        </div>{/* end page-content */}
      </div>{/* end main-content */}

      {/* ======================== MODAL TAMBAH/EDIT AGENDA ======================== */}
      {showAddAgendaModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>{editingAgenda ? 'Edit Agenda Surat' : 'Tambah Agenda Surat Baru'}</h3>
              <button className="modal-close-btn" onClick={() => { setShowAddAgendaModal(false); setEditingAgenda(null); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={saveAgenda}>
              <div className="modal-body">
                <div className="modal-form">
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>No. Urut (Auto Generate)</label>
                      <input
                        type="text"
                        disabled
                        value={editingAgenda ? (editingAgenda.nomorUrut || 'Auto') : (agendas.length > 0 ? Math.max(...agendas.map(a => a.nomorUrut || 0)) + 1 : 1)}
                        style={{ background: '#e2e8f0', cursor: 'not-allowed', color: '#434655', fontWeight: 700 }}
                      />
                    </div>
                    <div className="modal-field">
                      <label>Tanggal Surat / Agenda</label>
                      <input
                        type="date"
                        required
                        value={agendaForm.tanggal}
                        onChange={e => setAgendaForm({ ...agendaForm, tanggal: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="modal-field">
                    <label>Nomor Surat</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: W3.PAS.PAS.12.UM.01.01-452"
                      value={agendaForm.nomorSurat}
                      onChange={e => setAgendaForm({ ...agendaForm, nomorSurat: e.target.value })}
                    />
                  </div>

                  <div className="modal-field">
                    <label>Alamat Surat (Pengirim / Tujuan)</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Kanwil Kemenkumham Sumbar / Bupati Pesisir Selatan"
                      value={agendaForm.alamatSurat}
                      onChange={e => setAgendaForm({ ...agendaForm, alamatSurat: e.target.value })}
                    />
                  </div>

                  <div className="modal-field">
                    <label>Keterangan Isi Surat</label>
                    <textarea
                      required
                      placeholder="Tuliskan ringkasan / perihal isi surat secara jelas..."
                      value={agendaForm.keteranganIsiSurat}
                      onChange={e => setAgendaForm({ ...agendaForm, keteranganIsiSurat: e.target.value })}
                    ></textarea>
                  </div>

                  <div className="modal-field">
                    <label>Divisi / Seksi</label>
                    <select value={agendaForm.division} onChange={e => setAgendaForm({ ...agendaForm, division: e.target.value })}>
                      <option>KPR</option>
                      <option>Pengelolaan</option>
                      <option>Pelayan Tahanan</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => { setShowAddAgendaModal(false); setEditingAgenda(null); }}>Batal</button>
                <button type="submit" className="btn-save">Simpan Agenda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== MODAL TAMBAH USER ======================== */}
      {showAddUserModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Buat Akun Petugas Baru</h3>
              <button className="modal-close-btn" onClick={() => setShowAddUserModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={saveOfficer}>
              <div className="modal-body">
                <div className="modal-form">
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Username (untuk login)</label>
                      <input type="text" required placeholder="Contoh: budi.santoso" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
                    </div>
                    <div className="modal-field">
                      <label>Password Login</label>
                      <input type="password" required minLength={6} placeholder="Min. 6 karakter" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                    </div>
                  </div>
                  <div className="modal-field">
                    <label>Nama Lengkap</label>
                    <input type="text" required placeholder="Nama Petugas" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label>NIP (Opsional)</label>
                    <input type="text" placeholder="Nomor Induk Pegawai" value={userForm.nip} onChange={e => setUserForm({ ...userForm, nip: e.target.value })} />
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Divisi</label>
                      <select value={userForm.division} onChange={e => setUserForm({ ...userForm, division: e.target.value })}>
                        <option>KPR</option>
                        <option>Pengelolaan</option>
                        <option>Pelayan Tahanan</option>
                      </select>
                    </div>
                    <div className="modal-field">
                      <label>Role</label>
                      <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as Officer['role'] })}>
                        <option value="Petugas">Petugas</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#1e40af' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }}>info</span>
                    <strong>Otomatis dibuat:</strong> Akun login dengan email <em>{userForm.username ? `${userForm.username}@sinora.internal` : '[username]@sinora.internal'}</em> akan langsung aktif setelah disimpan.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowAddUserModal(false)}>Batal</button>
                <button type="submit" className="btn-save" disabled={userCreateLoading}>
                  {userCreateLoading ? 'Membuat Akun...' : 'Buat Akun Petugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== MODAL EDIT USER ======================== */}
      {showEditUserModal && editingOfficer && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Edit Data Petugas</h3>
              <button className="modal-close-btn" onClick={() => { setShowEditUserModal(false); setEditingOfficer(null); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={updateOfficer}>
              <div className="modal-body">
                <div className="modal-form">
                  <div className="modal-field">
                    <label>Username (tidak bisa diubah)</label>
                    <input type="text" disabled value={editingOfficer.username} style={{ background: '#e2e8f0', cursor: 'not-allowed', color: '#434655' }} />
                  </div>
                  <div className="modal-field">
                    <label>Nama Lengkap</label>
                    <input type="text" required placeholder="Nama Petugas" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} />
                  </div>
                  <div className="modal-field">
                    <label>NIP (Opsional)</label>
                    <input type="text" placeholder="Nomor Induk Pegawai" value={userForm.nip} onChange={e => setUserForm({ ...userForm, nip: e.target.value })} />
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Divisi</label>
                      <select value={userForm.division} onChange={e => setUserForm({ ...userForm, division: e.target.value })}>
                        <option>KPR</option>
                        <option>Pengelolaan</option>
                        <option>Pelayan Tahanan</option>
                      </select>
                    </div>
                    <div className="modal-field">
                      <label>Role</label>
                      <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as Officer['role'] })}>
                        <option value="Petugas">Petugas</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => { setShowEditUserModal(false); setEditingOfficer(null); }}>Batal</button>
                <button type="submit" className="btn-save">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== MODAL LUPA PASSWORD ======================== */}
      {showForgotPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Informasi Lupa Password</h3>
              <button className="modal-close-btn" onClick={() => setShowForgotPasswordModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eff6ff', color: '#004ac6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>lock_reset</span>
              </div>
              <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0d1c2e' }}>Kebijakan Akun Instansi</h4>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                Demi keamanan instansi Rutan Kelas IIB Painan, registrasi & reset password akun dilakukan secara terpusat oleh Admin.
              </p>
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 8, margin: '16px 0', fontSize: 13, color: '#334155', border: '1px solid #e2e8f0' }}>
                Silakan hubungi <strong>Super Admin / Pengelola IT</strong> Rutan Kelas IIB Painan untuk membantu mereset kata sandi akun Anda.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-save" style={{ width: '100%' }} onClick={() => setShowForgotPasswordModal(false)}>Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL EDIT PROFIL & GANTI PASSWORD ======================== */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>Profil Saya & Keamanan Akun</h3>
              <button className="modal-close-btn" onClick={() => setShowProfileModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              {/* Informational Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eff4ff', padding: '12px 16px', borderRadius: 8, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#004ac6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18 }}>
                  {userDisplayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#0d1c2e' }}>{userDisplayName}</div>
                  <div style={{ fontSize: 12, color: '#004ac6', fontWeight: 700 }}>ID / Username: {currentUsername} • Role: {userRole}</div>
                </div>
              </div>

              {/* Form 1: Edit Informasi Profil */}
              <form onSubmit={handleSaveProfile} style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#004ac6' }}>person_edit</span>
                  Informasi Profil (Dapat diubah)
                </h4>

                {profileSuccessMsg && <div className="status-badge status-selesai" style={{ width: '100%', padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{profileSuccessMsg}</div>}
                {profileErrorMsg && <div className="login-error" style={{ marginBottom: 12, fontSize: 13 }}>{profileErrorMsg}</div>}

                <div className="modal-form">
                  <div className="modal-field">
                    <label>Nama Lengkap (Ubah jika ada penulisan keliru)</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama lengkap Anda..."
                      value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    />
                  </div>
                  {userRole !== 'Super Admin' && (
                    <div className="modal-grid-2">
                      <div className="modal-field">
                        <label>NIP Pegawai</label>
                        <input
                          type="text"
                          placeholder="Contoh: 19950815 202012 1 001"
                          value={profileForm.nip}
                          onChange={e => setProfileForm({ ...profileForm, nip: e.target.value })}
                        />
                      </div>
                      <div className="modal-field">
                        <label>Divisi / Seksi</label>
                        <select value={profileForm.division} onChange={e => setProfileForm({ ...profileForm, division: e.target.value })}>
                          <option>KPR</option>
                          <option>Pengelolaan</option>
                          <option>Pelayanan Tahanan</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <button type="submit" className="btn-save" disabled={profileSaveLoading} style={{ marginTop: 8 }}>
                    {profileSaveLoading ? 'Menyimpan...' : 'Simpan Perubahan Profil'}
                  </button>
                </div>
              </form>

              {/* Form 2: Ganti Password */}
              <form onSubmit={handleChangePassword}>
                <h4 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#475569', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#004ac6' }}>key</span>
                  Ubah Kata Sandi (Password)
                </h4>

                {passwordSuccessMsg && <div className="status-badge status-selesai" style={{ width: '100%', padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{passwordSuccessMsg}</div>}
                {passwordErrorMsg && <div className="login-error" style={{ marginBottom: 12, fontSize: 13 }}>{passwordErrorMsg}</div>}

                <div className="modal-form">
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Password Baru</label>
                      <input
                        type="password"
                        required
                        placeholder="Minimal 6 karakter"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="modal-field">
                      <label>Konfirmasi Password Baru</label>
                      <input
                        type="password"
                        required
                        placeholder="Ketik ulang password baru"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-save" style={{ background: '#0d1c2e', marginTop: 8 }} disabled={passwordChangeLoading}>
                    {passwordChangeLoading ? 'Memproses...' : 'Ubah Kata Sandi'}
                  </button>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setShowProfileModal(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
