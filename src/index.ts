import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import router from './routes/index';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3000;
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:5173';

app.use(cors({ origin: DASHBOARD_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', router);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ChatChef server running on port ${PORT}`);
});

export default app;
