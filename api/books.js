import { createClient } from '@libsql/client';
import { v2 as cloudinary } from 'cloudinary';

// --- CONFIGURATION ---
const tursoConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
};

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const turso = createClient(tursoConfig);

// Helper to parse JSON body since Vercel's body-parser is sometimes disabled for certain requests
async function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(data));
            } catch (e) {
                reject(e);
            }
        });
    });
}

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or a specific domain
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle pre-flight OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const result = await turso.execute('SELECT * FROM books ORDER BY title ASC');
            return res.status(200).json({ data: result.rows });
        }

        if (req.method === 'POST') {
            const { title, author, pdfUrl, publicId } = await parseJsonBody(req);
            await turso.execute({
                sql: 'INSERT INTO books (title, author, pdfUrl, publicId) VALUES (?, ?, ?, ?)',
                args: [title, author, pdfUrl, publicId],
            });
            return res.status(201).json({ message: 'Book record created' });
        }

        if (req.method === 'DELETE') {
            const bookId = req.query.id;
            if (!bookId) return res.status(400).json({ error: 'Book ID is required' });

            const result = await turso.execute({ sql: 'SELECT publicId FROM books WHERE id = ?', args: [bookId] });

            if (result.rows.length > 0) {
                const publicId = result.rows[0].publicId;
                // This part is correct. It tells Cloudinary to look for a "raw" file, not an "image".
                await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
            }


            await turso.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [bookId] });
            return res.status(200).json({ message: 'Book deleted successfully' });
        }

        return res.status(404).json({ error: 'Not Found' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}