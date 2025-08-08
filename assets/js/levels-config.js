// 🎮 LabubuCoin - Конфигурация системы уровней
console.log('📋 Starting to load levels-config.js...');

class LevelsConfig {
    constructor() {
        // ВАЖНО: сначала инициализируем ranks, потом levels
        // так как generateLevelsConfig() использует getRankByCoins()
        this.ranks = this.generateRanksConfig();
        this.levels = this.generateLevelsConfig();
    }

    // Генерация конфигурации уровней
    generateLevelsConfig() {
        const levels = [];

        // Делает уровни жёстко привязанными к порогам рангов (coins)
        // Уровень 1 → requiredCoins = 0; Уровень 2 → 500; далее по списку рангов
        for (let i = 0; i < this.ranks.length; i++) {
            const currentRank = this.ranks[i];
            const nextRank = this.ranks[i + 1] || null;
            const totalXpRequired = currentRank.requiredCoins; // XP (coins) для достижения этого уровня
            const xpRequired = nextRank
                ? nextRank.requiredCoins - currentRank.requiredCoins // Сколько нужно от текущего до следующего уровня
                : 0; // последний уровень

            levels.push({
                level: i + 1,
                xpRequired: xpRequired,
                totalXpRequired: totalXpRequired,
                rank: currentRank.name,
                rankColor: currentRank.color,
                rankIcon: currentRank.icon,
                rankId: currentRank.id,
                rewards: this.getLevelRewards(i + 1, totalXpRequired),
                title: this.getLevelTitle(i + 1, currentRank)
            });
        }

        return levels;
    }

    // Конфигурация рангов - детальная система на основе баланса игрока
    generateRanksConfig() {
        return [
            // Bronze ранги
            {
                id: "bronze_1",
                name: "Bronze 1", 
                requiredCoins: 0,
                reward: 100,
                color: "#CD7F32",
                gradient: "linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)",
                icon: "🥉",
                description: "Первые шаги в мире LabubuCoin"
            },
            {
                id: "bronze_2",
                name: "Bronze 2",
                requiredCoins: 500,
                reward: 200, 
                color: "#CD7F32",
                gradient: "linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)",
                icon: "🥉",
                description: "Изучаешь основы накопления"
            },
            {
                id: "bronze_3", 
                name: "Bronze 3",
                requiredCoins: 1000,
                reward: 300,
                color: "#CD7F32",
                gradient: "linear-gradient(135deg, #CD7F32 0%, #A0522D 100%)",
                icon: "🥉",
                description: "Мастер бронзового уровня"
            },
            
            // Silver ранги
            {
                id: "silver_1",
                name: "Silver 1",
                requiredCoins: 2000,
                reward: 400,
                color: "#C0C0C0", 
                gradient: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",
                icon: "🥈",
                description: "Переход на серебряный уровень"
            },
            {
                id: "silver_2",
                name: "Silver 2", 
                requiredCoins: 3500,
                reward: 500,
                color: "#C0C0C0",
                gradient: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",
                icon: "🥈", 
                description: "Опытный серебряный игрок"
            },
            {
                id: "silver_3",
                name: "Silver 3",
                requiredCoins: 5000,
                reward: 600,
                color: "#C0C0C0",
                gradient: "linear-gradient(135deg, #C0C0C0 0%, #808080 100%)",
                icon: "🥈",
                description: "Элита серебряного ранга"
            },
            
            // Gold ранги
            {
                id: "gold_1",
                name: "Gold 1",
                requiredCoins: 7500,
                reward: 800,
                color: "#FFD700",
                gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                icon: "🥇",
                description: "Добро пожаловать в золотую лигу"
            },
            {
                id: "gold_2",
                name: "Gold 2", 
                requiredCoins: 10000,
                reward: 1000,
                color: "#FFD700",
                gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                icon: "🥇",
                description: "Золотой инвестор"
            },
            {
                id: "gold_3",
                name: "Gold 3",
                requiredCoins: 15000,
                reward: 1200,
                color: "#FFD700", 
                gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                icon: "🥇",
                description: "Мастер золотых инвестиций"
            },
            {
                id: "gold_4",
                name: "Gold 4",
                requiredCoins: 20000,
                reward: 1500,
                color: "#FFD700",
                gradient: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
                icon: "🥇",
                description: "Король золотого ранга"
            },
            
            // Platinum ранги
            {
                id: "platinum_1",
                name: "Platinum 1",
                requiredCoins: 30000,
                reward: 2000,
                color: "#E5E4E2",
                gradient: "linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)",
                icon: "💎",
                description: "Платиновый статус достигнут"
            },
            {
                id: "platinum_2",
                name: "Platinum 2",
                requiredCoins: 40000,
                reward: 2500,
                color: "#E5E4E2",
                gradient: "linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)",
                icon: "💎",
                description: "Элитный платиновый игрок"
            },
            {
                id: "platinum_3",
                name: "Platinum 3",
                requiredCoins: 50000,
                reward: 3000,
                color: "#E5E4E2",
                gradient: "linear-gradient(135deg, #E5E4E2 0%, #BCC6CC 100%)",
                icon: "💎",
                description: "Мастер платинового уровня"
            },
            
            // Diamond ранги
            {
                id: "diamond_1",
                name: "Diamond 1",
                requiredCoins: 65000,
                reward: 4000,
                color: "#B9F2FF",
                gradient: "linear-gradient(135deg, #B9F2FF 0%, #87CEEB 100%)",
                icon: "💠",
                description: "Алмазный статус - редкость"
            },
            {
                id: "diamond_2",
                name: "Diamond 2",
                requiredCoins: 80000,
                reward: 5000,
                color: "#B9F2FF",
                gradient: "linear-gradient(135deg, #B9F2FF 0%, #87CEEB 100%)",
                icon: "💠",
                description: "Элитный алмазный магнат"
            },
            {
                id: "diamond_3",
                name: "Diamond 3",
                requiredCoins: 100000,
                reward: 6000,
                color: "#B9F2FF",
                gradient: "linear-gradient(135deg, #B9F2FF 0%, #87CEEB 100%)",
                icon: "💠",
                description: "Король алмазного ранга"
            },
            
            // Master ранги
            {
                id: "master_1",
                name: "Master 1",
                requiredCoins: 125000,
                reward: 8000,
                color: "#9932CC",
                gradient: "linear-gradient(135deg, #9932CC 0%, #4B0082 100%)",
                icon: "👑",
                description: "Мастерский уровень достигнут"
            },
            {
                id: "master_2",
                name: "Master 2",
                requiredCoins: 150000,
                reward: 10000,
                color: "#9932CC",
                gradient: "linear-gradient(135deg, #9932CC 0%, #4B0082 100%)",
                icon: "👑",
                description: "Величайший мастер LabubuCoin"
            },
            
            // Grandmaster ранг
            {
                id: "grandmaster",
                name: "Grandmaster",
                requiredCoins: 200000,
                reward: 15000,
                color: "#FF6B35",
                gradient: "linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)",
                icon: "🔥",
                description: "Гроссмейстер - легендарный статус"
            },
            
            // Legend ранги
            {
                id: "legend",
                name: "Legend",
                requiredCoins: 300000,
                reward: 20000,
                color: "#FF1493",
                gradient: "linear-gradient(135deg, #FF1493 0%, #DC143C 100%)",
                icon: "⭐",
                description: "Легендарный статус - мечта многих"
            },
            {
                id: "legend_elite",
                name: "Legend Elite",
                requiredCoins: 500000,
                reward: 30000,
                color: "#FF0080",
                gradient: "linear-gradient(135deg, #FF0080 0%, #8B008B 100%)",
                icon: "🌟",
                description: "Абсолютная легенда LabubuCoin"
            }
        ];
    }

