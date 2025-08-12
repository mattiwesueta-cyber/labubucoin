// 🎮 LabubuCoin Game Script
// Mute console.log output
(() => {
    try {
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
            console.log = function() {};
        }
    } catch (_) {}
})();
class LabubuGame {
    constructor() {
        this.coins = 0;
        this.stableIncome = 0; // доход в минуту
        this.profitPerClick = 1;
        this.boost = 2;
        this.boostTimeLeft = 0;
        this.isBoostActive = false;
        this.costume = 'labubu.png';
        this.accessories = {};
        // Структура владения предметами (инвентарь)
        this.purchaseHistory = [];
        this.selectedCard = null;
        this.selectedAccessory = null;
        this.selectedCar = null;
        this.userId = null;
        this.isOnline = true; // флаг что игрок онлайн
        this.onlineIncomeInterval = null; // интервал для начисления онлайн дохода
        this.lastOnlineIncomeSave = Date.now(); // время последнего сохранения онлайн дохода

        // Система энергии
        this.currentEnergy = 100; // текущая энергия
        this.maxEnergy = 100; // максимальная энергия
        this.lastEnergyUpdate = Date.now(); // время последнего обновления энергии

        // Анимации UI
        this.circleBgAnim = null; // текущая анимация пульса фона

        // Система уровней
        this.currentLevel = 1;
        this.currentXp = 0;
        this.levelsConfig = null; // Будет инициализирована после загрузки конфига

        // Данные игрока для проверки требований
        this.playerData = {
            level: 1,
            referrals_count: 0
        };

        this.db = null; // Инициализируем в init() после загрузки DOM
        // TON Connect UI
        this.tonConnectUI = null;
        this.walletAddress = null;
        
        this.init();
    }

    // Реферальные награды: если у меня есть пригласивший, и я (реферал) достиг нового реферального ранга,
    // то пригласившему начисляется базовая награда ранга * 2
    async checkAndAwardReferralRanks() {
        try {
            if (!this.levelsConfig || !this.levelsConfig.ranks || !this.userId || !this.db) return;

            // Загружаем мои текущие данные (нужен invited_by и текущий баланс/ранг)
            const me = await this.db.loadPlayerData(this.userId);
            if (!me || !me.invited_by) return; // нет пригласившего

            // Определяем мой текущий ранг по монетам
            const myCoins = this.coins;
            const currentRank = this.levelsConfig.getRankByCoins(myCoins);
            if (!currentRank) return;

            // Храним локально, какой максимальный реферальный ранги я уже засчитывал для наград, чтобы не дублировать выплаты
            if (!this.accessories) this.accessories = {};
            if (!this.accessories._awardedReferralRank) this.accessories._awardedReferralRank = 0;

            const currentRankIndex = this.levelsConfig.ranks.findIndex(r => r.name === currentRank.name);
            if (currentRankIndex === -1) return;

            if (currentRankIndex > this.accessories._awardedReferralRank) {
                // Новый достигнутый ранг — начисляем пригласившему
                const inviterId = me.invited_by;
                const baseReward = currentRank.reward || 0;
                const rewardForInviter = baseReward * 2;

                if (rewardForInviter > 0) {
                    // Загружаем пригласившего, прибавляем монеты, сохраняем
                    const inviter = await this.db.loadPlayerData(inviterId);
                    if (inviter) {
                        const newBalance = (inviter.balance || 0) + rewardForInviter;
                        await this.db.updateBalance(inviterId, newBalance);
                    }
                }

                // Обновляем локально и в БД отметку, что этот ранг уже учтён
                this.accessories._awardedReferralRank = currentRankIndex;
                await this.db.updateAccessoriesAndIncome(this.userId, this.accessories, undefined);
            }
        } catch (_) {}
    }

