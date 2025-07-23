export default async function handler(req, res) {
    try {
        // Return current server time in ISO format
        res.status(200).json({ 
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in server-time API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
} 