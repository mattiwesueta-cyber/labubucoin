// 🎮 LabubuCoin Game Script
class LabubuGame {
    constructor() {
        this.coins = 0;
        this.stableIncome = 0;
        this.profitPerClick = 1;
        this.boost = 0;
        this.boostTimeLeft = 0;
        this.isBoostActive = false;
        this.userId = null; // сохраняем userId для обновления баланса
        this.init();
    }

    init() {
        this.loadGameData();
        this.setupEventListeners();
        this.updateUI();

        // Получаем данные пользователя через Telegram WebApp API
        this.loadTelegramUser();
    }

    async loadTelegramUser(retry = 0) {
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                const user = window.Telegram.WebApp.initDataUnsafe.user;
                this.userId = user.id; // сохраняем userId
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
                // Загружаем баланс из backend/Supabase
                await this.loadUserBalance(user.id);
            } else {
                if (retry < 5) {
                    setTimeout(() => this.loadTelegramUser(retry + 1), 400);
                } else {
                    // Показываем крупное сообщение на экран
                    let warn = document.getElementById('tg_api_warn');
                    if (!warn) {
                        warn = document.createElement('div');
                        warn.id = 'tg_api_warn';
                        warn.style = 'position:fixed;top:0;left:0;right:0;background:#c00;color:#fff;font-size:20px;z-index:10000;padding:20px;text-align:center;';
                        warn.textContent = 'Нет данных пользователя из Telegram! Перезапустите игру через Telegram-клиент.';
                        document.body.appendChild(warn);
                    }
                    const userElement = document.getElementById('user_id');
                    if (userElement) userElement.textContent = 'Player';
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async loadUserBalance(userId) {
        try {
            const balanceUrl = `https://labubucoin.vercel.app/api/balance?user_id=${userId}`;
            const res = await fetch(balanceUrl);
            const data = await res.json();
            if (data && typeof data.balance !== 'undefined') {
                this.coins = data.balance; // <-- обновляем баланс
                const balanceElement = document.querySelector('.flex_balance span');
                if (balanceElement) {
                    balanceElement.textContent = this.formatNumber(this.coins);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    setupEventListeners() {
        // Клик только по .labubu_cont
        const labubuCont = document.querySelector('.labubu_cont');
        if (labubuCont) {
            labubuCont.addEventListener('click', () => this.handleClick());
        }
    }

    handleClick() {
        const profit = this.profitPerClick * (this.isBoostActive ? this.boost : 1);
        this.coins += profit;
        this.showProfitAnimation(profit);
        this.updateUI();
        this.saveGameData();
        console.log('handleClick: userId =', this.userId, 'coins =', this.coins);
        this.updateBalanceInDB();
        this.spawnRandomProfitSpan(profit);
        this.animateCircleBg();
    }

    showProfitAnimation(profit) {
        const numbersCont = document.querySelector('.numbers_cont span');
        if (numbersCont) {
            numbersCont.textContent = `+${profit}`;
            numbersCont.style.opacity = '1';
            numbersCont.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                numbersCont.style.opacity = '0';
                numbersCont.style.transform = 'scale(1)';
            }, 1000);
        }
    }

    spawnRandomProfitSpan(profit) {
        const numbersCont = document.querySelector('.numbers_cont');
        if (numbersCont) {
            const span = document.createElement('span');
            span.textContent = `+${profit}`;
            span.style.position = 'absolute';
            // Рандомная позиция внутри контейнера (от 10% до 90%)
            span.style.left = `${10 + Math.random() * 80}%`;
            span.style.top = `${10 + Math.random() * 80}%`;
            span.style.pointerEvents = 'none';
            span.style.transition = 'opacity 0.8s, transform 0.8s';
            span.style.opacity = '1';
            span.style.transform = 'scale(1.2)';
            numbersCont.appendChild(span);
            setTimeout(() => {
                span.style.opacity = '0';
                span.style.transform = 'scale(1)';
            }, 50);
            setTimeout(() => {
                numbersCont.removeChild(span);
            }, 900);
        }
    }

    // Удаляю startIncomeTimer полностью

    updateUI() {
        // Обновляем баланс монет
        const balanceElement = document.querySelector('.flex_balance span');
        if (balanceElement) {
            balanceElement.textContent = this.formatNumber(this.coins);
        }

        // Обновляем стабильный доход
        const stableIncomeElement = document.querySelector('.flex_i span');
        if (stableIncomeElement) {
            const income = this.stableIncome * (this.isBoostActive ? this.boost : 1);
            stableIncomeElement.textContent = `+${income.toFixed(2)}`;
        }

        // Обновляем прибыль за клик
        const profitElement = document.querySelector('.blue_pannel .flex_i span');
        if (profitElement) {
            const profit = this.profitPerClick * (this.isBoostActive ? this.boost : 1);
            profitElement.textContent = profit;
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
    }

    formatNumber(num) {
        if (num >= 1e9) {
            return (num / 1e9).toFixed(1) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(1) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(1) + 'K';
        }
        return Math.floor(num).toString();
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
        const gameData = {
            coins: this.coins,
            stableIncome: this.stableIncome,
            profitPerClick: this.profitPerClick,
            boost: this.boost,
            boostTimeLeft: this.boostTimeLeft,
            isBoostActive: this.isBoostActive,
            lastSave: Date.now()
        };
        
        localStorage.setItem('labubuGameData', JSON.stringify(gameData));
    }

    loadGameData() {
        const savedData = localStorage.getItem('labubuGameData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.coins = data.coins || 0;
                this.stableIncome = data.stableIncome || 3.65;
                this.profitPerClick = data.profitPerClick || 1;
                this.boost = data.boost || 2;
                this.boostTimeLeft = data.boostTimeLeft || 0;
                this.isBoostActive = data.isBoostActive || false;
                
                // Проверяем, не истек ли буст
                if (this.isBoostActive && this.boostTimeLeft <= 0) {
                    this.isBoostActive = false;
                }
            } catch (error) {
                console.error('Ошибка загрузки данных игры:', error);
            }
        }
    }

    async updateBalanceInDB() {
        if (!this.userId) {
            console.warn('updateBalanceInDB: userId is null!');
            return;
        }
        try {
            const response = await fetch(`https://labubucoin.vercel.app/api/update-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: this.userId, balance: this.coins })
            });
            const result = await response.json();
            console.log('updateBalanceInDB: response', result);
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
        if (circleBg) {
            circleBg.style.transition = 'transform 0.05s';
            circleBg.style.transform = 'scale(0.9)';
            setTimeout(() => {
                circleBg.style.transform = 'scale(1)';
            }, 50);
        }
    }
}

// 🚀 Запуск игры
document.addEventListener('DOMContentLoaded', () => {
    window.labubuGame = new LabubuGame();
    console.log('🎮 LabubuCoin Game запущена!');
}); 