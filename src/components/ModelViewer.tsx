import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';

const ModelViewer: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [model, setModel] = useState<THREE.Object3D | null>(null);
    const [color, setColor] = useState('#ffffff');

    useEffect(() => {
        if (!mountRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcccccc);

        const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
        mountRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(5, 10, 7);
        scene.add(light);

        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Placeholder for model loading
        // In the next phase, this will be connected to the Sovereign EngineCache
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        scene.add(cube);
        setModel(cube);


        return () => {
            mountRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setColor(e.target.value);
        if (model) {
            ((model as THREE.Mesh).material as any).color.set(e.target.value);
        }
    };

    const exportModel = (format: 'gltf' | 'obj') => {
        if (!model) return;

        if (format === 'gltf') {
            const gltfExporter = new GLTFExporter();
            gltfExporter.parse(
                model,
                (result) => {
                    const data = typeof result === 'object' ? JSON.stringify(result) : result;
                    const blob = new Blob([data as any], { type: 'application/json' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'model.gltf';
                    link.click();
                },
                (error) => { console.error('GLTF export error:', error); },
                { binary: false }
            );
        } else {
            const objExporter = new OBJExporter();
            const result = objExporter.parse(model);
            const blob = new Blob([result], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'model.obj';
            link.click();
        }
    };

    return (
        <div className="rsmv-viewer-container">
            <div ref={mountRef} style={{ width: '100%', height: '500px', borderRadius: '8px', overflow: 'hidden' }}></div>
            <div className="rsmv-controls" style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="color" value={color} onChange={handleColorChange} style={{ height: '32px', width: '32px', padding: '0', border: 'none', borderRadius: '4px' }} />
                <button onClick={() => exportModel('gltf')} style={{ padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Export GLTF</button>
                <button onClick={() => exportModel('obj')} style={{ padding: '8px 16px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Export OBJ</button>
            </div>
        </div>
    );
};

export default ModelViewer;
