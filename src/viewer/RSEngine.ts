import * as THREE from "three";
import { EngineCache, ThreejsSceneCache } from "../3d/modeltothree";
import { RSCompositeAvatar } from "./RSCompositeAvatar";
import { SovereignBridge } from "./SovereignBridge";
import { GameCacheLoader } from "../cache/sqlite";
import { stringToMapArea } from "../utils";

export class RSAvatarController {
    public raycaster = new THREE.Raycaster();
    public mousepos = new THREE.Vector2();

    constructor(private engine: RSEngine) {
        window.addEventListener('mousedown', (e) => {
            if (e.target && (e.target as HTMLElement).id === 'pog2-world') {
                this.handleSovereignClick(e);
            }
        });
    }

    private handleSovereignClick(e: MouseEvent) {
        if (!this.engine.camera || !this.engine.scene || !this.engine.cache) return;
        
        // Raycast logic
        this.mousepos.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mousepos.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mousepos, this.engine.camera);
        let intersects = this.raycaster.intersectObjects(this.engine.scene.children, true);
        
        if (intersects.length > 0) {
            let hit = intersects[0];
            // Get RS world coordinates (tile = RS / 512)
            let tileX = hit.point.x / 512;
            let tileZ = hit.point.z / 512;
            
            console.log(`[SOVEREIGN SENSORY] Clicked: tileX: ${Math.floor(tileX)}, tileZ: ${Math.floor(tileZ)}`);
            
            // Check if we hit an entity
            let entityId = this.getEntityIdFromMesh(hit.object);
            if (entityId !== null && this.engine.grounding?.pedagogy?.npcs) {
                let npcMeta = this.engine.grounding.pedagogy.npcs[entityId];
                console.log(`[SOVEREIGN CNS] Entity Target Acquired: ${npcMeta ? npcMeta.name : entityId}`);
                console.log(`[POG2 COMMAND] -> Interact(${entityId})`);

                // Editor Manifestation: Attach Gizmo
                if (this.engine.editorMode && (globalThis as any).render?.transformControls) {
                    console.log(`[POG2 EDITOR] Attaching Gizmo to Entity ${entityId}`);
                    (globalThis as any).render.transformControls.attach(hit.object);
                }
            } else {
                console.log(`[POG2 COMMAND] -> WalkTo(${Math.floor(tileX)}, ${Math.floor(tileZ)})`);
                // Command Engine to pathfind
                this.engine.walkAvatarTo(tileX, tileZ);
            }
        }
    }

    private getEntityIdFromMesh(obj: THREE.Object3D): number | null {
        let current: THREE.Object3D | null = obj;
        while (current) {
            if (current.name && current.name.startsWith("NPC_")) {
                return parseInt(current.name.replace("NPC_", ""));
            }
            if (current.name && current.name.startsWith("LOC_")) {
                return parseInt(current.name.replace("LOC_", ""));
            }
            current = current.parent;
        }
        return null;
    }
}

export class RSEngine {
    private lastFrameTime = 0;
    private accumulator = 0;
    private worldTickAccumulator = 0;
    private readonly TICK_RATE = 50; // 50ms RS classic tick
    private readonly WORLD_TICK = 600; // 600ms World Heartbeat
    
    // Engine State
    public cache: ThreejsSceneCache | null = null;
    public renderer: THREE.WebGLRenderer | null = null;
    public camera: THREE.PerspectiveCamera | null = null;
    public scene: THREE.Scene | null = null;
    public avatarController: RSAvatarController | null = null;
    public collisionGroup = new THREE.Group();
    public spatialManager: import("./RSSpatialManager").RSSpatialManager | null = null;
    public objectRenderer: import("./SovereignObjectRenderer").SovereignObjectRenderer | null = null;
    public grounding: import("../map/grounding_logic").SovereignGrounding | null = null;
    public modelnode = new THREE.Group();
    private avatarTileX = 544;
    private avatarTileZ = 1632;
    private lastChunkX = -1;
    private lastChunkZ = -1;
    public editorMode = false;

