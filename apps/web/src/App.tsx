import { useState, useRef, useEffect } from 'react'
import * as Comlink from 'comlink'
import { GanCubeAdapter } from '@cubeforge/hardware-hal'
import { SyncBridge } from '@cubeforge/cube-3d-engine'
import type { EngineWorkerAPI } from '@cubeforge/cube-3d-engine'

// Instantiate worker using native Vite handling
import EngineWorker from '@cubeforge/cube-3d-engine/src/workers/EngineWorker?worker'

import './App.css'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Disconnected');
  const [showMacInput, setShowMacInput] = useState(false);
  const [manualMac, setManualMac] = useState('');
  
  const workerProxy = useRef<Comlink.Remote<EngineWorkerAPI>>(null);
  const syncBridge = useRef<SyncBridge>(null);
  const workerInstance = useRef<Worker>(null);

  const isInitialized = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || isInitialized.current) return;
    isInitialized.current = true;
    
    // Setup Worker
    workerInstance.current = new EngineWorker();
    workerProxy.current = Comlink.wrap<EngineWorkerAPI>(workerInstance.current);
    syncBridge.current = new SyncBridge(workerProxy.current);

    // Setup OffscreenCanvas robustly for HMR
    let offscreen: OffscreenCanvas;
    try {
      offscreen = canvasRef.current.transferControlToOffscreen();
    } catch {
      console.warn('Canvas already transferred by previous render');
      return; // Abort second initialization
    }
    
    // Init Engine
    workerProxy.current.init(
      Comlink.transfer(offscreen, [offscreen]), 
      canvasRef.current.clientWidth, 
      canvasRef.current.clientHeight, 
      window.devicePixelRatio
    );

    return () => {
      // In strict mode dev, React unmounts and remounts.
      // But we can't un-transfer a canvas. So we only clean up if the component truly dies.
      // For a robust dev environment, it's better to just keep it alive or recreate the canvas.
    }
  }, []);

  const connectCube = async () => {
    try {
      setStatus('Connecting...');
      const adapter = new GanCubeAdapter();
      await adapter.connect(showMacInput ? manualMac : undefined);
      setStatus('Connected!');
      setShowMacInput(false);
      
      // Bind moves and gyroscope streams from the HAL to the 3D engine
      if (syncBridge.current && adapter.moves$) {
        syncBridge.current.bindCube(adapter.moves$, adapter.gyro$);
      }
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : String(e);
      // MAC_REQUIRED is thrown by GanCubeAdapter; errors about 'requestDevice' usually
      // mean the Web Bluetooth API is blocked by the browser (missing experimental flag).
      const requiresExperimental = errMsg === 'MAC_REQUIRED' || errMsg.includes('requestDevice') || errMsg.includes('bluetooth') || !('bluetooth' in navigator);
      
      if (requiresExperimental) {
        setStatus('Automatic MAC reading or Web Bluetooth is blocked by the browser.');
        setShowMacInput(true);
      } else {
        setStatus('Failed to connect: ' + errMsg);
      }
    }
  }

  const calibrateGyro = () => {
    if (workerProxy.current) {
      workerProxy.current.calibrateGyro();
    }
  }

  const instructions = /Edg\//i.test(navigator.userAgent) 
    ? 'edge://flags/#enable-experimental-web-platform-features'
    : 'chrome://flags/#enable-experimental-web-platform-features';

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>CubeForge Engine Test</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={connectCube} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
            Connect GAN Cube
          </button>
          <button onClick={calibrateGyro} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
            Calibrate Gyro
          </button>
        </div>
        <p style={{ fontWeight: 'bold' }}>Status: {status}</p>

        {showMacInput && (
          <div style={{ background: '#333', padding: '15px', borderRadius: '8px', color: '#fff', maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ marginBottom: '10px' }}>Your browser blocks automatic MAC reading. To fix this permanently, copy and paste this in a new tab and enable the flag:</p>
            <code style={{ background: '#111', padding: '5px', display: 'block', marginBottom: '15px' }}>{instructions}</code>
            <p style={{ marginBottom: '10px' }}>Or enter the MAC address manually (e.g. AA:BB:CC:DD:EE:FF):</p>
            <input 
              type="text" 
              value={manualMac} 
              onChange={e => setManualMac(e.target.value)} 
              placeholder="MAC Address"
              style={{ padding: '8px', width: '200px' }}
            />
          </div>
        )}
      </div>

      <canvas 
        ref={canvasRef} 
        style={{ width: '400px', height: '400px', backgroundColor: '#1e1e1e', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} 
        width="400" 
        height="400"
      />
      <p style={{ maxWidth: '600px', textAlign: 'center', color: '#666', lineHeight: 1.5 }}>
        Perform moves on your physical cube. The hardware HAL will decode them and send them to the Web Worker via RxJS and Comlink, bypassing the React main thread for pure 60FPS tweening.
      </p>
    </main>
  )
}

export default App
