const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { WebSocketServer } = require('ws');

const PORT = process.env.RSMV_STANDALONE_PORT ? parseInt(process.env.RSMV_STANDALONE_PORT, 10) : 1983;
const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'maprender.js');
const VIEWER = path.join(ROOT, 'viewer-standalone.html');

let rendererModule = null;
let currentCachePath = null;
let currentEngine = null;
let currentScene = null;

async function loadRendererModule() {
	if (rendererModule) return rendererModule;
	await fs.promises.access(DIST);
	rendererModule = require(DIST);
	return rendererModule;
}

function jsonResponse(res, status, obj) {
	res.writeHead(status, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify(obj));
}

function badRequest(res, message) {
	jsonResponse(res, 400, { ok: false, error: message });
}

function loadTopology() {
	const topoPath = path.join(ROOT, 'rs3-wiki-topology-explorer', 'topology_data.json');
	if (!fs.existsSync(topoPath)) return null;
	return JSON.parse(fs.readFileSync(topoPath, 'utf8'));
}

function loadCacheIntersections() {
	const ciPath = path.join(ROOT, 'rs3-wiki-topology-explorer', 'cache-intersections.md');
	if (!fs.existsSync(ciPath)) return '';
	return fs.readFileSync(ciPath, 'utf8');
}

async function handleLoadCache(ws, payload) {
	const cachePath = payload?.cachePath;
	if (!cachePath) throw new Error('cachePath required');
	const mod = await loadRendererModule();
	const source = new mod.GameCacheLoader(cachePath, false);
	const engine = await mod.EngineCache.create(source);
	const scene = await mod.ThreejsSceneCache.create(engine);
	currentCachePath = cachePath;
	currentEngine = engine;
	currentScene = scene;
	return { ok: true, cachePath, loaded: true };
}

async function handleRenderLoc(ws, payload) {
	if (!currentScene) throw new Error('load cache first');
	const mod = await loadRendererModule();
	const data = await mod.locToModel(currentScene, +payload?.locId);
	const models = data?.models ?? data?.info?.models;
	return { ok: true, locId: +payload?.locId, modelCount: Array.isArray(models) ? models.length : 0, models };
}

async function handleRenderItem(ws, payload) {
	if (!currentScene) throw new Error('load cache first');
	const mod = await loadRendererModule();
	const data = await mod.itemToModel(currentScene, +payload?.itemId);
	return { ok: true, itemId: +payload?.itemId, modelCount: data ? 1 : 0, modelData: data };
}

async function handleRenderNpc(ws, payload) {
	if (!currentScene) throw new Error('load cache first');
	const mod = await loadRendererModule();
	const data = await mod.npcToModel(currentScene, +payload?.npcId);
	return { ok: true, npcId: +payload?.npcId, modelCount: data ? 1 : 0, modelData: data };
}

function handleWikiCrossref(payload) {
	const locId = payload?.locId ? +payload.locId : NaN;
	const name = (payload?.name || '').toString();
	const topo = loadTopology();
	if (!topo) return { ok: true, pages: {}, related: [] };
	const pages = topo.pages || {};
	const matched = [];
	for (const [title, row] of Object.entries(pages)) {
		const id = +(row?.id);
		if (name && title.toLowerCase().includes(name.toLowerCase())) {
			matched.push({ title, id, url: row?.url, category: row?.category });
		} else if (!isNaN(locId) && id === locId) {
			matched.push({ title, id, url: row?.url, category: row?.category });
		}
	}
	const related = (topo.cross_adjacency || {})[matched[0]?.title || ''] || [];
	return { ok: true, query: { locId, name }, pages: matched.slice(0, 10), related: Array.isArray(related) ? related.slice(0, 50) : [] };
}

function handleCacheIntersections() {
	return { ok: true, text: loadCacheIntersections() };
}

function handleCaches(payload) {
	const root = (payload?.root || '').toString();
	if (!root) return { ok: true, root: '', caches: [] };
	try {
		const entries = fs.readdirSync(root, { withFileTypes: true });
		const caches = entries
			.filter(e => e.isDirectory() || /\.cache$|cache/.test(e.name))
			.map(e => ({ name: e.name, path: path.join(root, e.name), isDir: e.isDirectory() }));
		return { ok: true, root, caches };
	} catch (e) {
		return { ok: false, error: e?.message || String(e) };
	}
}

const server = http.createServer(async (req, res) => {
	const u = url.parse(req.url || '', true);
	const safe = path.normalize(u.pathname || '/').replace(/^((\.\.)(\/)?)+/, '');
	const file = path.join(ROOT, safe);
	const method = (req.method || 'GET').toUpperCase();

	console.log('REQ', method, u.pathname, 'from', req.socket.remoteAddress);

	if ((u.pathname === '/' || u.pathname === '/viewer' || u.pathname === '/viewer/') && method === 'GET') {
		const html = fs.readFileSync(VIEWER, 'utf8');
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end(html);
		return;
	}

	if (u.pathname === '/dist/maprender.js' && method === 'GET') {
		const data = fs.readFileSync(DIST);
		res.writeHead(200, { 'Content-Type': 'application/javascript' });
		res.end(data);
		return;
	}

	if (u.pathname === '/api/caches' && method === 'GET') {
		const root = (u.query.root || '').toString();
		if (!root) { jsonResponse(res, 200, { root: '', caches: [] }); return; }
		try {
			const entries = fs.readdirSync(root, { withFileTypes: true });
			const caches = entries
				.filter(e => e.isDirectory() || /\.cache$|cache/.test(e.name))
				.map(e => ({ name: e.name, path: path.join(root, e.name), isDir: e.isDirectory() }));
			jsonResponse(res, 200, { root, caches });
		} catch (e) { badRequest(res, e?.message || String(e)); }
		return;
	}

	res.writeHead(404);
	res.end('not found');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
	console.log('WS open', req.url);

	ws.on('message', async (message) => {
		let payload;
		try { payload = JSON.parse(message.toString()); }
		catch (e) { ws.send(JSON.stringify({ ok: false, error: 'invalid json' })); return; }

		const action = (payload?.action || '').toString();
		try {
			let result;
			if (action === 'load-cache') result = await handleLoadCache(ws, payload);
			else if (action === 'render-loc') result = await handleRenderLoc(ws, payload);
			else if (action === 'render-item') result = await handleRenderItem(ws, payload);
			else if (action === 'render-npc') result = await handleRenderNpc(ws, payload);
			else if (action === 'caches') result = await handleCaches(payload);
			else if (action === 'wiki-crossref') result = handleWikiCrossref(payload);
			else if (action === 'cache-intersections') result = handleCacheIntersections();
			else result = { ok: false, error: `unknown action: ${action}` };

			ws.send(JSON.stringify({ id: payload?.id, ...result }));
		} catch (e) {
			ws.send(JSON.stringify({ id: payload?.id, ok: false, error: e?.message || String(e) }));
		}
	});

	ws.on('close', () => {
		console.log('WS close');
	});
});

server.listen(PORT, () => {
	console.log(`RSMV standalone viewer bridge on http://localhost:${PORT}/viewer`);
	console.log(`Using dist ${DIST}`);
	console.log(`BOOTSTRAP_OK path=${ROOT} pid=${process.pid}`);
});
