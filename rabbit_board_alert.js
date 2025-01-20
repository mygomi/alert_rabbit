const puppeteer = require('puppeteer');
const telegram = require('node-telegram-bot-api');

// 텔레그램 설정
const TELEGRAM_TOKEN = '7535947506:AAHdq2uK_gQZ4CClZ2ScJCX4UiFCtSCs2fM';
const CHAT_ID = '6130424486';
const bot = new telegram(TELEGRAM_TOKEN, { polling: true });

// 사이트 URL
const url = 'https://newtoki467.com/toki_bl';

// 이전 게시물 카운트
let previousPostCount = {};

// 페이지 크롤링 및 알림 전송
const sendNotification = async (totalNewPosts) => {
    const message = `${totalNewPosts}개 확인`;
    await bot.sendMessage(CHAT_ID, message);
    console.log(`${new Date().toISOString()}: 메시지 전송 완료`);
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

const main = async () => {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: '/opt/render/.cache/puppeteer/chrome/linux-132.0.6834.83/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

    const page = await browser.newPage();

    // 화면 크기 설정
    await page.setViewport({ width: 1920, height: 1080 });

    let firstRun = true;

    while (true) {
        try {
            console.log(`${new Date().toISOString()}: 스크래핑 시작`);

            // 게시물 크롤링
            const posts = await scrapePosts(page);

            // 작성자별 게시물 카운트
            let authorPostCount = {};
            let totalNewPosts = 0;
            const newAuthors = new Set();

            for (const post of posts) {
                if (post.downloadCount > 0) {
                    if (!authorPostCount[post.authorName]) {
                        authorPostCount[post.authorName] = 0;
                    }
                    authorPostCount[post.authorName] += 1;
                    newAuthors.add(post.authorName);
                }
            }

            // 새로운 게시물 카운트 계산
            for (const author of newAuthors) {
                const currentCount = authorPostCount[author];
                const previousCount = previousPostCount[author] || 0;

                if (currentCount > previousCount) {
                    const newPosts = currentCount - previousCount;
                    totalNewPosts += newPosts;
                }
            }

            // 첫 실행이 아닌 경우 이전 상태 업데이트
            if (!firstRun) {
                for (const author in previousPostCount) {
                    if (!newAuthors.has(author) && previousPostCount[author] === 0) {
                        if (authorPostCount[author] > 0) {
                            totalNewPosts += authorPostCount[author];
                        }
                    }
                }
            }

            if (totalNewPosts > 0) {
                await sendNotification(totalNewPosts);
            }

            // 이전 상태 업데이트
            previousPostCount = { ...authorPostCount };
            firstRun = false;

            // 원래 80~90초 간격으로 대기
            const waitTime = randomDelay(80000, 90000);
            console.log(`${new Date().toISOString()}: ${waitTime / 1000}초 대기`);
            await sleep(waitTime);

        } catch (error) {
            console.error(`${new Date().toISOString()}: 오류 발생 - ${error}`);
            console.log(`${new Date().toISOString()}: 90초 후 재시도`);
            await sleep(90000);  // 오류 발생 시 90초 대기 후 재시도
        }
    }
};

main();