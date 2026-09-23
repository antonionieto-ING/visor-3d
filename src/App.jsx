import React, { useState, Suspense, useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows, TransformControls, Html } from '@react-three/drei';
import { Box as BoxIcon, Circle, Trash2, MousePointer2 } from 'lucide-react';
import './index.css';

// --- FUNCIONES DE COLISIÓN ---
const getAABB = (objPosition, type, dimensions) => {
  const [x, y, z] = objPosition;
  if (type === 'cube') {
    const { width = 1, height = 1, depth = 1 } = dimensions;
    return {
      minX: x - width / 2, maxX: x + width / 2,
      minY: y - height / 2, maxY: y + height / 2,
      minZ: z - depth / 2, maxZ: z + depth / 2
    };
  }
  if (type === 'sphere') {
    const { radius = 0.6 } = dimensions;
    return {
      minX: x - radius, maxX: x + radius,
      minY: y - radius, maxY: y + radius,
      minZ: z - radius, maxZ: z + radius
    };
  }
  return null;
};

const checkOverlap = (boxA, boxB) => {
  if (!boxA || !boxB) return false;
  return (
    boxA.minX < boxB.maxX &&
    boxA.maxX > boxB.minX &&
    boxA.minY < boxB.maxY &&
    boxA.maxY > boxB.minY &&
    boxA.minZ < boxB.maxZ &&
    boxA.maxZ > boxB.minZ
  );
};

// Resuelve la colisión eje por eje para permitir deslizarse y quedar completamente pegado
const resolveCollision = (lastPos, newPos, myType, myDims, allObjects, myId) => {
  let [x, y, z] = newPos;
  const [lastX, lastY, lastZ] = lastPos;

  const { width = 1, height = 1, depth = 1, radius = 0.6 } = myDims;
  const rx = myType === 'cube' ? width / 2 : radius;
  const ry = myType === 'cube' ? height / 2 : radius;
  const rz = myType === 'cube' ? depth / 2 : radius;

  // EPSILON para evitar problemas de precisión de coma flotante al quedar pegados
  const EPS = 0.001;

  // Comprobar colisión con el suelo (Y=0)
  if (y - ry < 0) {
    y = ry + EPS; // Impedir que atraviese el suelo
  }

  // Comprobar eje X
  let tempBox = getAABB([x, lastY, lastZ], myType, myDims);
  for (const obj of allObjects) {
    if (obj.id === myId) continue;
    const otherBox = getAABB(obj.position, obj.type, obj.dimensions);
    if (checkOverlap(tempBox, otherBox)) {
      if (x > lastX) x = otherBox.minX - rx - EPS; // Movimiento hacia la derecha
      else x = otherBox.maxX + rx + EPS; // Movimiento hacia la izquierda
      break;
    }
  }

  // Comprobar eje Y (solo contra otros objetos, el suelo ya se comprobó)
  tempBox = getAABB([x, y, lastZ], myType, myDims);
  for (const obj of allObjects) {
    if (obj.id === myId) continue;
    const otherBox = getAABB(obj.position, obj.type, obj.dimensions);
    if (checkOverlap(tempBox, otherBox)) {
      if (y > lastY) y = otherBox.minY - ry - EPS;
      else y = otherBox.maxY + ry + EPS;
      break;
    }
  }

  // Comprobar eje Z
  tempBox = getAABB([x, y, z], myType, myDims);
  for (const obj of allObjects) {
    if (obj.id === myId) continue;
    const otherBox = getAABB(obj.position, obj.type, obj.dimensions);
    if (checkOverlap(tempBox, otherBox)) {
      if (z > lastZ) z = otherBox.minZ - rz - EPS;
      else z = otherBox.maxZ + rz + EPS;
      break;
    }
  }

  return [x, y, z];
};

