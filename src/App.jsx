import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows } from '@react-three/drei';
import { Box as BoxIcon, Circle, Trash2 } from 'lucide-react';
import './index.css';

// Componente para Formas Básicas
const BasicShape = ({ type, position, color, onClick }) => {
  const [hovered, setHovered] = useState(false);

  const meshProps = {
    position,
    onClick: (e) => {
      e.stopPropagation(); // Evita que el clic llegue a otros objetos debajo
      onClick();
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: (e) => {
      e.stopPropagation();
      setHovered(false);
      document.body.style.cursor = 'auto';
    }
  };

  const scale = hovered ? [1.1, 1.1, 1.1] : [1, 1, 1];

  if (type === 'cube') {
    return (
      <mesh {...meshProps} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
    );
  }
  
  if (type === 'sphere') {
    return (
      <mesh {...meshProps} scale={scale}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
    );
  }
  
  return null;
};

export default function App() {
  const [objects, setObjects] = useState([]);

  // Función para añadir una nueva forma
  const addObject = (type) => {
    const newObj = {
      id: Date.now(),
      type,
      // Posición aleatoria cerca del centro, siempre apoyado en el suelo (y=0.5 para cubo, 0.6 para esfera)
      position: [
        (Math.random() - 0.5) * 4, 
        type === 'cube' ? 0.5 : 0.6, 
        (Math.random() - 0.5) * 4
      ],
      // Color aleatorio vibrante
      color: `hsl(${Math.random() * 360}, 80%, 60%)`
    };
    setObjects([...objects, newObj]);
  };

  // Función para cambiar de color al hacer clic
  const changeColor = (id) => {
    setObjects(objects.map(obj => 
      obj.id === id 
        ? { ...obj, color: `hsl(${Math.random() * 360}, 80%, 60%)` }
        : obj
    ));
  };

  return (
    <div className="app-container">
      {/* UI Flotante */}
      <div className="ui-panel">
        <h1>Visor y Creador 3D</h1>
        <p>Crea tu escena añadiendo formas. Haz clic en ellas para cambiar su color.</p>
        
        <div className="button-group">
          <button onClick={() => addObject('cube')} className="btn">
            <BoxIcon size={18} /> Añadir Cubo
          </button>
          <button onClick={() => addObject('sphere')} className="btn">
            <Circle size={18} /> Añadir Esfera
          </button>
          
          {objects.length > 0 && (
            <button onClick={() => setObjects([])} className="btn btn-danger">
              <Trash2 size={18} /> Limpiar Escena
            </button>
          )}
        </div>

        <div className="help-text">
          Arrastra con el ratón para rotar la cámara. Scroll para zoom.
        </div>
      </div>

      {/* Entorno 3D */}
      <Canvas camera={{ position: [4, 4, 6], fov: 45 }} shadows>
        {/* Luces y Entorno */}
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize-width={1024} 
          shadow-mapSize-height={1024}
        />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>

        {/* Renderizado de objetos */}
        {objects.map(obj => (
          <BasicShape 
            key={obj.id} 
            {...obj} 
            onClick={() => changeColor(obj.id)} 
          />
        ))}

        {/* Suelo y Sombras */}
        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={20} blur={2} far={4} />
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#6b7280" 
          cellColor="#374151" 
          position={[0, -0.01, 0]} 
        />
        
        {/* Controles de cámara */}
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05} // No permite ir por debajo del suelo
        />
      </Canvas>
    </div>
  );
}
