import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';

// --- CONFIGURATION ---
const tursoConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
};
const turso = createClient(tursoConfig);

// --- HELPER FUNCTIONS ---
const authenticateAdmin = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Missing or invalid Authorization header');
        }
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET);
        return true;
    } catch (error) {
        throw new Error('Authentication failed: ' + error.message);
    }
};

async function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch (e) { reject(e); }
        });
    });
}

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // GETting categories is public for the homepage
        if (req.method === 'GET') {
            const result = await turso.execute('SELECT * FROM categories ORDER BY name ASC');
            return res.status(200).json({ data: result.rows });
        }
        
        // All other methods are for admins only
        authenticateAdmin(req);
        
        if (req.method === 'POST') {
            const { name } = await parseJsonBody(req);
            if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required.' });
            await turso.execute({
                sql: 'INSERT INTO categories (name) VALUES (?)',
                args: [name.trim()]
            });
            return res.status(201).json({ message: 'Category created' });
        }

        if (req.method === 'PUT') {
            const { id, name } = await parseJsonBody(req);
            if (!id || !name || !name.trim()) return res.status(400).json({ error: 'ID and name are required.' });
            await turso.execute({
                sql: 'UPDATE categories SET name = ? WHERE id = ?',
                args: [name.trim(), id]
            });
            return res.status(200).json({ message: 'Category renamed' });
        }

        if (req.method === 'DELETE') {
            const { id } = await parseJsonBody(req);
            if (!id) return res.status(400).json({ error: 'Category ID is required.' });
            // The ON DELETE CASCADE in the DB schema will handle deleting links in `book_categories`
            await turso.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
            return res.status(200).json({ message: 'Category deleted' });
        }

        return res.status(404).json({ error: 'Route not found' });
    } catch (error) {
        if (error.message.startsWith('Authentication failed')) return res.status(401).json({ error: error.message });
        console.error("Category API Error:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}