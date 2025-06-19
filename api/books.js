import { createClient } from '@libsql/client';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken'; // Import jwt

// --- CONFIGURATION ---
// These environment variables must be set in your Vercel project settings
// and in a local .env.local file for development.
const tursoConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
};

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize the database client
const turso = createClient(tursoConfig);

// Helper function to safely parse the request body as JSON
async function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                // If the body is empty, resolve with an empty object to avoid errors
                if (data) {
                    resolve(JSON.parse(data));
                } else {
                    resolve({});
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// --- NEW: Security Middleware ---
const authenticateAdmin = (req) => {
    // A function that returns true if authenticated, otherwise throws an error
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Missing or invalid Authorization header');
        }
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET); // This will throw an error if token is invalid or expired
        return true;
    } catch (error) {
        throw new Error('Authentication failed: ' + error.message);
    }
};

// --- MAIN API HANDLER ---
// This single function handles all requests to /api/books and its sub-routes.
export default async function handler(req, res) {
    // Set CORS headers to allow requests from any origin.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle pre-flight OPTIONS requests sent by browsers
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            // --- The browser sends "history of india" as "history+of+india" in req.query.q.
            // This logic correctly decodes it back into spaces and is UNCHANGED.
            const rawSearchTerm = req.query.q || '';
            const searchTerm = decodeURIComponent(rawSearchTerm.replace(/\+/g, ' '));
            // ---

            console.log(`[API_DEBUG] 1. Received search request. Raw Term: "${rawSearchTerm}", Decoded Term: "${searchTerm}"`);

            if (searchTerm.trim()) {
                const likeQuery = '%' + searchTerm.trim().toLowerCase().split(/\s+/).join('%') + '%';

                // --- THIS IS THE FIX ---
                // We change the SQL statement to select ALL columns using '*'
                // instead of just specific ones. This ensures 'pdfUrl' is included.
                const sql = `SELECT * FROM books 
                             WHERE LOWER(title) LIKE ? OR LOWER(author) LIKE ? OR LOWER(bookNumber) LIKE ? 
                             ORDER BY id DESC`;
                // --- END OF FIX ---

                const args = [likeQuery, likeQuery, likeQuery];

                console.log(`[API_DEBUG] 2. Generated 'likeQuery':`, likeQuery);
                console.log(`[API_DEBUG] 3. SQL statement sent to Turso:`, sql);
                console.log(`[API_DEBUG] 4. Arguments sent to Turso:`, args);

                const result = await turso.execute({ sql, args });

                console.log(`[API_DEBUG] 5. Turso database returned ${result.rows.length} rows.`);
                return res.status(200).json({ data: result.rows });
            } else {
                // This part was already correct and is UNCHANGED.
                console.log(`[API_DEBUG] No search term provided. Fetching all books.`);
                const result = await turso.execute('SELECT * FROM books ORDER BY id DESC');
                return res.status(200).json({ data: result.rows });
            }
        }

        authenticateAdmin(req);

        // --- POST: Add a single new book ---
        if (req.method === 'POST') {
            const { title, author, bookNumber, pdfUrl, publicId } = await parseJsonBody(req);

            if (!title) {
                return res.status(400).json({ error: "Title is a required field." });
            }

            await turso.execute({
                sql: 'INSERT INTO books (title, author, bookNumber, pdfUrl, publicId) VALUES (?, ?, ?, ?, ?)',
                args: [title, author, bookNumber, pdfUrl, publicId],
            });
            return res.status(201).json({ message: 'Book created successfully' });
        }

        // --- PUT: Edit an existing book ---
        if (req.method === 'PUT') {
            const bookId = req.query.id;
            if (!bookId) return res.status(400).json({ error: 'Book ID is required for an update.' });

            // This line gets the data from the frontend request
            const rawData = await parseJsonBody(req);

            // --- SANITIZE THE INPUTS ---
            // If a field is missing in the request, its value will be 'undefined'.
            // We ensure we pass 'null' to the database instead, which is safe.
            const title = rawData.title; // Assumed to always exist for an update
            const author = rawData.author ?? null;
            const bookNumber = rawData.bookNumber ?? null;
            const pdfUrl = rawData.pdfUrl ?? null;
            const publicId = rawData.publicId ?? null;
            const oldPublicId = rawData.oldPublicId ?? null;
            // The `??` is the "nullish coalescing operator". It says: "use the value on the left
            // if it's not null or undefined, otherwise use the value on the right".

            // If replacing a PDF, delete the old file from Cloudinary
            if (oldPublicId) {
                await cloudinary.uploader.destroy(oldPublicId, { resource_type: "raw" });
            }

            // Use COALESCE to robustly update only the fields that are provided by the frontend
            await turso.execute({
                sql: `UPDATE books SET 
                        title = COALESCE(?, title), 
                        author = COALESCE(?, author), 
                        bookNumber = COALESCE(?, bookNumber),
                        pdfUrl = COALESCE(?, pdfUrl),
                        publicId = COALESCE(?, publicId)
                      WHERE id = ?`,
                args: [title, author, bookNumber, pdfUrl, publicId, bookId],
            });

            return res.status(200).json({ message: 'Book updated successfully' });
        }

        // --- DELETE: Remove a book from database and cloud storage ---
        if (req.method === 'DELETE') {
            const bookId = req.query.id;
            if (!bookId) return res.status(400).json({ error: 'Book ID is required for deletion.' });

            const result = await turso.execute({ sql: 'SELECT publicId FROM books WHERE id = ?', args: [bookId] });

            // If the book has a PDF, delete it from Cloudinary
            if (result.rows.length > 0 && result.rows[0].publicId) {
                await cloudinary.uploader.destroy(result.rows[0].publicId, { resource_type: "raw" });
            }

            // Delete the record from our database
            await turso.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [bookId] });
            return res.status(200).json({ message: 'Book deleted successfully' });
        }

        // Fallback for any other unhandled request methods
        return res.status(404).json({ error: 'Route not found' });

    } catch (error) {
        // Differentiate between auth errors and other errors
        if (error.message.startsWith('Authentication failed')) {
            return res.status(401).json({ error: error.message });
        }
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}