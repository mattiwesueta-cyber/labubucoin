export default async function handler(req, res) {
    try {
        const now = new Date();
        // Return current server time in multiple formats for debugging
        res.status(200).json({ 
            serverTime: now.toISOString(),
            timestamp: now.getTime(),
            readable: now.toString()
        });
    } catch (error) {
        console.error('Error in server-time API:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
} 