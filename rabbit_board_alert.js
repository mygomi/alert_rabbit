const puppeteer = require('puppeteer');
const telegram = require('node-telegram-bot-api');

// 텔레그램 설정
const TELEGRAM_TOKEN = '7535947506:AAHdq2uK_gQZ4CClZ2ScJCX4UiFCtSCs2fM';
const CHAT_IDS = ['6130424486', '-1002494765597']; // 개인 ID와 채널 ID 혼합 가능
const bot = new telegram(TELEGRAM_TOKEN, { polling: true });

// 사이트 URL
const url = 'https://newtoki467.com/toki_bl';

// 이전 게시물 카운트
let previousPostCount = {};

// 페이지 크롤링 및 알림 전송
const sendNotification = async (totalNewPosts) => {
    const message = `${totalNewPosts}개 확인`;
    for (const chatId of CHAT_IDS) { // CHAT_IDS 배열 순회
        try {
            await bot.sendMessage(chatId, message);
            console.log(`${new Date().toLocaleString()}: ${chatId}에 메시지 전송 완료`);
        } catch (error) {
            console.error(`${new Date().toLocaleString()}: ${chatId}로 메시지 전송 실패 - ${error.message}`);
        }
    }
};

// 게시물 스크래핑
const scrapePosts = async (page) => {
    // 페이지 요청
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // 게시물 정보 추출
    const posts = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('li.list-item'));
        return items.map(item => {
            const downloadCount = parseInt(item.querySelector('.wr-down').innerText.trim());
            const authorName = item.querySelector('.member').innerText.trim();
            return { downloadCount, authorName };
        });
    });

    return posts;
};

// setTimeout으로 90초 대기 및 랜덤 대기 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const isWithinBlockedHours = () => {
    const now = new Date();
    const currentHour = now.getHours(); // 현재 시각 (0~23)
    return currentHour >= 23 || currentHour < 1; // 오후 11시부터 오전 1시까지
};

const main = async () => {
    const browser = await puppeteer.launch({
        executablePath: puppeteer.executablePath(),
        headless: true
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 950 });

    let firstRun = true;

    while (true) {
        try {
            // 작동 제한 시간 확인
            if (isWithinBlockedHours()) {
                console.log(`${new Date().toLocaleString()}: 제한 시간 (오후 11시~오전 1시). 10분 후 재확인.`);
                await sleep(10 * 60 * 1000); // 10분 대기
                continue;
            }

            console.log(`${new Date().toLocaleString()}: 스크래핑 시작`);

            // 게시물 크롤링
            const posts = await scrapePosts(page);

            let authorPostCount = {};
            let totalNewPosts = 0;

            for (const post of posts) {
                if (post.downloadCount > 0) {
                    if (!authorPostCount[post.authorName]) {
                        authorPostCount[post.authorName] = 0;
                    }
                    authorPostCount[post.authorName] += 1;
                }
            }

            // 새로운 게시물 계산
            for (const author in authorPostCount) {
                const currentCount = authorPostCount[author];
                const previousCount = previousPostCount[author] || 0;

                if (currentCount > previousCount) {
                    const newPosts = currentCount - previousCount;
                    totalNewPosts += newPosts;
                }
            }

            // 새로운 게시물이 있을 때만 알림 전송
            if (totalNewPosts > 0) {
                await sendNotification(totalNewPosts);
            } else {
                console.log(`${new Date().toLocaleString()}: 새로운 게시물이 없습니다.`);
            }

            previousPostCount = { ...authorPostCount };
            firstRun = false;

            const waitTime = randomDelay(80000, 90000);
            console.log(`${new Date().toLocaleString()}: ${waitTime / 1000}초 대기`);
            await sleep(waitTime);

        } catch (error) {
            console.error(`${new Date().toLocaleString()}: 오류 발생 - ${error}`);
            console.log(`${new Date().toLocaleString()}: 90초 후 재시도`);
            await sleep(90000);
        }
    }
};

main();


//pushd E:\work\auto_download
//node rabbit_board_alert.js
//https://newtoki467.com/toki_bl