    // Получение ранга по количеству монет
    getRankByCoins(coins) {
        // Ищем подходящий ранг в убывающем порядке
        for (let i = this.ranks.length - 1; i >= 0; i--) {
            if (coins >= this.ranks[i].requiredCoins) {
                return this.ranks[i];
            }
        }
        // Если нет подходящего ранга, возвращаем первый (Bronze 1)
        return this.ranks[0];
    }

    // Получение ранга по уровню игрока
    getRankByLevel(level) {
        // Находим данные уровня
        const levelData = this.levels.find(l => l.level === level);
        if (!levelData) {
            return this.ranks[0]; // Возвращаем Bronze 1 если уровень не найден
        }
        
        // Получаем ранг по общему XP для этого уровня
        return this.getRankByCoins(levelData.totalXpRequired);
    }

    // Получение следующего ранга
    getNextRank(coins) {
        const currentRank = this.getRankByCoins(coins);
        const currentIndex = this.ranks.findIndex(rank => rank.id === currentRank.id);
        
        if (currentIndex < this.ranks.length - 1) {
            return this.ranks[currentIndex + 1];
        }
        
        return null; // Максимальный ранг достигнут
    }

    // Получение прогресса до следующего ранга
    getRankProgress(coins) {
        const currentRank = this.getRankByCoins(coins);
        const nextRank = this.getNextRank(coins);
        
        if (!nextRank) {
            return 100; // Максимальный ранг достигнут
        }
        
        const progressCoins = coins - currentRank.requiredCoins;
        const totalNeeded = nextRank.requiredCoins - currentRank.requiredCoins;
        
        return Math.max(0, Math.min(100, (progressCoins / totalNeeded) * 100));
    }

