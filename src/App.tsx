import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
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
import { auth, db } from './services/firebase';
import './App.css';

// ---- TIPE DATA ----
interface Agenda {
  id: string;
  title: string;
  date: string;
  time: string;
  timeEnd?: string;
  location: string;
  responsible: string;
  division: string;
  category: string;
  status: 'Proses' | 'Selesai' | 'Mendatang' | 'Penting';
  description?: string;
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

const statusClass = (status: string) => {
  if (status === 'Selesai') return 'status-badge status-selesai';
  if (status === 'Proses') return 'status-badge status-proses';
  if (status === 'Penting') return 'status-badge status-penting';
  return 'status-badge status-mendatang';
};

const dotClass = (status: string) => {
  if (status === 'Selesai') return 'timeline-dot done';
  if (status === 'Proses') return 'timeline-dot active';
  return 'timeline-dot';
};

const dotIcon = (status: string) => {
  if (status === 'Selesai') return 'check';
  if (status === 'Proses') return 'radio_button_checked';
  return 'radio_button_unchecked';
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
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('All');
  const [agendaTabFilter, setAgendaTabFilter] = useState<'all' | 'today' | 'upcoming' | 'archive'>('all');

  // --- Modals ---
  const [showAddAgendaModal, setShowAddAgendaModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);

  // --- Agenda Form ---
  const emptyAgendaForm = {
    title: '', date: todayStr, time: '08:00', timeEnd: '09:00',
    location: 'Aula Rutan IIB Painan', responsible: '', division: 'Kamtib',
    category: 'Rapat Internal', status: 'Mendatang' as Agenda['status'], description: ''
  };
  const [agendaForm, setAgendaForm] = useState(emptyAgendaForm);

  // --- User Form ---
  const [userForm, setUserForm] = useState({ username: '', name: '', nip: '', division: 'Kamtib', role: 'Petugas' as Officer['role'] });

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
    setAgendaForm({ ...emptyAgendaForm, responsible: currentUser?.email?.split('@')[0] || '' });
    setShowAddAgendaModal(true);
  };
  const openEditModal = (a: Agenda) => {
    setEditingAgenda(a);
    setAgendaForm({ title: a.title, date: a.date, time: a.time, timeEnd: a.timeEnd || '', location: a.location, responsible: a.responsible, division: a.division, category: a.category, status: a.status, description: a.description || '' });
    setShowAddAgendaModal(true);
  };

