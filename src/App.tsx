import React, { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import { Lock, User, LogOut, Calendar, ShieldCheck, Sparkles } from 'lucide-react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Format username ke dummy email @sinora.internal jika belum ada domain
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
        setError('ID User atau Password salah!');
      } else {
        setError('Gagal masuk: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="app-container">
      {/* Banner Selamat Datang di Web SINORA */}
      <div className="welcome-banner">
        <Sparkles size={20} className="sparkle-icon" />
        <span>Selamat datang di web SINORA</span>
      </div>

      {currentUser ? (
        <div className="dashboard-card">
          <div className="dashboard-header">
            <div className="badge"><ShieldCheck size={16} /> Terautentikasi</div>
            <h1>Sistem Agenda Lapas Painan</h1>
            <p className="user-info">Login sebagai: <strong>{currentUser.email?.split('@')[0]}</strong></p>
          </div>
          <div className="dashboard-body">
            <div className="placeholder-box">
              <Calendar size={48} className="icon-calendar" />
              <h3>Modul Agenda & Jadwal Kegiatan</h3>
              <p>Sistem otentikasi Firebase berhasil terhubung. Fitur manajemen agenda sedang dalam tahap pembangunan antarmuka (UI).</p>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              <LogOut size={18} /> Keluar Aplikasi
            </button>
          </div>
        </div>
      ) : (
        <div className="login-card">
          <div className="login-header">
            <div className="logo-badge">SINORA</div>
            <h2>Sistem Agenda Lapas Painan</h2>
            <p>Silakan masuk menggunakan ID Petugas dan Password yang telah diberikan Admin.</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {error && <div className="error-alert">{error}</div>}

            <div className="form-group">
              <label htmlFor="username">ID User / Username</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="username"
                  type="text"
                  placeholder="Masukkan ID (contoh: glubis)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type="password"
                  placeholder="Masukkan Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk Aplikasi'}
            </button>
          </form>

          <div className="login-footer">
            <p>Hanya akun resmi bentukan Admin yang dapat mengakses sistem.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
