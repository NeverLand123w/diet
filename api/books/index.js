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

    try {
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

        if (req.method === 'POST' && req.url.includes('/bulk-import')) {
            const booksToImport = await parseJsonBody(req);
            const tx = await turso.transaction('write');
            try {
                for (const book of booksToImport) {
                    let categoryId = null;
                    if (book.categoryName) {
                        let catRes = await tx.execute({ sql: 'SELECT id FROM categories WHERE name = ?', args: [book.categoryName] });
                        if (catRes.rows.length === 0) {
                            const newCatRes = await tx.execute({ sql: 'INSERT INTO categories (name) VALUES (?) RETURNING id', args: [book.categoryName] });
                            categoryId = newCatRes.rows[0].id;
                        } else {
                            categoryId = catRes.rows[0].id;
                        }
                    }

                    let bookId = null;
                    const bookRes = await tx.execute({ sql: 'SELECT id FROM books WHERE bookNumber = ?', args: [book.bookNumber] });

                    // Use `book.author ?? null` to safely handle missing author field
                    const author = book.author ?? null;

                    if (bookRes.rows.length > 0) {
                        bookId = bookRes.rows[0].id;
                        await tx.execute({
                            sql: 'UPDATE books SET title = ?, author = ? WHERE id = ?',
                            args: [book.title, author, bookId]
                        });
                    } else {
                        const newBookRes = await tx.execute({
                            sql: 'INSERT INTO books (title, author, bookNumber) VALUES (?, ?, ?)',
                            args: [book.title, author, book.bookNumber]
                        });
                        bookId = newBookRes.lastInsertRowid;
                    }

                    if (bookId && categoryId) {
                        await tx.execute({ sql: 'DELETE FROM book_categories WHERE book_id = ?', args: [bookId] });
                        await tx.execute({ sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', args: [bookId, categoryId] });
                    }
                }
                await tx.commit();
                return res.status(200).json({ message: `Successfully imported/updated ${booksToImport.length} books.` });

            } catch (err) { /* ... rollback and error handling ... */ }
        }

        if (req.method === 'PUT') {
            const bookId = req.query.id;
            const { title, author, bookNumber, pdfUrl, publicId, oldPublicId, categoryIds } = await parseJsonBody(req);

            const tx = await turso.transaction('write');
            try {
                await tx.execute({
                    sql: `UPDATE books SET title = ?, author = ?, bookNumber = ? WHERE id = ?`,
                    args: [title, author, bookNumber, bookId]
                });
                if (oldPublicId && pdfUrl) { await cloudinary.uploader.destroy(oldPublicId, { resource_type: "raw" }); }
                if (pdfUrl) { await tx.execute({ sql: 'UPDATE books SET pdfUrl = ?, publicId = ? WHERE id = ?', args: [pdfUrl, publicId, bookId] }) }

                if (Array.isArray(categoryIds)) {
                    await tx.execute({ sql: 'DELETE FROM book_categories WHERE book_id = ?', args: [bookId] });
                    if (categoryIds.length > 0) {
                        for (const categoryId of categoryIds) {
                            await tx.execute({ sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', args: [bookId, categoryId] });
                        }
                    }
                }
                await tx.commit();
                return res.status(200).json({ message: 'Book updated' });
            } catch (err) {
                await tx.rollback();
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