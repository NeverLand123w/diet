import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { username, password } = req.body;
        console.log(`[AUTH_DEBUG] 1. Login attempt with username: "${username}" and password of length: ${password.length}`);
        
        // Retrieve credentials from secure environment variables
        const adminUsername = process.env.ADMIN_USERNAME;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        // --- ⚠️ DEBUG LOG: Check if environment variables are loaded ---
        console.log(`[AUTH_DEBUG] 2. ADMIN_USERNAME from env: "${adminUsername}"`);
        console.log(`[AUTH_DEBUG] 3. ADMIN_PASSWORD_HASH from env (first 10 chars): "${adminPasswordHash?.substring(0, 10)}..."`);

        if (!adminUsername || !adminPasswordHash) {
            console.error("[AUTH_DEBUG] FATAL: Auth environment variables are not set on the server!");
            return res.status(500).json({ message: "Server configuration error." });
        }
        
        // --- ⚠️ DEBUG LOG: Check if usernames match ---
        const isUsernameMatch = (username === adminUsername);
        console.log(`[AUTH_DEBUG] 4. Username match result: ${isUsernameMatch}`);
        if (!isUsernameMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // --- ⚠️ DEBUG LOG: Compare submitted password with the stored hash ---
        console.log(`[AUTH_DEBUG] 5. Now comparing submitted password with the hash...`);
        const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
        console.log(`[AUTH_DEBUG] 6. Password comparison result: ${isPasswordValid}`);

        if (isPasswordValid) {
            console.log("[AUTH_DEBUG] 7. SUCCESS: Credentials are valid. Generating token.");
            const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
            return res.status(200).json({ token });
        } else {
            console.log("[AUTH_DEBUG] 7. FAILED: Password comparison returned false.");
            return res.status(401).json({ message: 'Invalid credentials' });
        }

    } catch (error) {
        console.error('[AUTH_DEBUG] An error occurred during the login process:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}