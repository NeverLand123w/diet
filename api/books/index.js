import { createClient } from '@libsql/client';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';

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

// --- HELPER FUNCTIONS ---

async function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                if (data) { resolve(JSON.parse(data)); }
                else { resolve({}); }
            } catch (e) {
                reject(e);
            }
        });
    });
}

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

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
    // --- CORS and OPTIONS (Unchanged) ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    const { type, id } = req.query; // Check for a 'type' parameter


    try {
        // --- VIDEO CONTENT LOGIC ---
        if (type === 'videos') {
            if (req.method === 'GET') {
                const result = await turso.execute('SELECT * FROM videos ORDER BY academic_year DESC, title ASC');
                return res.status(200).json({ data: result.rows });
            }
            if (req.method === 'PUT') {
                if (!id) return res.status(400).json({ error: 'Video ID is required' });

                const { title, youtube_url, academic_year } = await parseJsonBody(req);

                if (!title || !youtube_url || !academic_year) {
                    return res.status(400).json({ error: 'Title, URL, and Academic Year are required.' });
                }

                await turso.execute({
                    sql: 'UPDATE videos SET title = ?, youtube_url = ?, academic_year = ? WHERE id = ?',
                    args: [title, youtube_url, academic_year, id],
                });

                return res.status(200).json({ message: 'Video updated successfully' });
            }

            if (req.method === 'POST') {
                const { title, youtube_url, academic_year } = await parseJsonBody(req);
                await turso.execute({
                    sql: 'INSERT INTO videos (title, youtube_url, academic_year) VALUES (?, ?, ?)',
                    args: [title, youtube_url, academic_year],
                });
                return res.status(201).json({ message: 'Video added successfully' });
            }
            if (req.method === 'DELETE') {
                if (!id) return res.status(400).json({ error: 'Video ID is required' });
                await turso.execute({ sql: 'DELETE FROM videos WHERE id = ?', args: [id] });
                return res.status(200).json({ message: 'Video deleted successfully' });
            }
        }

        // This block goes inside the 'try' of your main handler function
        if (req.method === 'GET') {
            const { q, categoryId, page = 1, limit = 12 } = req.query;
            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

            let whereClauses = [];
            let args = [];

            // --- Building the filter conditions (This part is correct and unchanged) ---
            if (q && q.trim()) {
                const searchTerm = decodeURIComponent(q.replace(/\+/g, ' '));
                const likeQuery = '%' + searchTerm.trim().split(/\s+/).join('%') + '%';
                whereClauses.push('(title LIKE ? OR author LIKE ? OR bookNumber LIKE ?)');
                args.push(likeQuery, likeQuery, likeQuery);
            }
            if (categoryId) {
                whereClauses.push('id IN (SELECT book_id FROM book_categories WHERE category_id = ?)');
                args.push(parseInt(categoryId, 10));
            }
            const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

            // --- Step 1: Get the simple, paginated list of book IDs (This part is correct and unchanged) ---
            const idsSql = `SELECT id FROM books ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`;
            const idsArgs = [...args, parseInt(limit, 10), offset];
            const idsResult = await turso.execute({ sql: idsSql, args: idsArgs });
            const bookIds = idsResult.rows.map(row => row.id);

            let books = []; // Initialize our final books array

            // --- THIS IS THE FIX ---
            // Only proceed to fetch full book details if we actually found some IDs.
            if (bookIds.length > 0) {
                const booksSql = `
            SELECT b.*, GROUP_CONCAT(c.id) as category_ids, GROUP_CONCAT(c.name) as category_names
            FROM books b
            LEFT JOIN book_categories bc ON b.id = bc.book_id
            LEFT JOIN categories c ON bc.category_id = c.id
            WHERE b.id IN (${bookIds.map(() => '?').join(',')})  -- Use parameter placeholders for security
            GROUP BY b.id
            ORDER BY b.id DESC`;

                const booksResult = await turso.execute({ sql: booksSql, args: bookIds });
                books = booksResult.rows;
            }
            // --- END OF FIX ---

            // Get the total count for pagination (This logic is correct and unchanged)
            const countSql = `SELECT COUNT(*) as count FROM books ${whereSql}`;
            const totalResult = await turso.execute({ sql: countSql, args });
            const totalBooks = totalResult.rows[0]?.count || 0;
            const totalPages = Math.ceil(totalBooks / parseInt(limit, 10));

            return res.status(200).json({
                data: books,
                pagination: { page: parseInt(page, 10), totalPages, totalBooks }
            });
        }


        // All subsequent routes are protected by admin authentication
        authenticateAdmin(req);

        if (req.method === 'POST') {
            const { title, author, bookNumber, pdfUrl, publicId, categoryIds = [] } = await parseJsonBody(req);
            if (!title) return res.status(400).json({ error: "Title is a required field." });

            const tx = await turso.transaction('write');
            try {
                const bookInsertResult = await tx.execute({
                    sql: 'INSERT INTO books (title, author, bookNumber, pdfUrl, publicId) VALUES (?, ?, ?, ?, ?)',
                    args: [title, author || null, bookNumber || null, pdfUrl || null, publicId || null]
                });

                // --- THE FIX ---
                // Convert the BigInt result to a standard JavaScript Number.
                const bookId = Number(bookInsertResult.lastInsertRowid);
                // --- END OF FIX ---

                if (bookId > 0 && Array.isArray(categoryIds) && categoryIds.length > 0) {
                    for (const categoryId of categoryIds) {
                        await tx.execute({
                            sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)',
                            args: [bookId, parseInt(categoryId, 10)]
                        });
                    }
                }

                await tx.commit();
                return res.status(201).json({ message: 'Book created successfully' });
            } catch (err) {
                console.error("[POST_ERROR] Transaction failed:", err);
                await tx.rollback();
                throw err;
            }
        }

        if (req.method === 'PUT') {
            const bookId = req.query.id;
            if (!bookId) {
                return res.status(400).json({ error: 'Book ID is required for an update.' });
            }

            const payload = await parseJsonBody(req);

            // Start a database transaction for safety
            const tx = await turso.transaction('write');
            try {
                // --- STEP 1: Determine the final state of PDF fields ---

                // This is a special signal from the frontend to remove the PDF
                if (payload.pdfUrl === null && payload.oldPublicId) {
                    // A. User wants to DELETE the existing PDF
                    await cloudinary.uploader.destroy(payload.oldPublicId, { resource_type: "raw" });

                    // Explicitly update the PDF fields to NULL
                    await tx.execute({
                        sql: 'UPDATE books SET pdfUrl = NULL, publicId = NULL WHERE id = ?',
                        args: [bookId]
                    });

                } else if (payload.pdfUrl && payload.publicId) {
                    // B. User uploaded a NEW file to ADD or REPLACE

                    // If replacing, delete the old file first
                    if (payload.oldPublicId) {
                        await cloudinary.uploader.destroy(payload.oldPublicId, { resource_type: "raw" });
                    }
                    // Update with the new PDF info
                    await tx.execute({
                        sql: 'UPDATE books SET pdfUrl = ?, publicId = ? WHERE id = ?',
                        args: [payload.pdfUrl, payload.publicId, bookId]
                    });
                }
                // If neither of the above conditions are met, the PDF is left untouched.

                // --- STEP 2: Execute a simple UPDATE for text-based fields ---
                // This is separate and clear, preventing conflicts.
                await tx.execute({
                    sql: `UPDATE books SET 
                    title = ?, 
                    author = ?, 
                    bookNumber = ?
                  WHERE id = ?`,
                    args: [
                        payload.title,
                        payload.author ?? null,
                        payload.bookNumber ?? null,
                        bookId
                    ],
                });

                // --- STEP 3: Handle category updates (this logic is correct) ---
                if (Array.isArray(payload.categoryIds)) {
                    await tx.execute({ sql: 'DELETE FROM book_categories WHERE book_id = ?', args: [bookId] });
                    if (payload.categoryIds.length > 0) {
                        for (const categoryId of payload.categoryIds) {
                            await tx.execute({ sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', args: [bookId, categoryId] });
                        }
                    }
                }

                await tx.commit();
                return res.status(200).json({ message: 'Book updated successfully.' });

            } catch (err) {
                console.error("[PUT_ERROR] Transaction failed:", err);
                await tx.rollback();
                // Look at the server-side terminal logs (running 'vercel dev') for the detailed SQL error!
                throw err;
            }
        }

        if (req.method === 'DELETE') {
            const bookId = req.query.id;
            if (!bookId) return res.status(400).json({ error: 'Book ID required for deletion.' });

            const result = await turso.execute({ sql: 'SELECT publicId FROM books WHERE id = ?', args: [bookId] });
            if (result.rows.length > 0 && result.rows[0].publicId) {
                await cloudinary.uploader.destroy(result.rows[0].publicId, { resource_type: "raw" });
            }
            await turso.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [bookId] });
            return res.status(200).json({ message: 'Book deleted successfully' });
        }

        return res.status(404).json({ error: 'Route not found' });

    } catch (error) {
        if (error.message.startsWith('Authentication failed')) return res.status(401).json({ error: error.message });
        console.error('API Error in books.js:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}