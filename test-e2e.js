/**
 * 任务管家 E2E 复测脚本
 * 使用系统 Edge 浏览器，无需下载 Chromium
 * 运行：cd task-manager-h5 && node test-e2e.js
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:8080';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe', ['start.py'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    proc.stdout.on('data', data => {
      const line = data.toString();
      if (line.includes('服务已启动') || line.includes('访问地址')) {
        setTimeout(() => resolve(proc), 800);
      }
    });
    proc.stderr.on('data', data => {
      // ignore
    });
    setTimeout(() => resolve(proc), 2000); // fallback
  });
}

function log(step, ok, detail = '') {
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${step}${detail ? ' | ' + detail : ''}`);
}

async function run() {
  console.log('启动任务管家 E2E 复测...\n');

  const server = await startServer();
  console.log('本地服务器已启动\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE_PATH
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let passed = 0;
  let failed = 0;

  try {
    // 1. 首页加载
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.locator('.auth-title, .header-title').first().textContent().catch(() => '');
    const loaded = title.includes('任务管家') || await page.locator('#login-account').count() > 0;
    log('页面加载', loaded, title);
    if (loaded) passed++; else failed++;

    // 2. 注册
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    const phone = `138${String(timestamp).slice(-8)}`;
    const password = 'Test1234';

    await page.click('[data-tab="register"]');
    await page.fill('#reg-email', email);
    await page.fill('#reg-phone', phone);
    await page.fill('#reg-password', password);
    await page.fill('#reg-password2', password);
    await page.click('#btn-register');
    await page.waitForTimeout(1200);

    const calendarVisible = await page.locator('#calendar-grid').count() > 0;
    log('注册并登录', calendarVisible, email);
    if (calendarVisible) passed++; else failed++;

    // 4. 创建任务
    await page.click('#btn-add-task');
    await page.fill('#task-title', '复测任务');
    await page.fill('#task-content', '这是一条用于复测的任务');
    await page.fill('#task-date', new Date().toISOString().slice(0, 10));
    await page.selectOption('#task-category', '工作');
    await page.click('#btn-save-task');
    await page.waitForTimeout(600);

    const taskVisible = await page.locator('.task-title:has-text("复测任务")').count() > 0;
    log('创建任务', taskVisible);
    if (taskVisible) passed++; else failed++;

    // 5. 日历标记检查
    const coloredCell = await page.locator('.calendar-day.level-medium, .calendar-day.level-high').count();
    log('日历任务标记', coloredCell > 0, `标记格子数: ${coloredCell}`);
    if (coloredCell > 0) passed++; else failed++;

    // 6. 切换列表页
    await page.click('[data-nav="list"]');
    await page.waitForTimeout(400);
    const listTask = await page.locator('.task-title:has-text("复测任务")').count() > 0;
    log('列表页显示任务', listTask);
    if (listTask) passed++; else failed++;

    // 7. 搜索功能
    await page.fill('#list-search', '复测');
    await page.waitForTimeout(400);
    const searchResult = await page.locator('.task-title:has-text("复测任务")').count() > 0;
    log('搜索任务', searchResult);
    if (searchResult) passed++; else failed++;

    // 8. 删除任务（进回收站）
    await page.locator('.task-title:has-text("复测任务")').click();
    await page.waitForTimeout(400);
    await page.click('#btn-edit-task');
    await page.waitForTimeout(300);
    page.on('dialog', async dialog => await dialog.accept());
    await page.click('#btn-delete-task');
    await page.waitForTimeout(600);
    const modalClosed = await page.locator('.modal-overlay').count() === 0;
    const deleted = modalClosed && (await page.locator('#calendar-grid .task-title:has-text("复测任务")').count() === 0);
    log('删除任务', deleted);
    if (deleted) passed++; else failed++;

    // 9. 统计页
    await page.click('[data-nav="stats"]');
    await page.waitForTimeout(500);
    const statsVisible = await page.locator('#stats-container .card').count() > 0;
    log('统计页加载', statsVisible);
    if (statsVisible) passed++; else failed++;

    // 10. 我的页
    await page.click('[data-nav="profile"]');
    await page.waitForTimeout(400);
    const profileVisible = await page.locator('#btn-save-profile').count() > 0;
    log('我的页加载', profileVisible);
    if (profileVisible) passed++; else failed++;

  } catch (e) {
    console.error('测试异常:', e.message);
    failed++;
  } finally {
    await context.close();
    await browser.close();
    server.kill();
  }

  console.log(`\n复测结果：通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
