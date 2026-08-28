import * as React from "react";
import { UIContextReady } from "./maincomponents";
import { SovereignGrounding } from "../map/grounding_logic";

export function GroundingHUD(p: { ctx: UIContextReady | null, mapCenter: { x: number, z: number } }) {
	if (!p.ctx) return null;
	
	const [grounding, setGrounding] = React.useState<SovereignGrounding | null>(null);
	const [metadata, setMetadata] = React.useState<any>(null);
	
	React.useEffect(() => {
		SovereignGrounding.loadDefault().then(setGrounding);
	}, []);
	
	React.useEffect(() => {
		if (!grounding) return;
		const interval = setInterval(() => {
			const cam = p.ctx?.renderer.camera;
			if (!cam) return;
			
			// Map spatial coordinates to pedagogical context
			const x = Math.floor(cam.position.x / 512 + p.mapCenter.x / 512);
			const z = Math.floor(cam.position.z / 512 + p.mapCenter.z / 512);
			
			const region = grounding.getRegionMetadata(x, z);
			setMetadata(region);
		}, 500);
		
		return () => clearInterval(interval);
	}, [p.ctx, p.mapCenter, grounding]);

	if (!grounding) return <div className="grounding-hud">Spinning up Sovereign Engine...</div>;
	if (!metadata) return <div className="grounding-hud">Calibrating Aether...</div>;

	return (
		<div className="grounding-hud" style={{ padding: "10px", background: "rgba(0,0,0,0.6)", borderRadius: "8px", marginTop: "10px" }}>
			<h4 style={{ margin: "0 0 5px 0", color: "#00ffcc" }}>Sovereign Grounding</h4>
			<div><b>Region:</b> {metadata.name} ({metadata.id})</div>
			<div><b>Archetype:</b> {metadata.archetype || "Unknown"}</div>
			{metadata.varbits && metadata.varbits.length > 0 && (
				<div style={{ marginTop: "5px" }}>
					<b>Active Pedagogy:</b> {metadata.varbits.length} triggers
				</div>
			)}
		</div>
	);
}

export function VarbitMonitor(p: { ctx: UIContextReady | null }) {
	const [grounding, setGrounding] = React.useState<SovereignGrounding | null>(null);
	const [searchId, setSearchId] = React.useState("");
	const [results, setResults] = React.useState<{ npcs: number[], objects: number[] } | null>(null);

	React.useEffect(() => {
		SovereignGrounding.loadDefault().then(setGrounding);
	}, []);

	const handleSearch = () => {
		const id = parseInt(searchId);
		if (!isNaN(id) && grounding) {
			setResults(grounding.getEntitiesForVarbit(id));
		}
	};

	return (
		<div className="varbit-monitor" style={{ marginTop: "15px", borderTop: "1px solid #444", paddingTop: "10px" }}>
			<h4 style={{ margin: "0 0 5px 0", color: "#ffcc00" }}>Taxonomic Synthesis</h4>
			<div style={{ display: "flex", gap: "5px", marginBottom: "5px" }}>
				<input 
					type="number" 
					placeholder="Varbit ID" 
					value={searchId} 
					onChange={e => setSearchId(e.target.value)}
					style={{ flex: 1, background: "#222", color: "#fff", border: "1px solid #555" }}
				/>
				<button onClick={handleSearch} className="sub-btn">Query</button>
			</div>
			{results && (
				<div style={{ fontSize: "0.85em", color: "#ccc" }}>
					<div><b>NPCs:</b> {results.npcs.length > 0 ? results.npcs.join(", ") : "None"}</div>
					<div><b>Objects:</b> {results.objects.length > 0 ? results.objects.join(", ") : "None"}</div>
				</div>
			)}
		</div>
	);
}