// Componente para Formas Básicas
const BasicShape = ({ id, type, position, color, dimensions, isSelected, onSelect, onTransformEnd, allowOverlap, allObjects }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();
  
  // Guardamos la última posición válida conocida para revertir si hay colisión
  const lastValidPosition = useRef([...position]);
  const currentPos = useRef([...position]);

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

  const emissiveColor = isSelected ? "#333333" : (hovered ? "#111111" : "#000000");

  // Función que se ejecuta continuamente mientras arrastras
  const handleTransformChange = () => {
    if (!meshRef.current) return;
    
    let newPos = [meshRef.current.position.x, meshRef.current.position.y, meshRef.current.position.z];
    
    if (!allowOverlap) {
      newPos = resolveCollision(lastValidPosition.current, newPos, type, dimensions, allObjects, id);
      meshRef.current.position.set(...newPos);
    }
    
    lastValidPosition.current = [...newPos];
    currentPos.current = [...newPos];
  };

  const renderTooltip = () => {
    if (!hovered || isSelected) return null;
    
    // Usamos el ref para coordenadas en tiempo real sin re-renderizar todo
    const pos = currentPos.current;
    const x = pos[0].toFixed(2);
    const y = pos[1].toFixed(2);
    const z = pos[2].toFixed(2);

    return (
      <Html center position={[0, type === 'cube' ? height / 2 + 0.3 : radius + 0.3, 0]}>
        <div className="tooltip">
          <b>{type === 'cube' ? 'Cubo' : 'Esfera'}</b><br/>
          {type === 'cube' 
            ? <>Dim: <span>{width}x{height}x{depth}</span></> 
            : <>Radio: <span>{radius}</span></>}
          <br/>
          Pos: <span>X:{x} Y:{y} Z:{z}</span>
        </div>
      </Html>
    );
  };

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
          {renderTooltip()}
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
          {renderTooltip()}
        </mesh>
      );
    }
    return null;
  };

  return (
    <>
      {renderShape()}
      {isSelected && meshRef.current && (
        <TransformControls 
          object={meshRef.current} 
          mode="translate"
          onChange={handleTransformChange}
          onMouseUp={() => {
            if (meshRef.current) {
              const finalPos = [meshRef.current.position.x, meshRef.current.position.y, meshRef.current.position.z];
              onTransformEnd(id, finalPos);
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
  const [placementMode, setPlacementMode] = useState(null);
  const [allowOverlap, setAllowOverlap] = useState(true);
  
  const [dims, setDims] = useState({
    width: 1,
    height: 1,
    depth: 1,
    radius: 0.6,
    elevation: 0
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDims(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  // Cuando hacemos clic en el suelo para colocar algo
  const handleGroundClick = (e) => {
    if (!placementMode) {
      setSelectedId(null);
      return;
    }

    const { x, z } = e.point;
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

    // Validar colisión inicial si no se permite superposición
    if (!allowOverlap) {
      const myBox = getAABB(newObj.position, newObj.type, newObj.dimensions);
      let collision = false;
      for (const obj of objects) {
        const otherBox = getAABB(obj.position, obj.type, obj.dimensions);
        if (checkOverlap(myBox, otherBox)) {
          collision = true; break;
        }
      }
      if (collision) {
        // No creamos el objeto si cae encima de otro
        return;
      }
    }

    setObjects([...objects, newObj]);
    setSelectedId(newObj.id);
    setPlacementMode(null);
  };

  // Cuando soltamos el objeto tras moverlo, guardamos el estado final en React
  const handleTransformEnd = (id, newPosition) => {
    setObjects(objects.map(obj => 
      obj.id === id ? { ...obj, position: newPosition } : obj
    ));
  };

  return (
    <div className="app-container">
      <div className="ui-panel">
        <h1>Visor y Creador 3D</h1>
        <p>Configura las medidas y haz clic en "Poner" para colocarlo. Usa las flechas 3D para mover.</p>
        
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
          
          <div className="switch-container">
            <label className="switch-label">Permitir superposición</label>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={allowOverlap} 
                onChange={(e) => setAllowOverlap(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
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
          - <b>Movimiento Diagonal:</b> Arrastra los cuadraditos del centro de las flechas.<br/>
          - <b>Para deseleccionar:</b> Haz clic en el fondo vacío y podrás rotar la cámara.
        </div>
      </div>

      <Canvas 
        camera={{ position: [6, 6, 8], fov: 45 }} 
        shadows
        onPointerMissed={(e) => {
          if (e.button === 0 && !placementMode) {
            setSelectedId(null);
          }
        }}
      >
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

        {objects.map(obj => (
          <BasicShape 
            key={obj.id} 
            {...obj} 
            isSelected={selectedId === obj.id}
            onSelect={setSelectedId}
            onTransformEnd={handleTransformEnd}
            allowOverlap={allowOverlap}
            allObjects={objects}
          />
        ))}

        {/* Usamos onClick en lugar de onPointerUp para no bloquear el drag de la cámara */}
        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, 0, 0]} 
          onClick={(e) => {
            e.stopPropagation();
            if(placementMode) {
              handleGroundClick(e);
            } else {
              setSelectedId(null);
            }
          }}
          receiveShadow
        >
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={20} blur={2} far={4} />
        <Grid 
          infiniteGrid 
          fadeDistance={30} 
          sectionColor="#6b7280" 
          cellColor="#374151" 
          position={[0, -0.02, 0]} 
        />
        
        {/* React Three Drei gestionará automáticamente este OrbitControls gracias a makeDefault */}
        <OrbitControls 
          makeDefault 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
      </Canvas>
    </div>
  );
}
