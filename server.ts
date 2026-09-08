import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createYukiApp } from './server/app.ts';

const PORT = 3000;

async function startServer() {
  const app = createYukiApp();

  // Vite middleware for development or static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ Yuki server online at http://0.0.0.0:${PORT}`);
  });

  return app;
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});

export default startServer;
