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
        this.db = null; // GameDatabase instance
        this.init();
    }

    async init() {
        // Показываем лоадер
        const loader = document.querySelector('.load_bg');
        if (loader) loader.style.display = '';
        // Инициализация GameDatabase
        this.db = new window.GameDatabase();
        // Ждем инициализации supabase
        while (!this.db.supabase) {
            await new Promise(r => setTimeout(r, 100));
        }
        this.setupEventListeners();
        this.updateUI();
        // Получаем данные пользователя через Telegram WebApp API
        await this.loadTelegramUser();
        // Искусственная задержка для лоадера
        await new Promise(r => setTimeout(r, 0));
        // Скрываем лоадер после полной загрузки
        if (loader) loader.style.display = 'none';
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
                // Загружаем все игровые данные из Supabase, передавая username
                await this.loadPlayerDataFromDB(user.id, user.username);
            } else {
                if (retry < 5) {
                    setTimeout(() => this.loadTelegramUser(retry + 1), 400);
                } else {
                    // Удаляю показ сообщения tg_api_warn
                    const userElement = document.getElementById('user_id');
                    if (userElement) userElement.textContent = 'Player';
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    async loadPlayerDataFromDB(userId, username = null) {
        if (!this.db) return;
        const data = await this.db.loadPlayerData(userId, username);
        if (data) {
            this.coins = data.balance || 0;
            this.stableIncome = data.stable_income || 3.65;
            this.profitPerClick = data.profit_per_click || 1;
            this.boost = data.boost || 2;
            this.boostTimeLeft = data.boost_time_left || 0;
            this.isBoostActive = data.is_boost_active || false;
            this.costume = data.costume || 'labubu.png';
            // Применяем costume к картинке
            const labubuImg = document.querySelector('.labubu_pic');
            if (labubuImg) {
                labubuImg.src = 'assets/images/' + this.costume;
            }
            // Проверяем, не истек ли буст
            if (this.isBoostActive && this.boostTimeLeft <= 0) {
                this.isBoostActive = false;
            }
            this.updateUI();
        }
    }

    setupEventListeners() {
        // Клик только по .labubu_cont
        const labubuCont = document.querySelector('.labubu_cont');
        if (labubuCont) {
            labubuCont.addEventListener('click', () => this.handleClick());
        }

        // Обработка клика по карточкам апгрейда
        document.querySelectorAll('.box_lb').forEach(card => {
            card.addEventListener('click', (e) => {
                // Сохраняем выбранную карточку
                this.selectedCard = {
                    id: card.dataset.id,
                    price: parseInt(card.dataset.price, 10),
                    stableIncome: parseInt(card.dataset.stableIncome, 10),
                    costume: card.dataset.costume || null
                };
                // Открываем окно подтверждения
                document.getElementById('popout_confirm').style.display = 'flex';
                // Можно обновить инфу в попапе, если нужно
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

    async handleBuyCard() {
        if (!this.selectedCard || !this.userId || !this.db) return;
        // Получаем данные пользователя
        const data = await this.db.loadPlayerData(this.userId);
        if (!data) return;
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
            // Сохраняем в БД
            await this.db.savePlayerData(this.userId, {
                coins: this.coins,
                stableIncome: this.stableIncome,
                profitPerClick: this.profitPerClick,
                boost: this.boost,
                boostTimeLeft: this.boostTimeLeft,
                isBoostActive: this.isBoostActive,
                costume: this.costume || 'labubu.png'
            });
            this.updateUI();
            // Скрываем попап
            document.getElementById('popout_confirm').style.display = 'none';
            // Можно показать сообщение об успехе
        } else {
            // Недостаточно монет, показать ошибку
            alert('Недостаточно монет для покупки!');
        }
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
            // Рандомный размер шрифта от 5vw до 10.3565vw
            const minFontSize = 5; // vw
            const maxFontSize = 10.3565; // vw
            const fontSize = minFontSize + Math.random() * (maxFontSize - minFontSize);
            span.style.fontSize = `${fontSize}vw`;
            span.style.pointerEvents = 'none';
            span.style.transition = 'opacity 0.8s, transform 0.8s';
            span.style.opacity = '1';
            span.style.transform = 'scale(1.2)';
            numbersCont.appendChild(span);
            setTimeout(() => {
                span.style.opacity = '0';
                span.style.transform = 'scale(1)';
            }, 150);
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
        if (!this.userId || !this.db) return;
        const gameData = {
            coins: this.coins,
            stableIncome: this.stableIncome,
            profitPerClick: this.profitPerClick,
            boost: this.boost,
            boostTimeLeft: this.boostTimeLeft,
            isBoostActive: this.isBoostActive,
            lastSave: Date.now()
        };
        this.db.savePlayerData(this.userId, gameData);
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
            circleBg.style.transform = 'scale(0.9) translateZ(0)';
            setTimeout(() => {
                circleBg.style.transform = 'scale(1) translateZ(0)';
            }, 50);
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
document.addEventListener('DOMContentLoaded', () => {
    window.labubuGame = new LabubuGame();
    console.log('🎮 LabubuCoin Game запущена!');
    setInterval(animateCircles, 2000);
    animateCircles();
}); 

document.querySelectorAll('.ctg_wrap').forEach(btn => {
    btn.addEventListener('click', function() {
      // Скрыть все основные страницы
      document.querySelectorAll('.main_page, .upgrade_page').forEach(page => {
        page.style.display = 'none';
      });
      // Показать нужную
      const target = this.dataset.target;
      const page = document.querySelector('.' + target);
      if (page) page.style.display = '';
      // Подсветить активную иконку
      document.querySelectorAll('.ctg_wrap').forEach(b => b.classList.remove('selected_ctg'));
      this.classList.add('selected_ctg');
    });
  });