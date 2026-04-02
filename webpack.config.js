const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/**
 * @type {import("webpack").Configuration}
 */
module.exports = {
	devtool: false,
	mode: "development",
	entry: {
		main: "./src/main.ts",
		electronviewer: "./src/viewer/",
		cli: "./src/cli.ts",
		api: "./src/headless/api",
		buildfiletypes: "./src/buildfiletypes.ts",
		maprender: "./src/map/mapcli.ts",
		runbrowser: "./src/headless/runbrowser.ts",
		extract_sovereign_taxonomic: "./src/scripts/extract_sovereign_taxonomic.ts",
		extract_spatial_grounding: "./src/scripts/extract_spatial_grounding.ts",
		research_npc_spawns: "./src/scripts/research_npc_spawns.ts",
		probe_dbrows: "./src/scripts/probe_dbrows.ts",
		probe_dbtables: "./src/scripts/probe_dbtables.ts",
		probe_hex: "./src/scripts/probe_hex.ts",
		probe_items: "./src/scripts/probe_items.ts",
		probe_npcs: "./src/scripts/probe_npcs.ts",
		probe_sextant: "./src/scripts/probe_sextant.ts",
		dump_script: "./src/scripts/dump_script.ts",
		probe_table39: "./src/scripts/probe_table39.ts",
		list_grounded: "./src/scripts/list_grounded.ts",
		scan_table39: "./src/scripts/scan_table39.ts",
		probe_locales: "./src/scripts/probe_locales.ts",
		probe_map_npcs: "./src/scripts/probe_map_npcs.ts",
		probe_row2353: "./src/scripts/probe_row2353.ts",
		clear_grounded: "./src/scripts/clear_grounded.ts",
		audit_pedagogy: "./src/scripts/audit_pedagogy.ts",
		extract_prifddinas_logic: "./src/scripts/extract_prifddinas_logic.ts",
		probe_all_tables: "./src/scripts/probe_all_tables.ts",
		ground_prifddinas: "./src/scripts/ground_prifddinas.ts",
		research_prifddinas_interactions: "./src/scripts/research_prifddinas_interactions.ts",
		probe_enums: "./src/scripts/probe_enums.ts",
		probe_item_id: "./src/scripts/probe_item_id.ts",
		synthesize_prifddinas: "./src/scripts/synthesize_prifddinas.ts"
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
				options: {
					onlyCompileBundledFiles: true
				}
			},
			{
				test: /\.jsonc?$/,
				type: "asset/source"
			},
			{
				test: /\.glsl(\.c)?$/,
				type: "asset/source"
			}
		],
	},
	target: "node",
	externals: {
		// "fs", "net", "path", "os", "util", "assert",
		"sqlite3": { commonjs: "sqlite3" },
		"better-sqlite3": { commonjs: "better-sqlite3" },
		"electron": { commonjs: "electron" },
		"electron/main": { commonjs: "electron/main" },
		"electron/renderer": { commonjs: "electron/renderer" },
		"sharp": { commonjs: "sharp" },
		"zlib": { commonjs: "zlib" },
		"lzma": { commonjs: "lzma" },
		"comment-json": { commonjs: "comment-json" },
		"gl": { commonjs: "gl" },
		"canvas": { commonjs: "canvas" }
	},
	resolve: {
		extensions: ['.tsx', '.ts', '.js'],
		extensionAlias: {
			".js": [".js", ".ts", ".tsx"]
		},
		alias: {
			"sql.js/dist/sql-wasm-workerfs.js": path.resolve(__dirname, "src/libs/sqljsfork/dist/sql-wasm-workerfs.js")
		}
	},
	externalsType: "commonjs",
	output: {
		libraryTarget: "commonjs",
		filename: "[name].js",
		chunkFilename: "generated/[contenthash].js",
		assetModuleFilename: "generated/[contenthash][ext]",
		webassemblyModuleFilename: "generated/[contenthash][ext]",
		path: path.resolve(__dirname, 'dist')
	},
	plugins: [
		new CopyWebpackPlugin({
			patterns: [
				{ from: 'src/assets', to: "assets" }
			]
		})
	]
};