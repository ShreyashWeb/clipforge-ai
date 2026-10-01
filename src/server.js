import 'dotenv/config';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`ClipForge AI server listening on port ${port}`);
  });
}

export default app;
