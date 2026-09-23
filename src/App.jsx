import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Trash2, Save, FolderOpen, LogIn, User, X } from 'lucide-react';
import Editor3D from './Editor3D';
import './index.css';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [isGuest, setIsGuest] = useState(false);
  const [view, setView] = useState('editor'); // 'login', 'dashboard', 'editor'
  
  // Proyectos
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  
  // Estado del Editor elevado a App
  const [objects, setObjects] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [pendingSave, setPendingSave] = useState(false);

  // Formularios
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        const projs = await loadProjects(currentUser.uid);
        if (view === 'login') {
          setView('editor');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && pendingSave) {
      handleAutoSaveDefault(user.uid);
      setPendingSave(false);
    }
  }, [user, pendingSave]);

  const loadProjects = async (uid) => {
    try {
      const q = query(collection(db, "projects"), where("userId", "==", uid));
      const querySnapshot = await getDocs(q);
      const projs = [];
      querySnapshot.forEach((doc) => {
        projs.push({ id: doc.id, ...doc.data() });
      });
      setProjects(projs);
      return projs;
    } catch (e) {
      console.error("Error cargando proyectos", e);
      return [];
    }
  };

  const handleAutoSaveDefault = async (uid) => {
    const projs = await loadProjects(uid);
    let defaultProj = projs.find(p => p.name === "Default");
    
    if (defaultProj) {
      const projRef = doc(db, "projects", defaultProj.id);
      await updateDoc(projRef, { objects, updatedAt: serverTimestamp() });
      setCurrentProject({ ...defaultProj, objects });
      alert("Se guardaron tus figuras en el proyecto 'Default'.");
    } else {
      const newProj = { name: "Default", objects, updatedAt: serverTimestamp(), userId: uid };
      const docRef = await addDoc(collection(db, "projects"), newProj);
      setCurrentProject({ id: docRef.id, ...newProj });
      setProjects([...projs, { id: docRef.id, ...newProj }]);
      alert("Se creó un proyecto 'Default' con tus figuras guardadas.");
    }
    setView('editor');
  };

  const handleTopBarSave = () => {
    if (!user && !isGuest) {
      setPendingSave(true);
      setView('login');
      return;
    }
    
    if (isGuest) {
      if (!currentProject) {
        const newProj = { id: Date.now().toString(), name: "Default", objects, updatedAt: Date.now() };
        setCurrentProject(newProj);
        const updated = [...projects, newProj];
        setProjects(updated);
        localStorage.setItem('guestProjects', JSON.stringify(updated));
        alert("Guardado localmente en 'Default' (Invitado)");
      } else {
        saveProject(objects);
      }
      return;
    }

    if (!currentProject) {
      handleAutoSaveDefault(user.uid);
    } else {
      saveProject(objects);
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
      setError('Error al registrarse. Puede que el correo ya exista.');
    }
    setLoading(false);
  };

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError('Error al iniciar sesión con Google.');
    }
    setLoading(false);
  };

  const handleGuest = () => {
    setIsGuest(true);
    const localProjects = JSON.parse(localStorage.getItem('guestProjects')) || [];
    setProjects(localProjects);
    setView('editor');
  };

  const handleLogout = async () => {
    if (isGuest) {
      setIsGuest(false);
      setProjects([]);
      setCurrentProject(null);
    } else {
      await signOut(auth);
      setProjects([]);
      setCurrentProject(null);
    }
    setView('editor');
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
      if (currentProject?.id === id) setCurrentProject(null);
    } else {
      try {
        await deleteDoc(doc(db, "projects", id));
        setProjects(projects.filter(p => p.id !== id));
        if (currentProject?.id === id) setCurrentProject(null);
      } catch (err) {
        console.error("Error borrando proyecto", err);
      }
    }
  };

  const openProject = (proj) => {
    setCurrentProject(proj);
    setObjects(proj.objects || []);
    setHistory([]);
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

  return (
    <div className="app-container">
      {/* Mini-Header */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: 'rgba(15,23,42,0.9)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', background: 'linear-gradient(135deg, #a78bfa, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', cursor: 'pointer' }} onClick={() => setView('editor')}>
            {currentProject ? `Visor 3D - ${currentProject.name}` : 'Visor 3D - Proyecto Nuevo'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user || isGuest ? (
            <>
              <button className="btn" onClick={() => setView('dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)' }}><FolderOpen size={16} /> Mis Proyectos</button>
              <button className="btn" onClick={handleTopBarSave} style={{ padding: '8px 16px', backgroundColor: '#10b981' }}><Save size={16} /> Guardar</button>
              {user && <div style={{ marginLeft: '12px', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14}/> {user.email}</div>}
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setView('login')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)' }}><LogIn size={16} /> Iniciar Sesión</button>
              <button className="btn" onClick={handleTopBarSave} style={{ padding: '8px 16px', backgroundColor: '#10b981' }}><Save size={16} /> Guardar</button>
            </>
          )}
        </div>
      </div>

      {/* Editor Principal (Siempre renderizado pero por debajo de las modales para no perder estado) */}
      <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0 }}>
        <Editor3D 
          project={currentProject} 
          objects={objects}
          setObjects={setObjects}
          history={history}
          setHistory={setHistory}
        />
      </div>

      {/* Pantalla Flotante de Iniciar Sesión */}
      {view === 'login' && (
        <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="ui-panel" style={{ position: 'relative', top: 'auto', left: 'auto', width: '380px', animation: 'none' }}>
            <button onClick={() => { setView('editor'); setPendingSave(false); }} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
            </button>
            
            <h1 style={{ textAlign: 'center', marginBottom: '24px' }}>Inicia Sesión</h1>
            {pendingSave && <p style={{ textAlign: 'center', marginBottom: '24px', color: '#10b981' }}>Inicia sesión para guardar tu proyecto automáticamente.</p>}
            
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
              <hr style={{ width: '100%', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
              <button className="btn" onClick={handleGoogleLogin} disabled={loading} style={{ backgroundColor: 'white', color: 'black', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuar con Google
              </button>
            </form>

            <div className="help-text" style={{ marginTop: '24px' }}>
              ¿Solo quieres echar un vistazo?<br/>
              <button onClick={handleGuest} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', textDecoration: 'underline', marginTop: '8px' }}>Continuar como Invitado</button>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla Flotante de Dashboard */}
      {view === 'dashboard' && (
        <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(10px)', zIndex: 200, overflowY: 'auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={() => setView('editor')} style={{ position: 'absolute', top: '24px', right: '40px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <X size={18} /> Volver al Editor
          </button>
          
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
      )}
    </div>
  );
}
