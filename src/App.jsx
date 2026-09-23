import React, { useState, Suspense, useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
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
  if (type === 'cylinder') {
    const { radius = 0.6, height = 1 } = dimensions;
    return {
      minX: x - radius, maxX: x + radius,
      minY: y - height / 2, maxY: y + height / 2,
      minZ: z - radius, maxZ: z + radius
    };
  }
  if (type === 'ramp') {
    const { width = 1, height = 1, depth = 1 } = dimensions;
    return {
      minX: x - width / 2, maxX: x + width / 2,
      minY: y - height / 2, maxY: y + height / 2,
      minZ: z - depth / 2, maxZ: z + depth / 2
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
  const rx = (myType === 'cube' || myType === 'ramp') ? width / 2 : radius;
  const ry = (myType === 'cube' || myType === 'ramp' || myType === 'cylinder') ? height / 2 : radius;
  const rz = (myType === 'cube' || myType === 'ramp') ? depth / 2 : radius;

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

  const rampGeom = useMemo(() => {
    if (type !== 'ramp') return null;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, height);
    shape.lineTo(depth, 0);
    shape.lineTo(0, 0);
    const geom = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
    geom.rotateY(-Math.PI / 2);
    geom.center();
    return geom;
  }, [type, width, height, depth]);

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
    
    const yOffset = (type === 'cube' || type === 'ramp' || type === 'cylinder') ? height / 2 + 0.3 : radius + 0.3;

    return (
      <Html center position={[0, yOffset, 0]}>
        <div className="tooltip">
          <b>
            {type === 'cube' && 'Cubo'}
            {type === 'sphere' && 'Esfera'}
            {type === 'cylinder' && 'Cilindro'}
            {type === 'ramp' && 'Rampa'}
          </b><br/>
          {(type === 'cube' || type === 'ramp')
            ? <>Dim: <span>{width}x{height}x{depth}</span></> 
            : (type === 'cylinder' 
                ? <>Rad: <span>{radius}</span>, Alt: <span>{height}</span></>
                : <>Radio: <span>{radius}</span></>)}
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

    if (type === 'cylinder') {
      return (
        <mesh 
          ref={meshRef} 
          position={position} 
          onClick={handleClick} 
          onPointerOver={handlePointerOver} 
          onPointerOut={handlePointerOut}
        >
          <cylinderGeometry args={[radius, radius, height, 32]} />
          <meshStandardMaterial color={color} emissive={emissiveColor} roughness={0.3} metalness={0.2} />
          {renderTooltip()}
        </mesh>
      );
    }

    if (type === 'ramp' && rampGeom) {
      return (
        <mesh 
          ref={meshRef} 
          position={position} 
          onClick={handleClick} 
          onPointerOver={handlePointerOver} 
          onPointerOut={handlePointerOut}
        >
          <primitive object={rampGeom} attach="geometry" />
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
  const [selectedShape, setSelectedShape] = useState('cube');
  
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
    if (placementMode === 'cube' || placementMode === 'ramp' || placementMode === 'cylinder') yPos += dims.height / 2;
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

          <div className="input-row" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
            <label>Figura</label>
            <select 
              value={selectedShape} 
              onChange={(e) => setSelectedShape(e.target.value)}
              style={{ width: '100%', padding: '6px', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', outline: 'none' }}
            >
              <option value="cube">Cubo</option>
              <option value="sphere">Esfera</option>
              <option value="cylinder">Cilindro</option>
              <option value="ramp">Rampa</option>
            </select>
          </div>
        </div>

        <div className="button-group">
          <button 
            className={`btn ${placementMode ? 'active' : ''}`}
            onClick={() => setPlacementMode(placementMode ? null : selectedShape)}
          >
            <MousePointer2 size={18} />
            {placementMode ? 'Haz clic en el suelo...' : 'Poner Figura'}
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
