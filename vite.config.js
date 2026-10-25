import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'visual-effects', test: /node_modules[\\/]three[\\/]examples/ },
            { name: 'engine', test: /node_modules[\\/]three[\\/](?:build|src)/ },
            { name: 'confetti', test: /node_modules[\\/]canvas-confetti/ }
          ]
        }
      }
    }
  }
});
