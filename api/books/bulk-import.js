import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';

const tursoConfig = { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN };
const turso = createClient(tursoConfig);
const authenticateAdmin = (req) => { try { const t = req.headers.authorization.split(' ')[1]; jwt.verify(t, process.env.JWT_SECRET); } catch (e) { throw new Error('Authentication failed'); } };
async function parseJsonBody(req) { return new Promise((resolve, reject) => { let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d ? JSON.parse(d) : {})); }); }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

    try {
        authenticateAdmin(req);
        const booksInBatch = await parseJsonBody(req);
        if (!Array.isArray(booksInBatch) || booksInBatch.length === 0) {
            return res.status(400).json({ error: "Request body must be a non-empty array of books." });
        }
        
        // Each batch is now its own isolated transaction
        const tx = await turso.transaction('write');
        try {
            for (const book of booksInBatch) {
                if (!book.bookNumber || !book.title) {
                    console.log("[BULK_IMPORT_WARN] Skipping row due to missing title or book number:", book);
                    continue;
                }
                
                // --- CATEGORY HANDLING (More Robust) ---
                let categoryId = null;
                if (book.categoryName) {
                    // Check the database for the category name first.
                    let catRes = await tx.execute({
                        sql: 'SELECT id FROM categories WHERE name = ?',
                        args: [book.categoryName]
                    });
                    
                    if (catRes.rows.length === 0) {
                        // If it doesn't exist, INSERT it.
                        const newCatRes = await tx.execute({
                            sql: 'INSERT INTO categories (name) VALUES (?)',
                            args: [book.categoryName]
                        });
                        categoryId = Number(newCatRes.lastInsertRowid);
                    } else {
                        // If it exists, just get its ID.
                        categoryId = catRes.rows[0].id;
                    }
                }
                
                // --- BOOK HANDLING (UPSERT) ---
                let bookId = null;
                const author = book.author ?? null;
                const bookNumberStr = book.bookNumber.toString();

                const bookRes = await tx.execute({
                    sql: 'SELECT id FROM books WHERE bookNumber = ?',
                    args: [bookNumberStr]
                });
                
                if (bookRes.rows.length > 0) {
                    // Book exists, UPDATE it
                    bookId = bookRes.rows[0].id;
                    await tx.execute({
                        sql: 'UPDATE books SET title = ?, author = ? WHERE id = ?',
                        args: [book.title, author, bookId]
                    });
                } else {
                    // Book is new, INSERT it
                    const newBookRes = await tx.execute({
                        sql: 'INSERT INTO books (title, author, bookNumber) VALUES (?, ?, ?)',
                        args: [book.title, author, bookNumberStr]
                    });
                    bookId = Number(newBookRes.lastInsertRowid);
                }
                
                // --- LINKING ---
                if (bookId && categoryId) {
                    await tx.execute({ sql: 'DELETE FROM book_categories WHERE book_id = ?', args: [bookId] });
                    await tx.execute({ sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)', args: [bookId, categoryId] });
                }
            }

            await tx.commit();
            // A success response for just this batch
            return res.status(200).json({ message: `Batch of ${booksInBatch.length} processed.` });

        } catch (err) {
            console.error('[BULK_IMPORT_ERROR] Transaction failed for batch. Rolling back.', err);
            await tx.rollback();
            // Send a specific error message back to the frontend
            return res.status(500).json({ error: 'Database transaction failed', details: err.message });
        }
    } catch (error) {
        if (error.message.startsWith('Authentication failed')) return res.status(401).json({ error: error.message });
        console.error("Bulk Import API Top-Level Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}