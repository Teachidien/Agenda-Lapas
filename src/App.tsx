import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'calendar' | 'users' | 'reports'>('dashboard');

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

  // ---- Firebase Listeners ----
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { setCurrentUser(user); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'agendas'), orderBy('date', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setAgendas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Agenda)));
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
  const openAddModal = () => {
    setEditingAgenda(null);
    setAgendaForm({ ...emptyAgendaForm });
    setShowAddAgendaModal(true);
  };
  const openEditModal = (a: Agenda) => {
    setEditingAgenda(a);
    setAgendaForm({
      nomorSurat: a.nomorSurat || '',
      tanggal: a.tanggal || a.date || todayStr,
      alamatSurat: a.alamatSurat || a.location || '',
      keteranganIsiSurat: a.keteranganIsiSurat || a.title || a.description || '',
      division: a.division || 'Kamtib'
    });
    setShowAddAgendaModal(true);
  };

  const saveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAgenda) {
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
          responsible: currentUser?.email?.split('@')[0] || 'Admin',
          createdAt: serverTimestamp()
        });
      }
      setShowAddAgendaModal(false);
      setEditingAgenda(null);
    } catch (err: any) { alert('Gagal menyimpan: ' + err.message); }
  };

  const deleteAgenda = async (id: string) => {
    if (window.confirm('Hapus agenda ini?')) {
      try { await deleteDoc(doc(db, 'agendas', id)); } catch (err: any) { alert('Gagal menghapus: ' + err.message); }
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
      // 1. Buat akun Firebase Auth menggunakan secondary app (tidak mengganggu sesi Admin)
      const secondaryAuth = getSecondaryAuth();
      const email = `${userForm.username}@sinora.internal`;
      await createUserWithEmailAndPassword(secondaryAuth, email, userForm.password);
      // Sign out dari secondary app agar tidak ada konflik
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
  const totalToday = agendas.filter(a => (a.tanggal || a.date || '') === todayStr).length;
  const totalUpcoming = agendas.filter(a => (a.tanggal || a.date || '') > todayStr).length;
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
                <p className="login-subtitle">Agenda System</p>
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
            <hr /><span>Rutan IIB Painan</span><hr />
          </div>
        </div>
      </div>
    );
  }

  // ================================================================
  // DASHBOARD UTAMA (Setelah Login)
  // ================================================================
  const userDisplayName = currentUser.email?.split('@')[0] || 'Admin';

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
            <div className="sidebar-brand-sub">Rutan IIB Painan</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {[
            { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
            { key: 'agenda', icon: 'event_note', label: 'Agenda' },
            { key: 'calendar', icon: 'calendar_today', label: 'Calendar' },
            { key: 'users', icon: 'group', label: 'Users' },
            { key: 'reports', icon: 'description', label: 'Reports' },
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
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{userDisplayName.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{userDisplayName}</div>
            <div className="sidebar-user-role">Super Admin</div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Keluar">
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
            <input placeholder="Search activities, officers.." readOnly />
          </div>
          <div className="topbar-user">
            <div className="topbar-user-info">
              <strong>{userDisplayName}</strong>
              <span>NIP. {currentUser.email?.split('@')[0]?.toUpperCase()}</span>
            </div>
            <div className="topbar-user-avatar">
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#004ac6' }}>person</span>
            </div>
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
                  <h2>Dashboard Overview</h2>
                  <p>Monitoring agenda harian dan status kegiatan Rutan IIB Painan.</p>
                </div>
                <button className="add-agenda-btn" onClick={openAddModal}>
                  <span className="material-symbols-outlined">add_circle</span>
                  + TAMBAH AGENDA BARU
                </button>
              </div>

              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card blue">
                  <div className="stat-label">Agenda / Surat Hari Ini</div>
                  <div className="stat-number">{String(totalToday).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">schedule</span>{totalToday} agenda tercatat hari ini</div>
                </div>
                <div className="stat-card indigo">
                  <div className="stat-label">Agenda Mendatang</div>
                  <div className="stat-number">{String(totalUpcoming).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">event</span>Surat / agenda akan datang</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-label">Total Seluruh Surat</div>
                  <div className="stat-number">{String(totalSurat).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">mail</span>Tercatat dalam sistem</div>
                </div>
                <div className="stat-card amber">
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
                    <h4>Petugas Piket Hari Ini</h4>
                    {officers.slice(0, 3).length === 0 ? (
                      <div style={{ color: '#737686', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>Belum ada petugas terdaftar.</div>
                    ) : (
                      officers.slice(0, 3).map(o => (
                        <div key={o.id} className="officer-item">
                          <div className="officer-avatar"><span className="material-symbols-outlined">person</span></div>
                          <div>
                            <div className="officer-name">{o.name || o.username}</div>
                            <div className="officer-role">{o.division}</div>
                          </div>
                          <div className="officer-status"></div>
                        </div>
                      ))
                    )}
                    {/* Super Admin hardcoded */}
                    <div className="officer-item">
                      <div className="officer-avatar"><span className="material-symbols-outlined">admin_panel_settings</span></div>
                      <div>
                        <div className="officer-name">Gilang Lubis</div>
                        <div className="officer-role">Super Admin</div>
                      </div>
                      <div className="officer-status"></div>
                    </div>
                  </div>

                  <div className="panel-card">
                    <h4>Agenda Mendatang</h4>
                    {agendas.filter(a => (a.tanggal || a.date || '') > todayStr).slice(0, 3).length === 0 ? (
                      <div style={{ color: '#737686', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Tidak ada agenda mendatang.</div>
                    ) : (
                      agendas.filter(a => (a.tanggal || a.date || '') > todayStr).slice(0, 3).map(item => (
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
                  <p>Daftar seluruh kegiatan dan agenda Rutan IIB Painan.</p>
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
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#737686' }}>
                          Tidak ada agenda surat yang sesuai.
                        </td>
                      </tr>
                    ) : filteredAgendas.map((agenda, index) => (
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
                          <div className="action-btns">
                            <button className="action-btn edit" onClick={() => openEditModal(agenda)} title="Edit">
                              <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button className="action-btn delete" onClick={() => deleteAgenda(agenda.id)} title="Hapus">
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

          {/* ======================== CALENDAR ======================== */}
          {activeTab === 'calendar' && (
            <>
              <div className="page-header">
                <div><h2>Kalender Agenda</h2><p>Tampilan kalender bulanan seluruh kegiatan Rutan IIB Painan.</p></div>
              </div>
              <div className="calendar-wrap">
                <div className="calendar-header">
                  <h3>Juli 2026</h3>
                  <span style={{ fontSize: 13, color: '#737686' }}>Bulan Berjalan</span>
                </div>
                <div className="cal-grid-header">
                  {['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(d => (
                    <div key={d} className="cal-day-name">{d}</div>
                  ))}
                </div>
                <div className="cal-grid">
                  {/* Offset: July 2026 starts on Wednesday (index 3) */}
                  {Array.from({ length: 3 }).map((_, i) => <div key={`empty-${i}`} className="cal-cell" style={{ background: '#f8f9ff' }}></div>)}
                  {Array.from({ length: 31 }).map((_, i) => {
                    const dayNum = i + 1;
                    const dayStr = `2026-07-${String(dayNum).padStart(2, '0')}`;
                    const dayAgendas = agendas.filter(a => (a.tanggal || a.date) === dayStr);
                    const isToday = dayStr === todayStr;
                    return (
                      <div key={dayNum} className="cal-cell" style={{ background: isToday ? '#eff4ff' : '#ffffff', border: isToday ? '1px solid #004ac6' : undefined }}>
                        <div className="cal-cell-num" style={{ color: isToday ? '#004ac6' : undefined, fontWeight: isToday ? 800 : undefined }}>{dayNum}</div>
                        {dayAgendas.slice(0, 2).map(item => (
                          <div key={item.id} className="cal-event" title={item.keteranganIsiSurat || item.title || ''}>{item.nomorSurat || item.keteranganIsiSurat || item.title}</div>
                        ))}
                        {dayAgendas.length > 2 && <div style={{ fontSize: 9, color: '#737686' }}>+{dayAgendas.length - 2} lagi</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ======================== USER MANAGEMENT ======================== */}
          {activeTab === 'users' && (
            <>
              <div className="user-page-header">
                <div><h2>Manajemen User</h2><p>Daftar akun petugas dan admin yang terdaftar di sistem SINORA.</p></div>
                <button className="add-agenda-btn" onClick={() => setShowAddUserModal(true)}>
                  <span className="material-symbols-outlined">person_add</span>
                  + Buat Akun Baru
                </button>
              </div>

              <div className="data-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID User</th>
                      <th>Nama Lengkap</th>
                      <th>NIP</th>
                      <th>Divisi</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Super Admin Bawaan */}
                    <tr style={{ background: '#eff4ff' }}>
                      <td className="td-primary" style={{ color: '#004ac6' }}>glubis</td>
                      <td>Gilang Lubis</td>
                      <td>19950815 202012 1 001</td>
                      <td><span className="division-tag">TI & Admin</span></td>
                      <td><span style={{ background: '#004ac6', color: 'white', padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>Super Admin</span></td>
                      <td><span className="status-badge status-selesai" style={{ fontSize: 10 }}>Aktif</span></td>
                    </tr>
                    {officers.map(user => (
                      <tr key={user.id}>
                        <td className="td-primary">{user.username}</td>
                        <td>{user.name}</td>
                        <td>{user.nip || '-'}</td>
                        <td><span className="division-tag">{user.division}</span></td>
                        <td><span style={{ background: '#e6eeff', color: '#004ac6', padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{user.role}</span></td>
                        <td><span className="status-badge status-selesai" style={{ fontSize: 10 }}>{user.status}</span></td>
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
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>Pratinjau Laporan Resmi</h3>
                    <p style={{ fontSize: 13, color: '#737686', marginTop: 2 }}>Format Kop Surat Rutan Kelas IIB Painan</p>
                  </div>
                  <button className="print-btn" onClick={() => window.print()}>
                    <span className="material-symbols-outlined">print</span>
                    Cetak / Download PDF
                  </button>
                </div>

                {/* Kop Surat */}
                <div className="kop-surat">
                  <div className="kop-surat-header">
                    <h6>KEMENTERIAN HUKUM DAN HAK ASASI MANUSIA RI</h6>
                    <h4>KANTOR WILAYAH SUMATERA BARAT</h4>
                    <h3>RUMAH TAHANAN NEGARA KELAS IIB PAINAN</h3>
                    <small>Jl. Merdeka No. 12 Painan, Kab. Pesisir Selatan – Sumatera Barat</small>
                  </div>

                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, textDecoration: 'underline', textTransform: 'uppercase', marginBottom: 16 }}>
                    Laporan Rekapitulasi Agenda & Kegiatan Rutan
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

                  <div className="ttd-section">
                    <div className="ttd-box">
                      <p>Painan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p style={{ marginTop: 4 }}>Kepala Rutan Kelas IIB Painan</p>
                      <div className="ttd-space"></div>
                      <p className="ttd-name">GILANG LUBIS, S.H.</p>
                      <p style={{ fontSize: 11, color: '#737686' }}>NIP. 19950815 202012 1 001</p>
                    </div>
                  </div>
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

    </div>
  );
}
