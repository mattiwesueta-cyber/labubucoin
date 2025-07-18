import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akomgazktlvymcgafnor.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrb21nYXprdGx2eW1jZ2Fmbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3OTMzNjQsImV4cCI6MjA2ODM2OTM2NH0.tDCQREuF0CIXzJdXUVEkKXidq70fypvqmFWgQZjjy34';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { user_id, balance } = req.body;
  if (!user_id || typeof balance !== 'number') {
    return res.status(400).json({ error: 'user_id and balance are required' });
  }
  try {
    const { error } = await supabase
      .from('players')
      .update({ balance })
      .eq('tg_id', user_id);
    if (error) {
      return res.status(500).json({ error: 'Failed to update balance' });
    }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
} 