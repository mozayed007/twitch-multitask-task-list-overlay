import { defineConfig } from "vite";

export default defineConfig({
	build: {
		outDir: "dist",
		lib: {
			// Use enhanced version as default
			entry: "src/index-enhanced.js",
			name: "taskBot",
			formats: ["iife"],
			fileName: "taskBot",
		},
		rollupOptions: {
			output: {
				// Include all dependencies in single file
				inlineDynamicImports: true,
			},
		},
	},
	publicDir: false,
});
