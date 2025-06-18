import { createClient } from '@libsql/client';
import XLSX from 'xlsx';
import multiparty from 'multiparty';

// --- CONFIGURATION ---
const tursoConfig = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
};
// This is a simple secret key to protect the endpoint.
// Set this in your Vercel Environment Variables.
const IMPORT_SECRET_KEY = process.env.IMPORT_SECRET_KEY;

// Vercel requires this config to correctly handle file uploads
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- V V V ADD THIS ENTIRE DEBUGGING BLOCK V V V ---
    console.log('--- IMPORT API HIT ---');
    console.log('Request Headers:', req.headers); // Log all headers to see what's available

    const providedKey = req.headers['x-import-secret'];
    const serverKey = process.env.IMPORT_SECRET_KEY;

    // Log the keys with delimiters to see any hidden whitespace
    console.log(`Provided Key from Frontend: [${providedKey}]`);
    console.log(`Server Key from Vercel Env: [${serverKey}]`);

    // Log the lengths to check for mismatches
    console.log(`Provided Key Length: ${providedKey?.length}`);
    console.log(`Server Key Length: ${serverKey?.length}`);
    // --- ^ ^ ^ END OF DEBUGGING BLOCK ^ ^ ^ ---

    // --- SECURITY CHECK ---
    if (providedKey !== serverKey) {
        console.log('Authorization failed. Keys do not match.'); // Add a log here too
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const form = new multiparty.Form();

    form.parse(req, async (err, fields, files) => {
        // --- V V V MODIFY THIS ERROR HANDLING BLOCK V V V ---
        if (err) {
            console.error('Multiparty parsing error:', err);
            return res.status(500).json({ error: 'Failed to parse form data.', details: err.message });
        }

        if (!files.excelFile || files.excelFile.length === 0) {
            console.error('File part "excelFile" not found in the request. Available file parts:', Object.keys(files));
            return res.status(400).json({ error: 'Excel file is required.' });
        }

        const filePath = files.excelFile[0].path;
        let db;

        try {
            db = createClient(tursoConfig);
            console.log('Importer: Connected to Turso.');

            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            let totalProcessed = 0;
            let totalFailed = 0;

            for (const sheetName of sheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, {
                    header: ['Book Name', 'Barcode', 'Author'],
                    range: 1, // Skip header row
                });

                for (const row of rows) {
                    const title = row['Book Name']?.trim();
                    const author = row['Author']?.trim();
                    const rawBarcode = row['Barcode'];

                    if (!title || !author || !rawBarcode) continue;

                    const transaction = await db.transaction('write');
                    try {
                        const bookResult = await transaction.execute({
                            sql: 'INSERT INTO books (title, author) VALUES (?, ?) RETURNING id;',
                            args: [title, author],
                        });
                        const bookId = bookResult.rows[0].id;

                        const barcodes = rawBarcode.toString().split(',').map(b => b.trim()).filter(Boolean);
                        for (const barcode of barcodes) {
                            await transaction.execute({
                                sql: 'INSERT OR IGNORE INTO barcodes (barcode, book_id) VALUES (?, ?);',
                                args: [barcode, bookId],
                            });
                        }
                        await transaction.commit();
                        totalProcessed++;
                    } catch (e) {
                        await transaction.rollback();
                        totalFailed++;
                        console.error(`Failed to insert row for "${title}":`, e.message);
                    }
                }
            }

            console.log('Importer: Finished processing.');
            return res.status(200).json({
                message: 'Import process finished.',
                processed: totalProcessed,
                failed: totalFailed,
                sheets: sheetNames,
            });

        } catch (error) {
            console.error('Importer Error:', error);
            return res.status(500).json({ error: 'An internal error occurred during import.' });
        } finally {
            if (db) await db.close();
        }
    });
}