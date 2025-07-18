// 🎮 LabubuCoin Game Script
class LabubuGame {
    constructor() {
        this.coins = 0;
        this.stableIncome = 3.65;
        this.profitPerClick = 1;
        this.boost = 2;
        this.boostTimeLeft = 0;
        this.isBoostActive = false;
        
        this.init();
    }

    init() {
        this.loadGameData();
        this.setupEventListeners();
        this.startIncomeTimer();
        this.updateUI();

        // Получаем данные пользователя через Telegram WebApp API
        this.loadTelegramUser();
    }

    async loadTelegramUser() {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            const user = window.Telegram.WebApp.initDataUnsafe.user;
            // Отображаем username или имя
            const userElement = document.getElementById('user_id');
            if (userElement) {
                userElement.textContent = user.username ? `@${user.username}` : user.first_name;
            }
            // Загружаем баланс из backend/Supabase
            this.loadUserBalance(user.id);
        } else {
            // Если не удалось получить пользователя, скрываем имя
            const userElement = document.getElementById('user_id');
            if (userElement) userElement.textContent = 'Player';
        }
    }

    async loadUserBalance(userId) {
        try {
            // Замените URL на ваш backend-эндпоинт, если он другой
            const res = await fetch(`https://labubucoin.vercel.app/api/balance?user_id=${userId}`);
            if (!res.ok) throw new Error('Ошибка загрузки баланса');
            const data = await res.json();
            if (data && typeof data.balance !== 'undefined') {
                const balanceElement = document.querySelector('.flex_balance span');
                if (balanceElement) {
                    balanceElement.textContent = this.formatNumber(data.balance);
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки баланса:', e);
        }
    }

    setupEventListeners() {
        // Клик по Labubu
        const labubuPic = document.querySelector('.labubu_pic');
        if (labubuPic) {
            labubuPic.addEventListener('click', () => this.handleClick());
        }

        // Клик по кругу
        const circleBg = document.querySelector('.circle_bg');
        if (circleBg) {
            circleBg.addEventListener('click', () => this.handleClick());
        }
    }

    handleClick() {
        const profit = this.profitPerClick * (this.isBoostActive ? this.boost : 1);
        this.coins += profit;
        
        // Показываем анимацию прибыли
        this.showProfitAnimation(profit);
        
        // Обновляем UI
        this.updateUI();
        
        // Сохраняем данные
        this.saveGameData();
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

    startIncomeTimer() {
        setInterval(() => {
            if (this.isBoostActive) {
                this.coins += this.stableIncome * this.boost;
                this.boostTimeLeft--;
                
                if (this.boostTimeLeft <= 0) {
                    this.isBoostActive = false;
                }
            } else {
                this.coins += this.stableIncome;
            }
            
            this.updateUI();
            this.saveGameData();
        }, 1000);
    }

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
}

// 🚀 Запуск игры
document.addEventListener('DOMContentLoaded', () => {
    window.labubuGame = new LabubuGame();
    console.log('🎮 LabubuCoin Game запущена!');
}); 