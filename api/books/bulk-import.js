import { createClient } from '@libsql/client';
import jwt from 'jsonwebtoken';

// --- CONFIGURATION ---
const tursoConfig = { 
    url: process.env.TURSO_DATABASE_URL, 
    authToken: process.env.TURSO_AUTH_TOKEN 
};
const turso = createClient(tursoConfig);

// --- HELPER FUNCTIONS ---
const authenticateAdmin = (req) => { 
    try { 
        const token = req.headers.authorization.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET); 
    } catch (e) { 
        throw new Error('Authentication failed'); 
    } 
};

async function parseJsonBody(req) { 
    return new Promise((resolve) => { 
        let d = ''; 
        req.on('data', c => d += c); 
        req.on('end', () => resolve(d ? JSON.parse(d) : {})); 
    }); 
}

// Helper to safely convert to string and trim
const safeString = (value) => {
    if (value === null || value === undefined) return null;
    return String(value).trim() || null;
};

// --- MAIN API HANDLER ---
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: "Method Not Allowed" });

    try {
        authenticateAdmin(req);
        const booksInBatch = await parseJsonBody(req);
        if (!Array.isArray(booksInBatch)) {
            return res.status(400).json({ error: "Request body must be an array of books." });
        }
        
        let skippedCount = 0; // Initialize skipped records counter
        const tx = await turso.transaction('write');
        try {
            for (let i = 0; i < booksInBatch.length; i++) {
                const book = booksInBatch[i];
                
                // Validate required fields
                if (!book || typeof book !== 'object') {
                    console.warn(`[BULK_IMPORT_WARN] Skipping invalid record at index ${i}`);
                    skippedCount++;
                    continue;
                }

                const title = safeString(book.title);
                if (!title) {
                    console.warn(`[BULK_IMPORT_WARN] Skipping record at index ${i} due to missing title`);
                    skippedCount++;
                    continue;
                }
                
                // --- 1. CATEGORY HANDLING ---
                let categoryId = null;
                const categoryName = safeString(book.categoryName);
                if (categoryName) {
                    try {
                        let catRes = await tx.execute({
                            sql: 'SELECT id FROM categories WHERE name = ?',
                            args: [categoryName]
                        });
                        
                        if (catRes.rows.length === 0) {
                            const newCatRes = await tx.execute({
                                sql: 'INSERT INTO categories (name) VALUES (?)',
                                args: [categoryName]
                            });
                            categoryId = Number(newCatRes.lastInsertRowid);
                        } else {
                            categoryId = catRes.rows[0].id;
                        }
                    } catch (err) {
                        console.error(`[CATEGORY_ERROR] Failed to process category for record ${i}:`, err);
                        skippedCount++;
                        continue;
                    }
                }
                
                // --- 2. BOOK HANDLING ---
                const author = safeString(book.author);
                const bookNumber = safeString(book.bookNumber);

                try {
                    // Find book by title and author only
                    const findBookSql = author 
                        ? 'SELECT id FROM books WHERE title = ? COLLATE NOCASE AND author = ? COLLATE NOCASE'
                        : 'SELECT id FROM books WHERE title = ? COLLATE NOCASE AND author IS NULL';
                    
                    const findBookArgs = author ? [title, author] : [title];

                    const bookRes = await tx.execute({ sql: findBookSql, args: findBookArgs });
                    
                    if (bookRes.rows.length > 0) {
                        // Book exists - update book number
                        const bookId = bookRes.rows[0].id;
                        await tx.execute({
                            sql: 'UPDATE books SET bookNumber = ? WHERE id = ?',
                            args: [bookNumber, bookId]
                        });
                        
                        // Link category if needed
                        if (categoryId) {
                            await tx.execute({ 
                                sql: 'INSERT OR IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)',
                                args: [bookId, categoryId] 
                            });
                        }
                    } else {
                        // New book - insert
                        const newBookRes = await tx.execute({
                            sql: 'INSERT INTO books (title, author, bookNumber) VALUES (?, ?, ?)',
                            args: [title, author, bookNumber]
                        });
                        const bookId = Number(newBookRes.lastInsertRowid);
                        
                        // Link category for new book
                        if (categoryId) {
                            await tx.execute({ 
                                sql: 'INSERT INTO book_categories (book_id, category_id) VALUES (?, ?)',
                                args: [bookId, categoryId] 
                            });
                        }
                    }
                } catch (err) {
                    console.error(`[BOOK_ERROR] Failed to process book at index ${i}:`, err);
                    skippedCount++;
                    continue;
                }
            }

            await tx.commit();
            return res.status(200).json({ 
                message: `Processed ${booksInBatch.length} records with ${booksInBatch.length - skippedCount} successful imports`,
                skipped: skippedCount,
                processed: booksInBatch.length - skippedCount,
                total: booksInBatch.length
            });

        } catch (err) {
            console.error('[BULK_IMPORT_ERROR] Transaction failed for batch. Rolling back.', err);
            await tx.rollback();
            return res.status(500).json({ 
                error: 'Database transaction failed', 
                details: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    } catch (error) {
        if (error.message.startsWith('Authentication failed')) {
            return res.status(401).json({ error: error.message });
        }
        console.error("Bulk Import API Top-Level Error:", error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}