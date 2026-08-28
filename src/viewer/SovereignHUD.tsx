import * as React from "react";
import { SovereignBridge } from "./SovereignBridge";

const SKILL_CATEGORIES: Record<string, number[]> = {
    "Combat": [1, 2, 5, 3, 4, 7, 6, 24, 29],
    "Gathering": [13, 18, 15, 21, 10, 23, 26, 28],
    "Artisan": [14, 11, 19, 16, 17, 9, 12, 22, 27],
    "Support": [8, 20, 25]
};

const QUEST_NAMES: Record<number, string> = {
    1: "Quest Cape", 2: "Cook's Assistant", 3: "Demon Slayer", 4: "The Restless Ghost", 5: "Shield of Arrav",
    6: "Ernest the Chicken", 7: "Vampyre Slayer", 8: "Imp Catcher", 9: "Stolen Hearts", 10: "Diamond in the Rough",
    11: "What's Mine is Yours", 12: "Rune Mysteries", 13: "Rune Memories", 14: "The Knight's Sword", 15: "Goblin Diplomacy",
    16: "Pirate's Treasure", 17: "Dragon Slayer", 18: "Druidic Ritual", 19: "Lost City", 20: "Animal Magnetism"
};

const SKILL_NAMES: Record<number, string> = {
    1: "Attack", 2: "Strength", 3: "Ranged", 4: "Magic", 5: "Defence", 
    6: "Constitution", 7: "Prayer", 8: "Agility", 9: "Herblore", 10: "Thieving",
    11: "Crafting", 12: "Runecrafting", 13: "Mining", 14: "Smithing", 15: "Fishing",
    16: "Cooking", 17: "Firemaking", 18: "Woodcutting", 19: "Fletching", 20: "Slayer",
    21: "Farming", 22: "Construction", 23: "Hunter", 24: "Summoning", 25: "Dungeoneering",
    26: "Divination", 27: "Invention", 28: "Archaeology", 29: "Necromancy", 31: "Quest point"
};