    // Инициализация системы уровней
    async initLevelsSystem() {
        console.log('🔄 Starting levels system initialization...');
        console.log('🔍 Checking if window object exists:', !!window);
        console.log('🔍 Available window properties:', Object.keys(window).filter(key => key.includes('Level') || key.includes('Config')));
        console.log('🔍 LevelsConfig type:', typeof window.LevelsConfig);
        console.log('🔍 LevelsConfig object:', window.LevelsConfig);
        
        // Ждем загрузки конфига уровней
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds maximum wait
            
            const checkConfig = () => {
                attempts++;
                console.log(`⏳ Waiting for levels config... (attempt ${attempts}/${maxAttempts})`);
                
                if (window.LevelsConfig) {
                    // LevelsConfig уже является экземпляром, не нужно создавать новый
                    this.levelsConfig = window.LevelsConfig;
                    console.log('🎮 Levels system initialized with config');
                    console.log('📊 Config details:', {
                        levels: this.levelsConfig.levels?.length,
                        ranks: this.levelsConfig.ranks?.length,
                        type: typeof this.levelsConfig,
                        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.levelsConfig)),
                        isInstance: this.levelsConfig.constructor?.name
                    });
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.error('❌ Failed to load levels config after maximum attempts');
                    // Продолжаем без конфига уровней (UI пропустит прогресс-бар)
                    resolve();
                } else {
                    setTimeout(checkConfig, 100);
                }
            };
            checkConfig();
        });
    }

    // (Удалено) Резервная конфигурация уровней

    // Вычисление уровня игрока на основе баланса
    calculateLevel() {
        if (!this.levelsConfig) {
            return { level: 1, currentXp: 0, progress: 0, xpToNextLevel: 100 };
        }
        
        // Используем баланс как XP
        const currentXp = Math.floor(this.coins);
        
        // Получаем текущий уровень (НЕ изменяем this.currentLevel здесь!)
        const calculatedLevel = this.levelsConfig.getLevelByTotalXP(currentXp);
        
        // Получаем прогресс до следующего уровня
        let progress = this.levelsConfig.getLevelProgress(currentXp);
        
        // 🔧 ВРЕМЕННЫЙ ХАК: Исправляем прогресс для первого уровня
        if (calculatedLevel === 1 && progress === 0 && currentXp > 0) {
            // Если система показывает "Coins left", значит мы знаем цель
            const nextRank = this.levelsConfig.getNextRank(currentXp);
            if (nextRank && nextRank.requiredCoins) {
                progress = (currentXp / nextRank.requiredCoins) * 100;
                console.log(`🔧 Fixed progress for level 1: ${currentXp}/${nextRank.requiredCoins} = ${progress.toFixed(1)}%`);
            } else {
                // Fallback: предполагаем что первый уровень до 500 монет
                progress = (currentXp / 500) * 100;
                console.log(`🔧 Fallback progress for level 1: ${currentXp}/500 = ${progress.toFixed(1)}%`);
            }
        }
        
        // Получаем информацию о текущем уровне
        const levelInfo = this.levelsConfig.getLevelInfo(calculatedLevel);
        const nextLevelInfo = this.levelsConfig.getLevelInfo(calculatedLevel + 1);
        
        let xpToNextLevel = 0;
        if (nextLevelInfo) {
            xpToNextLevel = nextLevelInfo.totalXpRequired - currentXp;
        }
        
        return {
            level: calculatedLevel,
            currentXp: currentXp,
            progress: progress,
            xpToNextLevel: xpToNextLevel,
            levelInfo: levelInfo,
            nextLevelInfo: nextLevelInfo
        };
    }

    // Обновление прогресс-бара уровня
    updateLevelProgressBar() {
        if (!this.levelsConfig) {
            return;
        }
        
        // Сохраняем текущий уровень ДО вычисления нового
        const oldLevel = this.currentLevel;
        
        const levelData = this.calculateLevel();
        const progressElement = document.getElementById('progress_value');
        const rankElement = document.getElementById('level_rank');
        const progressTextElement = document.getElementById('level_progress');
        
        // Обновляем ширину прогресс-бара от 0 до 100% по прогрессу РАНГА (а не абстрактного уровня)
        if (progressElement) {
            const rankProgress = this.levelsConfig.getRankProgress(this.coins);
            progressElement.style.width = `${rankProgress}%`;
            console.log('🎨 Progress bar (rank) updated to:', rankProgress.toFixed(1) + '%');
        }
        
        // Обновляем текст ранга
        if (rankElement) {
            const rankInfo = this.levelsConfig.getRankByCoins(this.coins);
            rankElement.textContent = `${rankInfo.icon} ${rankInfo.name}`;
            console.log('🏆 Rank updated to:', `${rankInfo.icon} ${rankInfo.name}`);
        }
        
        // Обновляем текст прогресса: монеты до следующего ранга и текущий баланс
        if (progressTextElement) {
            const currentRank = this.levelsConfig.getRankByCoins(this.coins);
            const nextRank = this.levelsConfig.getNextRank(this.coins);
            
            if (!nextRank) {
                progressTextElement.textContent = 'MAX RANK';
            } else {
                const coinsToNextRank = Math.max(0, nextRank.requiredCoins - this.coins);
                progressTextElement.textContent = `${this.formatNumber(Math.floor(this.coins))} / ${this.formatNumber(nextRank.requiredCoins)}`;
            }
            console.log('📊 Progress text updated to:', progressTextElement.textContent);
        }
        
        // Сохраняем уровень в БД, если он изменился (сравниваем со старым уровнем)
        if (oldLevel !== levelData.level && this.userId && this.db) {
            console.log('🆙 Level changed:', oldLevel, '→', levelData.level);
            this.saveLevelToDB(levelData.level);
            
            // Показываем поздравление с новым уровнем
            if (levelData.level > oldLevel) {
                this.showLevelUpNotification(levelData);
            }
        }
        
        console.log('Level updated:', {
            level: levelData.level,
            rank: levelData.levelInfo?.rank,
            title: levelData.levelInfo?.title,
            currentXp: levelData.currentXp,
            progress: levelData.progress.toFixed(1) + '%',
            xpToNext: levelData.xpToNextLevel
        });
    }

    // 🔒 Проверка требований для покупки предмета
    checkItemRequirements(itemElement) {
        const requiredLevel = parseInt(itemElement.dataset.requiredLevel) || 1;
        const requiredReferrals = parseInt(itemElement.dataset.requiredReferrals) || 0;
        
        const playerLevel = this.calculateLevel().level;
        const playerReferrals = this.playerData.referrals_count;
        
        return {
            canBuy: playerLevel >= requiredLevel && playerReferrals >= requiredReferrals,
            hasLevel: playerLevel >= requiredLevel,
            hasReferrals: playerReferrals >= requiredReferrals,
            playerLevel,
            playerReferrals,
            requiredLevel,
            requiredReferrals
        };
    }

    // 🎨 Обновление визуального состояния карточек на основе требований
    updateItemsAvailability() {
        const allItems = document.querySelectorAll('.box_lb[data-required-level], .box_lb[data-required-referrals]');
        
        allItems.forEach(itemElement => {
            const wrapper = itemElement.closest('.wrapper_lb');
            if (!wrapper) return;
            
            const requirements = this.checkItemRequirements(itemElement);
            
            // Сброс всех классов блокировки
            wrapper.classList.remove('blocked_card', 'blocked_referals');
            
            // Обновляем отображение требований в UI (создадим блоки при необходимости)
            this.ensureRequirementBlocks(wrapper);
            this.updateRequirementDisplay(wrapper, requirements);
            
            if (!requirements.canBuy) {
                if (!requirements.hasLevel) {
                    wrapper.classList.add('blocked_card');
                } else if (!requirements.hasReferrals) {
                    wrapper.classList.add('blocked_referals');
                }
            }
        });
    }

    // 📝 Обновление отображения требований в UI карточки
    updateRequirementDisplay(wrapper, requirements) {
        // Обновляем required level
        const levelBlock = wrapper.querySelector('.required_level');
        const levelRequirementValue = wrapper.querySelector('.required_level .row_required span:last-child');
        if (levelRequirementValue) {
            let requiredLevelText = '';
            if (this.levelsConfig && typeof requirements.requiredLevel === 'number') {
                const rank = this.levelsConfig.getRankByLevel(requirements.requiredLevel);
                requiredLevelText = rank ? rank.name : `Level ${requirements.requiredLevel}`;
            } else {
                requiredLevelText = `Level ${requirements.requiredLevel || 1}`;
            }
            levelRequirementValue.textContent = requiredLevelText;
        }
        if (levelBlock) {
            levelBlock.style.display = requirements.hasLevel ? 'none' : '';
        }

        // Обновляем required referrals
        const referralsBlock = wrapper.querySelector('.required_referals');
        const referralsRequirementValue = wrapper.querySelector('.required_referals .row_required span:last-child');
        if (referralsRequirementValue) {
            referralsRequirementValue.textContent = requirements.requiredReferrals;
        }
        if (referralsBlock) {
            referralsBlock.style.display = requirements.hasReferrals ? 'none' : '';
        }
    }

    // Проверяет, куплен ли предмет по элементу карточки
    isItemAlreadyOwned(cardElement) {
        const itemId = cardElement?.dataset?.id;
        if (!itemId) return false;
        return this.isItemOwnedById(itemId);
    }

    // Проверяет владение по id
    isItemOwnedById(itemId) {
        if (!this.accessories) return false;
        // inventory как список всех покупок
        if (Array.isArray(this.accessories.inventory) && this.accessories.inventory.includes(itemId)) {
            return true;
        }
        // Также допускаем, что некоторые категории хранятся по ключам (hat/shoes/bag/car)
        const possible = ['hat','shoes','bag','car'];
        for (const key of possible) {
            const value = this.accessories[key];
            if (typeof value === 'string' && itemId.includes(key)) {
                return true;
            }
        }
        return false;
    }

    // Проверка по данным, считанным из БД
    isItemAlreadyOwnedByData(itemId, data) {
        try {
            let accessories = data.accessories;
            if (accessories && typeof accessories === 'string') {
                accessories = JSON.parse(accessories);
            }
            if (!accessories) return false;
            if (Array.isArray(accessories.inventory) && accessories.inventory.includes(itemId)) return true;
            return false;
        } catch {
            return false;
        }
    }

    // Добавить запись о покупке в локальный журнал
    addPurchaseRecord(entry) {
        try {
            this.purchaseHistory.push(entry);
        } catch {}
    }

    // Гарантировать структуру accessories
    ensureAccessoriesStructure() {
        if (!this.accessories || typeof this.accessories !== 'object') this.accessories = {};
        if (!Array.isArray(this.accessories.inventory)) this.accessories.inventory = [];
    }

    // Гарантируем наличие блоков required_level и required_referals в карточке
    ensureRequirementBlocks(wrapper) {
        // required_level
        if (!wrapper.querySelector('.required_level')) {
            const levelDiv = document.createElement('div');
            levelDiv.className = 'required_level jlcn clmn';
            levelDiv.style.display = 'none';
            levelDiv.innerHTML = `
                <svg width="31" height="30" viewBox="0 0 31 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M15.5 4.06104C13.0837 4.06104 11.125 6.0198 11.125 8.43604V10.3135H19.875V8.43604C19.875 6.0198 17.9162 4.06104 15.5 4.06104ZM8.625 8.43604V10.3135H8C6.1014 10.3135 4.56233 11.8527 4.5625 13.7513L4.56354 25.0013C4.56371 26.8996 6.10269 28.4385 8.00104 28.4385H22.9997C24.8982 28.4385 26.4372 26.8995 26.4372 25.001V13.751C26.4372 11.8525 24.8982 10.3135 22.9997 10.3135H22.375V8.43604C22.375 4.63909 19.297 1.56104 15.5 1.56104C11.7031 1.56104 8.625 4.63909 8.625 8.43604ZM21.75 19.3638C21.75 18.6734 21.1903 18.1138 20.5 18.1138C19.8096 18.1138 19.25 18.6734 19.25 19.3638V19.3763C19.25 20.0666 19.8096 20.6263 20.5 20.6263C21.1903 20.6263 21.75 20.0666 21.75 19.3763V19.3638ZM15.5 18.1138C16.1904 18.1138 16.75 18.6734 16.75 19.3638V19.3763C16.75 20.0666 16.1904 20.6263 15.5 20.6263C14.8096 20.6263 14.25 20.0666 14.25 19.3763V19.3638C14.25 18.6734 14.8096 18.1138 15.5 18.1138ZM11.75 19.3638C11.75 18.6734 11.1904 18.1138 10.5 18.1138C9.80965 18.1138 9.25 18.6734 9.25 19.3638V19.3763C9.25 20.0666 9.80965 20.6263 10.5 20.6263C11.1904 20.6263 11.75 20.0666 11.75 19.3763Z" fill="#D96163"/>
                </svg>
                <div class="row_required clmn">
                    <span>Required level:</span>
                    <span></span>
                </div>`;
            wrapper.appendChild(levelDiv);
        }

        // required_referals
        if (!wrapper.querySelector('.required_referals')) {
            const refDiv = document.createElement('div');
            refDiv.className = 'required_referals jlcn clmn';
            refDiv.style.display = 'none';
            refDiv.innerHTML = `
                <svg width="31" height="31" viewBox="0 0 31 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M5.48926 9.68734C5.48926 6.65552 7.94703 4.19775 10.9788 4.19775C14.0106 4.19775 16.4684 6.65552 16.4684 9.68734C16.4684 12.7192 14.0106 15.1769 10.9788 15.1769C7.94703 15.1769 5.48926 12.7192 5.48926 9.68734Z" fill="#D9B961"/>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M1.29199 23.2498C1.29199 19.683 4.18349 16.7915 7.75033 16.7915H14.2087C15.3829 16.7915 16.4875 17.106 17.4387 17.6563C17.8379 17.8872 18.0837 18.3133 18.0837 18.7743V25.8332C18.0837 26.5466 17.5054 27.1248 16.792 27.1248H2.58366C1.8703 27.1248 1.29199 26.5466 1.29199 25.8332V23.2498Z" fill="#D9B961"/>
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M24.5417 16.7915C25.2551 16.7915 25.8333 17.3698 25.8333 18.0832V20.6665H28.4167C29.1301 20.6665 29.7083 21.2448 29.7083 21.9582C29.7083 22.6716 29.1301 23.2498 28.4167 23.2498H25.8333V25.8332C25.8333 26.5466 25.2551 27.1248 24.5417 27.1248C23.8283 27.1248 23.25 26.5466 23.25 25.8332V23.2498H20.6667C19.9533 23.2498 19.375 22.6716 19.375 21.9582C19.375 21.2448 19.9533 20.6665 20.6667 20.6665H23.25V18.0832C23.25 17.3698 23.8283 16.7915 24.5417 16.7915Z" fill="#D9B961"/>
                </svg>
                <div class="row_required clmn">
                    <span>Required referals:</span>
                    <span></span>
                </div>`;
            wrapper.appendChild(refDiv);
        }
    }

    // Сохранение уровня в БД
    async saveLevelToDB(level) {
        if (!this.userId || !this.db) return;
        
        try {
            // Используем существующую функцию обновления или создаем новую
            const success = await this.db.updatePlayerLevel(this.userId, level);
            if (success) {
                // Обновляем локальное значение только после успешного сохранения
                this.currentLevel = level;
                console.log('💾 Level saved to DB and updated locally:', level);
            }
        } catch (error) {
            console.error('❌ Error saving level to DB:', error);
        }
    }

    // Уведомление о повышении уровня
    showLevelUpNotification(levelData) {
        const rankInfo = this.levelsConfig.getRankByCoins(this.coins);
        
        // Создаем временное уведомление
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-content">
                <h3>🎉 Поздравляем!</h3>
                <p>Достигнут ${levelData.level} уровень!</p>
                <p>${rankInfo.icon} ${rankInfo.name}</p>
                <p class="level-title">${levelData.levelInfo?.title || 'Мастер'}</p>
            </div>
        `;
        
        // Добавляем стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            text-align: center;
            animation: levelUpAnim 3s ease-in-out;
            font-family: 'Gilroy-Bold', sans-serif;
        `;
        
        // Добавляем CSS анимацию если её нет
        if (!document.getElementById('levelUpStyles')) {
            const styles = document.createElement('style');
            styles.id = 'levelUpStyles';
            styles.textContent = `
                @keyframes levelUpAnim {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
                    20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                }
                .level-up-notification h3 { margin: 0 0 10px 0; font-size: 24px; }
                .level-up-notification p { margin: 5px 0; font-size: 16px; }
                .level-up-notification .level-title { font-size: 18px; font-weight: bold; }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Удаляем уведомление через 3 секунды
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
        console.log('🎉 Level up notification shown for level:', levelData.level);
    }

    // Загрузка уровня из БД
    async loadLevelFromDB() {
        if (!this.userId || !this.db) return 1;
        
        try {
            const data = await this.db.loadPlayerData(this.userId);
            return data?.player_level || 1;
        } catch (error) {
            console.error('❌ Error loading level from DB:', error);
            return 1;
        }
    }

    getPlayerDataForSave() {
        const data = {
            coins: this.coins,
            stableIncome: this.stableIncome,
            profitPerClick: this.profitPerClick,
            boost: this.boost,
            boostTimeLeft: this.boostTimeLeft,
            isBoostActive: this.isBoostActive,
            costume: this.costume,
            accessories: this.accessories,
            playerLevel: this.currentLevel // Добавляем уровень игрока
            // last_active больше не передаём с клиента!
        };
        
        console.log('getPlayerDataForSave - accessories:', this.accessories);
        console.log('getPlayerDataForSave - level:', this.currentLevel);
        
        return data;
    }

    // Получение реферального кода из URL
    getReferralCode() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref') || urlParams.get('referral');
            
            // Также проверяем Telegram WebApp start parameter
            if (window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
                const startParam = window.Telegram.WebApp.initDataUnsafe.start_param;
                if (startParam.startsWith('ref_')) {
                    return startParam.substring(4); // Убираем префикс 'ref_'
                }
            }
            
            console.log('🔗 Referral code from URL:', refCode);
            return refCode;
        } catch (error) {
            console.error('❌ Error getting referral code:', error);
            return null;
        }
    }

    async init() {
        // Показываем лоадер
        const loader = document.querySelector('.load_bg');
        if (loader) loader.style.display = '';
        
        // Дополнительное ожидание для загрузки видео/анимации/ресурсов
        console.log('⏳ Waiting for video/animation resources to load...');
        await new Promise(r => setTimeout(r, 1200));
        
        // Получаем реферальный код из URL
        this.referralCode = this.getReferralCode();
        
        // Ждем инициализации supabase (база данных уже создана в конструкторе)
        while (!window.GameDatabase) { // Исправляем на window.GameDatabase
            await new Promise(r => setTimeout(r, 150)); // Увеличено с 100ms до 150ms
        }
        this.db = new window.GameDatabase(); // Инициализируем db
        
        // Инициализируем систему уровней и ЖДЕМ её завершения
        await this.initLevelsSystem();
        this.initTonConnect();
        
        this.setupEventListeners();
        this.updateUI();
        // Запускаем фоновую анимацию дыхания круга
        this.startCircleBgIdleAnimation();
        // Получаем данные пользователя через Telegram WebApp API
        await this.loadTelegramUser();
        // Отображаем топ игроков
        this.renderTopPlayers();
        // Отображаем реферальные ранги
        this.renderReferralRanks();
        // Отображаем реальных рефералов игрока
        this.renderPlayerReferrals();
        // Дополнительная задержка для завершения загрузки всех элементов
        console.log('⏳ Finalizing video/animation setup...');
        await new Promise(r => setTimeout(r, 800));
        // Скрываем лоадер после полной загрузки
        if (loader) loader.style.display = 'none';
    }

    // Инициализация TON Connect UI и обработчиков
    initTonConnect() {
        try {
            // UMD-глобаль библиотеки: TON_CONNECT_UI
            if (window.TON_CONNECT_UI && window.TON_CONNECT_UI.TonConnectUI) {
                const underLabubu = window.location.pathname.includes('/labubu_game/');
                const manifestUrl = location.origin + (underLabubu ? '/labubu_game/tonconnect-manifest.json' : '/tonconnect-manifest.json');
                this.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({ manifestUrl });

                // Обновляем UI при изменении статуса кошелька
                if (typeof this.tonConnectUI.onStatusChange === 'function') {
                    this.tonConnectUI.onStatusChange(async (wallet) => {
                        const addr = wallet?.account?.address || null;
                        if (addr) {
                            this.walletAddress = addr;
                            this.updateWalletUI();
                            if (this.userId && this.db) {
                                await this.db.updateWalletAddress(this.userId, addr);
                            }
                        } else {
                            this.walletAddress = null;
                            this.updateWalletUI();
                        }
                    });
                }
            }
            const btn = document.getElementById('connect_wallet_btn');
            if (btn) {
                btn.addEventListener('click', async () => {
                    await this.handleConnectWallet();
                });
                // При старте обновим подпись, если адрес уже есть в памяти (после загрузки БД)
                this.updateWalletUI();
            }
        } catch (_) {}
    }

    async handleConnectWallet() {
        try {
            if (!this.tonConnectUI) return;
            // Если уже подключен — отключим и откроем модал заново (переподключение)
            if ((this.tonConnectUI.wallet && this.tonConnectUI.wallet.account) || this.walletAddress) {
                if (typeof this.tonConnectUI.disconnect === 'function') {
                    await this.tonConnectUI.disconnect();
                }
                this.walletAddress = null;
                this.updateWalletUI();
            }
            // Открываем модал (на случай, если требуется вручную)
            if (typeof this.tonConnectUI.openModal === 'function') {
                this.tonConnectUI.openModal();
            }
            const connected = await this.tonConnectUI.connectWallet();
            const account = connected?.account;
            const address = account?.address || null;
            if (!address) return;
            this.walletAddress = address;
            // Сохраняем в БД, если есть userId и db
            if (this.userId && this.db) {
                await this.db.updateWalletAddress(this.userId, address);
            }
            // Обновим кнопку адресом
            this.updateWalletUI();
        } catch (_) {}
    }

    // Короткий вывод адреса и подпись кнопки
    updateWalletUI() {
        const btn = document.getElementById('connect_wallet_btn');
        if (!btn) return;
        const span = btn.querySelector('span');
        if (!span) return;
        if (this.walletAddress && typeof this.walletAddress === 'string' && this.walletAddress.length > 10) {
            span.textContent = this.formatTonAddress(this.walletAddress);
        } else {
            span.textContent = 'Connect wallet';
        }
    }

    formatTonAddress(address) {
        try {
            const clean = String(address).trim();
            if (clean.length <= 10) return clean;
            return `${clean.slice(0, 4)}…${clean.slice(-4)}`;
        } catch (_) {
            return 'Wallet';
        }
    }

    async loadTelegramUser(retry = 0) {
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                
                console.log('📱 Telegram user data:', user);
                console.log('🆔 User ID:', user.id, 'type:', typeof user.id);
                console.log('👤 Username:', user.username);
                
                this.userId = user.id; // сохраняем userId
                
                console.log('💾 Saved userId to game:', this.userId);
                // Устанавливаем аватар
                const avatarImg = document.getElementById('tg_avatar');
                if (avatarImg && user.photo_url) {
                    avatarImg.src = user.photo_url;
                    avatarImg.alt = user.username || 'avatar';
                }
                // Отображаем username или имя
                const userElement = document.getElementById('user_id');
                if (userElement) {
                    userElement.textContent = user.username ? `@${user.username}` : user.first_name;
                }
                // Загружаем все игровые данные из Supabase, передавая username и реферальный код
                await this.loadPlayerDataFromDB(user.id, user.username, this.referralCode);
            } else {
                // Fallback: пытаемся получить данные из URL параметров
                const urlParams = new URLSearchParams(window.location.search);
                const urlUserId = urlParams.get('tg_user_id');
                const urlUsername = urlParams.get('tg_username');
                
                if (urlUserId) {
                    console.log('🔗 Getting user data from URL parameters');
                    console.log('🆔 URL User ID:', urlUserId);
                    console.log('👤 URL Username:', urlUsername);
                    
                    this.userId = parseInt(urlUserId);
                    
                    // Отображаем username
                    const userElement = document.getElementById('user_id');
                    if (userElement) {
                        userElement.textContent = urlUsername ? `@${urlUsername}` : 'Player';
                    }
                    
                    // Загружаем игровые данные
                    await this.loadPlayerDataFromDB(this.userId, urlUsername, this.referralCode);
                } else if (retry < 15) {
                    // Прогрессивное увеличение времени ожидания для видео/анимации
                    const waitTime = Math.min(800 + (retry * 200), 2000); // от 800ms до 2s
                    console.log(`⏳ Retry ${retry + 1}/15, waiting ${waitTime}ms for Telegram WebApp...`);
                    setTimeout(() => this.loadTelegramUser(retry + 1), waitTime);
                } else {
                    console.log('❌ No user data available from Telegram WebApp or URL after 15 attempts');
                    const userElement = document.getElementById('user_id');
                    if (userElement) userElement.textContent = 'Player';
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async loadPlayerDataFromDB(userId, username = null, referralCode = null) {
        if (!this.db) return;
        
        console.log('🎮 Loading player data for userId:', userId, 'username:', username, 'referralCode:', referralCode);
        
        const data = await this.db.loadPlayerData(userId, username, referralCode);
        if (data) {
            console.log('📦 Received player data from DB:', data);
            console.log('💰 Balance from DB:', data.balance, 'type:', typeof data.balance);
            
            // Проверка и исправление некорректных значений
            const timeResponse = await fetch('https://labubucoin.vercel.app/api/server-time');
            const timeData = await timeResponse.json();
            const now = timeData.timestamp;
            
            // Проверяем и исправляем некорректные значения
            let needsUpdate = false;
            
            // Проверка даты last_active
            if (!data.last_active || new Date(data.last_active).getTime() > now) {
                data.last_active = timeData.serverTime;
                needsUpdate = true;
            }

            // Если были найдены некорректные значения, обновляем данные
            if (needsUpdate) {
                console.log('Resetting invalid values:', {
                    last_active: data.last_active,
                    stable_income: data.stable_income
                });
                // Безопасно обновляем только исправленные поля
                if (data.last_active) {
                    await this.db.updateLastActive(userId, data.last_active);
                }
                if (data.stable_income !== undefined) {
                    await this.db.updateAccessoriesAndIncome(userId, undefined, data.stable_income);
                }
                // НЕ перезагружаем страницу, а продолжаем с исправленными данными
            }

            // Парсим accessories, если это строка
            if (data.accessories && typeof data.accessories === 'string') {
                try {
                    data.accessories = JSON.parse(data.accessories);
                } catch (e) {
                    data.accessories = {};
                }
            }
            
            // ВАЖНО: Устанавливаем баланс ВСЕГДА, независимо от других проверок
            this.coins = data.balance || 0;
            this.stableIncome = data.stable_income || 0; // Убираем все лимиты на stableIncome
            this.profitPerClick = data.profit_per_click || 1;
            this.boost = data.boost || 2;
            this.boostTimeLeft = data.boost_time_left || 0;
            this.isBoostActive = data.is_boost_active || false;
            this.costume = data.costume || 'labubu.png';
            this.accessories = data.accessories || {};
            this.ensureAccessoriesStructure();
            this.currentLevel = data.player_level || 1; // Загружаем уровень игрока
            // Если current_energy отсутствует в БД (null/undefined), НЕ заполняем бесплатно — ставим 0
            this.currentEnergy = (data.current_energy === null || data.current_energy === undefined)
                ? 0
                : data.current_energy; // Загружаем текущую энергию
            this.maxEnergy = data.max_energy !== undefined ? data.max_energy : 100; // Загружаем максимальную энергию

            console.log('💾 Energy loaded from DB:', this.currentEnergy + '/' + this.maxEnergy);

            // Сразу обновляем UI после загрузки ключевых полей, чтобы прогресс-бар и ранги не ждали последующих шагов
            this.updateUI();

            // Если у игрока уже сохранен адрес кошелька — отобразим его сразу на кнопке
            if (data.wallet_address) {
                this.walletAddress = data.wallet_address;
                this.updateWalletUI();
            }

            // Восстанавливаем энергию за время отсутствия
            if (data.last_active) {
                const lastActiveTime = new Date(data.last_active).getTime();
                const currentTime = now;
                const secondsOffline = Math.floor((currentTime - lastActiveTime) / 1000);
                
                console.log('⏰ Offline time calculation:', {
                    lastActiveTime: data.last_active,
                    currentTime: new Date(now).toISOString(),
                    secondsOffline: secondsOffline,
                    currentEnergy: this.currentEnergy,
                    maxEnergy: this.maxEnergy,
                    profitPerClick: this.profitPerClick
                });
                
                if (secondsOffline > 0 && this.currentEnergy < this.maxEnergy) {
                    const energyToRestore = secondsOffline * this.profitPerClick;
                    const oldEnergy = this.currentEnergy;
                    this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + energyToRestore);
                    
                    console.log('⚡ Energy restored for offline time:', {
                        secondsOffline: secondsOffline,
                        energyRestored: this.currentEnergy - oldEnergy,
                        oldEnergy: oldEnergy,
                        newEnergy: this.currentEnergy,
                        maxEnergy: this.maxEnergy
                    });
                    
                    // Сохраняем восстановленную энергию в БД
                    if (this.userId && this.db) {
                        await this.db.updateEnergy(this.userId, this.currentEnergy, this.maxEnergy);
                    }
                } else {
                    console.log('⚡ No energy restoration needed');
                }
            }

            // НЕ обновляем last_active сразу при входе - только при активных действиях

            // Добавляем обработчик выхода из игры для сохранения энергии
            this.setupExitHandlers();

            console.log('Set local balance to:', this.coins);
            console.log('Set energy to:', this.currentEnergy + '/' + this.maxEnergy);

            // Применяем costume к картинке
            const labubuImg = document.querySelector('.labubu_pic');
            if (labubuImg) {
                labubuImg.src = 'assets/images/' + this.costume;
            }
            // Подгружаем аксессуары, если есть
            if (data.accessories) {
                console.log('Loading accessories:', data.accessories);
                
                const hatImg = document.getElementById('hat');
                const shoesImg = document.getElementById('shoes');
                const bagImg = document.getElementById('bag');
                const carImg = document.getElementById('car');
                
                console.log('Accessory elements found:', {
                    hat: !!hatImg,
                    shoes: !!shoesImg,
                    bag: !!bagImg
                });
                
                if (hatImg) {
                    if (data.accessories.hat) {
                        console.log('Setting hat:', data.accessories.hat);
                        hatImg.src = data.accessories.hat;
                        hatImg.style.display = 'block';
                        hatImg.onerror = () => console.error('Failed to load hat image:', data.accessories.hat);
                        hatImg.onload = () => console.log('Hat image loaded successfully');
                    } else {
                        console.log('No hat accessory found');
                        hatImg.style.display = 'none';
                    }
                }
                
                if (shoesImg) {
                    if (data.accessories.shoes) {
                        console.log('Setting shoes:', data.accessories.shoes);
                        shoesImg.src = data.accessories.shoes;
                        shoesImg.style.display = 'block';
                        shoesImg.onerror = () => console.error('Failed to load shoes image:', data.accessories.shoes);
                        shoesImg.onload = () => console.log('Shoes image loaded successfully');
                    } else {
                        console.log('No shoes accessory found');
                        shoesImg.style.display = 'none';
                    }
                }
                
                if (bagImg) {
                    if (data.accessories.bag) {
                        console.log('Setting bag:', data.accessories.bag);
                        bagImg.src = data.accessories.bag;
                        bagImg.style.display = 'block';
                        bagImg.onerror = () => console.error('Failed to load bag image:', data.accessories.bag);
                        bagImg.onload = () => console.log('Bag image loaded successfully');
                    } else {
                        console.log('No bag accessory found');
                        bagImg.style.display = 'none';
                    }
                }

                if (carImg) {
                    if (data.accessories.car) {
                        console.log('Setting car:', data.accessories.car);
                        carImg.src = data.accessories.car;
                        carImg.style.display = 'block';
                        carImg.onerror = () => console.error('Failed to load car image:', data.accessories.car);
                        carImg.onload = () => console.log('Car image loaded successfully');
                    } else {
                        console.log('No car accessory found');
                        carImg.style.display = 'none';
                    }
                }
            } else {
                console.log('No accessories data found');
                // Скрываем все аксессуары если данных нет
                const hatImg = document.getElementById('hat');
                const shoesImg = document.getElementById('shoes');
                const bagImg = document.getElementById('bag');
                const carImg2 = document.getElementById('car');
                if (hatImg) hatImg.style.display = 'none';
                if (shoesImg) shoesImg.style.display = 'none';
                if (bagImg) bagImg.style.display = 'none';
                if (carImg2) carImg2.style.display = 'none';
            }
            // Проверяем, не истек ли буст
            if (this.isBoostActive && this.boostTimeLeft <= 0) {
                this.isBoostActive = false;
            }
            
            // === Оффлайн доход ===
            // Проверяем, нужно ли начислить оффлайн доход
            const shouldProcessOfflineIncome = data.last_active && new Date(data.last_active).getTime() < now;
            
            if (shouldProcessOfflineIncome) {
                await this.processOfflineIncome(data, timeData);
            } else {
                // Если это первый вход или другие случаи, просто обновляем last_active
                console.log('First login or no offline income needed, updating last_active');
                const utcTime = timeData.serverTime.endsWith('Z') ? timeData.serverTime : timeData.serverTime + 'Z';
                await this.db.updateLastActive(this.userId, utcTime);
            }

            // Сохраняем аксессуары в объект
            if (data.accessories) {
                if (typeof data.accessories === 'string') {
                    try {
                        this.accessories = JSON.parse(data.accessories);
                    } catch (e) {
                        console.error('Error parsing accessories JSON:', e);
                        this.accessories = {};
                    }
                } else {
                    this.accessories = data.accessories;
                }
            }

            // 🔄 Обновляем данные игрока для проверки требований
            this.playerData.level = this.calculateLevel().level;
            this.playerData.referrals_count = data.referrals_count || 0;

            this.updateUI();
            
            // 🔒 Обновляем доступность предметов на основе требований
            this.updateItemsAvailability();
            
            // 🆙 Принудительно обновляем уровень после загрузки всех данных
            this.forceUpdateLevel();
            
            // 🚀 Запускаем онлайн доход после загрузки всех данных
            this.startOnlineIncome();
        }
    }
    
    // Выносим логику оффлайн дохода в отдельную функцию
    async processOfflineIncome(data, timeData) {
        try {
            // Убеждаемся, что last_active в UTC формате
            const lastActiveStr = data.last_active.endsWith('Z') ? data.last_active : data.last_active + 'Z';
            
            // Преобразуем оба времени в UTC миллисекунды
            const serverDate = new Date(timeData.serverTime);
            const lastActiveDate = new Date(lastActiveStr);
            
            // Получаем timestamp'ы в UTC
            const now = serverDate.getTime(); // serverTime уже в UTC
            const lastActive = lastActiveDate.getTime(); // теперь lastActive тоже в UTC
            
            // Отладочная информация
            console.log('Offline income time debug:', {
                serverTime: timeData.serverTime,
                lastActive: lastActiveStr,
                diffMs: now - lastActive,
                diffMinutes: (now - lastActive) / (60 * 1000)
            });

            let diffMs = now - lastActive;
            
            // Проверка на отрицательную разницу во времени
            if (diffMs < 0) {
                console.error('Negative time difference detected:', diffMs);
                return; // Выходим, чтобы предотвратить неправильное начисление
            }

            // Проверка на слишком большую разницу во времени (больше суток)
            if (diffMs > 24 * 60 * 60 * 1000) {
                console.warn('Time difference more than 24 hours, limiting to 24 hours');
                diffMs = 24 * 60 * 60 * 1000;
            }
            
            let maxMs = 4 * 60 * 60 * 1000; // 4 часа в мс
            let earnMs = Math.min(diffMs, maxMs);

            console.log('Offline income calculation:', {
                diffMs,
                maxMs,
                earnMs,
                diffMinutes: Math.floor(diffMs / (60 * 1000)), // округляем минуты вниз
                earnMinutes: Math.floor(earnMs / (60 * 1000))  // округляем минуты вниз
            });

            if (earnMs > 60 * 1000) { // если больше 1 минуты
                let minutes = Math.floor(earnMs / (60 * 1000)); // округляем минуты вниз
                
                // Используем полный stableIncome без ограничений
                let earned = this.stableIncome * minutes;
                
                console.log('Offline reward calculation:', {
                    minutes,
                    stableIncome: this.stableIncome,
                    earned,
                    minutesRaw: earnMs / (60 * 1000),
                    currentBalance: this.coins
                });

                // Показываем попап
                const popoutEarn = document.querySelector('.popout_earn');
                if (popoutEarn) {
                    popoutEarn.style.display = 'flex';
                    const earnCoinsSpan = document.getElementById('earn_coins');
                    if (earnCoinsSpan) earnCoinsSpan.textContent = this.formatNumber(earned);
                    const pickupBtn = document.getElementById('pickup_coins');
                    if (pickupBtn) {
                        pickupBtn.onclick = async () => {
                            // Анимация скрытия попапа
                            popoutEarn.classList.add('hidepopout');
                            setTimeout(async () => {
                                popoutEarn.style.display = 'none';
                                popoutEarn.classList.remove('hidepopout');
                                this.coins += earned;
                                console.log('Added offline income:', earned, 'New balance:', this.coins);
                                this.updateUI();
                                // Сохраняем все данные игрока с новым временем
                                // Убеждаемся, что сохраняем время в UTC
                                const utcTime = timeData.serverTime.endsWith('Z') ? timeData.serverTime : timeData.serverTime + 'Z';
                                await this.db.updateLastActive(this.userId, utcTime);
                                await this.db.updateBalance(this.userId, this.coins);
                            }, 1000);
                        };
                    }
                }
            } else {
                // Просто обновляем last_active (если доход не начислялся)
                // Убеждаемся, что сохраняем время в UTC
                const utcTime = timeData.serverTime.endsWith('Z') ? timeData.serverTime : timeData.serverTime + 'Z';
                await this.db.updateLastActive(this.userId, utcTime);
            }
        } catch (error) {
            console.error('Error in offline income calculation:', error);
        }
    }

    setupEventListeners() {
        // Клик только по .labubu_cont
        const labubuCont = document.querySelector('.labubu_cont');
        if (labubuCont) {
            // Разрешаем эффективные тапы без жестов браузера на этой зоне
            try { labubuCont.style.touchAction = 'manipulation'; } catch (_) {}

            // Desktop / mouse
            labubuCont.addEventListener('click', (e) => this.handleClick(e));

            // Multi-touch: один вызов handleClick на каждый палец
            labubuCont.addEventListener('touchstart', (e) => {
                if (!e) return;
                // предотвращаем последующий "ghost click"
                try { e.preventDefault(); } catch (_) {}
                const touches = (e.changedTouches && e.changedTouches.length) ? e.changedTouches.length : 1;
                for (let i = 0; i < touches; i++) {
                    this.handleClick(e);
                }
            }, { passive: false });

            // Fallback для некоторых браузеров с Pointer Events
            labubuCont.addEventListener('pointerdown', (e) => {
                if (e && e.pointerType === 'touch' && e.isPrimary === false) {
                    // Доп. палец
                    this.handleClick(e);
                }
            });
        }

        // Обработка клика по карточкам апгрейда
        document.querySelectorAll('.box_lb').forEach(card => {
            card.addEventListener('click', (e) => {
                // Игнорируем обработку здесь для машин, у них отдельная логика ниже
                if (card.closest('.overflow_cars')) {
                    return;
                }
                // Проверяем, находится ли карточка в .overflow_clothes (аксессуары)
                if (card.closest('.overflow_clothes')) {
                    // Проверка: уже куплен?
                    if (this.isItemAlreadyOwned(card)) {
                        alert('У тебя уже есть этот предмет');
                        return;
                    }
                    // Это аксессуар
                    this.selectedAccessory = {
                        id: card.dataset.id,
                        price: parseInt(card.dataset.price, 10),
                        stableIncome: parseInt(card.dataset.stableIncome, 10),
                        costume: card.dataset.costume || null,
                        category: card.dataset.category || '',
                        name: card.querySelector('.row_lb span')?.textContent + ' ' + (card.querySelector('.row_lb span:nth-child(2)')?.textContent || ''),
                        image: card.querySelector('img.absolute')?.src || card.dataset.image || ''
                    };
                    const popout = document.getElementById('popout_confirm_acces');
                    if (popout) {
                        popout.style.display = 'flex';
                        this.updatePopoutConfirmAcces();
                    }
                } else {
                    // Это обычный suit - проверяем требования
                    if (this.isItemAlreadyOwned(card)) {
                        alert('У тебя уже есть этот предмет');
                        return;
                    }
                    const requirements = this.checkItemRequirements(card);
                    
                    if (!requirements.canBuy) {
                        // Показываем предупреждение о недоступности
                        let message = '';
                        if (!requirements.hasLevel) {
                            message = `Требуется ${requirements.requiredLevel} уровень. У вас ${requirements.playerLevel} уровень.`;
                        } else if (!requirements.hasReferrals) {
                            message = `Требуется ${requirements.requiredReferrals} рефералов. У вас ${requirements.playerReferrals} рефералов.`;
                        }
                        
                        // Можно показать alert или красивый попап
                        alert(message);
                        return; // Не открываем попап покупки
                    }
                    
                    // Если все требования выполнены, открываем попап
                    this.selectedCard = {
                        id: card.dataset.id,
                        price: parseInt(card.dataset.price, 10),
                        stableIncome: parseInt(card.dataset.stableIncome, 10),
                        costume: card.dataset.costume || null
                    };
                    document.getElementById('popout_confirm').style.display = 'flex';
                    this.updatePopoutConfirm();
                }
            });
        });

        // Обработка клика по карточкам машин
        document.querySelectorAll('.overflow_cars .box_lb').forEach(card => {
            card.addEventListener('click', () => {
                if (this.isItemAlreadyOwned(card)) {
                    alert('У тебя уже есть этот автомобиль');
                    return;
                }
                this.selectedCar = {
                    id: card.dataset.id,
                    price: parseInt(card.dataset.price, 10),
                    stableIncome: parseInt(card.dataset.stableIncome, 10),
                    image: card.dataset.costume ? ('assets/images/' + card.dataset.costume) : (card.querySelector('img')?.getAttribute('src') || '')
                };
                const popout = document.getElementById('popout_confirm_car');
                if (popout) {
                    popout.style.display = 'flex';
                    this.updatePopoutConfirmCar();
                }
            });
        });

        // Кнопка покупки
        const buyBtn = document.getElementById('buy_button');
        if (buyBtn) {
            buyBtn.addEventListener('click', () => {
                this.handleBuyCard();
                const popout = document.getElementById('popout_confirm');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }
        // Кнопка закрытия попапа
        const closeBtn = document.querySelector('.svg_close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const popout = document.getElementById('popout_confirm');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }
        // Кнопка покупки аксессуара
        const buyAccesBtn = document.querySelector('#popout_confirm_acces #buy_acces_button');
        if (buyAccesBtn) {
            buyAccesBtn.addEventListener('click', async () => {
                await this.handleBuyAccessory();
                const popout = document.getElementById('popout_confirm_acces');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }
        // Кнопка покупки машины
        const buyCarBtn = document.querySelector('#popout_confirm_car #buy_acces_button');
        if (buyCarBtn) {
            buyCarBtn.addEventListener('click', async () => {
                await this.handleBuyCar();
                const popout = document.getElementById('popout_confirm_car');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }
        // Кнопка закрытия попапа аксессуара
        const closeAccesBtn = document.querySelector('#popout_confirm_acces .svg_close');
        if (closeAccesBtn) {
            closeAccesBtn.addEventListener('click', () => {
                const popout = document.getElementById('popout_confirm_acces');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }
        // Кнопка закрытия попапа машины
        const closeCarBtn = document.querySelector('#popout_confirm_car .svg_close');
        if (closeCarBtn) {
            closeCarBtn.addEventListener('click', () => {
                const popout = document.getElementById('popout_confirm_car');
                if (popout) {
                    popout.classList.add('hidepopout');
                    setTimeout(() => {
                        popout.style.display = 'none';
                        popout.classList.remove('hidepopout');
                    }, 1000);
                }
            });
        }

        document.querySelectorAll('.ctg_cloth').forEach(btn => {
            btn.addEventListener('click', function() {
                // Снимаем выделение со всех категорий
                document.querySelectorAll('.ctg_cloth').forEach(b => b.classList.remove('selected_cloth_ctg'));
                // Добавляем выделение выбранной
                this.classList.add('selected_cloth_ctg');

                const category = this.querySelector('span').textContent.trim().toLowerCase();
                const overflowU = document.querySelector('.overflow_u');
                const overflowClothes = document.querySelector('.overflow_clothes');
                const overflowCars = document.querySelector('.overflow_cars');

                if (category === 'suit') {
                    if (overflowU) overflowU.style.display = '';
                    if (overflowClothes) overflowClothes.style.display = 'none';
                    if (overflowCars) overflowCars.style.display = 'none';
                } else if (category === 'car' || category === 'cars' || category === 'auto') {
                    // Показать список машин
                    if (overflowU) overflowU.style.display = 'none';
                    if (overflowClothes) overflowClothes.style.display = 'none';
                    if (overflowCars) overflowCars.style.display = '';
                } else {
                    if (overflowU) overflowU.style.display = 'none';
                    if (overflowClothes) overflowClothes.style.display = '';
                    if (overflowCars) overflowCars.style.display = 'none';
                    // Фильтруем карточки внутри overflow_clothes
                    document.querySelectorAll('.overflow_clothes .box_lb').forEach(card => {
                        const id = card.dataset.id ? card.dataset.id.toLowerCase() : '';
                        if (id.includes(category)) {
                            card.parentElement.style.display = ''; // wrapper_lb
                        } else {
                            card.parentElement.style.display = 'none';
                        }
                    });
                }
            });
        });

        // Обработчик для кнопки invite friends
        const inviteBtn = document.getElementById('invite_frinds');
        if (inviteBtn) {
            inviteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.shareReferralLink();
            });
        }
    }

    // Отправка реферальной ссылки в Telegram
    async shareReferralLink() {
        try {
            // Загружаем данные игрока чтобы получить реферальный код
            if (!this.userId || !this.db) {
                console.error('❌ User ID or database not available');
                return;
            }

            const playerData = await this.db.loadPlayerData(this.userId);
            if (!playerData || !playerData.referral_code) {
                console.error('❌ Player data or referral code not found');
                return;
            }

            // Создаем реферальную ссылку
            const botUsername = 'LabubuCoinBot'; // Имя вашего бота
            const referralUrl = `https://t.me/${botUsername}?start=ref_${playerData.referral_code}`;
            
            // Создаем текст сообщения
            const message = `🎮 Присоединяйся к LabubuCoin!
            
🚀 Нажимай, зарабатывай, покупай апгрейды!
💰 Получи бонус за регистрацию по моей ссылке!
            
${referralUrl}`;

            // Отправляем через Telegram WebApp API
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent(message)}`);
            } else {
                // Fallback: копируем в буфер обмена
                navigator.clipboard.writeText(referralUrl).then(() => {
                    alert('Реферальная ссылка скопирована в буфер обмена!');
                }).catch(() => {
                    // Показываем ссылку в алерте если не получается скопировать
                    prompt('Скопируйте реферальную ссылку:', referralUrl);
                });
            }

            console.log('📤 Sharing referral link:', referralUrl);
        } catch (error) {
            console.error('❌ Error sharing referral link:', error);
        }
    }

    handleClick(evt = null) {
        // Проверяем, есть ли достаточно энергии для клика
        const energyCost = this.profitPerClick;
        if (this.currentEnergy < energyCost) {
            console.log('❌ Недостаточно энергии для клика. Нужно:', energyCost, 'Есть:', this.currentEnergy);
            this.showEnergyWarning();
            return;
        }

        // Расходуем energyCost единиц энергии за клик (равно profitPerClick)
        this.currentEnergy = Math.max(0, this.currentEnergy - energyCost);
        
        // Вибрация устройства при успешном клике (если поддерживается)
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(15);
        } else if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            // Фолбэк для Telegram WebApp на iOS/устройствах без navigator.vibrate
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }

        const profit = this.profitPerClick * (this.isBoostActive ? this.boost : 1);
        this.coins += profit;
        this.updateUI(); // updateUI() уже включает updateLevelProgressBar()
        // Проверка и выдача реферальных наград пригласившему (если есть)
        this.checkAndAwardReferralRanks().catch(() => {});
        this.saveGameData();
        
        // Обновляем время последней активности при клике
        if (this.userId && this.db) {
            this.db.updateLastActive(this.userId, new Date().toISOString());
        }
        
        console.log('handleClick: userId =', this.userId, 'coins =', this.coins, 'energy =', this.currentEnergy, 'spent =', energyCost);
        this.updateBalanceInDB();
        // Визуальный эффект только один: рандомный около точки клика
        this.spawnRandomProfitSpan(profit, evt);
        this.animateCircleBg();
    }

    // Показать предупреждение о нехватке энергии
    showEnergyWarning() {
        console.log(`⚡ Недостаточно энергии! Нужно ${this.profitPerClick}, есть ${this.currentEnergy}. Подождите восстановления.`);
        
        // Добавим вибрацию, если доступна
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
    }

    async handleBuyCard() {
        if (!this.selectedCard || !this.userId || !this.db) return;
        // Получаем данные пользователя
        const data = await this.db.loadPlayerData(this.userId);
        if (!data) return;
        this.ensureAccessoriesStructure();

        // Предотвращаем повторную покупку одного и того же предмета
        if (this.isItemAlreadyOwnedByData(this.selectedCard.id, data)) {
            alert('Этот предмет уже куплен.');
            return;
        }
        if (data.balance >= this.selectedCard.price) {
            // Списываем монеты и увеличиваем stable income
            this.coins = data.balance - this.selectedCard.price;
            this.stableIncome = (data.stable_income || 0) + this.selectedCard.stableIncome;
            
            // Если карточка содержит поле costume, применяем его
            if (this.selectedCard.costume) {
                this.costume = this.selectedCard.costume;
                const labubuImg = document.querySelector('.labubu_pic');
                if (labubuImg) {
                    labubuImg.src = 'assets/images/' + this.costume;
                }
            }
            
            // Добавляем покупку в историю и аксессуары
            this.addPurchaseRecord({ id: this.selectedCard.id, type: 'suit', price: this.selectedCard.price, ts: Date.now() });
            // Сохраняем инвентарь в accessories.inventory
            this.accessories.inventory = this.accessories.inventory || [];
            if (!this.accessories.inventory.includes(this.selectedCard.id)) {
                this.accessories.inventory.push(this.selectedCard.id);
            }

            // Безопасно сохраняем в БД - отдельно каждое поле
            await this.db.updateBalance(this.userId, this.coins);
            await this.db.updateAccessoriesAndIncome(this.userId, this.accessories, this.stableIncome);
            
            this.updateUI();
            
            // 🔄 Перезапускаем онлайн доход с новым stable_income
            this.restartOnlineIncome();
            
            this.hideCards();
            this.selectedCard = null;
            // Скрываем попап
            document.getElementById('popout_confirm').style.display = 'none';
            // Можно показать сообщение об успехе
        } else {
            // Недостаточно монет, показать ошибку
            alert('Недостаточно монет для покупки!');
        }
    }

    // Покупка аксессуара
    async handleBuyAccessory() {
        if (!this.selectedAccessory || !this.userId || !this.db) return;
        
        console.log('Buying accessory:', this.selectedAccessory);
        
        // Получаем данные пользователя
        const data = await this.db.loadPlayerData(this.userId);
        if (!data) return;
        this.ensureAccessoriesStructure();
        // Предотвращаем повторную покупку того же аксессуара
        if (this.isItemAlreadyOwnedByData(this.selectedAccessory.id, data)) {
            alert('Этот аксессуар уже куплен.');
            return;
        }
        
        if (data.balance >= this.selectedAccessory.price) {
            // Списываем монеты
            const newBalance = data.balance - this.selectedAccessory.price;
            
            // Усиленная защита accessories
            let accessories = data.accessories;
            if (!accessories || typeof accessories !== 'object') {
                if (typeof accessories === 'string') {
                    try {
                        accessories = JSON.parse(accessories);
                        // Если после парсинга не объект — сбрасываем
                        if (!accessories || typeof accessories !== 'object') accessories = {};
                    } catch (e) {
                        console.error('Failed to parse accessories:', e);
                        accessories = {};
                    }
                } else {
                    accessories = {};
                }
            }
            
            // Определяем категорию аксессуара
            let category = '';
            
            // Получаем категорию из ID аксессуара или из элемента
            if (this.selectedAccessory.id.includes('hat')) {
                category = 'hat';
            } else if (this.selectedAccessory.id.includes('shoes')) {
                category = 'shoes';
            } else if (this.selectedAccessory.id.includes('bag')) {
                category = 'bag';
            } else {
                // Пытаемся получить из HTML элемента
                const selectedCardElem = document.querySelector(`.box_lb[data-id='${this.selectedAccessory.id}']`);
                if (selectedCardElem) {
                    const lastSpan = selectedCardElem.querySelector('.row_lb span:last-child');
                    if (lastSpan) {
                        category = lastSpan.textContent.trim().toLowerCase();
                    }
                }
            }
            
            console.log('Determined category:', category);
            console.log('Accessory image:', this.selectedAccessory.image);
            
            if (!category) {
                console.error('Could not determine accessory category');
                alert('Ошибка: не удалось определить тип аксессуара');
                return;
            }
            
            // Сохраняем аксессуар
            accessories[category] = this.selectedAccessory.image;
            this.accessories = accessories; // обязательно обновляем актуальные аксессуары
            // Инвентарь: логируем id покупки
            this.accessories.inventory = this.accessories.inventory || [];
            if (!this.accessories.inventory.includes(this.selectedAccessory.id)) {
                this.accessories.inventory.push(this.selectedAccessory.id);
            }
            
            // Увеличиваем стабильный доход при покупке аксессуара
            this.stableIncome += this.selectedAccessory.stableIncome;
            
            console.log('Updated accessories:', accessories);
            console.log('Increased stable income by:', this.selectedAccessory.stableIncome);
            console.log('New stable income:', this.stableIncome);
            
            // Безопасно сохраняем аксессуары и стабильный доход в БД
            await this.db.updateAccessoriesAndIncome(this.userId, this.accessories, this.stableIncome);
            
            // Обновляем баланс в БД
            await this.db.updateBalance(this.userId, this.coins);
            
            this.updateUI();
            
            // 🔄 Перезапускаем онлайн доход с новым stable_income
            this.restartOnlineIncome();
            
            // Отобразить аксессуар на главном персонаже сразу после покупки
            this.displayAccessory(category, this.selectedAccessory.image);
            
            console.log('Accessory purchase completed successfully');
        } else {
            alert('Недостаточно монет для покупки!');
        }
    }

    // Покупка машины (логика как у вещей)
    async handleBuyCar() {
        if (!this.selectedCar || !this.userId || !this.db) return;

        // Загружаем актуальные данные игрока
        const data = await this.db.loadPlayerData(this.userId);
        if (!data) return;
        this.ensureAccessoriesStructure();
        // Предотвращаем повторную покупку той же машины
        if (this.isItemAlreadyOwnedByData(this.selectedCar.id, data)) {
            alert('Этот автомобиль уже куплен.');
            return;
        }

        if (data.balance >= this.selectedCar.price) {
            // Списываем монеты
            const newBalance = data.balance - this.selectedCar.price;
            this.coins = newBalance;

            // Увеличиваем стабильный доход от машины
            this.stableIncome = (data.stable_income || 0) + (this.selectedCar.stableIncome || 0);

            // Сохраняем путь к машине в accessories.car, без использования costume
            if (!this.accessories || typeof this.accessories !== 'object') {
                this.accessories = {};
            }
            if (this.selectedCar.image) {
                this.accessories.car = this.selectedCar.image;
                const carImg = document.getElementById('car');
                if (carImg) {
                    carImg.src = this.selectedCar.image;
                    carImg.style.display = 'block';
                }
            }
            // Инвентарь: добавляем ID машины
            this.accessories.inventory = this.accessories.inventory || [];
            if (!this.accessories.inventory.includes(this.selectedCar.id)) {
                this.accessories.inventory.push(this.selectedCar.id);
            }

            // Сохраняем изменения в БД: баланс, аксессуары (включая car), стабильный доход
            await this.db.updateBalance(this.userId, this.coins);
            await this.db.updateAccessoriesAndIncome(this.userId, this.accessories, this.stableIncome);

            // Обновляем UI и перезапускаем онлайн доход
            this.updateUI();
            this.restartOnlineIncome();

            // Сбрасываем выбор и закрываем попап
            this.selectedCar = null;
            const popout = document.getElementById('popout_confirm_car');
            if (popout) popout.style.display = 'none';
        } else {
            alert('Недостаточно монет для покупки машины!');
        }
    }

    // Обновление попапа подтверждения покупки машины
    updatePopoutConfirmCar() {
        const popout = document.getElementById('popout_confirm_car');
        if (!popout || !this.selectedCar) return;

        // Название — берём текст из выбранной карточки
        const nameSpans = popout.querySelectorAll('.box_lb .row_lb span');
        const selectedCardElemCar = document.querySelector(`.overflow_cars .box_lb[data-id='${this.selectedCar.id}']`);
        if (nameSpans.length >= 2 && selectedCardElemCar) {
            const cardNameSpans = selectedCardElemCar.querySelectorAll('.row_lb span');
            if (cardNameSpans.length >= 2) {
                nameSpans[0].textContent = cardNameSpans[0].textContent;
                nameSpans[1].textContent = cardNameSpans[1].textContent;
            }
        }

        // Превью изображения: обычный img + absolute
        const imgBase = popout.querySelector('.box_lb > img:not(.absolute)');
        if (imgBase && this.selectedCar.image) {
            imgBase.src = this.selectedCar.image;
        }
        const imgAbs = popout.querySelector('.box_lb img.absolute');
        if (imgAbs && this.selectedCar.image) {
            imgAbs.src = this.selectedCar.image;
            imgAbs.style.display = '';
        }

        // Stable income
        const stableIncomeSpan = popout.querySelector('.box_lb .row_profit_lb .flex_i span');
        if (stableIncomeSpan) {
            stableIncomeSpan.textContent = '+' + this.formatNumber(this.selectedCar.stableIncome || 0);
        }

        // Цена
        const priceSpan = popout.querySelector('.price_pannel .pr_wrapper span');
        if (priceSpan) {
            priceSpan.textContent = this.formatNumber(this.selectedCar.price || 0);
        }
    }
    
    // Новая функция для отображения аксессуара
    displayAccessory(category, imagePath) {
        console.log(`Displaying ${category} accessory:`, imagePath);
        
        const element = document.getElementById(category);
        if (element) {
            element.src = imagePath;
            element.style.display = 'block';
            element.onerror = () => console.error(`Failed to load ${category} image:`, imagePath);
            element.onload = () => console.log(`${category} image loaded successfully`);
        } else {
            console.error(`Element with id '${category}' not found`);
        }
    }

    // Удалено: showProfitAnimation — теперь используем только spawnRandomProfitSpan

    spawnRandomProfitSpan(profit, evt = null) {
        const numbersCont = document.querySelector('.numbers_cont');
        if (numbersCont) {
            const span = document.createElement('span');
            span.textContent = `+${profit}`;
            span.style.position = 'absolute';
            // Если есть координаты клика — около точки клика с небольшим разбросом
            if (evt && (evt.touches || evt.changedTouches || typeof evt.clientX === 'number')) {
                const contRect = numbersCont.getBoundingClientRect();
                let cx, cy;
                if (evt.changedTouches || evt.touches) {
                    const t = (evt.changedTouches && evt.changedTouches[0]) || evt.touches[0];
                    cx = t.clientX - contRect.left;
                    cy = t.clientY - contRect.top;
                } else {
                    cx = evt.clientX - contRect.left;
                    cy = evt.clientY - contRect.top;
                }
                const jitter = 12;
                span.style.left = `${Math.max(0, Math.min(contRect.width, cx + (Math.random()*jitter*2 - jitter)))}px`;
                span.style.top = `${Math.max(0, Math.min(contRect.height, cy + (Math.random()*jitter*2 - jitter)))}px`;
                span.style.transform = 'translate(-50%, -50%)';
            } else {
                // Рандомная позиция внутри контейнера (от 10% до 90%)
                span.style.left = `${10 + Math.random() * 80}%`;
                span.style.top = `${10 + Math.random() * 80}%`;
            }
            // Рандомный размер шрифта от 5vw до 10.3565vw
            const minFontSize = 8; // vw
            const maxFontSize = 13.3565; // vw
            const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
            span.style.fontSize = `${fontSize}vw`;
            span.style.pointerEvents = 'none';
            span.style.transition = 'opacity 800ms ease, transform 800ms ease';
            span.style.opacity = '1';
            span.style.transform += ' scale(1.2)';
            numbersCont.appendChild(span);
            setTimeout(() => {
                span.style.opacity = '0';
                span.style.transform += ' scale(1) translateY(-40px)';
            }, 150);
            setTimeout(() => {
                numbersCont.removeChild(span);
            }, 900);
        }
    }

    // Функция форматирования больших чисел
    formatNumberCoins(num) {
        const intNum = Math.floor(num);
        if (intNum < 1000) {
            return intNum.toString();
        } else {
            return intNum.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
        }
    }

    formatNumber(num) {
        if (num < 1000) {
            return Math.floor(num).toString();
        } else if (num < 1000000) {
            return Math.floor(num / 1000) + 'К';
        } else if (num < 1000000000) {
            return Math.floor(num / 1000000) + 'М';
        } else if (num < 1000000000000) {
            return Math.floor(num / 1000000000) + 'B';
        } else {
            return Math.floor(num / 1000000000000) + 'T';
        }
    }

    // Удаляю startIncomeTimer полностью

    updateUI() {
        // Отображаем баланс с форматированием (К, М, Б, Т)
        const balanceElement = document.querySelector('.flex_balance span');
        if (balanceElement) {
            balanceElement.textContent = this.formatNumberCoins(this.coins);
        }

        const stableIncomeElement = document.querySelector('.flex_i span');
        if (stableIncomeElement) {
            stableIncomeElement.textContent = this.formatNumber(this.stableIncome);
        }

        const profitPerClickElement = document.querySelector('.flex_c span');
        if (profitPerClickElement) {
            profitPerClickElement.textContent = this.formatNumber(this.profitPerClick);
        }

        // Обновляем буст
        const boostElement = document.querySelector('.green_pannel .flex_i span');
        const boostTimeElement = document.querySelector('.green_pannel .box_icon');
        
        if (boostElement && boostTimeElement) {
            if (this.isBoostActive) {
                boostElement.textContent = `X${this.boost}`;
                boostTimeElement.textContent = this.formatTime(this.boostTimeLeft);
            } else {
                boostElement.textContent = 'X1';
                boostTimeElement.textContent = '00:00';
            }
        }

        // Обновляем энергию
        const energyElement = document.querySelector('.energy_text');
        if (energyElement) {
            energyElement.innerHTML = `${this.currentEnergy}<span class="energy_max">/${this.maxEnergy}</span>`;
        }

        // Обновляем систему уровней
        this.updateLevelProgressBar();
    }



    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    activateBoost() {
        this.isBoostActive = true;
        this.boostTimeLeft = 900; // 15 минут
        this.updateUI();
        this.saveGameData();
    }

    saveGameData() {
        if (!this.userId || !this.db) return;
        
        // Используем безопасные функции вместо полной перезаписи
        // Обновляем баланс и энергию
        this.db.updateBalance(this.userId, this.coins);
        this.db.updateEnergy(this.userId, this.currentEnergy, this.maxEnergy);
        
        // Если активен буст, можно добавить отдельную функцию для его обновления
        // Но пока не критично, так как буст сейчас не используется активно
    }

    loadGameData() {
        // Удаляем работу с localStorage, теперь все из БД
    }

    async updateBalanceInDB() {
        if (!this.userId) {
            console.warn('updateBalanceInDB: userId is null!');
            return;
        }
        try {
            // Используем новую безопасную функцию обновления баланса
            const result = await this.db.updateBalance(this.userId, this.coins);
            console.log('updateBalanceInDB: success =', result);
        } catch (e) {
            console.error('Ошибка обновления баланса в БД:', e);
        }
    }

    randomizeLabubuPosition() {
        const labubuCont = document.querySelector('.labubu_cont');
        if (labubuCont) {
            // Рандомное смещение: left и top в пределах ±5vw/±5vh
            const randLeft = (Math.random() - 0.5) * 10; // от -5 до +5
            const randTop = (Math.random() - 0.5) * 10;  // от -5 до +5
            labubuCont.style.position = 'relative';
            labubuCont.style.left = `${randLeft}vw`;
            labubuCont.style.top = `${randTop}vh`;
        }
    }

    animateCircleBg() {
        const circleBg = document.querySelector('.circle_bg');
        if (!circleBg) return;

        // Готовим элемент к анимации
        try { circleBg.style.willChange = 'transform, filter'; } catch (_) {}

        // Если предыдущая анимация ещё идёт — перезапускаем
        if (this.circleBgAnim && typeof this.circleBgAnim.cancel === 'function') {
            this.circleBgAnim.cancel();
        }

        // Плавный пульс: лёгкое уменьшение и возврат + чуть ярче
        const keyframes = [
            { transform: 'scale(1)', filter: 'brightness(1)' },
            { transform: 'scale(0.94)', filter: 'brightness(1.7)' },
            { transform: 'scale(1)', filter: 'brightness(1)' }
        ];
        const options = { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' };
        const anim = circleBg.animate(keyframes, options);
        this.circleBgAnim = anim;

        anim.onfinish = () => {
            // Сбрасываем will-change после завершения, чтобы не держать слой вечно
            try { circleBg.style.willChange = 'auto'; } catch (_) {}
            this.circleBgAnim = null;
        };
        anim.oncancel = () => {
            try { circleBg.style.willChange = 'auto'; } catch (_) {}
            this.circleBgAnim = null;
        };
    }

    // Непрерывная фоновая анимация: лёгкое дыхание круга
    startCircleBgIdleAnimation() {
        const circleBg = document.querySelector('.circle_bg');
        if (!circleBg) return;
        // Если уже запущено — не дублируем
        if (circleBg.dataset.idleAnim === '1') return;
        circleBg.dataset.idleAnim = '1';

        try { circleBg.style.willChange = 'transform, filter'; } catch (_) {}

        const loop = () => {
            if (!circleBg.dataset.idleAnim) return; // остановлено
            const keyframes = [
                { transform: 'scale(1)', filter: 'brightness(1.0)' },
                { transform: 'scale(1.02)', filter: 'brightness(1.08)' },
                { transform: 'scale(1)', filter: 'brightness(1.0)' }
            ];
            const anim = circleBg.animate(keyframes, { duration: 1800, easing: 'ease-in-out' });
            anim.onfinish = () => {
                if (circleBg.dataset.idleAnim === '1') loop();
            };
            anim.oncancel = () => {};
        };
        loop();
    }

    stopCircleBgIdleAnimation() {
        const circleBg = document.querySelector('.circle_bg');
        if (!circleBg) return;
        delete circleBg.dataset.idleAnim;
        try { circleBg.getAnimations().forEach(a => a.cancel()); } catch (_) {}
        try { circleBg.style.willChange = 'auto'; } catch (_) {}
    }

    async renderTopPlayers() {
        if (!this.db) return;
        const topPlayers = await this.db.getTopPlayers(10);
        let currentUser = null;
        if (this.userId) {
            currentUser = await this.db.loadPlayerData(this.userId);
        }
        const list = document.getElementById('top_players_list');
        if (!list) return;
        list.innerHTML = '';
        // Рендер топ-10
        topPlayers.forEach((player, idx) => {
            const medalClass = idx === 0 ? 'gold_pannel' : idx === 1 ? 'silver_pannel' : idx === 2 ? 'bronze_pannel' : '';
            list.innerHTML += `
                <div class="pannel_top w100 space alcn ${medalClass}">
                    <div class="numb_pos">#${idx + 1}</div>
                    <div class="left_top alcn">
                        <img src="assets/images/${player.costume || ''}" alt="">
                        <div class="row_top clmn">
                            <span>Username:</span>
                            <span>${player.username ? '@' + player.username : 'Player'}</span>
                        </div>
                    </div>
                    <div class="right_top alcn">
                        <div class="row_top_right coins_row clmn">
                            <span>Coins:</span>
                            <span>${this.formatNumber(player.balance)}</span>
                        </div>
                        <div class="row_top_right stableincome_row clmn">
                            <span>Stable income:</span>
                            <span>+${this.formatNumber(player.stable_income)}</span>
                        </div>
                        <div class="row_top_right referals_row clmn">
                            <span>Referals:</span>
                            <span>${player.referals || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        // Рендер текущего пользователя, если его нет в топ-10
        if (currentUser && !topPlayers.some(p => p.tg_id == currentUser.tg_id)) {
            list.innerHTML += `
                <div class="pannel_top w100 space alcn">
                    <div class="numb_pos">You</div>
                    <div class="left_top alcn">
                        <img src="assets/images/${currentUser.costume || ''}" alt="">
                        <div class="row_top clmn">
                            <span>Username:</span>
                            <span>${currentUser.username ? '@' + currentUser.username : 'Player'}</span>
                        </div>
                    </div>
                    <div class="right_top alcn">
                        <div class="row_top_right coins_row clmn">
                            <span>Coins:</span>
                            <span>${this.formatNumber(currentUser.balance)}</span>
                        </div>
                        <div class="row_top_right stableincome_row clmn">
                            <span>Stable income:</span>
                            <span>+${this.formatNumber(currentUser.stable_income)}</span>
                        </div>
                        <div class="row_top_right referals_row clmn">
                            <span>Referals:</span>
                            <span>${currentUser.referals || 0}</span>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    // Отображение реферальных рангов на основе конфига
    renderReferralRanks() {
        if (!this.levelsConfig || !this.levelsConfig.ranks) {
            console.log('❌ Levels config not available for referral ranks');
            return;
        }

        const container = document.querySelector('.overflow_levels');
        if (!container) {
            console.log('❌ Referral ranks container not found');
            return;
        }

        console.log('🎯 Rendering referral ranks...');
        
        // Генерируем HTML для каждого ранга
        const ranksHTML = this.levelsConfig.ranks.map((rank, index) => {
            const playerReward = rank.reward * 2; // Награда для реферала в два раза больше обычной
            const referralReward = rank.reward;
            
            // Определяем CSS класс панели на основе ранга
            let panelClass = 'bronze_referal';
            if (rank.id.includes('silver')) panelClass = 'silver_referal';
            else if (rank.id.includes('gold')) panelClass = 'gold_referal';
            else if (rank.id.includes('platinum')) panelClass = 'platinum_referal';
            else if (rank.id.includes('diamond')) panelClass = 'diamond_referal';
            else if (rank.id.includes('master')) panelClass = 'master_referal';
            else if (rank.id.includes('grandmaster')) panelClass = 'grandmaster_referal';
            else if (rank.id.includes('legend')) panelClass = 'legend_referal';

            return `
                <div class="pannel_referal ${panelClass} w100 alcn" data-rank-id="${rank.id}">
                    <div class="left_ref alcn">
                        <div class="circ_ref jlcn">#${index + 1}</div>
                        <span>${rank.name}</span>
                    </div>
                    <div class="right_ref alcn">
                        <div class="wrapper_ref forfriend alcn">
                            <img src="assets/images/logo.png" alt="">
                            <span>+${this.formatNumber(referralReward)}</span>
                        </div>
                        <div class="wrapper_ref forme alcn">
                            <img src="assets/images/logo.png" alt="">
                            <span>+${this.formatNumber(playerReward)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = ranksHTML;
        console.log(`✅ Rendered ${this.levelsConfig.ranks.length} referral ranks`);
    }

    // Отображение реальных рефералов игрока
    async renderPlayerReferrals() {
        if (!this.userId || !this.db) return;

        try {
            const referrals = await this.db.getPlayerReferrals(this.userId);
            const container = document.querySelector('.overflow_friends');
            
            if (!container) {
                console.error('❌ Container .overflow_friends not found');
                return;
            }

            if (referrals.length === 0) {
                container.innerHTML = `
                    <div class="no_referrals w100 alcn" style="padding: 20px; text-align: center; color: #999;">
                        <span></span>
                        <br>
                        <small></small>
                    </div>
                `;
                return;
            }

            const referralsHTML = referrals.map((referral, index) => {
                const username = referral.username ? `@${referral.username}` : `User ${referral.tg_id}`;
                const balance = this.formatNumber(referral.balance || 0);
                const level = referral.player_level || 1;
                
                // Получаем ранг по уровню
                const rank = this.levelsConfig.getRankByLevel(level);
                const rankName = rank ? rank.name : 'Bronze 1';
                
                // Вычисляем награду за этого реферала
                const reward = this.calculateReferralReward(referral.balance || 0);

                return `
                    <div class="pannel_friend w100 alcn">
                        <div class="l_friend alcn">
                            <img class="avatar_friend" src="assets/images/labubu.png" alt="">
                            <div class="row_friend clmn">
                                <span class="name_friend">${username}</span>
                                <div class="flex_friend alcn">
                                    <span class="rang_friend">${rankName}</span>
                                    <div class="balance_friend alcn">
                                        <img src="assets/images/logo.png" alt="">
                                        <span>${balance}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="r_friend alcn">
                            <img src="assets/images/logo.png" alt="">
                            <span>+${this.formatNumber(reward)}</span>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = referralsHTML;
            console.log(`✅ Rendered ${referrals.length} player referrals`);
        } catch (error) {
            console.error('❌ Error rendering player referrals:', error);
        }
    }

    // Вычисление награды за реферала в зависимости от его баланса
    calculateReferralReward(referralBalance) {
        // Находим соответствующий ранг по балансу реферала
        const rank = this.levelsConfig.getRankByCoins(referralBalance);
        return rank ? rank.reward * 2 : 200; // Удвоенная награда для реферала
    }

    // Добавляю метод для обновления попапа с выбранным скином
    updatePopoutConfirm() {
        const popout = document.getElementById('popout_confirm');
        if (!popout || !this.selectedCard) return;
        // Картинка
        const img = popout.querySelector('.box_lb img');
        if (img && this.selectedCard.costume) {
            img.src = 'assets/images/' + this.selectedCard.costume;
        }
        // Название — копируем из выбранной карточки
        const nameSpans = popout.querySelectorAll('.box_lb .row_lb span');
        const selectedCardElemName = document.querySelector(`.box_lb[data-id='${this.selectedCard.id}']`);
        if (nameSpans.length >= 2 && selectedCardElemName) {
            const cardNameSpans = selectedCardElemName.querySelectorAll('.row_lb span');
            if (cardNameSpans.length >= 2) {
                nameSpans[0].textContent = cardNameSpans[0].textContent;
                nameSpans[1].textContent = cardNameSpans[1].textContent;
            }
        } else if (nameSpans.length >= 2) {
            const parts = this.selectedCard.id.split('_');
            nameSpans[0].textContent = parts[0] ? this.capitalize(parts[0]) : '';
            nameSpans[1].textContent = parts[1] ? this.capitalize(parts[1]) : '';
        }
        // Stable income
        const stableIncomeSpan = popout.querySelector('.box_lb .row_profit_lb .flex_i span');
        if (stableIncomeSpan) {
            stableIncomeSpan.textContent = '+' + this.formatNumber(this.selectedCard.stableIncome);
        }
        // Цена
        const priceSpan = popout.querySelector('.price_pannel .pr_wrapper span');
        if (priceSpan) {
            priceSpan.textContent = this.formatNumber(this.selectedCard.price);
        }
        // Цветовая тема box_lb — полностью копируем классы с выбранной карточки
        const box = popout.querySelector('.box_lb');
        const selectedCardElem = document.querySelector(`.box_lb[data-id='${this.selectedCard.id}']`);
        if (box && selectedCardElem) {
            // Оставляем только базовый класс clmn
            box.className = 'box_lb clmn';
            // Копируем все классы кроме box_lb и clmn
            selectedCardElem.classList.forEach(cls => {
                if (cls !== 'box_lb' && cls !== 'clmn') {
                    box.classList.add(cls);
                }
            });
        }
    }

    // Обновление попапа аксессуара
    updatePopoutConfirmAcces() {
        const popout = document.getElementById('popout_confirm_acces');
        if (!popout || !this.selectedAccessory) return;
        // НЕ меняем src у обычного img!
        // Меняем только у img.absolute
        const absImg = popout.querySelector('.box_lb img.absolute');
        if (absImg && this.selectedAccessory.image) {
            absImg.src = this.selectedAccessory.image;
            absImg.style.display = '';
        }
        // Название — копируем из выбранной карточки
        const selectedCardElem = document.querySelector(`.box_lb[data-id='${this.selectedAccessory.id}']`);
        const nameSpans = popout.querySelectorAll('.box_lb .row_lb span');
        if (selectedCardElem) {
            const cardNameSpans = selectedCardElem.querySelectorAll('.row_lb span');
            if (nameSpans.length >= 2 && cardNameSpans.length >= 2) {
                nameSpans[0].textContent = cardNameSpans[0].textContent;
                nameSpans[1].textContent = cardNameSpans[1].textContent;
            }
        } else if (nameSpans.length >= 2) {
            // fallback: разбиваем по пробелу
            const parts = this.selectedAccessory.name.split(' ');
            nameSpans[0].textContent = parts[0] || '';
            nameSpans[1].textContent = parts.slice(1).join(' ') || '';
        }
        // Stable income
        const stableIncomeSpan = popout.querySelector('.box_lb .row_profit_lb .flex_i span');
        if (stableIncomeSpan) {
            stableIncomeSpan.textContent = '+' + this.formatNumber(this.selectedAccessory.stableIncome);
        }
        // Цена
        const priceSpan = popout.querySelector('.price_pannel .pr_wrapper span');
        if (priceSpan) {
            priceSpan.textContent = this.formatNumber(this.selectedAccessory.price);
        }
        // Картинка аксессуара (absolute)
        const absImg2 = popout.querySelector('.box_lb img.absolute');
        if (absImg2 && this.selectedAccessory.image) {
            absImg2.src = this.selectedAccessory.image;
            absImg2.style.display = '';
        }
        // Цветовая тема box_lb
        const box = popout.querySelector('.box_lb');
        if (box && selectedCardElem) {
            box.className = 'box_lb clmn';
            selectedCardElem.classList.forEach(cls => {
                if (cls !== 'box_lb' && cls !== 'clmn') {
                    box.classList.add(cls);
                }
            });
        }
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // Функция для отладки аксессуаров
    debugAccessories() {
        console.log('=== ACCESSORIES DEBUG ===');
        console.log('Game accessories:', this.accessories);
        
        const hatImg = document.getElementById('hat');
        const shoesImg = document.getElementById('shoes');
        const bagImg = document.getElementById('bag');
        
        console.log('DOM elements:', {
            hat: hatImg ? { src: hatImg.src, display: hatImg.style.display, visible: hatImg.offsetHeight > 0 } : 'NOT FOUND',
            shoes: shoesImg ? { src: shoesImg.src, display: shoesImg.style.display, visible: shoesImg.offsetHeight > 0 } : 'NOT FOUND',
            bag: bagImg ? { src: bagImg.src, display: bagImg.style.display, visible: bagImg.offsetHeight > 0 } : 'NOT FOUND'
        });
        
        // Проверяем данные в БД
        if (this.userId && this.db) {
            this.db.loadPlayerData(this.userId).then(data => {
                console.log('DB accessories data:', data ? data.accessories : 'NO DATA');
                if (data && data.accessories) {
                    if (typeof data.accessories === 'string') {
                        try {
                            const parsed = JSON.parse(data.accessories);
                            console.log('Parsed DB accessories:', parsed);
                        } catch (e) {
                            console.error('Failed to parse DB accessories:', e);
                        }
                    }
                }
            });
        }
        
        console.log('=== END DEBUG ===');
    }
    
    // Функция для принудительного обновления аксессуаров
    forceRefreshAccessories() {
        console.log('Force refreshing accessories...');
        if (this.accessories && typeof this.accessories === 'object') {
            Object.keys(this.accessories).forEach(category => {
                const imagePath = this.accessories[category];
                if (imagePath) {
                    this.displayAccessory(category, imagePath);
                }
            });
        }
    }
    
    // Функция для отладки баланса
    async debugBalance() {
        console.log('=== BALANCE DEBUG ===');
        console.log('Current local balance (this.coins):', this.coins);
        console.log('UserId:', this.userId);
        
        // Проверяем данные в БД
        if (this.userId && this.db) {
            const data = await this.db.loadPlayerData(this.userId);
            console.log('DB balance data:', data ? data.balance : 'NO DATA');
            console.log('Full DB data:', data);
            
            if (data && data.balance !== this.coins) {
                console.warn('⚠️ BALANCE MISMATCH!');
                console.warn('Local coins:', this.coins);
                console.warn('DB balance:', data.balance);
            }
        }
        
        // Проверяем элемент UI
        const balanceElement = document.querySelector('.flex_balance span');
        if (balanceElement) {
            console.log('UI shows:', balanceElement.textContent);
        }
        
        console.log('=== END BALANCE DEBUG ===');
    }
    
    // Функция для принудительной синхронизации баланса с БД
    async forceSyncBalance() {
        console.log('Force syncing balance with DB...');
        if (this.userId && this.db) {
            const data = await this.db.loadPlayerData(this.userId);
            if (data) {
                console.log('DB balance:', data.balance);
                this.coins = data.balance || 0;
                console.log('Set local balance to:', this.coins);
                this.updateUI();
                console.log('Balance synced successfully');
            } else {
                console.error('No data found in DB');
            }
        } else {
            console.error('UserId or DB not available');
        }
    }
    
    // Функция для отладки stable_income
    async debugStableIncome() {
        console.log('=== STABLE INCOME DEBUG ===');
        console.log('Current local stable_income (this.stableIncome):', this.stableIncome);
        console.log('UserId:', this.userId);
        
        // Проверяем данные в БД
        if (this.userId && this.db) {
            const data = await this.db.loadPlayerData(this.userId);
            console.log('DB stable_income data:', data ? data.stable_income : 'NO DATA');
            console.log('Full DB data:', data);
            
            if (data && data.stable_income !== this.stableIncome) {
                console.warn('⚠️ STABLE INCOME MISMATCH!');
                console.warn('Local stableIncome:', this.stableIncome);
                console.warn('DB stable_income:', data.stable_income);
            }
        }
        
        // Проверяем элемент UI
        const stableIncomeElement = document.querySelector('.flex_i span');
        if (stableIncomeElement) {
            console.log('UI shows stable income:', stableIncomeElement.textContent);
        }
        
        console.log('=== END STABLE INCOME DEBUG ===');
    }
    
    // Функция для принудительной синхронизации stable_income с БД
    async forceSyncStableIncome() {
        console.log('Force syncing stable_income with DB...');
        if (this.userId && this.db) {
            const data = await this.db.loadPlayerData(this.userId);
            if (data) {
                console.log('DB stable_income:', data.stable_income);
                this.stableIncome = data.stable_income || 0;
                console.log('Set local stable_income to:', this.stableIncome);
                this.updateUI();
                console.log('Stable income synced successfully');
                
                // Перезапускаем онлайн доход с новым значением
                this.restartOnlineIncome();
            } else {
                console.error('No data found in DB');
            }
        } else {
            console.error('UserId or DB not available');
        }
    }
    
    // Запуск автоматического начисления онлайн дохода
    startOnlineIncome() {
        // Останавливаем предыдущий интервал если есть
        this.stopOnlineIncome();
        
        console.log('🚀 Starting timers (online income + energy regen). Stable income per min:', this.stableIncome);
        
        this.onlineIncomeInterval = setInterval(() => {
            if (this.isOnline) {
                const oldCoins = this.coins;
                
                // Доход за секунду = stable_income / 60 (может быть 0)
                const incomePerSecond = this.stableIncome / 60;
                if (this.stableIncome > 0) {
                    // Добавляем доход за секунду только если доход положительный
                    this.coins += incomePerSecond;
                }
                
                // Восстанавливаем энергию (profitPerClick единиц в секунду)
                if (this.currentEnergy < this.maxEnergy) {
                    this.currentEnergy = Math.min(this.maxEnergy, this.currentEnergy + this.profitPerClick);
                }
                
                // Логируем каждые 10 секунд для не засорения консоли
                if (Math.floor(Date.now() / 1000) % 10 === 0) {
                    console.log('💰 Online income & ⚡ Energy regen:', {
                        coinsBefore: oldCoins.toFixed(4),
                        coinsAdded: incomePerSecond.toFixed(4),
                        coinsAfter: this.coins.toFixed(4),
                        energy: `${this.currentEnergy}/${this.maxEnergy}`,
                        energyRegen: this.profitPerClick,
                        stableIncomePerMin: this.stableIncome
                    });
                }
                
                this.updateUI();
                
                // Сохраняем в БД каждые 10 секунд для тестирования (было 30)
                const now = Date.now();
                const timeSinceLastSave = now - this.lastOnlineIncomeSave;
                
                // Добавляем отладку каждые 5 секунд
                if (Math.floor(Date.now() / 1000) % 5 === 0) {
                    console.log('⏰ Save check:', {
                        timeSinceLastSave: Math.floor(timeSinceLastSave / 1000) + 's',
                        shouldSave: timeSinceLastSave > 10000, // изменено на 10 секунд
                        userId: this.userId,
                        hasDb: !!this.db,
                        currentBalance: this.coins.toFixed(4)
                    });
                }
                
                if (timeSinceLastSave > 10000) { // 10 секунд для тестирования
                    console.log('💾 Attempting to save online income to DB:', this.coins.toFixed(4));
                    console.log('📋 Save details:', {
                        userId: this.userId,
                        userIdType: typeof this.userId,
                        coins: this.coins,
                        db: !!this.db,
                        dbSupabase: !!(this.db && this.db.supabase)
                    });
                    
                    if (this.userId && this.db) {
                        try {
                            this.db.updateBalance(this.userId, this.coins).then(result => {
                                console.log('✅ Save result:', result);
                                this.lastOnlineIncomeSave = now;
                            }).catch(error => {
                                console.error('❌ Save error:', error);
                            });
                        } catch (error) {
                            console.error('❌ Save error:', error);
                        }
                    } else {
                        console.error('❌ Cannot save: userId or db missing', {
                            userId: this.userId,
                            db: !!this.db
                        });
                    }
                }
            }
        }, 1000); // каждую секунду
        
        console.log('✅ Online income started!');
    }
    
    // Остановка автоматического начисления онлайн дохода
    stopOnlineIncome() {
        if (this.onlineIncomeInterval) {
            clearInterval(this.onlineIncomeInterval);
            this.onlineIncomeInterval = null;
            console.log('⏹️ Online income stopped');
            
            // Сохраняем финальный баланс при остановке
            if (this.userId && this.db) {
                console.log('💾 Saving final balance on stop:', this.coins.toFixed(4));
                this.db.updateBalance(this.userId, this.coins).then(result => {
                    console.log('✅ Final balance saved:', result);
                }).catch(error => {
                    console.error('❌ Error saving final balance:', error);
                });
            }
        }
    }
    
    // Перезапуск онлайн дохода (при изменении stable_income)
    restartOnlineIncome() {
        console.log('🔄 Restarting online income...');
        this.stopOnlineIncome();
        this.startOnlineIncome();
    }
    
    // Установка статуса онлайн/оффлайн
    setOnlineStatus(isOnline) {
        console.log('Setting online status:', isOnline);
        this.isOnline = isOnline;
        
        if (isOnline) {
            this.startOnlineIncome();
        } else {
            this.stopOnlineIncome();
        }
    }
    
    // Функция для принудительного сохранения баланса в БД
    async forceSaveBalance() {
        console.log('🔄 Force saving balance to DB...');
        console.log('Current balance:', this.coins);
        console.log('UserId:', this.userId);
        console.log('DB available:', !!this.db);
        
        if (this.userId && this.db) {
            try {
                const result = await this.db.updateBalance(this.userId, this.coins);
                console.log('✅ Force save result:', result);
                return result;
            } catch (error) {
                console.error('❌ Force save error:', error);
                return false;
            }
        } else {
            console.error('❌ Cannot force save: userId or db missing');
            return false;
        }
    }
    
    // Функция для отладки онлайн дохода
    debugOnlineIncome() {
        console.log('=== ONLINE INCOME DEBUG ===');
        console.log('Online status:', this.isOnline);
        console.log('Stable income per minute:', this.stableIncome);
        console.log('Income per second:', this.stableIncome / 60);
        console.log('Interval active:', !!this.onlineIncomeInterval);
        console.log('Last save time:', new Date(this.lastOnlineIncomeSave).toLocaleString());
        console.log('Time since last save:', Math.floor((Date.now() - this.lastOnlineIncomeSave) / 1000), 'seconds');
        console.log('Current balance:', this.coins);
        
        if (this.onlineIncomeInterval) {
            console.log('✅ Online income is RUNNING');
        } else {
            console.log('❌ Online income is STOPPED');
        }
    }

    // Принудительное обновление уровня (для синхронизации с балансом)
    forceUpdateLevel() {
        if (!this.levelsConfig) {
            console.log('⏳ Levels config not ready, will retry in 1 second...');
            // Повторяем попытку через 1 секунду
            setTimeout(() => {
                this.forceUpdateLevel();
            }, 1000);
            return;
        }
        
        const levelData = this.calculateLevel();
        const oldLevel = this.currentLevel;
        
        console.log('🔄 Force updating level:', {
            currentBalance: this.coins,
            oldLevel: oldLevel,
            newLevel: levelData.level,
            changed: oldLevel !== levelData.level
        });
        
        if (oldLevel !== levelData.level) {
            console.log('🆙 Level needs update:', oldLevel, '→', levelData.level);
            
            // Сохраняем новый уровень в БД
            if (this.userId && this.db) {
                this.saveLevelToDB(levelData.level);
            } else {
                // Если БД недоступна, обновляем только локально
                this.currentLevel = levelData.level;
            }
            
            // Обновляем UI
            this.updateLevelProgressBar();
            
            // 🔄 Обновляем данные игрока и доступность предметов при изменении уровня
            this.playerData.level = levelData.level;
            this.updateItemsAvailability();
            
            console.log('✅ Level force updated successfully');
        } else {
            console.log('✅ Level is already up to date');
            // Все равно обновляем UI для корректного отображения
            this.updateLevelProgressBar();
            
            // 🔄 Обновляем данные игрока на всякий случай
            this.playerData.level = levelData.level;
            this.updateItemsAvailability();
        }
    }

    // Настройка обработчиков выхода из игры для сохранения энергии
    setupExitHandlers() {
        // Добавляем только если не добавлены ранее
        if (!this.exitHandlersSetup) {
            this.exitHandlersSetup = true;
            console.log('🔧 Setting up exit handlers for energy saving');
            
            // Сохранение при потере фокуса окна
            const saveEnergyOnBlur = async () => {
                if (this.userId && this.db) {
                    console.log('💾 Saving energy and last_active on window blur');
                    await this.db.updateEnergy(this.userId, this.currentEnergy, this.maxEnergy);
                    await this.db.updateLastActive(this.userId, new Date().toISOString());
                }
            };
            
            // Сохранение при скрытии вкладки
            const saveEnergyOnHidden = async () => {
                if (document.hidden && this.userId && this.db) {
                    console.log('💾 Saving energy and last_active on tab hide');
                    await this.db.updateEnergy(this.userId, this.currentEnergy, this.maxEnergy);
                    await this.db.updateLastActive(this.userId, new Date().toISOString());
                }
            };
            
            window.addEventListener('blur', saveEnergyOnBlur);
            document.addEventListener('visibilitychange', saveEnergyOnHidden);
        }
    }
}


// === Анимация кружков на фоне ===
function randomizeCircle(circle, areaW, areaH) {
  const size = 120;
  const left = Math.random() * (areaW - size);
  const top = Math.random() * (areaH - size);
  const scale = 0.7 + Math.random() * 0.7;
  const opacity = 0.3 + Math.random() * 0.5;
  circle.style.left = left + 'px';
  circle.style.top = top + 'px';
  circle.style.transform = `scale(${scale})`;
  circle.style.opacity = opacity;
}

function animateCircles() {
  const area = document.querySelector('.bg_animation');
  if (!area) return;
  const areaW = area.offsetWidth;
  const areaH = area.offsetHeight;
  const circles = [
    document.querySelector('.circle_first'),
    document.querySelector('.circle_second'),
    document.querySelector('.circle_third'),
    document.querySelector('.circle_four'),
    document.querySelector('.circle_five')
  ];
  circles.forEach(circle => {
    if (circle) randomizeCircle(circle, areaW, areaH);
  });
}

// 🚀 Запуск игры
document.addEventListener('DOMContentLoaded', async () => {
    // Дополнительное ожидание для полной загрузки DOM и видео элементов
    console.log('⏳ DOM loaded, waiting for video/media resources...');
    await new Promise(resolve => setTimeout(resolve, 600));
    
    window.labubuGame = new LabubuGame();
    console.log('🎮 LabubuCoin Game запущена!');
    setInterval(animateCircles, 2000);
    animateCircles();
    // renderAccessories(); // убрано, если функции нет

    // Добавляем функции отладки в глобальную область видимости
    window.debugAccessories = () => window.labubuGame.debugAccessories();
    window.forceRefreshAccessories = () => window.labubuGame.forceRefreshAccessories();
    window.debugBalance = () => window.labubuGame.debugBalance();
    window.forceSyncBalance = () => window.labubuGame.forceSyncBalance();
    window.debugStableIncome = () => window.labubuGame.debugStableIncome();
    window.forceSyncStableIncome = () => window.labubuGame.forceSyncStableIncome();
    window.startOnlineIncome = () => window.labubuGame.startOnlineIncome();
    window.stopOnlineIncome = () => window.labubuGame.stopOnlineIncome();
    window.setOnlineStatus = (status) => window.labubuGame.setOnlineStatus(status);
    window.debugOnlineIncome = () => window.labubuGame.debugOnlineIncome();
    window.forceSaveBalance = () => window.labubuGame.forceSaveBalance();
    window.forceUpdateLevel = () => window.labubuGame.forceUpdateLevel();
    window.renderReferralRanks = () => window.labubuGame.renderReferralRanks();
    
    // 🔒 Отладочные функции для системы требований
    window.debugRequirements = () => {
        const game = window.labubuGame;
        console.log('=== REQUIREMENTS DEBUG ===');
        console.log('Player Data:', game.playerData);
        
        const allItems = document.querySelectorAll('.box_lb[data-required-level]');
        allItems.forEach(item => {
            const requirements = game.checkItemRequirements(item);
            console.log(`Item ${item.dataset.id}:`, requirements);
        });
    };
    
    window.testRequirements = (level = 5, referrals = 3) => {
        const game = window.labubuGame;
        console.log(`🧪 Testing with level=${level}, referrals=${referrals}`);
        
        // Временно устанавливаем тестовые значения
        game.playerData.level = level;
        game.playerData.referrals_count = referrals;
        
        // Обновляем UI
        game.updateItemsAvailability();
        
        console.log('✅ Requirements updated. Check the cards in the upgrade page.');
        console.log('To restore real data, reload the page or call window.labubuGame.updateItemsAvailability()');
    };
    
    // 🎯 Отладочные функции для прогресс-бара
    window.testProgressBar = () => {
        const game = window.labubuGame;
        console.log('🧪 Testing progress bar...');
        game.updateLevelProgressBar();
    };
    
    window.debugLevelsConfig = () => {
        const game = window.labubuGame;
        console.log('=== LEVELS CONFIG DEBUG ===');
        console.log('levelsConfig exists:', !!game.levelsConfig);
        console.log('levelsConfig object:', game.levelsConfig);
        
        if (game.levelsConfig) {
            console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(game.levelsConfig)));
            console.log('Test getLevelByTotalXP(100):', game.levelsConfig.getLevelByTotalXP(100));
            console.log('Test getLevelProgress(100):', game.levelsConfig.getLevelProgress(100));
        }
    };
    
    window.setCoinsAndTest = (coins = 50) => {
        const game = window.labubuGame;
        console.log(`🧪 Setting coins to ${coins} and testing progress bar...`);
        game.coins = coins;
        game.updateLevelProgressBar();
        console.log('✅ Coins updated. Check the progress bar!');
    };
    
    window.debugCurrentProgress = () => {
        const game = window.labubuGame;
        console.log('=== CURRENT PROGRESS DEBUG ===');
        console.log('Current coins:', game.coins);
        
        if (game.levelsConfig) {
            console.log('getLevelByTotalXP result:', game.levelsConfig.getLevelByTotalXP(Math.floor(game.coins)));
            console.log('getLevelProgress result:', game.levelsConfig.getLevelProgress(Math.floor(game.coins)));
            console.log('getLevelInfo(1):', game.levelsConfig.getLevelInfo(1));
            console.log('getLevelInfo(2):', game.levelsConfig.getLevelInfo(2));
            
            // Тестируем разные значения
            console.log('--- Testing different values ---');
            for (let i = 0; i <= 200; i += 50) {
                console.log(`XP: ${i}, Level: ${game.levelsConfig.getLevelByTotalXP(i)}, Progress: ${game.levelsConfig.getLevelProgress(i)}%`);
            }
        }
    };
    
    // 🧪 Быстрые тесты прогресс-бара
    window.quickProgressTest = () => {
        const game = window.labubuGame;
        console.log('🧪 QUICK PROGRESS TEST');
        
        const testValues = [0, 50, 100, 150, 200, 300, 500];
        testValues.forEach(coins => {
            game.coins = coins;
            game.updateLevelProgressBar();
            console.log(`${coins} coins → Progress visible`);
        });
        
        console.log('✅ Test complete - check progress bar changes!');
    };
    
    // 🔧 Функция для пересоздания системы уровней
    window.reinitLevels = async () => {
        const game = window.labubuGame;
        console.log('🔄 Reinitializing levels system...');
        await game.initLevelsSystem();
        game.updateLevelProgressBar();
        console.log('✅ Levels system reinitialized!');
    };
    
    // Добавляем обработчики для переключения категорий/страниц
    console.log('🔄 Setting up category switchers...');
    document.querySelectorAll('.ctg_wrap, #upgrade_buttton_page').forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('Category button clicked:', this.dataset.target);
            // Проверяем, есть ли у элемента data-target
            if (!this.dataset.target) {
                console.log('No data-target found, skipping');
                return;
            }
                
            // Скрыть все основные страницы
            document.querySelectorAll('.main_page, .upgrade_page, .top_page, .referal_page').forEach(page => {
                page.style.display = 'none';
            });
            
            // Показать нужную страницу
            const target = this.dataset.target;
            const page = document.querySelector('.' + target);
            if (page) {
                page.style.display = '';
                console.log('Showing page:', target);
            } else {
                console.log('Page not found:', target);
            }
            
            // Подсветить активную иконку
            document.querySelectorAll('.ctg_wrap').forEach(b => b.classList.remove('selected_ctg'));
            this.classList.add('selected_ctg');
        });
    });
    console.log('✅ Category switchers setup complete');
    
    // Функции отладки системы уровней
    window.debugLevels = () => {
        const game = window.labubuGame;
        if (!game.levelsConfig) {
            console.log('❌ Levels config not loaded yet');
            return;
        }
        
        const levelData = game.calculateLevel();
        const rankInfo = game.levelsConfig.getRankByCoins(game.coins);
        
        console.log('=== LEVELS DEBUG ===');
        console.log('Current balance (XP):', game.coins);
        console.log('Current level:', levelData.level);
        console.log('Progress:', levelData.progress.toFixed(2) + '%');
        console.log('XP to next level:', levelData.xpToNextLevel);
        console.log('Rank:', rankInfo.name, rankInfo.icon);
        console.log('Title:', levelData.levelInfo?.title);
        console.log('Level info:', levelData.levelInfo);
        console.log('Level requirements (first 10):', game.levelsConfig.levels.slice(0, 10));
        console.log('=== END LEVELS DEBUG ===');
    };
    
    window.setTestBalance = (amount) => {
        const game = window.labubuGame;
        game.coins = amount;
        game.updateUI();
        console.log('💰 Set test balance to:', amount);
        if (game.userId && game.db) {
            game.db.updateBalance(game.userId, amount);
        }
    };
    
    window.testLevelProgression = () => {
        const testBalances = [0, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];
        let index = 0;
        
        const testNext = () => {
            if (index < testBalances.length) {
                window.setTestBalance(testBalances[index]);
                window.debugLevels();
                index++;
                setTimeout(testNext, 2000); // 2 секунды между тестами
            } else {
                console.log('🏁 Level progression test completed!');
            }
        };
        
        console.log('🧪 Starting level progression test...');
        testNext();
    };
    
    // Новые функции отладки для конфига уровней
    window.showLevelsConfig = () => {
        if (!window.LevelsConfig) {
            console.log('❌ Levels config not available');
            return;
        }
        
        console.log('=== LEVELS CONFIG ===');
        console.log('Total levels:', window.LevelsConfig.levels.length);
        console.log('Total ranks:', window.LevelsConfig.ranks.length);
        console.log('Max XP needed:', window.LevelsConfig.levels[window.LevelsConfig.levels.length - 1]?.totalXpRequired);
        console.log('Max coins for highest rank:', window.LevelsConfig.ranks[window.LevelsConfig.ranks.length - 1]?.requiredCoins);
        console.log('First 20 levels:', window.LevelsConfig.levels.slice(0, 20));
        console.log('Last 10 levels:', window.LevelsConfig.levels.slice(-10));
        console.log('=== END CONFIG ===');
    };
    
    window.showRanksInfo = () => {
        if (!window.LevelsConfig) {
            console.log('❌ Levels config not available');
            return;
        }
        
        console.log('=== RANKS INFO ===');
        window.LevelsConfig.ranks.forEach((rank, index) => {
            console.log(`${index + 1}. ${rank.icon} ${rank.name}:`, {
                requiredCoins: rank.requiredCoins.toLocaleString(),
                reward: rank.reward,
                color: rank.color,
                description: rank.description
            });
        });
        console.log('=== END RANKS ===');
    };
    
    window.findLevelByXP = (xp) => {
        if (!window.LevelsConfig) {
            console.log('❌ Levels config not available');
            return;
        }
        
        const level = window.LevelsConfig.getLevelByTotalXP(xp);
        const progress = window.LevelsConfig.getLevelProgress(xp);
        const levelInfo = window.LevelsConfig.getLevelInfo(level);
        const rankInfo = window.LevelsConfig.getRankByCoins(xp);
        const rankProgress = window.LevelsConfig.getRankProgress(xp);
        
        console.log(`💰 XP/Coins: ${xp} → Level: ${level}`);
        console.log(`🏆 ${rankInfo.icon} ${rankInfo.name} - ${levelInfo?.title}`);
        console.log(`📊 Rank progress: ${rankProgress.toFixed(1)}%`);
        console.log(`📊 Progress: ${progress.toFixed(2)}%`);
        console.log(`📈 Level info:`, levelInfo);
    };
    
    console.log('🔧 Debug functions available:');
    console.log('- debugAccessories() - показать отладочную информацию об аксессуарах');
    console.log('- forceRefreshAccessories() - принудительно обновить отображение аксессуаров');
    console.log('- debugBalance() - показать отладочную информацию о балансе');
    console.log('- forceSyncBalance() - принудительно синхронизировать баланс с БД');
    console.log('- debugStableIncome() - показать отладочную информацию о stable_income');
    console.log('- forceSyncStableIncome() - принудительно синхронизировать stable_income с БД');
    console.log('- startOnlineIncome() - запустить автоматическое начисление онлайн дохода');
    console.log('- stopOnlineIncome() - остановить автоматическое начисление онлайн дохода');
    console.log('- setOnlineStatus(true/false) - установить статус онлайн/оффлайн');
    console.log('- debugOnlineIncome() - показать отладочную информацию о состоянии онлайн дохода');
    console.log('- forceSaveBalance() - принудительно сохранить текущий баланс в БД');
    console.log('- forceUpdateLevel() - принудительно обновить уровень');
    console.log('- testLevelsDisplay() - протестировать отображение уровней');
    console.log('- renderReferralRanks() - перерендерить реферальные ранги');
    console.log('🆙 LEVEL SYSTEM:');
    console.log('- debugLevels() - показать информацию о текущем уровне');
    console.log('- setTestBalance(amount) - установить тестовый баланс');
    console.log('- testLevelProgression() - протестировать прогрессию уровней');
    console.log('- showLevelsConfig() - показать конфигурацию всех уровней');
    console.log('- showRanksInfo() - показать информацию о рангах');
    console.log('- findLevelByXP(xp) - найти уровень по количеству XP');

    // Обновление last_active каждую минуту
    setInterval(async () => {
        if (window.labubuGame && window.labubuGame.userId && window.labubuGame.db) {
            try {
                const timeResponse = await fetch('https://labubucoin.vercel.app/api/server-time');
                const { serverTime } = await timeResponse.json();
                await window.labubuGame.db.updateLastActive(window.labubuGame.userId, serverTime);
            } catch (error) {
                console.error('Error updating last_active:', error);
                // В случае ошибки используем клиентское время как fallback
                await window.labubuGame.db.updateLastActive(window.labubuGame.userId, new Date().toISOString());
            }
        }
    }, 60 * 1000);

    // Надёжное сохранение last_active при выходе
    window.addEventListener('beforeunload', async (e) => {
        if (window.labubuGame && window.labubuGame.userId && window.labubuGame.db) {
            // Останавливаем онлайн доход и сохраняем финальный баланс
            window.labubuGame.setOnlineStatus(false);
            
            try {
                // Сохраняем энергию и время
                await window.labubuGame.db.updateEnergy(window.labubuGame.userId, window.labubuGame.currentEnergy, window.labubuGame.maxEnergy);
                
                const timeResponse = await fetch('https://labubucoin.vercel.app/api/server-time');
                const { serverTime } = await timeResponse.json();
                await window.labubuGame.db.updateLastActive(window.labubuGame.userId, serverTime);
            } catch (error) {
                console.error('Error saving data on unload:', error);
                // В случае ошибки используем клиентское время как fallback
                await window.labubuGame.db.updateEnergy(window.labubuGame.userId, window.labubuGame.currentEnergy, window.labubuGame.maxEnergy);
                await window.labubuGame.db.updateLastActive(window.labubuGame.userId, new Date().toISOString());
            }
        }
    });



    // Отслеживание видимости вкладки для пауз онлайн дохода
    document.addEventListener('visibilitychange', () => {
        if (window.labubuGame) {
            if (document.hidden) {
                // Вкладка скрыта - останавливаем онлайн доход
                console.log('🔇 Tab hidden, pausing online income');
                window.labubuGame.setOnlineStatus(false);
            } else {
                // Вкладка видима - возобновляем онлайн доход
                console.log('👁️ Tab visible, resuming online income');
                window.labubuGame.setOnlineStatus(true);
            }
        }
    });

    // Отслеживание фокуса окна
    window.addEventListener('focus', () => {
        if (window.labubuGame) {
            console.log('🎯 Window focused, resuming online income');
            window.labubuGame.setOnlineStatus(true);
        }
    });

    window.addEventListener('blur', () => {
        if (window.labubuGame) {
            console.log('😴 Window blurred, pausing online income');
            window.labubuGame.setOnlineStatus(false);
        }
    });
});