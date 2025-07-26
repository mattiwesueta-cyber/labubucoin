// 🗄️ Database operations for LabubuCoin
class GameDatabase {
    constructor() {
        this.supabaseUrl = 'https://akomgazktlvymcgafnor.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrb21nYXprdGx2eW1jZ2Fmbm9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3OTMzNjQsImV4cCI6MjA2ODM2OTM2NH0.tDCQREuF0CIXzJdXUVEkKXidq70fypvqmFWgQZjjy34';
        this.supabase = null;
        this.init();
    }

    // Генерация уникального реферального кода
    generateReferralCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Проверка уникальности реферального кода
    async isReferralCodeUnique(code) {
        if (!this.supabase) return false;
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('referral_code')
                .eq('referral_code', code)
                .single();

            return !data; // Если данных нет, код уникален
        } catch (error) {
            return true; // В случае ошибки считаем код уникальным
        }
    }

    // Создание уникального реферального кода
    async createUniqueReferralCode() {
        let code;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
            code = this.generateReferralCode();
            isUnique = await this.isReferralCodeUnique(code);
            attempts++;
        }
        
        return code;
    }

    // Поиск игрока по реферальному коду
    async findPlayerByReferralCode(referralCode) {
        if (!this.supabase || !referralCode) return null;
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('referral_code', referralCode)
                .single();

            return error ? null : data;
        } catch (error) {
            console.error('❌ Ошибка поиска по реферальному коду:', error);
            return null;
        }
    }

    // Увеличение счетчика рефералов
    async incrementReferralCount(inviterTgId) {
        if (!this.supabase || !inviterTgId) return false;
        try {
            // Сначала получаем текущий счетчик
            const { data: currentData, error: selectError } = await this.supabase
                .from('players')
                .select('referrals_count')
                .eq('tg_id', inviterTgId.toString())
                .single();

            if (selectError) throw selectError;

            const newCount = (currentData.referrals_count || 0) + 1;

            // Обновляем счетчик
            const { error: updateError } = await this.supabase
                .from('players')
                .update({ referrals_count: newCount })
                .eq('tg_id', inviterTgId.toString());

            if (updateError) throw updateError;
            console.log('✅ Счетчик рефералов увеличен для:', inviterTgId, 'новое значение:', newCount);
            return true;
        } catch (error) {
            console.error('❌ Ошибка увеличения счетчика рефералов:', error);
            return false;
        }
    }

    // Получение списка рефералов игрока
    async getPlayerReferrals(userId) {
        if (!this.supabase) return [];
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('tg_id, username, balance, player_level, last_active')
                .eq('invited_by', userId.toString())
                .order('last_active', { ascending: false });

            return error ? [] : data;
        } catch (error) {
            console.error('❌ Ошибка получения списка рефералов:', error);
            return [];
        }
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
            // Округляем баланс для сохранения в integer поле
            const roundedBalance = Math.floor(gameData.coins);
            
            console.log('Saving player data:', {
                userId,
                balance: gameData.coins + ' → ' + roundedBalance,
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
                
                if (gameData.coins !== undefined) updateData.balance = roundedBalance;
                if (gameData.stableIncome !== undefined) updateData.stable_income = Math.floor(gameData.stableIncome);
                if (gameData.profitPerClick !== undefined) updateData.profit_per_click = Math.floor(gameData.profitPerClick);
                if (gameData.boost !== undefined) updateData.boost = Math.floor(gameData.boost);
                if (gameData.boostTimeLeft !== undefined) updateData.boost_time_left = Math.floor(gameData.boostTimeLeft);
                if (gameData.isBoostActive !== undefined) updateData.is_boost_active = gameData.isBoostActive;
                if (gameData.costume !== undefined) updateData.costume = gameData.costume;
                if (gameData.accessories !== undefined) {
                    updateData.accessories = typeof gameData.accessories === 'string' 
                        ? gameData.accessories 
                        : JSON.stringify(gameData.accessories);
                }
                
                const { error: updateError } = await this.supabase
                    .from('players')
                    .update(updateData)
                    .eq('tg_id', userId.toString());
                    
                if (updateError) throw updateError;
            } else {
                // Если игрока нет, создаем нового
                const { error } = await this.supabase
                    .from('players')
                    .upsert({
                        tg_id: userId.toString(),
                        balance: roundedBalance,
                        stable_income: Math.floor(gameData.stableIncome),
                        profit_per_click: Math.floor(gameData.profitPerClick),
                        boost: Math.floor(gameData.boost),
                        boost_time_left: Math.floor(gameData.boostTimeLeft),
                        is_boost_active: gameData.isBoostActive,
                        costume: gameData.costume,
                        accessories: typeof gameData.accessories === 'string' 
                            ? gameData.accessories 
                            : JSON.stringify(gameData.accessories || {}),
                        last_updated: new Date().toISOString()
                    });
                if (error) throw error;
            }
            
            console.log('savePlayerData result: success');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            return false;
        }
    }

    async loadPlayerData(userId, username = null, referralCode = null) {
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
                
                // Генерируем уникальный реферальный код для нового игрока
                const uniqueReferralCode = await this.createUniqueReferralCode();
                
                // Проверяем, кто пригласил пользователя
                let invitedBy = null;
                if (referralCode) {
                    const inviter = await this.findPlayerByReferralCode(referralCode);
                    if (inviter) {
                        invitedBy = inviter.tg_id;
                        console.log('🤝 Player invited by:', inviter.username || inviter.tg_id);
                    }
                }
                
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
                    player_level: 1, // Устанавливаем начальный уровень
                    referral_code: uniqueReferralCode,
                    invited_by: invitedBy,
                    referrals_count: 0,
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
                
                // Если игрок пришел по рефералу, увеличиваем счетчик пригласившего
                if (invitedBy) {
                    await this.incrementReferralCount(invitedBy);
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
            // Округляем баланс для сохранения в integer поле
            const roundedBalance = Math.floor(balance);
            console.log('Updating balance:', balance, '→ rounded:', roundedBalance);
            
            const { error } = await this.supabase
                .from('players')
                .update({ 
                    balance: roundedBalance,
                    last_updated: new Date().toISOString()
                })
                .eq('tg_id', userId.toString());
            if (error) throw error;
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
                updateData.accessories = typeof accessories === 'string' 
                    ? accessories 
                    : JSON.stringify(accessories || {});
            }
            
            if (stableIncome !== undefined) {
                // Округляем stableIncome для сохранения в БД
                updateData.stable_income = Math.floor(stableIncome);
                console.log('Updating stable_income:', stableIncome, '→ rounded:', Math.floor(stableIncome));
            }
            
            const { error } = await this.supabase
                .from('players')
                .update(updateData)
                .eq('tg_id', userId.toString());
                
            if (error) throw error;
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
    
    // Безопасное обновление уровня игрока
    async updatePlayerLevel(userId, level) {
        if (!this.supabase) return false;
        try {
            const { error } = await this.supabase
                .from('players')
                .update({ 
                    player_level: level,
                    last_updated: new Date().toISOString()
                })
                .eq('tg_id', userId.toString());
            if (error) throw error;
            console.log('Player level updated successfully:', level);
            return true;
        } catch (error) {
            console.error('❌ Ошибка обновления уровня игрока:', error);
            return false;
        }
    }
}

// Экспортируем для использования в основном скрипте
window.GameDatabase = GameDatabase;