    // Награды за достижение уровня
    getLevelRewards(level, totalXpRequired, allLevels = null) {
        const rewards = [];
        const currentRank = this.getRankByCoins(totalXpRequired);
        
        // Базовые награды каждые 5 уровней
        if (level % 5 === 0) {
            rewards.push({
                type: 'coins',
                amount: level * 100,
                description: `Бонус ${level * 100} монет`
            });
        }
        
        // Награды за достижение нового ранга
        if (level > 1 && allLevels) {
            const previousTotalXP = allLevels[level - 2]?.totalXpRequired || 0;
            const previousRank = this.getRankByCoins(previousTotalXP);
            
            // Если ранг изменился, даем награду за новый ранг
            if (currentRank.id !== previousRank.id) {
                rewards.push({
                    type: 'rank',
                    amount: currentRank.reward,
                    description: `Достижение ранга ${currentRank.name}!`,
                    rankName: currentRank.name,
                    rankIcon: currentRank.icon
                });
            }
        }
        
        // Особые награды за крупные достижения
        if (level === 100) {
            rewards.push({
                type: 'special',
                description: 'Максимальный уровень! Поздравляем!',
                title: 'Мастер 100 уровня'
            });
        }
        
        return rewards;
    }

    // Получение титула для уровня
    getLevelTitle(level, rank) {
        const titles = {
            'bronze_1': 'Новичок',
            'bronze_2': 'Ученик', 
            'bronze_3': 'Исследователь',
            'silver_1': 'Искатель',
            'silver_2': 'Коллекционер',
            'silver_3': 'Энтузиаст',
            'gold_1': 'Знаток',
            'gold_2': 'Мастерок',
            'gold_3': 'Специалист',
            'gold_4': 'Эксперт',
            'platinum_1': 'Профессионал',
            'platinum_2': 'Виртуоз',
            'platinum_3': 'Мастер',
            'diamond_1': 'Гуру',
            'diamond_2': 'Чемпион',
            'diamond_3': 'Победитель',
            'master_1': 'Лидер',
            'master_2': 'Элита',
            'grandmaster': 'Звезда',
            'legend': 'Герой',
            'legend_elite': 'Легенда'
        };
        
        // Если есть специальный титул для ранга, используем его
        if (titles[rank.id]) {
            return titles[rank.id];
        }
        
        // Иначе генерируем титул на основе уровня
        const levelTitles = [
            'Новичок', 'Ученик', 'Исследователь', 'Искатель', 'Коллекционер',
            'Энтузиаст', 'Знаток', 'Мастерок', 'Специалист', 'Эксперт',
            'Профессионал', 'Виртуоз', 'Мастер', 'Гуру', 'Чемпион',
            'Победитель', 'Лидер', 'Элита', 'Звезда', 'Герой'
        ];
        
        const titleIndex = Math.min(level - 1, levelTitles.length - 1);
        return levelTitles[titleIndex] || 'Мастер';
    }

    // Получение информации об уровне
    getLevelInfo(level) {
        if (level < 1 || level > this.levels.length) {
            return null;
        }
        
        return this.levels[level - 1];
    }

    // Получение уровня по общему XP
    getLevelByTotalXP(totalXP) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (totalXP >= this.levels[i].totalXpRequired) {
                return i + 1;
            }
        }
        return 1; // Минимальный уровень
    }

    // Получение прогресса до следующего уровня
    getLevelProgress(totalXP) {
        const currentLevel = this.getLevelByTotalXP(totalXP);
        
        if (currentLevel >= this.levels.length) {
            return 100; // Максимальный уровень достигнут
        }
        
        const currentLevelInfo = this.levels[currentLevel - 1];
        const nextLevelInfo = this.levels[currentLevel];
        
        if (!nextLevelInfo) {
            return 100;
        }
        
        const xpInCurrentLevel = totalXP - currentLevelInfo.totalXpRequired;
        const xpNeededForNextLevel = nextLevelInfo.totalXpRequired - currentLevelInfo.totalXpRequired;
        
        return Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100));
    }

    // Экспорт конфигурации для отладки
    exportConfig() {
        return {
            levels: this.levels,
            ranks: this.ranks,
            summary: {
                totalLevels: this.levels.length,
                maxXP: this.levels[this.levels.length - 1]?.totalXpRequired || 0,
                ranksCount: this.ranks.length,
                maxRankRequirement: this.ranks[this.ranks.length - 1]?.requiredCoins || 0
            }
        };
    }
}

// Создаем глобальный экземпляр конфигурации
console.log('🔧 Creating LevelsConfig instance...');
try {
    window.LevelsConfig = new LevelsConfig();
    console.log('✅ LevelsConfig instance created successfully!');
    console.log('🎮 Levels Config loaded!');
    console.log('📊 Total levels:', window.LevelsConfig.levels.length);
    console.log('🏆 Total ranks:', window.LevelsConfig.ranks.length);
    console.log('💎 Max XP required:', window.LevelsConfig.levels[window.LevelsConfig.levels.length - 1]?.totalXpRequired);
    console.log('👑 Highest rank:', window.LevelsConfig.ranks[window.LevelsConfig.ranks.length - 1]?.name);
    console.log('💰 Max coins for highest rank:', window.LevelsConfig.ranks[window.LevelsConfig.ranks.length - 1]?.requiredCoins);
} catch (error) {
    console.error('❌ Error creating LevelsConfig instance:', error);
    console.error('📍 Stack trace:', error.stack);
} 