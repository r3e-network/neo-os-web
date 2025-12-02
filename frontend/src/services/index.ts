/**
 * Service Plugins Auto-Loader
 *
 * This file automatically imports and registers all service plugins.
 * Each service plugin should be placed in its own directory under src/services/
 * and export a default registration that calls registerServicePlugin().
 *
 * To add a new service plugin:
 * 1. Create a new directory: src/services/{service-name}/
 * 2. Create index.tsx with your plugin components
 * 3. Call registerServicePlugin() in your index.tsx
 * 4. Import the plugin here
 *
 * The build system will automatically bundle all registered plugins.
 */

// Import all service plugins
// Each plugin self-registers via registerServicePlugin()
import './oracle';
import './vrf';
import './gasbank';

// Export a function to verify plugins are loaded
export function getLoadedPlugins(): string[] {
  return ['oracle', 'vrf', 'gasbank'];
}

// Log loaded plugins in development
if (import.meta.env.DEV) {
  console.log('[Service Layer] Loaded service plugins:', getLoadedPlugins());
}
