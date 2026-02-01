const fs = require('fs');
const path = require('path');

const appsDir = '/home/neo/git/service_layer/miniapps-uniapp/apps';
const apps = fs.readdirSync(appsDir).filter(file => fs.statSync(path.join(appsDir, file)).isDirectory());

console.log(`Found ${apps.length} apps to check.`);

apps.forEach(app => {
    const viteConfigPath = path.join(appsDir, app, 'vite.config.ts');

    if (!fs.existsSync(viteConfigPath)) {
        console.log(`[${app}] No vite.config.ts found, skipping.`);
        return;
    }

    let content = fs.readFileSync(viteConfigPath, 'utf8');
    let modified = false;

    // Check if rollupOptions already exists
    if (!content.includes('rollupOptions') && content.includes('build: {')) {
        const rollupConfig = `
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', '@dcloudio/uni-app', '@dcloudio/uni-h5'],
        }
      }
    },`;

        // Insert rollupOptions inside build object
        content = content.replace(/build:\s*{([^}]*)}/s, (match, inner) => {
            // If copyPublicDir is missing, add it
            let newInner = inner;
            if (!inner.includes('copyPublicDir')) {
                newInner += '    copyPublicDir: true,\n';
            }
            // Add rollupOptions if not present in the inner block (double check)
            if (!inner.includes('rollupOptions')) {
                return `build: {${newInner}${rollupConfig}\n  }`;
            }
            return match;
        });
        modified = true;
    } else if (!content.includes('copyPublicDir') && content.includes('build: {')) {
        content = content.replace(/build:\s*{([^}]*)}/s, (match, inner) => {
            return `build: {${inner}    copyPublicDir: true,\n  }`;
        });
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(viteConfigPath, content);
        console.log(`[${app}] Optimized vite.config.ts`);
    } else {
        console.log(`[${app}] Already optimized`);
    }
});