    // Entities
    public avatar = {
        entityId: 15516,
        position: { x: 544, y: 0, z: 1632 }, 
        targetPosition: { x: 544, y: 0, z: 1632 },
        animation: { current: -1, next: -1, tick: 0 },
        path: [] as {x: number, z: number}[],
        state: 'idle', // idle, walking
        model: null as RSCompositeAvatar | null
    };
    public npcs: { id: number, model: import("../3d/modelnodes").RSModel }[] = [];

    public async initialize(canvas: HTMLCanvasElement, opts: any) {
        console.log("RSEngine: Initializing Sovereign Canvas");
        SovereignBridge.getInstance().setEngine(this);
        
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
 
        // Editor Mode Toggle (E key)
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isConsoleFocused = activeEl?.id === 'sovereign-console-input';
            const isHUDFocused = activeEl?.closest('#sovereign-hud') !== null;

            if (isConsoleFocused || isHUDFocused) {
                // Suppress game hotkeys unless Escape/Enter/Tab
                if (e.key !== 'Tab' && e.key !== 'Escape' && e.key !== 'Enter') {
                    return;
                }
            }

            if (e.key.toLowerCase() === 'e') {
                this.editorMode = !this.editorMode;
                const msg = `Editor Mode: ${this.editorMode ? 'ACTIVE (Noclip)' : 'INACTIVE (Follow)'}`;
                SovereignBridge.getInstance().log('INFO', 'RSEngine', msg);
                SovereignBridge.getInstance().sendAction(JSON.stringify({ type: 'EDITOR_TOGGLE', value: this.editorMode }));
            }
        });

        // real-time bridge subscription
        SovereignBridge.getInstance().onSync((msg: any) => {
            const data = msg.state;
            if (data.avatar) {
                this.avatarTileX = data.avatar.x;
                this.avatarTileZ = data.avatar.y; // Standard RS coordinate swap
                this.avatar.targetPosition.x = this.avatarTileX;
                this.avatar.targetPosition.z = this.avatarTileZ;
                
                // If we're far away, snap the avatar
                const dx = Math.abs(this.avatar.position.x - this.avatarTileX);
                const dz = Math.abs(this.avatar.position.z - this.avatarTileZ);
                if (dx > 2 || dz > 2) {
                    this.avatar.position.x = this.avatarTileX;
                    this.avatar.position.z = this.avatarTileZ;
                }
            }
        });

        // Sovereign Persistence: Fallback to Legacy Save
        try {
            const { SovereignPersistence } = await import("./SovereignPersistence");
            const legacyState = await SovereignPersistence.importLegacySave();
            if (legacyState) {
                this.avatarTileX = legacyState.origin.x;
                this.avatarTileZ = legacyState.origin.z;
                console.log(`[SOVEREIGN CNS] Legacy save loaded: (${this.avatarTileX}, ${this.avatarTileZ})`);
            }
        } catch (e) {
            console.warn(`[SOVEREIGN CNS] Persistence unavailable, defaulting to baseline origin.`);
        }
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        this.scene = new THREE.Scene();
        
        // Unified World Root (Z-inverted)
        this.modelnode.scale.set(1 / 512, 1 / 512, -1 / 512);
        this.scene.add(this.modelnode);
        this.scene.add(this.collisionGroup);
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        // Base starting position (Blooming Burrow)
        this.camera.position.set(544 * 512, 1000, 1632 * -512);
        this.camera.lookAt(544 * 512, 0, 1632 * -512);
        
        this.scene.background = new THREE.Color(0x000000);

        // Add some basic light to see things
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(0, 100, 0);
        this.scene.add(dirLight);

        this.avatarController = new RSAvatarController(this);

        window.addEventListener('resize', () => {
            if (this.camera && this.renderer) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });

        const tick = (timestamp: number) => {
            const delta = timestamp - this.lastFrameTime;
            this.lastFrameTime = timestamp;
            
            this.accumulator += delta;
            this.worldTickAccumulator += delta;
            
            while (this.accumulator >= this.TICK_RATE) {
                this.update(this.TICK_RATE);
                this.accumulator -= this.TICK_RATE;
            }

            // 600ms World Pulse (Autonomous Thinking + Spatial Grounding)
            if (this.worldTickAccumulator >= this.WORLD_TICK) {
                this.ThinkingTick();
                this.worldTickAccumulator -= this.WORLD_TICK;
            }
            
            // Interpolated Avatar Motor Logic
            if (this.avatar.state === 'walking' && this.avatar.model) {
                const speed = 4; // RS units per sec roughly
                const dt = delta / 1000;
                
                const dx = this.avatar.targetPosition.x - this.avatar.position.x;
                const dz = this.avatar.targetPosition.z - this.avatar.position.z;
                const dist = Math.sqrt(dx*dx + dz*dz);
                
                if (dist < 0.1) {
                    this.avatar.state = 'idle';
                    this.avatar.position.x = this.avatar.targetPosition.x;
                    this.avatar.position.z = this.avatar.targetPosition.z;
                    if (this.avatar.model.anims.default) {
                        this.avatar.model.rsModel?.setAnimation(this.avatar.model.anims.default);
                    }
                } else {
                    const step = Math.min(dist, speed * dt);
                    this.avatar.position.x += (dx / dist) * step;
                    // Basic orientation (Z-inverted)
                    this.avatar.model.rootNode.rotation.y = Math.atan2(dx, -dz);
                }
                
                // Snap to terrain Height (World-Unit Raycast against scaled modelnode)
                if (this.scene) {
                    const rc = new THREE.Raycaster(new THREE.Vector3(this.avatar.position.x, 10000, this.avatar.position.z * -1), new THREE.Vector3(0, -1, 0));
                    const hits = rc.intersectObjects(this.scene.children, true);
                    let groundY = 0;
                    for (let h of hits) {
                        if (h.object.name?.includes("m") || h.object.name?.includes("terrain")) {
                            groundY = h.point.y;
                            break;
                        }
                    }
                    this.avatar.model.rootNode.position.set(this.avatar.position.x * 512, groundY * 512, this.avatar.position.z * 512);
                }

                // Camera follow (Z-inverted)
                if (this.camera) {
                    this.camera.position.set(this.avatar.model.rootNode.position.x + 1000, this.avatar.model.rootNode.position.y + 1000, this.avatar.model.rootNode.position.z + 1000);
                    this.camera.lookAt(this.avatar.model.rootNode.position);
                }
            } else if (this.editorMode && this.camera) {
                // Fly-cam logic (Noclip)
                // This will be handled by PointerLockControls or custom key handling in next step
            }
            
            this.render(delta);
            requestAnimationFrame(tick);
        };
        }

    private async ThinkingTick() {
        // Clinical Pulse: Scan 3x3 grid around avatar for zero-latency grounding (1,1,1,1 expansion)
        if (this.modelnode && this.spatialManager) {
            const centerX = Math.floor(this.avatarTileX / 64);
            const centerZ = Math.floor(this.avatarTileZ / 64);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const tx = (centerX + dx) * 64;
                    const tz = (centerZ + dz) * 64;
                    // Stream all 4 planes (multi-plane manifestation)
                    for (let p = 0; p < 4; p++) {
                        this.spatialManager.stream(tx, tz, this.modelnode, p);
                    }
                }
            }
        }
    }

    public async setCache(cache: ThreejsSceneCache) {
        this.cache = cache;
        const { RSSpatialManager } = await import("./RSSpatialManager");
        const { SovereignObjectRenderer } = await import("./SovereignObjectRenderer");
        
        this.spatialManager = new RSSpatialManager(this.cache);
        this.objectRenderer = new SovereignObjectRenderer(this.cache, this.modelnode);
        await this.spatialManager.initialize();
        
        // Establish Neural Link to Cache Substrate for Brute-Force Extraction
        try {
            const loader = new GameCacheLoader(); // Defaults to ProgramData path
            this.spatialManager.setCacheLoader(loader);
            console.log(`[CNS] Sovereign Spatial Substrate (SQLITE) Linked.`);
        } catch (e) {
            console.warn(`[CNS] Failed to link Cache Substrate. Brute-force scanning disabled.`, e);
        }
        
        await this.setupAvatar();

        this.setupPOG2API();

        // Trigger first stream immediately
        if (this.modelnode) {
            await this.spatialManager.stream(this.avatarTileX, this.avatarTileZ, this.modelnode);
        }
    }

    public setGrounding(grounding: import("../map/grounding_logic").SovereignGrounding) {
        this.grounding = grounding;
    }

    public walkAvatarTo(x: number, z: number) {
        this.avatar.targetPosition.x = x;
        this.avatar.targetPosition.z = z;
        this.avatar.state = 'walking';
        if (this.avatar.model?.anims.walk) {
            this.avatar.model.rsModel?.setAnimation(this.avatar.model.anims.walk);
        }
    }

    private setupPOG2API() {
        (window as any).POG2 = {
            walkTo: (x: number, z: number) => {
                console.log(`[POG2 API] Walking avatar to ${x}, ${z}`);
                this.walkAvatarTo(x, z);
            },
            interact: (id: number) => {
                console.log(`[POG2 API] Attempting interaction with entity ${id}`);
                // Lookup pedagogy metadata for rich AI context
                let name = "Unknown";
                if (this.grounding?.pedagogy?.npcs[id]) {
                    name = this.grounding.pedagogy.npcs[id].name;
                }
                console.log(`[POG2 API] Interacting with NPC: ${name}`);
            },
            scan: (mx?: number | string, mz?: number, xsize = 1, zsize?: number) => {
                if (typeof mx === "string") {
                    const area = stringToMapArea(mx);
                    if (area) {
                        for (let dx = 0; dx < area.xsize; dx++) {
                            for (let dz = 0; dz < area.zsize; dz++) {
                                this.spatialManager?.stream((area.x + dx) * 64, (area.z + dz) * 64, this.modelnode);
                            }
                        }
                        console.log(`[POG2 API] Coordinate Range Pulse: ${mx}`);
                        return;
                    }
                }

                const sz = zsize ?? xsize;
                if (typeof mx === "number" && mz !== undefined) {
                    console.log(`[POG2 API] Regional Grounding Pulse: [${mx}, ${mz}] with range [${xsize}x${sz}]`);
                    for (let dx = 0; dx < xsize; dx++) {
                        for (let dz = 0; dz < sz; dz++) {
                            // Convert Mapsquare indices back to tile units for the spatial manager
                            const tx = (mx + dx) * 64;
                            const tz = (mz + dz) * 64;
                            this.spatialManager?.stream(tx, tz, this.modelnode);
                        }
                    }
                } else {
                    console.log(`[POG2 API] Scanning Pedagogy Grounding... loaded ${Object.keys(this.grounding?.pedagogy?.npcs || {}).length} NPCs and ${Object.keys(this.grounding?.pedagogy?.objects || {}).length} Objects into Runtime Context.`);
                }
            }
        };
        console.log("[CNS] window.POG2 bridge instantiated.");
    }

    public async spawnNPC(id: number, pos: { x: number, y: number, z: number }) {
        if (!this.cache || !this.scene) return;
        const { npcToModel, RSModel } = await import("../3d/modelnodes");
        const npcInfo = await npcToModel(this.cache, { id, head: false });
        if (!npcInfo) return;

        const rsModel = new RSModel(this.cache, npcInfo.models, `NPC_${id}`, { noSkin: false });
        const loaded = await rsModel.model;

        // Apply scale if provided (Jagex scale standard is usually 128 = 100%)
        let scaleX = npcInfo.info.scaleXZ ? npcInfo.info.scaleXZ / 128 : 1;
        let scaleY = npcInfo.info.scaleY ? npcInfo.info.scaleY / 128 : 1;
        
        loaded.mesh.scale.set(scaleX, scaleY, scaleX);
        loaded.mesh.position.set(pos.x * 512, pos.y * 512, pos.z * 512);
        
        if (npcInfo.anims.default) {
            rsModel.setAnimation(npcInfo.anims.default);
        }

        this.scene.add(loaded.mesh);
        this.npcs.push({ id, model: rsModel });
        SovereignBridge.getInstance().log('INFO', 'SovereignEngine', `Spawned NPC ${id} ('${npcInfo.info.name}') at ${pos.x}, ${pos.z}`);
    }

    public async spawnNPCCommand(id: number) {
        await this.spawnNPC(id, { x: this.avatar.position.x, y: 0, z: this.avatar.position.z });
    }

    public teleportTo(x: number, z: number) {
        this.avatar.position.x = x;
        this.avatar.position.z = z;
        this.avatar.targetPosition.x = x;
        this.avatar.targetPosition.z = z;
        this.avatarTileX = x;
        this.avatarTileZ = z;
        
        if (this.avatar.model) {
            this.avatar.model.rootNode.position.set(x * 512, this.avatar.model.rootNode.position.y, z * 512);
        }
        
        if (this.camera) {
            this.camera.position.set(x * 512 + 1000, this.camera.position.y, z * 512 - 1000);
            this.camera.lookAt(x * 512, this.camera.position.y - 1000, z * 512);
        }

        SovereignBridge.getInstance().log('CMD', 'Engine', `Teleported to (${x}, ${z})`);
        
        // Trigger immediate stream
        if (this.scene && this.spatialManager) {
            this.spatialManager.stream(x, z, this.scene);
        }
    }

    private async setupAvatar() {
        if (!this.cache || !this.scene) return;
        
        const avatar = new RSCompositeAvatar(this.cache.engine, this.cache, this.avatar.entityId);
        await avatar.rebuildComposite();
        
        // Scale and position the avatar appropriately. RS map tiles are 512 units usually.
        // Wait, standard scale for characters is usually 1 in modern RS3 scenes? Or 512 for map? 
        // We'll leave scale at 1 for now and place it at Havenhythe.
        // RS3 coordinates are tile_x * 512, tile_z * 512
        const TILE_SIZE = 512;
        avatar.rootNode.position.set(this.avatar.position.x * 512, this.avatar.position.y * 512, this.avatar.position.z * 512);
        
        // Add to sovereign scene
        this.modelnode.add(avatar.rootNode);
        this.avatar.model = avatar;

        if (this.camera) {
            this.camera.position.set(this.avatar.position.x * 512 + 1000, this.avatar.position.y * 512 + 1000, this.avatar.position.z * 512 - 1000);
            this.camera.lookAt(avatar.rootNode.position);
        }

        // --- Standard Baseline: Spawn Template NPC near Havenhythe anchor ---
        this.spawnNPC(15581, { x: 3710, y: 0, z: 3328 });
    }

    private update(tickMs: number) {
        // Run logic 20 times per second
        // Check for chunk boundaries and stream if necessary
        const newChunkX = Math.floor(this.avatarTileX / 64);
        const newChunkZ = Math.floor(this.avatarTileZ / 64);
        if ((newChunkX !== this.lastChunkX || newChunkZ !== this.lastChunkZ) && this.scene && this.spatialManager) {
            this.lastChunkX = newChunkX;
            this.lastChunkZ = newChunkZ;
            this.spatialManager.stream(this.avatarTileX, this.avatarTileZ, this.scene);
        }
    }

    private render(delta: number) {
        if (this.avatar.model && this.avatar.model.rsModel) {
            this.avatar.model.rsModel.updateAnimation(delta / 1000, Date.now() / 1000);
        }
        for (const npc of this.npcs) {
            npc.model.updateAnimation(delta / 1000, Date.now() / 1000);
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    public updateCollisionOverlay(active: boolean) {
        this.collisionGroup.visible = active;
        if (!active) return;

        this.collisionGroup.clear();
        const TILE_SIZE = 512;

        if (!this.spatialManager) {
            SovereignBridge.getInstance().log('WARN', 'Editor', 'No spatial manager — collision overlay unavailable.');
            return;
        }

        const matrix = this.spatialManager.getCollisionMatrix();
        if (matrix.size === 0) {
            SovereignBridge.getInstance().log('WARN', 'Editor', 'Collision cache empty — load a synthesized region first.');
            return;
        }

        let tileCount = 0;
        let edgeCount = 0;

        // Tile planes + edge walls from real collision_matrix
        for (const [key, tile] of matrix) {
            const parts = key.split('_');
            if (parts.length !== 2) continue;
            const tx = parseInt(parts[0]);
            const tz = parseInt(parts[1]);
            if (isNaN(tx) || isNaN(tz)) continue;

            // Tile occupancy plane
            let color: number;
            if (!tile.walkable) {
                color = 0xff3030; // Blocked — red
            } else {
                switch (tile.surfaceType) {
                    case 'water':  color = 0x1a4a6b; break;
                    case 'bridge': color = 0x6b4a1a; break;
                    default:       color = 0x0a3a1a; break; // Walkable — dark green
                }
            }

            const planeGeo = new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9);
            const planeMat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: tile.walkable ? 0.25 : 0.5,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const planeMesh = new THREE.Mesh(planeGeo, planeMat);
            planeMesh.rotation.x = -Math.PI / 2;
            planeMesh.position.set(tx * TILE_SIZE + TILE_SIZE * 0.5, 3, tz * TILE_SIZE + TILE_SIZE * 0.5);
            this.collisionGroup.add(planeMesh);
            tileCount++;

            // Edge walls as thin boxes
            const edges = tile.edges;
            const wallMat = new THREE.MeshBasicMaterial({
                color: 0xff3030,
                transparent: true,
                opacity: 0.8,
                depthWrite: false
            });

            const WALL_HEIGHT = TILE_SIZE * 1.5;
            const WALL_THICK = TILE_SIZE * 0.08;

            if (edges.northBlocked) {
                const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, WALL_THICK);
                const mesh = new THREE.Mesh(geo, wallMat);
                mesh.position.set(tx * TILE_SIZE + TILE_SIZE * 0.5, WALL_HEIGHT * 0.5, (tz + 1) * TILE_SIZE);
                this.collisionGroup.add(mesh);
                edgeCount++;
            }
            if (edges.southBlocked) {
                const geo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, WALL_THICK);
                const mesh = new THREE.Mesh(geo, wallMat);
                mesh.position.set(tx * TILE_SIZE + TILE_SIZE * 0.5, WALL_HEIGHT * 0.5, tz * TILE_SIZE);
                this.collisionGroup.add(mesh);
                edgeCount++;
            }
            if (edges.eastBlocked) {
                const geo = new THREE.BoxGeometry(WALL_THICK, WALL_HEIGHT, TILE_SIZE);
                const mesh = new THREE.Mesh(geo, wallMat);
                mesh.position.set((tx + 1) * TILE_SIZE, WALL_HEIGHT * 0.5, tz * TILE_SIZE + TILE_SIZE * 0.5);
                this.collisionGroup.add(mesh);
                edgeCount++;
            }
            if (edges.westBlocked) {
                const geo = new THREE.BoxGeometry(WALL_THICK, WALL_HEIGHT, TILE_SIZE);
                const mesh = new THREE.Mesh(geo, wallMat);
                mesh.position.set(tx * TILE_SIZE, WALL_HEIGHT * 0.5, tz * TILE_SIZE + TILE_SIZE * 0.5);
                this.collisionGroup.add(mesh);
                edgeCount++;
            }
        }

        SovereignBridge.getInstance().log('INFO', 'Editor', `Collision Overlay Active: ${tileCount} tiles, ${edgeCount} edge walls from sovereign collision_matrix.`);
    }
}

export const SovereignEngine = new RSEngine();
