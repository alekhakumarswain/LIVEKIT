import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createToken } from './livekit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/getToken', async (req, res) => {
    const { identity, roomName } = req.query;

    if (!identity || !roomName) {
        return res.status(400).json({ error: 'Missing identity or roomName' });
    }

    try {
        const token = await createToken(identity, roomName);
        res.json({ token });
    } catch (error) {
        console.error('Error creating token:', error);
        res.status(500).json({ error: 'Failed to create token' });
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