  const saveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAgenda) {
        await updateDoc(doc(db, 'agendas', editingAgenda.id), { ...agendaForm });
      } else {
        await addDoc(collection(db, 'agendas'), { ...agendaForm, createdAt: serverTimestamp() });
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
    try {
      await addDoc(collection(db, 'officers'), { ...userForm, status: 'Aktif', createdAt: serverTimestamp() });
      setShowAddUserModal(false);
      setUserForm({ username: '', name: '', nip: '', division: 'Kamtib', role: 'Petugas' });
      alert(`Akun petugas ${userForm.username} berhasil ditambahkan ke daftar.`);
    } catch (err: any) { alert('Gagal menambah akun: ' + err.message); }
  };

  // ---- Filtered Agenda ----
  const filteredAgendas = agendas.filter(item => {
    const s = (agendaSearch || '').toLowerCase();
    const matchSearch = !s || item.title.toLowerCase().includes(s) || item.responsible.toLowerCase().includes(s) || item.location.toLowerCase().includes(s);
    const matchStatus = agendaStatusFilter === 'All' || item.status === agendaStatusFilter;
    let matchTab = true;
    if (agendaTabFilter === 'today') matchTab = item.date === todayStr;
    if (agendaTabFilter === 'upcoming') matchTab = item.date >= todayStr;
    if (agendaTabFilter === 'archive') matchTab = item.date < todayStr || item.status === 'Selesai';
    return matchSearch && matchStatus && matchTab;
  });

  // ---- Stats ----
  const totalToday = agendas.filter(a => a.date === todayStr).length;
  const totalUpcoming = agendas.filter(a => a.date > todayStr).length;
  const totalCompleted = agendas.filter(a => a.status === 'Selesai').length;
  const totalPending = agendas.filter(a => a.status === 'Proses').length;
  const todayAgendas = agendas.filter(a => a.date === todayStr).sort((a, b) => a.time.localeCompare(b.time));

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
                  <div className="stat-label">Total Agenda Hari Ini</div>
                  <div className="stat-number">{String(totalToday).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">schedule</span>{totalToday} sedang berjalan</div>
                </div>
                <div className="stat-card indigo">
                  <div className="stat-label">Agenda Mendatang</div>
                  <div className="stat-number">{String(totalUpcoming).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">event</span>Hingga akhir pekan</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-label">Kegiatan Selesai</div>
                  <div className="stat-number">{String(totalCompleted).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">check_circle</span>Bulan ini</div>
                </div>
                <div className="stat-card amber">
                  <div className="stat-label">Menunggu Persetujuan</div>
                  <div className="stat-number">{String(totalPending).padStart(2, '0')}</div>
                  <div className="stat-meta"><span className="material-symbols-outlined">pending</span>Perlu tindakan segera</div>
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
                            <div className={dotClass(item.status)}>
                              <span className="material-symbols-outlined">{dotIcon(item.status)}</span>
                            </div>
                            <div className="timeline-line"></div>
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-row">
                              <div>
                                <div className="timeline-time">{item.time}{item.timeEnd ? ` - ${item.timeEnd} WIB` : ' WIB'}</div>
                                <div className="timeline-title">{item.title}</div>
                              </div>
                              <span className={statusClass(item.status)}>{item.status.toUpperCase()}</span>
                            </div>
                            <div className="timeline-meta">
                              <span><span className="material-symbols-outlined">location_on</span>{item.location}</span>
                              <span><span className="material-symbols-outlined">person</span>{item.responsible}</span>
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
                    {agendas.filter(a => a.date > todayStr).slice(0, 3).length === 0 ? (
                      <div style={{ color: '#737686', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>Tidak ada agenda mendatang.</div>
                    ) : (
                      agendas.filter(a => a.date > todayStr).slice(0, 3).map(item => (
                        <div key={item.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f4ff' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#0d1c2e' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#737686', marginTop: 2 }}>{item.date} · {item.time}</div>
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
                <select className="filter-select" value={agendaStatusFilter} onChange={e => setAgendaStatusFilter(e.target.value)}>
                  <option value="All">Semua Status</option>
                  <option value="Proses">Proses</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Mendatang">Mendatang</option>
                  <option value="Penting">Penting</option>
                </select>
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
                      <th>Tanggal & Waktu</th>
                      <th>Nama Kegiatan</th>
                      <th>Penanggung Jawab</th>
                      <th>Lokasi</th>
                      <th>Divisi</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#737686' }}>
                          Tidak ada agenda yang sesuai.
                        </td>
                      </tr>
                    ) : filteredAgendas.map(agenda => (
                      <tr key={agenda.id}>
                        <td>
                          <div className="td-primary">{agenda.date}</div>
                          <div className="td-muted">{agenda.time}{agenda.timeEnd ? ` - ${agenda.timeEnd}` : ''} WIB</div>
                        </td>
                        <td>
                          <div className="td-primary">{agenda.title}</div>
                          {agenda.description && <div className="td-muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agenda.description}</div>}
                        </td>
                        <td>{agenda.responsible}</td>
                        <td>{agenda.location}</td>
                        <td><span className="division-tag">{agenda.division}</span></td>
                        <td><span className={statusClass(agenda.status)}>{agenda.status}</span></td>
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
                    const dayAgendas = agendas.filter(a => a.date === dayStr);
                    const isToday = dayStr === todayStr;
                    return (
                      <div key={dayNum} className="cal-cell" style={{ background: isToday ? '#eff4ff' : '#ffffff', border: isToday ? '1px solid #004ac6' : undefined }}>
                        <div className="cal-cell-num" style={{ color: isToday ? '#004ac6' : undefined, fontWeight: isToday ? 800 : undefined }}>{dayNum}</div>
                        {dayAgendas.slice(0, 2).map(item => (
                          <div key={item.id} className="cal-event" title={item.title}>{item.time} {item.title}</div>
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
                        <th>No</th>
                        <th>Tanggal & Waktu</th>
                        <th>Nama Kegiatan</th>
                        <th>Penanggung Jawab</th>
                        <th>Lokasi</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agendas.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#737686' }}>Belum ada agenda tercatat.</td></tr>
                      ) : agendas.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td>{item.date} ({item.time})</td>
                          <td style={{ fontWeight: 700 }}>{item.title}</td>
                          <td>{item.responsible}</td>
                          <td>{item.location}</td>
                          <td style={{ fontWeight: 700 }}>{item.status}</td>
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
              <h3>{editingAgenda ? 'Edit Agenda Kegiatan' : 'Tambah Agenda Kegiatan Baru'}</h3>
              <button className="modal-close-btn" onClick={() => { setShowAddAgendaModal(false); setEditingAgenda(null); }}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={saveAgenda}>
              <div className="modal-body">
                <div className="modal-form">
                  <div className="modal-field">
                    <label>Nama / Judul Kegiatan</label>
                    <input type="text" required placeholder="Contoh: Rapat Koordinasi Keamanan" value={agendaForm.title} onChange={e => setAgendaForm({ ...agendaForm, title: e.target.value })} />
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Tanggal</label>
                      <input type="date" required value={agendaForm.date} onChange={e => setAgendaForm({ ...agendaForm, date: e.target.value })} />
                    </div>
                    <div className="modal-field">
                      <label>Waktu Mulai</label>
                      <input type="time" required value={agendaForm.time} onChange={e => setAgendaForm({ ...agendaForm, time: e.target.value })} />
                    </div>
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Lokasi</label>
                      <input type="text" required placeholder="Lokasi kegiatan" value={agendaForm.location} onChange={e => setAgendaForm({ ...agendaForm, location: e.target.value })} />
                    </div>
                    <div className="modal-field">
                      <label>Divisi / Seksi</label>
                      <select value={agendaForm.division} onChange={e => setAgendaForm({ ...agendaForm, division: e.target.value })}>
                        <option>Kamtib</option>
                        <option>Pembinaan</option>
                        <option>Tata Usaha</option>
                        <option>KPLP</option>
                        <option>Umum</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-field">
                      <label>Penanggung Jawab</label>
                      <input type="text" required placeholder="Nama petugas" value={agendaForm.responsible} onChange={e => setAgendaForm({ ...agendaForm, responsible: e.target.value })} />
                    </div>
                    <div className="modal-field">
                      <label>Status</label>
                      <select value={agendaForm.status} onChange={e => setAgendaForm({ ...agendaForm, status: e.target.value as Agenda['status'] })}>
                        <option value="Mendatang">Mendatang</option>
                        <option value="Proses">Proses</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Penting">Penting</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-field">
                    <label>Keterangan (Opsional)</label>
                    <textarea placeholder="Catatan rincian kegiatan..." value={agendaForm.description} onChange={e => setAgendaForm({ ...agendaForm, description: e.target.value })}></textarea>
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
                  <div className="modal-field">
                    <label>Username / ID User</label>
                    <input type="text" required placeholder="Contoh: petugas01" value={userForm.username} onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
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
                        <option>Kamtib</option>
                        <option>Pembinaan</option>
                        <option>Tata Usaha</option>
                        <option>KPLP</option>
                        <option>Umum</option>
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
                  <div style={{ background: '#fff8e1', border: '1px solid #f59e0b', padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                    <strong>Catatan:</strong> Setelah menambah data di sini, buat akun login di <strong>Firebase Console → Authentication → Add User</strong> dengan email <em>{userForm.username ? `${userForm.username}@sinora.internal` : '[username]@sinora.internal'}</em>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowAddUserModal(false)}>Batal</button>
                <button type="submit" className="btn-save">Tambah Petugas</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
