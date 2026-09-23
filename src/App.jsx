import React, { useState, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, TransformControls, Html } from '@react-three/drei';
import { Box as BoxIcon, Circle, Trash2, MousePointer2 } from 'lucide-react';
import './index.css';

const BasicShape = ({ id, type, position, color, dimensions, isSelected, onSelect, onTransform }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();

  // Calcular la escala de la geometría o usar dims
  const { width = 1, height = 1, depth = 1, radius = 0.6 } = dimensions || {};

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(id);
  };

  // Resaltar si está seleccionado o con hover
  const emissiveColor = isSelected ? "#333333" : (hovered ? "#111111" : "#000000");

  const renderShape = () => {
    if (type === 'cube') {
      return (
        <mesh 
          ref={meshRef} 
          position={position} 
          onClick={handleClick} 
          onPointerOver={handlePointerOver} 
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color={color} emissive={emissiveColor} roughness={0.3} metalness={0.2} />
          
          {hovered && !isSelected && (
            <Html center position={[0, height / 2 + 0.2, 0]}>
              <div className="tooltip">
                Cubo<br/>
                Ancho: <span>{width}</span> | Alto: <span>{height}</span> | Prof: <span>{depth}</span>
              </div>
            </Html>
          )}
        </mesh>
      );
    }
    
    if (type === 'sphere') {
      return (
        <mesh 
          ref={meshRef} 
          position={position} 
          onClick={handleClick} 
          onPointerOver={handlePointerOver} 
          onPointerOut={handlePointerOut}
        >
          <sphereGeometry args={[radius, 32, 32]} />
          <meshStandardMaterial color={color} emissive={emissiveColor} roughness={0.3} metalness={0.2} />
          
          {hovered && !isSelected && (
            <Html center position={[0, radius + 0.2, 0]}>
              <div className="tooltip">
                Esfera<br/>
                Radio: <span>{radius}</span>
              </div>
            </Html>
          )}
        </mesh>
      );
    }
    return null;
  };

  return (
    <>
      {renderShape()}
      {/* TransformControls si el objeto está seleccionado */}
      {isSelected && meshRef.current && (
        <TransformControls 
          object={meshRef.current} 
          mode="translate"
          onMouseUp={(e) => {
            if (meshRef.current) {
              const newPos = [
                meshRef.current.position.x,
                meshRef.current.position.y,
                meshRef.current.position.z
              ];
              onTransform(id, newPos);
            }
          }}
        />
      )}
    </>
  );
};

export default function App() {
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  
  // Estado para el modo de "colocación"
  const [placementMode, setPlacementMode] = useState(null); // 'cube' o 'sphere'
  
  // Configuración de dimensiones
  const [dims, setDims] = useState({
    width: 1,
    height: 1,
    depth: 1,
    radius: 0.6,
    elevation: 0 // altura base desde el suelo
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDims(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  // Función que se ejecuta al hacer clic en el suelo
  const handleGroundClick = (e) => {
    if (!placementMode) {
      setSelectedId(null); // Deseleccionar al hacer clic en vacío
      return;
    }

    const { x, z } = e.point;
    // La altura 'y' se calcula base de la geometría + elevación
    let yPos = dims.elevation;
    if (placementMode === 'cube') yPos += dims.height / 2;
    if (placementMode === 'sphere') yPos += dims.radius;

    const newObj = {
      id: Date.now(),
      type: placementMode,
      position: [x, yPos, z],
      dimensions: { ...dims },
      color: `hsl(${Math.random() * 360}, 80%, 60%)`
    };

    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
    setPlacementMode(null); // Desactivar el modo de poner tras crear
  };

  const handleTransform = (id, newPosition) => {
    setObjects(objects.map(obj => 
      obj.id === id ? { ...obj, position: newPosition } : obj
    ));
  };

  return (
    <div className="app-container">
      {/* UI Flotante */}
      <div className="ui-panel">
        <h1>Visor y Creador 3D</h1>
        <p>Configura las medidas y luego haz clic en "Poner..." para colocarlo en el suelo. Selecciona un objeto para moverlo.</p>
        
        <div className="settings-group">
          <div className="input-row">
            <label>Ancho (X)</label>
            <input type="number" step="0.1" name="width" value={dims.width} onChange={handleInputChange} />
          </div>
          <div className="input-row">
            <label>Alto (Y)</label>
            <input type="number" step="0.1" name="height" value={dims.height} onChange={handleInputChange} />
          </div>
          <div className="input-row">
            <label>Prof. (Z)</label>
            <input type="number" step="0.1" name="depth" value={dims.depth} onChange={handleInputChange} />
          </div>
          <div className="input-row">
            <label>Radio (Esf.)</label>
            <input type="number" step="0.1" name="radius" value={dims.radius} onChange={handleInputChange} />
          </div>
          <div className="input-row" style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
            <label title="Distancia desde el suelo">Elevación Base</label>
            <input type="number" step="0.1" name="elevation" value={dims.elevation} onChange={handleInputChange} />
          </div>
        </div>

        <div className="button-group">
          <button 
            className={`btn ${placementMode === 'cube' ? 'active' : ''}`}
            onClick={() => setPlacementMode(placementMode === 'cube' ? null : 'cube')}
          >
            {placementMode === 'cube' ? <MousePointer2 size={18} /> : <BoxIcon size={18} />}
            {placementMode === 'cube' ? 'Haz clic en el suelo...' : 'Poner Cubo'}
          </button>

          <button 
            className={`btn ${placementMode === 'sphere' ? 'active' : ''}`}
            onClick={() => setPlacementMode(placementMode === 'sphere' ? null : 'sphere')}
          >
            {placementMode === 'sphere' ? <MousePointer2 size={18} /> : <Circle size={18} />}
            {placementMode === 'sphere' ? 'Haz clic en el suelo...' : 'Poner Esfera'}
          </button>
          
          {objects.length > 0 && (
            <button onClick={() => { setObjects([]); setSelectedId(null); }} className="btn btn-danger">
              <Trash2 size={18} /> Limpiar Escena
            </button>
          )}
        </div>

        <div className="help-text">
          - <b>Para mover cámara:</b> Arrastra al fondo (sin seleccionar nada).<br/>
          - <b>Para mover objeto:</b> Hazle clic y usa las flechas 3D.
        </div>
      </div>

      {/* Entorno 3D */}
      <Canvas camera={{ position: [6, 6, 8], fov: 45 }} shadows>
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

        {/* Objetos */}
        {objects.map(obj => (
          <BasicShape 
            key={obj.id} 
            {...obj} 
            isSelected={selectedId === obj.id}
            onSelect={setSelectedId}
            onTransform={handleTransform}
          />
        ))}

        {/* Suelo Invisible para recibir clics */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, 0, 0]} 
          onPointerUp={handleGroundClick}
          receiveShadow
        >
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Sombras y Cuadrícula puramente visuales */}
        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={4} />
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#6b7280" 
          cellColor="#374151" 
          position={[0, -0.02, 0]} 
        />
        
        {/* Controles de cámara. Se desactivan si un TransformControls está usándose, 
            pero TransformControls ya lo maneja internamente en react-three/drei */}
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
}
