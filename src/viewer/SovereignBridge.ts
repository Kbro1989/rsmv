/**
 * SovereignBridge - Real-time WebSocket bridge to the POG2 Backend.
 * Decouples the 3D Viewer from the heavy POG2 Orchestrator while maintaining state parity.
 */
export class SovereignBridge {
    private static instance: SovereignBridge;
    private ws: WebSocket | null = null;
    private listeners: ((msg: any) => void)[] = [];
    private tickListeners: ((msg: any) => void)[] = [];
    private logListeners: ((log: any) => void)[] = [];
    private engine: any = null;
    private retryCount = 0;
    private state: any = {
        tick: 0,
        avatar: { x: 3200, y: 3200, plane: 0, username: 'POG2_Sovereign', isBusy: false },
        inventory: [],
        activeModule: 'idle'
    };

    private constructor() {
        this.connect();
    }

    public static getInstance(): SovereignBridge {
        if (!this.instance) {
            this.instance = new SovereignBridge();
        }
        return this.instance;
    }

    private connect() {
        // POG2 Switchboard Default Port: 8788
        this.ws = new WebSocket('ws://localhost:8788');

        this.ws.onopen = () => {
            this.retryCount = 0;
            console.log('%c[BRIDGE] Connected to Sovereign Switchboard', 'color: #00ff00; font-weight: bold;');
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'state_sync') {
                    this.state = msg.state;
                    this.notifyListeners(msg);
                } else if (msg.type === 'tick_event') {
                    this.notifyTickListeners(msg);
                } else if (msg.type === 'SYSTEM_LOG') {
                    this.notifyLogListeners(msg.payload);
                } else if (msg.type === 'log') {
                    // console.debug('[POG2 LOG]', msg.message);
                }
            } catch (err) {
                console.error('[BRIDGE] Parse error:', err);
            }
        };

        this.ws.onclose = () => {
            this.retryCount++;
            const delay = Math.min(5000 * Math.pow(2, this.retryCount - 1), 60000);
            if (this.retryCount <= 3) {
                console.warn(`[BRIDGE] Socket closed. Retry #${this.retryCount} in ${delay / 1000}s...`);
            }
            setTimeout(() => this.connect(), delay);
        };

        this.ws.onerror = (err) => {
            // console.error('[BRIDGE] Socket error:', err);
        };
    }

    public onSync(callback: (msg: any) => void) {
        this.listeners.push(callback);
    }

    public onTick(callback: (msg: any) => void) {
        this.tickListeners.push(callback);
    }

    public onSystemLog(callback: (log: any) => void) {
        this.logListeners.push(callback);
    }

    private notifyListeners(msg: any) {
        this.listeners.forEach(l => l(msg));
    }

    private notifyTickListeners(msg: any) {
        this.tickListeners.forEach(l => l(msg));
    }

    private notifyLogListeners(log: any) {
        this.logListeners.forEach(l => l(log));
    }

    public getState() {
        return this.state;
    }

    public setEngine(engine: any) {
        this.engine = engine;
    }

    /**
     * handleCommand - Clinical routing for the Sovereign Console.
     */
    public handleCommand(cmd: string) {
        const parts = cmd.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);

        this.log('CMD', 'User', `> ${cmd}`);

        switch (command) {
            case '/tp':
            case '/teleport':
                if (args.length >= 2) {
                    const x = parseInt(args[0]);
                    const z = parseInt(args[1]);
                    if (!isNaN(x) && !isNaN(z)) {
                        this.engine?.teleportTo(x, z);
                    } else {
                        this.log('ERROR', 'Bridge', 'Invalid coordinates: /tp <x> <z>');
                    }
                } else {
                    this.log('ERROR', 'Bridge', 'Usage: /tp <x> <z>');
                }
                break;

            case '/spawn':
                if (args.length >= 1) {
                    const id = parseInt(args[0]);
                    if (!isNaN(id)) {
                        this.engine?.spawnNPCCommand(id);
                    } else {
                        this.log('ERROR', 'Bridge', 'Invalid ID: /spawn <id>');
                    }
                } else {
                    this.log('ERROR', 'Bridge', 'Usage: /spawn <id>');
                }
                break;

            case '/collision':
                const active = args[0] === 'on' || args[0] === '1' || args[0] === 'true';
                this.engine?.updateCollisionOverlay(active);
                break;

            case '/export':
                this.log('INFO', 'Bridge', 'Manifesting POG2 Synthesis Export...');
                const manifest = {
                    timestamp: Date.now(),
                    chunks: this.engine?.spatialManager?.getIndexedChunkKeys() || [],
                    npcs: this.engine?.npcs?.map((n: any) => n.id) || []
                };
                console.log('[POG2 EXPORT]', manifest);
                this.log('INFO', 'Bridge', `Export Consolidated: ${manifest.chunks.length} Chunks, ${manifest.npcs.length} NPCs.`);
                break;

            default:
                // Authoritative Admin Command Relay (Phase 29)
                if (command.startsWith('::')) {
                    const rawCmd = command.substring(2);
                    this.log('CMD', 'Admin', `Relaying Authoritative Trigger: ${rawCmd}`);
                    this.sendAction(JSON.stringify({ 
                        type: 'ADMIN_COMMAND', 
                        payload: {
                            command: rawCmd,
                            args: args,
                            timestamp: Date.now()
                        } 
                    }));
                } else {
                    // Relay unknown commands to the backend orchestrator
                    this.sendAction(JSON.stringify({ type: 'CONSOLE_COMMAND', payload: cmd }));
                }
                break;
        }
    }

    /**
     * sendAction - Push a manual or autonomous action back to the backend.
     */
    public sendAction(intent: string) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                intent
            }));
        }
    }

    /**
     * log - Relay a system event to all subscribers (Clinical HUD console).
     */
    public log(level: 'INFO' | 'WARN' | 'ERROR' | 'CMD', source: string, message: string) {
        const payload = { timestamp: Date.now(), level, source, message };
        this.notifyLogListeners(payload);
        
        // Optionally relay back to orchestrator if needed for forensic persistence
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'SYSTEM_LOG', payload }));
        }
    }
}