export function SovereignHUD() {
    const [state, setState] = React.useState<any>(null);
    const [activeTab, setActiveTab] = React.useState<"inventory" | "skills" | "quests" | "bank" | "metadata" | "synthesis" | "editor" | "console">("inventory");
    const [logs, setLogs] = React.useState<any[]>([]);
    const [cmdInput, setCmdInput] = React.useState("");
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const bridge = SovereignBridge.getInstance();
        const handleSync = (msg: any) => {
            setState(msg.state);
        };
        const handleLog = (log: any) => {
            setLogs(prev => [...prev.slice(-99), log]);
        };
        bridge.onSync(handleSync);
        bridge.onSystemLog(handleLog);
    }, []);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (!state) return null;

    const avatar = state.avatar || {};
    const inventory = avatar.inventory || Array(28).fill(null);
    const wallet = avatar.wallet || {};
    const skills = avatar.skills || {};
    const bank = avatar.bank || [];
    const questData = avatar.quests || { points: 0, completedCount: 0, quests: {} };
    const metadata = avatar.metadata || {};
    const combat = metadata.combat_state || { necrosis: 0, souls: 0, adrenaline: 0 };

    const renderInventory = () => (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", padding: "8px", height: "100%", overflowY: "auto" }}>
            {inventory.map((item: any, i: number) => (
                <div key={i} style={{ 
                    aspectRatio: "1/1", 
                    background: "rgba(30, 30, 40, 0.5)", 
                    border: "1px solid #445", 
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    fontSize: "10px",
                    color: item ? "#fff" : "#444"
                }}>
                    {item ? `${item.id}` : ""}
                    {item && item.amount > 1 && <span style={{ position: "absolute", bottom: "2px", right: "2px", color: "#ffff00", fontSize: "8px", textShadow: "1px 1px 0px #000" }}>{item.amount}</span>}
                </div>
            ))}
        </div>
    );

    const renderSkills = () => (
        <div style={{ padding: "8px", height: "100%", overflowY: "auto" }}>
            <div style={{ fontSize: "14px", color: "#00eeff", fontWeight: "bold", marginBottom: "8px", display: "flex", justifyContent: "space-between", textShadow: "0 0 10px rgba(0,238,255,0.5)" }}>
                <span>RUNESCORE</span>
                <span>44,975</span>
            </div>
            {Object.entries(SKILL_CATEGORIES).map(([cat, ids]) => (
                <div key={cat} style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", color: "#88a", fontWeight: "bold", marginBottom: "4px", borderBottom: "1px solid #334" }}>{cat.toUpperCase()}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                        {ids.map(id => {
                            const skill = skills[id] || { level: 1, xp: 0 };
                            return (
                                <div key={id} style={{ padding: "4px", background: "rgba(20, 20, 30, 0.4)", border: "1px solid #334", borderRadius: "4px", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ color: "#aaa" }}>{SKILL_NAMES[id]}:</span>
                                    <span style={{ color: "#fff", fontWeight: "bold" }}>{skill.level}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );

    const renderQuests = () => (
        <div style={{ padding: "8px", height: "100%", overflowY: "auto" }}>
            <div style={{ fontSize: "14px", color: "#fff", fontWeight: "bold", marginBottom: "8px", borderBottom: "1px solid #334", paddingBottom: "4px", display: "flex", justifyContent: "space-between" }}>
                <span>QUEST POINTS: {questData.points} / 469</span>
                <span style={{ color: "#aaa", fontSize: "10px" }}>{questData.completedCount} DONE</span>
            </div>
            {Object.entries(QUEST_NAMES).map(([id, name]) => {
                const qId = parseInt(id);
                const quest = questData.quests[qId] || { status: 'NOT_STARTED' };
                let color = "#666";
                if (quest.status === 'COMPLETED') color = "#4f4";
                if (quest.status === 'IN_PROGRESS') color = "#ff0";
                
                return (
                    <div key={id} style={{ padding: "4px", fontSize: "11px", color, borderBottom: "1px solid #223", display: "flex", justifyContent: "space-between" }}>
                        <span>{name}</span>
                        <span style={{ fontSize: "8px" }}>{quest.status.replace('_', ' ')}</span>
                    </div>
                );
            })}
        </div>
    );

    const renderBank = () => (
        <div style={{ padding: "8px", height: "100%", overflowY: "auto" }}>
            <div style={{ fontSize: "12px", color: "#4f4", marginBottom: "8px", borderBottom: "1px solid #334", paddingBottom: "4px" }}>
                BANK SUBSTRATE
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
                {bank.map((item: any, i: number) => (
                    <div key={i} style={{ aspectRatio: "1/1", background: "rgba(30, 30, 40, 0.5)", border: "1px solid #445", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>
                        {item.id}
                    </div>
                ))}
            </div>
        </div>
    );

    const renderMetadata = () => (
        <div style={{ padding: "12px", color: "#e0e0f0" }}>
            <div style={{ fontSize: "12px", borderBottom: "1px solid #445", paddingBottom: "4px", marginBottom: "8px", color: "#88f" }}>NECROMANCY LOGIC</div>
            <div style={{ background: "rgba(50, 0, 50, 0.3)", padding: "10px", borderRadius: "8px", border: "1px solid #505" }}>
                <div style={{ fontSize: "10px", marginBottom: "4px" }}>RESIDUAL SOULS</div>
                <div style={{ display: "flex", gap: "2px" }}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} style={{ flex: 1, height: "6px", background: i < combat.souls ? "#00eeff" : "#223", borderRadius: "2px", boxShadow: i < combat.souls ? "0 0 5px #00eeff" : "none" }} />
                    ))}
                </div>
                <div style={{ fontSize: "10px", marginTop: "10px", marginBottom: "4px" }}>NECROSIS STACKS</div>
                <div style={{ display: "flex", gap: "2px" }}>
                    {[...Array(12)].map((_, i) => (
                        <div key={i} style={{ flex: 1, height: "6px", background: i < combat.necrosis ? "#ff00ff" : "#223", borderRadius: "2px", boxShadow: i < combat.necrosis ? "0 0 5px #ff00ff" : "none" }} />
                    ))}
                </div>
            </div>

            <div style={{ fontSize: "12px", borderBottom: "1px solid #445", paddingBottom: "4px", marginTop: "16px", marginBottom: "8px", color: "#ff0" }}>CHARACTER BIOMETRICS</div>
            <div style={{ fontSize: "11px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>ADRENALINE:</span> <span>{combat.adrenaline}%</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}><span>TOTAL XP:</span> <span style={{ color: "#fff" }}>1,460,251,989</span></div>
            </div>
        </div>
    );

    const renderSynthesis = () => (
        <div style={{ padding: "12px", color: "#e0e0f0" }}>
            <div style={{ fontSize: "12px", borderBottom: "1px solid #445", paddingBottom: "4px", marginBottom: "12px", color: "#00eeff", fontWeight: "bold" }}>GROUNDING STATUS (3X3)</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "16px", background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "8px" }}>
                {[-1,0,1].map(z => [-1,0,1].map(x => {
                    const cx = Math.floor(avatar.x / 64) + x;
                    const cz = Math.floor(avatar.y / 64) + z;
                    const active = x === 0 && z === 0;
                    return (
                        <div key={`${x}_${z}`} style={{ 
                            aspectRatio: "1/1", 
                            background: active ? "rgba(0,238,255,0.2)" : "rgba(30,30,50,0.5)", 
                            border: `1px solid ${active ? "#00eeff" : "#445"}`, 
                            borderRadius: "4px",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: "8px"
                        }}>
                            <div>{cx},{cz}</div>
                            <div style={{ color: active ? "#0f0" : "#667" }}>{active ? "STREAMING" : "BUFFERED"}</div>
                        </div>
                    );
                }))}
            </div>

            <div style={{ fontSize: "12px", borderBottom: "1px solid #445", paddingBottom: "4px", marginBottom: "8px", color: "#ff0" }}>GODHEAD LOGIC: VARBITS</div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "8px", border: "1px solid #445", height: "150px", overflowY: "auto", fontFamily: "'Courier New', monospace", fontSize: "10px" }}>
                {logs.filter(l => l.message.includes("Varbit") || l.message.includes("Godhead")).map((log, i) => (
                    <div key={i} style={{ color: "#00eeff", marginBottom: "2px" }}>
                        ⚡ {log.message}
                    </div>
                ))}
            </div>

            <div style={{ marginTop: "12px", padding: "8px", background: "rgba(20,50,20,0.2)", borderRadius: "4px", border: "1px solid #242" }}>
                <div style={{ fontSize: "10px", color: "#4f4" }}>ALL-PLANE MANIFESTATION ACTIVE</div>
                <div style={{ fontSize: "8px", color: "#686" }}>Vertical Grounding: Planes 0-3 synced.</div>
            </div>
        </div>
    );

    const renderConsole = () => (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "12px", background: "rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: "11px", borderBottom: "1px solid #445", paddingBottom: "4px", marginBottom: "8px", color: "#00eeff", fontWeight: "bold" }}>SYSTEM CONSOLE</div>
            
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", fontFamily: "'Courier New', monospace", fontSize: "10px", color: "#ccc", marginBottom: "12px" }}>
                {logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: "2px", borderLeft: `2px solid ${log.level === 'ERROR' ? '#f00' : log.level === 'WARN' ? '#ff0' : '#445'}`, paddingLeft: "6px" }}>
                        <span style={{ color: "#667" }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span> <span style={{ color: "#88a" }}>{log.source}:</span> {log.message}
                    </div>
                ))}
            </div>

            <input 
                id="sovereign-console-input"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && cmdInput.trim()) {
                        SovereignBridge.getInstance().handleCommand(cmdInput);
                        setCmdInput("");
                    }
                }}
                placeholder="Enter command (/teleport 3712 3328)..."
                style={{ 
                    background: "rgba(30, 30, 40, 0.8)", 
                    border: "1px solid #445", 
                    borderRadius: "4px", 
                    color: "#fff", 
                    padding: "8px", 
                    fontSize: "11px", 
                    outline: "none",
                    fontFamily: "'Courier New', monospace",
                    marginBottom: "8px"
                }}
            />
        </div>
    );

    const renderEditor = () => (
        <div style={{ padding: "12px", color: "#e0e0f0" }}>
            <div style={{ fontSize: "12px", borderBottom: "1px solid #445", paddingBottom: "4px", marginBottom: "12px", color: "#00eeff", fontWeight: "bold" }}>CACHE EDITOR (LIMB #34)</div>
            
            <div style={{ marginBottom: "16px" }}>
                <div style={{ fontSize: "10px", color: "#88a", marginBottom: "8px" }}>TRANSFORM MODE</div>
                <div style={{ display: "flex", gap: "4px" }}>
                    {["translate", "rotate", "scale"].map(mode => (
                        <button key={mode} 
                            onClick={() => {
                                const render = (globalThis as any).render;
                                if (render?.transformControls) {
                                    render.transformControls.setMode(mode);
                                }
                            }}
                            style={{ flex: 1, padding: "6px", background: "rgba(30, 30, 50, 0.5)", border: "1px solid #445", borderRadius: "4px", color: "#fff", fontSize: "10px", cursor: "pointer", textTransform: "uppercase" }}>{mode}</button>
                    ))}
                </div>
            </div>

            <div style={{ padding: "10px", background: "rgba(0, 0, 0, 0.3)", borderRadius: "8px", border: "1px solid #334" }}>
                <div style={{ fontSize: "10px", color: "#88a", marginBottom: "4px" }}>PERSISTENCE LAYER</div>
                <div style={{ fontSize: "11px", color: "#4f4" }}>● mod_layer active</div>
                <div style={{ fontSize: "9px", color: "#667", marginTop: "4px" }}>path: d:\sovereign\cache_pedagogy\modified\</div>
            </div>
        </div>
    );

    return (
        <div style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            width: "320px",
            height: "500px",
            background: "linear-gradient(135deg, rgba(15, 15, 25, 0.95) 0%, rgba(5, 5, 10, 0.98) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            color: "#e0e0f0",
            fontFamily: "'Inter', sans-serif",
            boxShadow: "0 20px 60px rgba(0,0,0,0.9), inset 0 0 20px rgba(100, 100, 255, 0.05)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            pointerEvents: "auto",
            animation: "hud-fadein 0.3s ease-out"
        }}>
            {/* Header */}
            <div style={{ padding: "16px", background: "rgba(255, 255, 255, 0.03)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff", letterSpacing: "0.5px" }}>{avatar.username || "SOVEREIGN"}</div>
                    <div style={{ fontSize: "10px", color: "#667" }}>REGION: {Math.floor(avatar.x / 64)}, {Math.floor(avatar.y / 64)} • {Math.floor(avatar.x)}, {Math.floor(avatar.y)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", color: "#f0f000", fontWeight: 700 }}>● {wallet[22159]?.toLocaleString() || 0}</div>
                    <div style={{ fontSize: "9px", color: "#445" }}>MOD: {state.activeModule || "CNS"}</div>
                </div>
            </div>

            {/* Navigation */}
            <div style={{ display: "flex", background: "rgba(0, 0, 0, 0.2)", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                {(["inventory", "skills", "quests", "metadata", "synthesis", "bank", "editor", "console"] as const).map(tab => (
                    <div key={tab} 
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            padding: "10px 0",
                            textAlign: "center",
                            fontSize: "10px",
                            fontWeight: 700,
                            cursor: "pointer",
                            background: activeTab === tab ? "rgba(255, 255, 255, 0.05)" : "transparent",
                            color: activeTab === tab ? "#fff" : "#556",
                            borderBottom: activeTab === tab ? "2px solid #00eeff" : "none",
                            transition: "all 0.2s ease"
                        }}>
                        {tab === "metadata" ? "MT" : tab === "synthesis" ? "SYN" : tab === "editor" ? "EDT" : tab === "console" ? "CON" : tab.slice(0, 3).toUpperCase()}
                    </div>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: "hidden" }}>
                {activeTab === "inventory" && renderInventory()}
                {activeTab === "skills" && renderSkills()}
                {activeTab === "quests" && renderQuests()}
                {activeTab === "metadata" && renderMetadata()}
                {activeTab === "synthesis" && renderSynthesis()}
                {activeTab === "bank" && renderBank()}
                {activeTab === "editor" && renderEditor()}
                {activeTab === "console" && renderConsole()}
            </div>

            {/* Diagnostic Footer */}
            <div style={{ padding: "10px 16px", fontSize: "9px", background: "rgba(0,0,0,0.2)", color: "#445", borderTop: "1px solid rgba(255, 255, 255, 0.05)", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#22aa44" }}>• GODHEAD-Grounding</span>
                <span>TICK {state.tick}</span>
            </div>
        </div>
    );
}
