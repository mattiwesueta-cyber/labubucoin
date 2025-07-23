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
            console.log('Saving player data:', {
                userId,
                balance: gameData.coins, // Убираем Math.floor для точного сохранения баланса
                stableIncome: gameData.stableIncome,
                accessories: gameData.accessories
            });
            
            // Сначала проверяем, существует ли игрок
            const { data: existingData } = await this.supabase
                .from('players')
                .select('*')
                .eq('tg_id', userId.toString())
                .single();
                
            if (existingData) {
                // Если игрок существует, обновляем только переданные поля
                const updateData = {
                    last_updated: new Date().toISOString()
                };
                
                if (gameData.coins !== undefined) updateData.balance = gameData.coins;
                if (gameData.stableIncome !== undefined) updateData.stable_income = gameData.stableIncome;
                if (gameData.profitPerClick !== undefined) updateData.profit_per_click = Math.floor(gameData.profitPerClick);
                if (gameData.boost !== undefined) updateData.boost = Math.floor(gameData.boost);
                if (gameData.boostTimeLeft !== undefined) updateData.boost_time_left = Math.floor(gameData.boostTimeLeft);
                if (gameData.isBoostActive !== undefined) updateData.is_boost_active = gameData.isBoostActive;
                if (gameData.costume !== undefined) updateData.costume = gameData.costume;
                if (gameData.accessories !== undefined) updateData.accessories = gameData.accessories ? JSON.stringify(gameData.accessories) : null;
                if (gameData.last_active !== undefined) updateData.last_active = gameData.last_active;
                
                const { error } = await this.supabase
                    .from('players')
                    .update(updateData)
                    .eq('tg_id', userId.toString());
                    
                if (error) throw error;
            } else {
                // Если игрока нет, создаем новую запись
                const { error } = await this.supabase
                    .from('players')
                    .insert([{
                        tg_id: userId.toString(),
                        balance: gameData.coins || 0,
                        stable_income: gameData.stableIncome || 0,
                        profit_per_click: Math.floor(gameData.profitPerClick || 1),
                        boost: Math.floor(gameData.boost || 2),
                        boost_time_left: Math.floor(gameData.boostTimeLeft || 0),
                        is_boost_active: gameData.isBoostActive || false,
                        costume: gameData.costume || 'labubu.png',
                        accessories: gameData.accessories ? JSON.stringify(gameData.accessories) : null,
                        last_active: gameData.last_active || new Date().toISOString(),
                        last_updated: new Date().toISOString()
                    }]);
                    
                if (error) throw error;
            }
            
            console.log('savePlayerData result: success');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            return false;
        }
    }

    async loadPlayerData(userId, username = null) {
        if (!this.supabase) return null;
        try {
            console.log('🔍 Searching for player with userId:', userId, 'type:', typeof userId);
            
            let { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('tg_id', userId.toString())
                .single();
                
            console.log('📊 Database query result:', { data, error });
            
            if (error || !data) {
                console.log('❌ Player not found, creating new player...');
                console.log('Error details:', error);
                
                // Если игрока нет — создаём с дефолтными параметрами
                const defaultData = {
                    tg_id: userId.toString(),
                    balance: 0,
                    stable_income: 3.65, // Изменяю на базовое значение вместо 0
                    profit_per_click: 1,
                    boost: 2,
                    boost_time_left: 0,
                    is_boost_active: false,
                    costume: 'labubu.png',
                    username: username || null,
                    last_updated: new Date().toISOString(),
                    last_active: new Date().toISOString()
                };
                
                console.log('📝 Creating new player with data:', defaultData);
                
                const { error: insertError } = await this.supabase
                    .from('players')
                    .insert([defaultData]);
                    
                if (insertError) {
                    console.error('❌ Ошибка создания игрока:', insertError);
                    return null;
                }
                
                console.log('✅ New player created successfully');
                return defaultData;
            }
            
            console.log('✅ Existing player found:', data);
            console.log('💰 Player balance:', data.balance);
            console.log('📈 Player stable_income:', data.stable_income);
            
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

    // Получить топ игроков по балансу
    async getTopPlayers(limit = 10) {
        if (!this.supabase) return [];
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .order('balance', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Ошибка получения топа игроков:', error);
            return [];
        }
    }
    
    // Безопасное обновление только баланса
    async updateBalance(userId, balance) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('players')
                .update({ 
                    balance: balance,
                    last_updated: new Date().toISOString()
                })
                .eq('tg_id', userId.toString());
            if (error) throw error;
            console.log('Balance updated successfully:', balance);
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления баланса:', error);
            return false;
        }
    }
    
    // Безопасное обновление аксессуаров и стабильного дохода
    async updateAccessoriesAndIncome(userId, accessories, stableIncome) {
        if (!this.supabase) return false;
        try {
            const updateData = {
                last_updated: new Date().toISOString()
            };
            
            if (accessories !== undefined) {
                updateData.accessories = accessories ? JSON.stringify(accessories) : null;
            }
            if (stableIncome !== undefined) {
                updateData.stable_income = stableIncome;
            }
            
            const { error } = await this.supabase
                .from('players')
                .update(updateData)
                .eq('tg_id', userId.toString());
            if (error) throw error;
            console.log('Accessories and income updated successfully');
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления аксессуаров и дохода:', error);
            return false;
        }
    }
    
    // Безопасное обновление времени активности
    async updateLastActive(userId, lastActive) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('players')
                .update({ 
                    last_active: lastActive,
                    last_updated: new Date().toISOString()
                })
                .eq('tg_id', userId.toString());
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления last_active:', error);
            return false;
        }
    }
    
    // Безопасное обновление костюма
    async updateCostume(userId, costume) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('players')
                .update({ 
                    costume: costume,
                    last_updated: new Date().toISOString()
                })
                .eq('tg_id', userId.toString());
            if (error) throw error;
            console.log('Costume updated successfully:', costume);
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления костюма:', error);
            return false;
        }
    }
}

// Экспортируем для использования в основном скрипте
window.GameDatabase = GameDatabase;
