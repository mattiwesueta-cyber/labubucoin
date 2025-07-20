// 🗄️ Database operations for LabubuCoin
class GameDatabase {
    constructor() {
        this.supabaseUrl = 'https://akomgazktlvymcgafnor.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrb21nYXprdGx2eW1jZ2Fmbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3OTMzNjQsImV4cCI6MjA2ODM2OTM2NH0.tDCQREuF0CIXzJdXUVEkKXidq70fypvqmFWgQZjjy34';
        this.supabase = null;
        this.init();
    }

    init() {
        try {
            this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
            console.log('✅ Supabase подключен');
        } catch (error) {
            console.error('❌ Ошибка подключения к Supabase:', error);
        }
    }

    async savePlayerData(userId, gameData) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('players')
                .upsert({
                    tg_id: userId.toString(),
                    balance: gameData.coins,
                    stable_income: gameData.stableIncome,
                    profit_per_click: gameData.profitPerClick,
                    boost: gameData.boost,
                    boost_time_left: gameData.boostTimeLeft,
                    is_boost_active: gameData.isBoostActive,
                    last_updated: new Date().toISOString()
                }, { onConflict: 'tg_id' });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            return false;
        }
    }

    async loadPlayerData(userId, username = null) {
        if (!this.supabase) return null;
        try {
            let { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('tg_id', userId.toString())
                .single();
            if (error || !data) {
                // Если игрока нет — создаём с дефолтными параметрами
                const defaultData = {
                    tg_id: userId.toString(),
                    balance: 0,
                    stable_income: 0,
                    profit_per_click: 1,
                    boost: 2,
                    boost_time_left: 0,
                    is_boost_active: false,
                    username: username || null,
                    last_updated: new Date().toISOString()
                };
                const { error: insertError } = await this.supabase
                    .from('players')
                    .insert([defaultData]);
                if (insertError) {
                    console.error('❌ Ошибка создания игрока:', insertError);
                    return null;
                }
                return defaultData;
            }
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            return null;
        }
    }

    async updatePlayerStats(userId, stats) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('player_stats')
                .upsert({
                    tg_id: userId.toString(),
                    total_clicks: stats.totalClicks || 0,
                    total_coins_earned: stats.totalCoinsEarned || 0,
                    play_time: stats.playTime || 0,
                    last_played: new Date().toISOString()
                }, { onConflict: 'tg_id' });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления статистики:', error);
            return false;
        }
    }
}

// Экспортируем для использования в основном скрипте
window.GameDatabase = GameDatabase;
