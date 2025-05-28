const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN = '7535947506:AAHdq2uK_gQZ4CClZ2ScJCX4UiFCtSCs2fM';
const CHAT_IDS = ['6130424486', '-1002494765597'];
const BASE_URL = 'https://newtoki468.com/toki_bl';
const COOKIE_FILE_PATH = path.resolve(__dirname, 'cookies.json');

const getLocalTime = () => new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

const getKoreaHour = () => {
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour12: false });
    return parseInt(now.split(', ')[1].split(':')[0], 10);
};

const sendTelegramMessage = async (message) => {
    const time = getLocalTime();
    for (const chatId of CHAT_IDS) {
        try {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: message,
            });
            console.log(`[${time}] 텔레그램 메시지 전송: ${message}`);
        } catch (error) {
            console.error(`[${time}] 텔레그램 전송 오류 (ID: ${chatId}):`, error.response?.data || error.message);
        }
    }
};

const loadCookies = async (page) => {
    try {
        const cookies = JSON.parse(fs.readFileSync(COOKIE_FILE_PATH, 'utf8'));
        await page.setCookie(...cookies);
        console.log(`[${getLocalTime()}] ✅ 쿠키 로딩 완료`);
    } catch (err) {
        console.error(`[${getLocalTime()}] ❌ 쿠키 로딩 실패:`, err.message);
    }
};

const startScraping = async () => {
    console.log(`[${getLocalTime()}] 스크래핑 시작`);

    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser', // 시놀로지에 맞게 경로 설정
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await loadCookies(page);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    let processedPosts = new Set();

    while (true) {
        const hour = getKoreaHour();
        if (hour === 23 || hour === 0) {
            console.log(`[${getLocalTime()}] 🕒 23시~01시: 감지 일시 중단`);
            await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
            continue;
        }

        await page.reload({ waitUntil: 'domcontentloaded', bypassCache: true });

        const posts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.list-item')).map(item => {
                const urlElement = item.querySelector('.item-subject');
                const url = urlElement?.href || '';
                const title = urlElement?.innerText.trim() || '';
                const hasFileIcon = urlElement?.querySelector('.wr-file') !== null;
                return { title, url, hasFileIcon };
            });
        });

        const newPosts = posts.filter(post => post.hasFileIcon && !processedPosts.has(post.url));

        if (newPosts.length > 0) {
            console.log(`[${getLocalTime()}] ✅ 새 게시물 발견: ${newPosts.length}개`);
            await sendTelegramMessage(`${newPosts.length}개 새 게시물 발견!`);

            for (const post of newPosts) {
                console.log(`🚀 ${post.title}\n▶️ ${post.url}`);
                processedPosts.add(post.url);
            }

            if (processedPosts.size > 50) {
                processedPosts = new Set([...processedPosts].slice(-50));
            }
        } else {
            console.log(`[${getLocalTime()}] ❌ 새 게시물 없음`);
        }

        const delay = Math.floor(Math.random() * 31) + 60;
        console.log(`[${getLocalTime()}] ⏳ ${delay}초 후 다시 검사`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
};

startScraping();
