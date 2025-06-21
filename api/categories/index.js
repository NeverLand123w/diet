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
            const bookId = req.query.id;
            if (!bookId) return res.status(400).json({ error: 'Book ID required for update.' });

            const { title, author, bookNumber, pdfUrl, publicId, oldPublicId, categoryIds } = await parseJsonBody(req);

            const tx = await turso.transaction('write');
            try {
                // --- Logic for DELETING an existing PDF ---
                // If the user sent pdfUrl: null, they want to remove the existing file.
                // We use 'oldPublicId' as a safeguard to know what to delete.
                if (pdfUrl === null && publicId === null && oldPublicId) {
                    // 1. Delete the file from Cloudinary
                    await cloudinary.uploader.destroy(oldPublicId, { resource_type: "raw" });

                    // 2. Clear the PDF columns in the database for this book
                    await tx.execute({
                        sql: 'UPDATE books SET pdfUrl = NULL, publicId = NULL WHERE id = ?',
                        args: [bookId]
                    });
                }

                // Logic for ADDING or REPLACING a PDF
                // If a new pdfUrl is provided, update the columns.
                if (pdfUrl && publicId) {
                    // If replacing, delete the old file from Cloudinary first
                    if (oldPublicId) {
                        await cloudinary.uploader.destroy(oldPublicId, { resource_type: "raw" });
                    }
                    await tx.execute({
                        sql: 'UPDATE books SET pdfUrl = ?, publicId = ? WHERE id = ?',
                        args: [pdfUrl, publicId, bookId]
                    });
                }

                // Logic for updating text details (unchanged)
                await tx.execute({
                    sql: `UPDATE books SET title = ?, author = ?, bookNumber = ? WHERE id = ?`,
                    args: [title, author, bookNumber, bookId]
                });

                // Logic for updating categories (unchanged)
                if (Array.isArray(categoryIds)) {
                    await tx.execute({ sql: 'DELETE FROM book_categories WHERE book_id = ?', args: [bookId] });
                    if (categoryIds.length > 0) {
                        for (const categoryId of categoryIds) {
                            await tx.execute({ sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', args: [bookId, categoryId] });
                        }
                    }
                }

                await tx.commit();
                return res.status(200).json({ message: 'Book updated successfully' });
            } catch (err) {
                console.error("[PUT_ERROR] Transaction failed:", err);
                await tx.rollback();
                throw err;
            }
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