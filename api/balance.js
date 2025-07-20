import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://akomgazktlvymcgafnor.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrb21nYXprdGx2eW1jZ2Fmbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3OTMzNjQsImV4cCI6MjA2ODM2OTM2NH0.tDCQREuF0CIXzJdXUVEkKXidq70fypvqmFWgQZjjy34';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { user_id, username, first_name, last_name } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  try {
    let { data, error } = await supabase
      .from('players')
      .select('balance')
      .eq('tg_id', user_id)
      .single();
    if (error || !data) {
      // Если пользователя нет — создаём его с балансом 0 и username
      const insertData = {
        tg_id: user_id,
        balance: 0,
        username: username || null
      };
      const { error: insertError } = await supabase
        .from('players')
        .insert([insertData]);
      if (insertError) {
        return res.status(500).json({ error: 'Failed to create user' });
      }
      return res.status(200).json({ balance: 0 });
    }
    res.status(200).json({ balance: data.balance || 0 });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
} 