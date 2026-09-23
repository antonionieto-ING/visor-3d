import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Trash2 } from 'lucide-react';
import Editor3D from './Editor3D';
import './index.css';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [isGuest, setIsGuest] = useState(false);
  const [view, setView] = useState('login'); // 'login', 'dashboard', 'editor'
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  
  // Formularios
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        setView('dashboard');
        loadProjects(currentUser.uid);
      } else if (!isGuest) {
        setView('login');
      }
    });
    return () => unsubscribe();
  }, [isGuest]);

  const loadProjects = async (uid) => {
    try {
      const q = query(collection(db, "projects"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const projs = [];
      querySnapshot.forEach((doc) => {
        projs.push({ id: doc.id, ...doc.data() });
      });
      setProjects(projs);
    } catch (e) {
      console.error("Error cargando proyectos", e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Error al iniciar sesión. Comprueba tus datos.');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Error al registrarse. Puede que el correo ya exista o la contraseña sea muy débil.');
    }
    setLoading(false);
  };

  const handleGuest = () => {
    setIsGuest(true);
    const localProjects = JSON.parse(localStorage.getItem('guestProjects')) || [];
    setProjects(localProjects);
    setView('dashboard');
  };

  const handleLogout = async () => {
    if (isGuest) {
      setIsGuest(false);
      setView('login');
    } else {
      await signOut(auth);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    const newProj = {
      name: newProjectName,
      objects: [],
      updatedAt: user ? serverTimestamp() : Date.now()
    };

    if (isGuest) {
      newProj.id = Date.now().toString();
      const updated = [...projects, newProj];
      setProjects(updated);
      localStorage.setItem('guestProjects', JSON.stringify(updated));
      setNewProjectName('');
    } else {
      try {
        const docRef = await addDoc(collection(db, "projects"), {
          ...newProj,
          userId: user.uid
        });
        setProjects([...projects, { id: docRef.id, ...newProj }]);
        setNewProjectName('');
      } catch (err) {
        console.error("Error creando proyecto", err);
      }
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm("¿Estás seguro de borrar este proyecto?")) return;
    
    if (isGuest) {
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      localStorage.setItem('guestProjects', JSON.stringify(updated));
    } else {
      try {
        await deleteDoc(doc(db, "projects", id));
        setProjects(projects.filter(p => p.id !== id));
      } catch (err) {
        console.error("Error borrando proyecto", err);
      }
    }
  };

  const openProject = (proj) => {
    setCurrentProject(proj);
    setView('editor');
  };

  const saveProject = async (newObjects) => {
    if (!currentProject) return;
    
    if (isGuest) {
      const updated = projects.map(p => 
        p.id === currentProject.id ? { ...p, objects: newObjects, updatedAt: Date.now() } : p
      );
      setProjects(updated);
      localStorage.setItem('guestProjects', JSON.stringify(updated));
      alert("Guardado localmente (Modo Invitado)");
    } else {
      try {
        const projRef = doc(db, "projects", currentProject.id);
        await updateDoc(projRef, {
          objects: newObjects,
          updatedAt: serverTimestamp()
        });
        alert("¡Proyecto guardado en la nube!");
        loadProjects(user.uid);
      } catch (err) {
        console.error("Error guardando proyecto", err);
        alert("Error al guardar");
      }
    }
  };

  if (user === undefined) return <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><p>Cargando...</p></div>;

  if (view === 'login') {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'radial-gradient(circle at center, #1e293b, #0f172a)' }}>
        <div className="ui-panel" style={{ position: 'relative', top: 'auto', left: 'auto', width: '380px', animation: 'none' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>Visor y Creador 3D</h1>
          <p style={{ textAlign: 'center', marginBottom: '24px' }}>Inicia sesión para guardar tus proyectos en la nube.</p>
          
          {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
          
          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#cbd5e1' }}>Contraseña</label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }}
              />
            </div>
            
            <button className="btn" onClick={handleLogin} disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
            <button className="btn" onClick={handleRegister} disabled={loading} style={{ backgroundColor: '#475569' }}>
              Registrarse
            </button>
          </form>

          <div className="help-text" style={{ marginTop: '24px' }}>
            ¿Solo quieres echar un vistazo?<br/>
            <button onClick={handleGuest} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}>Entrar como Invitado</button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'dashboard') {
    return (
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', background: 'radial-gradient(circle at center, #1e293b, #0f172a)', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', background: 'linear-gradient(135deg, #a78bfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Tus Proyectos</h1>
            <p style={{ margin: '8px 0 0 0', color: '#94a3b8' }}>
              {isGuest ? 'Modo Invitado (Los proyectos solo se guardan en este navegador)' : `Conectado como ${user?.email}`}
            </p>
          </div>
          <button className="btn btn-danger" style={{ width: 'auto' }} onClick={handleLogout}>Cerrar Sesión</button>
        </div>

        <div style={{ width: '100%', maxWidth: '800px', background: 'rgba(30,41,59,0.5)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '32px' }}>
          <form onSubmit={createProject} style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="Nombre del nuevo proyecto..." 
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', outline: 'none' }}
            />
            <button type="submit" className="btn" style={{ width: 'auto', padding: '0 24px' }}>Crear Proyecto</button>
          </form>
        </div>

        <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {projects.length === 0 && <p style={{ color: '#64748b', gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0' }}>No tienes ningún proyecto todavía. ¡Crea uno arriba!</p>}
          
          {projects.map(proj => (
            <div key={proj.id} style={{ background: 'rgba(30,41,59,0.8)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, color: 'white' }}>{proj.name}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>{proj.objects?.length || 0} figuras</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button className="btn" style={{ flex: 1, padding: '8px' }} onClick={() => openProject(proj)}>Abrir</button>
                <button className="btn btn-danger" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => deleteProject(proj.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'editor' && currentProject) {
    return (
      <Editor3D 
        project={currentProject} 
        onSave={saveProject} 
        onExit={() => setView('dashboard')} 
      />
    );
  }

  return null;
}
