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

// Tipe Data Agenda
interface Agenda {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  responsible: string;
  division: string;
  category: string;
  status: 'Proses' | 'Selesai' | 'Mendatang' | 'Penting';
  description?: string;
  createdAt?: any;
}

// Tipe Data Officer / User
interface Officer {
  id: string;
  username: string;
  name: string;
  nip: string;
  division: string;
  role: 'Super Admin' | 'Admin' | 'Petugas';
  status: 'Aktif' | 'Nonaktif';
}

function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Navigation state: 'dashboard' | 'agenda' | 'calendar' | 'users' | 'reports'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agenda' | 'calendar' | 'users' | 'reports'>('dashboard');

  // Realtime Data State
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [officers, setOfficers] = useState<Officer[]>([]);

  // Filter & Search State for Agenda
  const [agendaSearch, setAgendaSearch] = useState('');
  const [agendaStatusFilter, setAgendaStatusFilter] = useState('All');
  const [agendaTabFilter, setAgendaTabFilter] = useState<'all' | 'today' | 'upcoming' | 'archive'>('all');

  // Modals state
  const [showAddAgendaModal, setShowAddAgendaModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);

  // Form State Tambah/Edit Agenda
  const [agendaForm, setAgendaForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    location: 'Aula Lapas Painan',
    responsible: 'Gilang Lubis (Super Admin)',
    division: 'Kamtib',
    category: 'Rapat Internal',
    status: 'Proses' as 'Proses' | 'Selesai' | 'Mendatang' | 'Penting',
    description: ''
  });

  // Form State Tambah User Baru
  const [userForm, setUserForm] = useState({
    username: '',
    name: '',
    nip: '',
    division: 'Kamtib',
    role: 'Petugas' as 'Super Admin' | 'Admin' | 'Petugas',
    password: ''
  });

  // Listener Auth Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Listener Realtime Firestore Agendas
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'agendas'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Agenda[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Agenda[];
      setAgendas(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Listener Realtime Firestore Officers / Users
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'officers'), orderBy('username', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Officer[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Officer[];
      setOfficers(data);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Handle Login Super Admin / User
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    // Format username ke dummy email @sinora.internal
    const formattedEmail = username.includes('@') 
      ? username 
      : `${username.trim()}@sinora.internal`;

    try {
      await signInWithEmailAndPassword(auth, formattedEmail, password);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setLoginError('ID User / Username atau Password salah!');
      } else {
        setLoginError('Gagal masuk: ' + err.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // CRUD Agenda Actions
  const handleSaveAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAgenda) {
        // Edit Agenda
        const docRef = doc(db, 'agendas', editingAgenda.id);
        await updateDoc(docRef, { ...agendaForm });
        setEditingAgenda(null);
      } else {
        // Tambah Agenda Baru
        await addDoc(collection(db, 'agendas'), {
          ...agendaForm,
          createdAt: serverTimestamp()
        });
      }
      setShowAddAgendaModal(false);
      setAgendaForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        location: 'Aula Lapas Painan',
        responsible: currentUser?.displayName || 'Super Admin',
        division: 'Kamtib',
        category: 'Rapat Internal',
        status: 'Proses',
        description: ''
      });
    } catch (err: any) {
      alert('Gagal menyimpan agenda: ' + err.message);
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus agenda ini?')) {
      try {
        await deleteDoc(doc(db, 'agendas', id));
      } catch (err: any) {
        alert('Gagal menghapus agenda: ' + err.message);
      }
    }
  };

  const handleOpenEditAgenda = (agenda: Agenda) => {
    setEditingAgenda(agenda);
    setAgendaForm({
      title: agenda.title,
      date: agenda.date,
      time: agenda.time,
      location: agenda.location,
      responsible: agenda.responsible,
      division: agenda.division,
      category: agenda.category,
      status: agenda.status,
      description: agenda.description || ''
    });
    setShowAddAgendaModal(true);
  };

  // CRUD User / Officer Actions (Admin Only)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Simpan data officer ke Firestore
      await addDoc(collection(db, 'officers'), {
        username: userForm.username.trim(),
        name: userForm.name,
        nip: userForm.nip,
        division: userForm.division,
        role: userForm.role,
        status: 'Aktif',
        createdAt: serverTimestamp()
      });

      alert(`Akun Petugas (${userForm.username}) berhasil ditambahkan ke daftar!`);
      setShowAddUserModal(false);
      setUserForm({ username: '', name: '', nip: '', division: 'Kamtib', role: 'Petugas', password: '' });
    } catch (err: any) {
      alert('Gagal membuat akun: ' + err.message);
    }
  };

  // Filter Agenda Data
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredAgendas = agendas.filter((item) => {
    const matchSearch = item.title.toLowerCase().includes(agendaSearch.toLowerCase()) || 
                        item.responsible.toLowerCase().includes(agendaSearch.toLowerCase()) ||
                        item.location.toLowerCase().includes(agendaSearch.toLowerCase());
    const matchStatus = agendaStatusFilter === 'All' || item.status === agendaStatusFilter;
    
    let matchTab = true;
    if (agendaTabFilter === 'today') matchTab = item.date === todayStr;
    if (agendaTabFilter === 'upcoming') matchTab = item.date > todayStr;
    if (agendaTabFilter === 'archive') matchTab = item.date < todayStr || item.status === 'Selesai';

    return matchSearch && matchStatus && matchTab;
  });

  // Calculate Dashboard Stats
  const totalToday = agendas.filter(a => a.date === todayStr).length;
  const totalUpcoming = agendas.filter(a => a.date > todayStr).length;
  const totalCompleted = agendas.filter(a => a.status === 'Selesai').length;
  const totalPending = agendas.filter(a => a.status === 'Proses').length;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f8f9ff]">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#004ac6]">sync</span>
          <p className="mt-2 text-sm text-[#737686]">Memuat Sistem SINORA...</p>
        </div>
      </div>
    );
  }

  // JIKA USER BELUM LOGIN -> TAMPILKAN LOGIN PAGE (Desain dari Rancangan UI)
  if (!currentUser) {
    return (
      <div className="min-h-screen asymmetric-bg flex flex-col justify-between p-4 sm:p-6 md:p-10 text-[#0d1c2e]">
        {/* Header Branding */}
        <header className="flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#004ac6] flex items-center justify-center rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div>
              <h1 className="font-extrabold text-xl text-[#004ac6] leading-none">SINORA</h1>
              <p className="text-[10px] font-bold text-[#737686] uppercase tracking-widest">Lapas Kelas IIB Painan</p>
            </div>
          </div>
          <span className="bg-[#e6eeff] text-[#004ac6] text-xs font-semibold px-3 py-1 rounded-full border border-[#b4c5ff]">
            v2.4 Official
          </span>
        </header>

        {/* Main Grid Container */}
        <main className="max-w-7xl mx-auto w-full my-auto py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Branding / Context */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 bg-[#d5e3fc] text-[#003ea8] px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm">security</span>
                Sistem Agenda Resmi
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0d1c2e] leading-tight tracking-tight">
                Manajemen Agenda & Kegiatan Terintegrasi
              </h2>
              
              <p className="text-base sm:text-lg text-[#434655] max-w-2xl leading-relaxed">
                Aplikasi resmi Lembaga Pemasyarakatan Kelas IIB Painan untuk penjadwalan kegiatan, pengawasan tugas petugas, dan dokumentasi agenda institusi.
              </p>

              {/* Asymmetric Informational Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <div className="bg-white p-4 rounded-lg border-l-4 border-[#004ac6] shadow-sm">
                  <span className="material-symbols-outlined text-[#004ac6] mb-1">lock</span>
                  <h4 className="font-bold text-sm">Akses Terbatas</h4>
                  <p className="text-xs text-[#737686] mt-1">Khusus akun resmi yang telah dibuat oleh Admin.</p>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-[#2563eb] shadow-sm">
                  <span className="material-symbols-outlined text-[#2563eb] mb-1">speed</span>
                  <h4 className="font-bold text-sm">Real-time Sync</h4>
                  <p className="text-xs text-[#737686] mt-1">Agenda terupdate secara langsung di seluruh divisi.</p>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-[#4059aa] shadow-sm">
                  <span className="material-symbols-outlined text-[#4059aa] mb-1">verified</span>
                  <h4 className="font-bold text-sm">Dokumentasi</h4>
                  <p className="text-xs text-[#737686] mt-1">Arsip dan laporan agenda tercatat dengan sistematis.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Asymmetric Login Form */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-[#c3c6d7] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#e6eeff] rounded-bl-full -z-0 pointer-events-none"></div>

                <div className="relative z-10">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-[#0d1c2e]">Masuk Aplikasi</h3>
                    <p className="text-xs text-[#737686] mt-1">Silakan masukkan ID User dan Password Anda.</p>
                  </div>

                  {loginError && (
                    <div className="mb-4 bg-[#ffdad6] border border-[#ba1a1a] text-[#93000a] text-xs p-3 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {loginError}
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#434655] mb-2" htmlFor="username">
                        ID User / Username / NIP
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686]">account_circle</span>
                        <input
                          id="username"
                          type="text"
                          className="w-full bg-[#f8f9ff] border border-[#c3c6d7] focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/20 rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#0d1c2e] outline-none transition"
                          placeholder="Masukkan ID (contoh: glubis)"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#434655] mb-2" htmlFor="password">
                        Password
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737686]">lock</span>
                        <input
                          id="password"
                          type="password"
                          className="w-full bg-[#f8f9ff] border border-[#c3c6d7] focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/20 rounded-lg py-2.5 pl-10 pr-4 text-sm text-[#0d1c2e] outline-none transition"
                          placeholder="Masukkan Password (contoh: gilanglubis1)"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full bg-[#004ac6] hover:bg-[#003ea8] text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm mt-6"
                    >
                      {loginLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                          Memverifikasi...
                        </>
                      ) : (
                        <>
                          <span>Masuk Sistem</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-6 pt-4 border-t border-[#e6eeff] text-center">
                    <p className="text-[11px] text-[#737686]">
                      Lupa password atau butuh bantuan akun? Hubungi <strong className="text-[#004ac6]">Admin IT Lapas Painan</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto w-full text-center text-xs text-[#737686] py-4">
          &copy; 2026 Lembaga Pemasyarakatan Kelas IIB Painan. Hak Cipta Dilindungi.
        </footer>
      </div>
    );
  }

  // JIKA USER SUDAH LOGIN -> TAMPILKAN DASHBOARD UTAMA
  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0d1c2e] flex">
      {/* Sidebar Navigation (Sesuai Rancangan UI) */}
      <aside className="fixed left-0 top-0 h-full w-[260px] bg-white border-r border-[#c3c6d7] z-40 flex flex-col justify-between">
        <div>
          {/* Logo & Header Sidebar */}
          <div className="p-6 border-b border-[#eff4ff]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#004ac6] flex items-center justify-center rounded-lg text-white font-bold">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-[#004ac6] leading-none">SINORA</h1>
                <p className="text-[10px] font-bold text-[#737686] uppercase tracking-wider mt-0.5">Lapas Painan</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-[#e6eeff] text-[#004ac6] border-l-4 border-[#004ac6]'
                  : 'text-[#434655] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined">dashboard</span>
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('agenda')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'agenda'
                  ? 'bg-[#e6eeff] text-[#004ac6] border-l-4 border-[#004ac6]'
                  : 'text-[#434655] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined">event_note</span>
              <span>Manajemen Agenda</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'calendar'
                  ? 'bg-[#e6eeff] text-[#004ac6] border-l-4 border-[#004ac6]'
                  : 'text-[#434655] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined">calendar_month</span>
              <span>Kalender Agenda</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'users'
                  ? 'bg-[#e6eeff] text-[#004ac6] border-l-4 border-[#004ac6]'
                  : 'text-[#434655] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined">group</span>
              <span>Manajemen User</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                activeTab === 'reports'
                  ? 'bg-[#e6eeff] text-[#004ac6] border-l-4 border-[#004ac6]'
                  : 'text-[#434655] hover:bg-[#eff4ff]'
              }`}
            >
              <span className="material-symbols-outlined">description</span>
              <span>Laporan & Cetak</span>
            </button>
          </nav>
        </div>

        {/* User Info & Logout at Sidebar Footer */}
        <div className="p-4 border-t border-[#eff4ff] bg-[#f8f9ff]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#004ac6] text-white flex items-center justify-center text-xs font-bold">
                {currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-[#0d1c2e] truncate">{currentUser.email?.split('@')[0]}</p>
                <p className="text-[10px] text-[#737686] capitalize">Super Admin</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1.5 rounded-md transition flex items-center"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-[260px] flex-1 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-[#c3c6d7] px-8 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h2 className="text-base font-bold text-[#0d1c2e] capitalize">
              {activeTab === 'dashboard' && 'Dashboard Utama'}
              {activeTab === 'agenda' && 'Kelola Agenda & Kegiatan'}
              {activeTab === 'calendar' && 'Tampilan Kalender Kegiatan'}
              {activeTab === 'users' && 'Manajemen Akun & Petugas'}
              {activeTab === 'reports' && 'Laporan & Cetak Agenda'}
            </h2>
            <p className="text-xs text-[#737686]">Sistem Agenda Lapas Kelas IIB Painan</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setEditingAgenda(null);
                setShowAddAgendaModal(true);
              }}
              className="bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>+ Tambah Agenda</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-8 flex-1">
          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] border-l-4 border-l-[#004ac6] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-[#737686] uppercase">Agenda Hari Ini</p>
                      <h3 className="text-3xl font-extrabold text-[#0d1c2e] mt-1">{totalToday}</h3>
                    </div>
                    <span className="material-symbols-outlined text-[#004ac6] bg-[#e6eeff] p-2 rounded-lg">today</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] border-l-4 border-l-[#2563eb] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-[#737686] uppercase">Agenda Mendatang</p>
                      <h3 className="text-3xl font-extrabold text-[#0d1c2e] mt-1">{totalUpcoming}</h3>
                    </div>
                    <span className="material-symbols-outlined text-[#2563eb] bg-[#eff4ff] p-2 rounded-lg">event</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] border-l-4 border-l-[#10b981] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-[#737686] uppercase">Kegiatan Selesai</p>
                      <h3 className="text-3xl font-extrabold text-[#0d1c2e] mt-1">{totalCompleted}</h3>
                    </div>
                    <span className="material-symbols-outlined text-[#10b981] bg-[#d1fae5] p-2 rounded-lg">check_circle</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] border-l-4 border-l-[#f59e0b] shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-[#737686] uppercase">Dalam Proses</p>
                      <h3 className="text-3xl font-extrabold text-[#0d1c2e] mt-1">{totalPending}</h3>
                    </div>
                    <span className="material-symbols-outlined text-[#f59e0b] bg-[#fef3c7] p-2 rounded-lg">pending</span>
                  </div>
                </div>
              </div>

              {/* Today's Timeline & Agenda Preview */}
              <div className="bg-white rounded-xl border border-[#c3c6d7] p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0d1c2e]">Daftar Agenda Terbaru</h3>
                    <p className="text-xs text-[#737686]">Jadwal kegiatan terupdate di Lapas Painan</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('agenda')}
                    className="text-xs font-bold text-[#004ac6] hover:underline flex items-center gap-1"
                  >
                    Lihat Semua <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>

                {agendas.length === 0 ? (
                  <div className="text-center py-12 bg-[#f8f9ff] rounded-lg border border-dashed border-[#c3c6d7]">
                    <span className="material-symbols-outlined text-4xl text-[#737686]">event_busy</span>
                    <p className="text-sm font-semibold text-[#434655] mt-2">Belum ada agenda terdaftar</p>
                    <p className="text-xs text-[#737686] mt-1">Klik "+ Tambah Agenda" di pojok kanan atas untuk membuat kegiatan baru.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#eff4ff]">
                    {agendas.slice(0, 5).map((item) => (
                      <div key={item.id} className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-[#e6eeff] text-[#004ac6] flex flex-col items-center justify-center font-bold">
                            <span className="text-xs leading-none">{item.time}</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#0d1c2e]">{item.title}</h4>
                            <p className="text-xs text-[#737686] mt-0.5">
                              📍 {item.location} | 👤 {item.responsible} ({item.division})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                            item.status === 'Selesai' ? 'bg-[#d1fae5] text-[#065f46]' :
                            item.status === 'Penting' ? 'bg-[#fee2e2] text-[#991b1b]' :
                            item.status === 'Mendatang' ? 'bg-[#e0e7ff] text-[#3730a3]' :
                            'bg-[#fef3c7] text-[#92400e]'
                          }`}>
                            {item.status}
                          </span>
                          <button
                            onClick={() => handleOpenEditAgenda(item)}
                            className="text-[#004ac6] hover:bg-[#e6eeff] p-1.5 rounded-lg transition"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteAgenda(item.id)}
                            className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1.5 rounded-lg transition"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. AGENDA MANAGEMENT VIEW */}
          {activeTab === 'agenda' && (
            <div className="space-y-6">
              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-xl border border-[#c3c6d7] flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                  <span className="material-symbols-outlined text-[#737686]">search</span>
                  <input
                    type="text"
                    placeholder="Cari agenda, lokasi, atau penanggung jawab..."
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaSearch}
                    onChange={(e) => setAgendaSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    className="bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaStatusFilter}
                    onChange={(e) => setAgendaStatusFilter(e.target.value)}
                  >
                    <option value="All">Semua Status</option>
                    <option value="Proses">Proses</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Mendatang">Mendatang</option>
                    <option value="Penting">Penting</option>
                  </select>

                  <div className="flex bg-[#f8f9ff] p-1 rounded-lg border border-[#c3c6d7]">
                    <button
                      onClick={() => setAgendaTabFilter('all')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition ${agendaTabFilter === 'all' ? 'bg-[#004ac6] text-white' : 'text-[#737686]'}`}
                    >
                      Semua
                    </button>
                    <button
                      onClick={() => setAgendaTabFilter('today')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition ${agendaTabFilter === 'today' ? 'bg-[#004ac6] text-white' : 'text-[#737686]'}`}
                    >
                      Hari Ini
                    </button>
                    <button
                      onClick={() => setAgendaTabFilter('upcoming')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition ${agendaTabFilter === 'upcoming' ? 'bg-[#004ac6] text-white' : 'text-[#737686]'}`}
                    >
                      Mendatang
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white rounded-xl border border-[#c3c6d7] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-[#c3c6d7] text-[11px] font-bold text-[#737686] uppercase tracking-wider">
                      <th className="p-4">Tanggal & Waktu</th>
                      <th className="p-4">Nama Kegiatan</th>
                      <th className="p-4">Penanggung Jawab</th>
                      <th className="p-4">Lokasi</th>
                      <th className="p-4">Divisi</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff] text-xs">
                    {filteredAgendas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-[#737686]">
                          Tidak ada agenda yang cocok dengan pencarian/filter.
                        </td>
                      </tr>
                    ) : (
                      filteredAgendas.map((agenda) => (
                        <tr key={agenda.id} className="hover:bg-[#f8f9ff] transition">
                          <td className="p-4 font-semibold">
                            <div>{agenda.date}</div>
                            <div className="text-[10px] text-[#737686]">{agenda.time} WIB</div>
                          </td>
                          <td className="p-4 font-bold text-[#0d1c2e]">
                            {agenda.title}
                            {agenda.description && <p className="text-[10px] text-[#737686] font-normal mt-0.5 line-clamp-1">{agenda.description}</p>}
                          </td>
                          <td className="p-4">{agenda.responsible}</td>
                          <td className="p-4">{agenda.location}</td>
                          <td className="p-4"><span className="bg-[#e6eeff] text-[#004ac6] px-2 py-0.5 rounded font-semibold text-[10px]">{agenda.division}</span></td>
                          <td className="p-4">
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                              agenda.status === 'Selesai' ? 'bg-[#d1fae5] text-[#065f46]' :
                              agenda.status === 'Penting' ? 'bg-[#fee2e2] text-[#991b1b]' :
                              agenda.status === 'Mendatang' ? 'bg-[#e0e7ff] text-[#3730a3]' :
                              'bg-[#fef3c7] text-[#92400e]'
                            }`}>
                              {agenda.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenEditAgenda(agenda)}
                                className="text-[#004ac6] hover:bg-[#e6eeff] p-1.5 rounded transition"
                                title="Edit"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteAgenda(agenda.id)}
                                className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1.5 rounded transition"
                                title="Hapus"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. CALENDAR VIEW */}
          {activeTab === 'calendar' && (
            <div className="bg-white p-6 rounded-xl border border-[#c3c6d7] shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold">Kalender Agenda Lapas Painan</h3>
                <span className="text-xs text-[#737686]">Bulan Ini (Real-time Grid)</span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold bg-[#f8f9ff] p-3 rounded-lg border border-[#c3c6d7]">
                <div>Minggu</div><div>Senin</div><div>Selasa</div><div>Rabu</div><div>Kamis</div><div>Jumat</div><div>Sabtu</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 31 }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayStr = `2026-07-${dayNum < 10 ? '0' + dayNum : dayNum}`;
                  const dayAgendas = agendas.filter(a => a.date === dayStr);
                  return (
                    <div key={i} className="min-h-[90px] p-2 bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg flex flex-col justify-between">
                      <span className="text-xs font-bold text-[#737686]">{dayNum}</span>
                      <div className="space-y-1 mt-1">
                        {dayAgendas.map(item => (
                          <div key={item.id} className="text-[9px] bg-[#004ac6] text-white p-1 rounded font-semibold truncate" title={item.title}>
                            {item.time} - {item.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. USER MANAGEMENT VIEW */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Daftar Akun Petugas & Admin</h3>
                  <p className="text-xs text-[#737686]">Pengelolaan akun resmi terdaftar di sistem SINORA</p>
                </div>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 shadow-sm transition"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  <span>+ Buat Akun Petugas</span>
                </button>
              </div>

              <div className="bg-white rounded-xl border border-[#c3c6d7] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-[#c3c6d7] text-[11px] font-bold text-[#737686] uppercase tracking-wider">
                      <th className="p-4">ID User / Username</th>
                      <th className="p-4">Nama Lengkap</th>
                      <th className="p-4">NIP</th>
                      <th className="p-4">Divisi / Seksi</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff] text-xs">
                    {/* Hardcoded Super Admin Glubis */}
                    <tr className="bg-[#eff4ff]/50 font-semibold">
                      <td className="p-4 font-bold text-[#004ac6]">glubis</td>
                      <td className="p-4">Gilang Lubis (Super Admin)</td>
                      <td className="p-4">19950815 202012 1 001</td>
                      <td className="p-4">TI & Admin Utama</td>
                      <td className="p-4"><span className="bg-[#004ac6] text-white px-2 py-0.5 rounded text-[10px] font-bold">Super Admin</span></td>
                      <td className="p-4"><span className="bg-[#d1fae5] text-[#065f46] px-2 py-0.5 rounded text-[10px] font-bold">Aktif</span></td>
                    </tr>
                    {officers.map((user) => (
                      <tr key={user.id} className="hover:bg-[#f8f9ff]">
                        <td className="p-4 font-bold text-[#0d1c2e]">{user.username}</td>
                        <td className="p-4">{user.name}</td>
                        <td className="p-4">{user.nip || '-'}</td>
                        <td className="p-4">{user.division}</td>
                        <td className="p-4"><span className="bg-[#e6eeff] text-[#004ac6] px-2 py-0.5 rounded text-[10px] font-bold">{user.role}</span></td>
                        <td className="p-4"><span className="bg-[#d1fae5] text-[#065f46] px-2 py-0.5 rounded text-[10px] font-bold">{user.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. REPORTS VIEW */}
          {activeTab === 'reports' && (
            <div className="bg-white p-8 rounded-xl border border-[#c3c6d7] shadow-sm space-y-6">
              <div className="border-b border-[#c3c6d7] pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#0d1c2e]">Cetak Laporan Agenda Resmi</h3>
                  <p className="text-xs text-[#737686]">Pratinjau laporan format resmi Lapas Kelas IIB Painan</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="bg-[#004ac6] hover:bg-[#003ea8] text-white text-xs font-bold py-2.5 px-5 rounded-lg flex items-center gap-2 shadow transition"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  <span>Cetak / Download PDF</span>
                </button>
              </div>

              {/* Kop Surat Resmi */}
              <div className="border border-[#c3c6d7] p-8 rounded-lg bg-white space-y-6 max-w-4xl mx-auto">
                <div className="text-center border-b-2 border-black pb-4">
                  <h4 className="font-bold text-sm tracking-wide uppercase">KEMENTERIAN HUKUM DAN HAK ASASI MANUSIA RI</h4>
                  <h3 className="font-extrabold text-base uppercase">KANTOR WILAYAH SUMATERA BARAT</h3>
                  <h2 className="font-extrabold text-lg uppercase text-[#004ac6]">LEMBAGA PEMASYARAKATAN KELAS IIB PAINAN</h2>
                  <p className="text-[10px] text-[#434655]">Jl. Merdeka No. 12 Painan, Kab. Pesisir Selatan - Sumatera Barat</p>
                </div>

                <div className="text-center font-bold text-sm underline uppercase">
                  LAPORAN REKAPITULASI AGENDA & KEGIATAN LAPAS
                </div>

                <table className="w-full text-left border-collapse border border-black text-xs">
                  <thead>
                    <tr className="bg-[#e6eeff] border-b border-black">
                      <th className="border border-black p-2 text-center">No</th>
                      <th className="border border-black p-2">Tanggal & Waktu</th>
                      <th className="border border-black p-2">Nama Kegiatan</th>
                      <th className="border border-black p-2">Penanggung Jawab</th>
                      <th className="border border-black p-2">Lokasi</th>
                      <th className="border border-black p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendas.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                        <td className="border border-black p-2">{item.date} ({item.time})</td>
                        <td className="border border-black p-2 font-bold">{item.title}</td>
                        <td className="border border-black p-2">{item.responsible}</td>
                        <td className="border border-black p-2">{item.location}</td>
                        <td className="border border-black p-2 font-bold">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-between pt-8 text-xs font-semibold">
                  <div></div>
                  <div className="text-center">
                    <p>Painan, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p className="mt-1 font-bold">Kepala Lapas Kelas IIB Painan</p>
                    <div className="h-16"></div>
                    <p className="underline font-bold">GILANG LUBIS, S.H.</p>
                    <p className="text-[10px] text-[#737686]">NIP. 19950815 202012 1 001</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL TAMBAH / EDIT AGENDA */}
      {showAddAgendaModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#c3c6d7]">
            <div className="flex justify-between items-center mb-4 border-b border-[#eff4ff] pb-3">
              <h3 className="font-bold text-base text-[#0d1c2e]">
                {editingAgenda ? 'Edit Agenda Kegiatan' : 'Tambah Agenda Kegiatan Baru'}
              </h3>
              <button
                onClick={() => setShowAddAgendaModal(false)}
                className="text-[#737686] hover:bg-[#eff4ff] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveAgenda} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">Nama / Judul Kegiatan</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                  placeholder="Contoh: Rapat Koordinasi Keamanan"
                  value={agendaForm.title}
                  onChange={(e) => setAgendaForm({ ...agendaForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaForm.date}
                    onChange={(e) => setAgendaForm({ ...agendaForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Waktu (WIB)</label>
                  <input
                    type="time"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaForm.time}
                    onChange={(e) => setAgendaForm({ ...agendaForm, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Lokasi</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    placeholder="Lokasi tempat"
                    value={agendaForm.location}
                    onChange={(e) => setAgendaForm({ ...agendaForm, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Divisi / Seksi</label>
                  <select
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaForm.division}
                    onChange={(e) => setAgendaForm({ ...agendaForm, division: e.target.value })}
                  >
                    <option value="Kamtib">Kamtib</option>
                    <option value="Pembinaan">Pembinaan</option>
                    <option value="Tata Usaha">Tata Usaha</option>
                    <option value="KPLP">KPLP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Penanggung Jawab</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    placeholder="Nama Petugas"
                    value={agendaForm.responsible}
                    onChange={(e) => setAgendaForm({ ...agendaForm, responsible: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Status Kegiatan</label>
                  <select
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={agendaForm.status}
                    onChange={(e) => setAgendaForm({ ...agendaForm, status: e.target.value as any })}
                  >
                    <option value="Proses">Proses</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Mendatang">Mendatang</option>
                    <option value="Penting">Penting</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">Keterangan Tambahan (Opsional)</label>
                <textarea
                  className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                  rows={3}
                  placeholder="Catatan rincian kegiatan..."
                  value={agendaForm.description}
                  onChange={(e) => setAgendaForm({ ...agendaForm, description: e.target.value })}
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAgendaModal(false)}
                  className="px-4 py-2 bg-[#f8f9ff] border border-[#c3c6d7] text-[#434655] rounded-lg text-xs font-bold hover:bg-[#eff4ff]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003ea8] text-white rounded-lg text-xs font-bold shadow transition"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH USER / PETUGAS */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c3c6d7]">
            <div className="flex justify-between items-center mb-4 border-b border-[#eff4ff] pb-3">
              <h3 className="font-bold text-base text-[#0d1c2e]">Buat Akun Petugas Baru</h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-[#737686] hover:bg-[#eff4ff] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">Username / ID User</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                  placeholder="Contoh: petugas01"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                  placeholder="Nama Petugas"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#434655] mb-1">NIP (Opsional)</label>
                <input
                  type="text"
                  className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                  placeholder="Nomor Induk Pegawai"
                  value={userForm.nip}
                  onChange={(e) => setUserForm({ ...userForm, nip: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Divisi / Seksi</label>
                  <select
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={userForm.division}
                    onChange={(e) => setUserForm({ ...userForm, division: e.target.value })}
                  >
                    <option value="Kamtib">Kamtib</option>
                    <option value="Pembinaan">Pembinaan</option>
                    <option value="Tata Usaha">Tata Usaha</option>
                    <option value="KPLP">KPLP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#434655] mb-1">Role Akses</label>
                  <select
                    className="w-full bg-[#f8f9ff] border border-[#c3c6d7] rounded-lg p-2.5 text-xs outline-none focus:border-[#004ac6]"
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  >
                    <option value="Petugas">Petugas</option>
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-[#f8f9ff] border border-[#c3c6d7] text-[#434655] rounded-lg text-xs font-bold hover:bg-[#eff4ff]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#004ac6] hover:bg-[#003ea8] text-white rounded-lg text-xs font-bold shadow transition"
                >
                  Tambah Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
