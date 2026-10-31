const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const HTML_PATH = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');

async function runQATestSuite() {
  console.log('================================================================');
  console.log('QA AUDIT TEST SUITE: CREATOR COMMAND CENTER (Musk-Dashboard)');
  console.log('Target:', HTML_PATH);
  console.log('Date:', new Date().toISOString());
  console.log('================================================================\n');

  const testResults = [];

  function recordResult(acId, name, passed, details) {
    testResults.push({ acId, name, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${mark}] ${acId}: ${name}`);
    if (details) {
      console.log(`       Details: ${details}`);
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files']
  });

  const page = await browser.newPage();

  // Capture page console logs & page errors
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  try {
    // -------------------------------------------------------------
    // AC-01: File chạy độc lập, cú pháp JS hợp lệ, không lỗi console lúc khởi động
    // -------------------------------------------------------------
    console.log('--- Testing AC-01: Standalone Execution & Syntax ---');
    await page.goto(HTML_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const title = await page.title();
    const hasFatalErrors = pageErrors.length > 0;
    const isStandalone = title.includes('Creator Command Center');

    recordResult(
      'AC-01',
      'Standalone Single-File Execution & Syntax Validity',
      isStandalone && !hasFatalErrors,
      `Title: "${title}", Page Errors: ${pageErrors.length}`
    );

    // -------------------------------------------------------------
    // AC-02 & AC-03: Time-blocking 7 blocks (08:30 - 16:30); Timer Start/Pause/Reset
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-02 & AC-03: Timeline & Deep Work Timer ---');
    const timeBlocksCount = await page.locator('#timelineGrid > div').count();
    const timelineData = await page.evaluate(() => {
      return state.timeBlocks.map(b => ({
        id: b.id,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        type: b.type,
        breakMinutes: b.breakMinutes,
        breakRange: b.breakRange,
        isLunchAfter: b.isLunchAfter
      }));
    });

    const is7BlocksSchedule = timelineData.length === 7 &&
      timelineData[0].startTime === '08:30' &&
      timelineData[6].endTime === '16:30';

    recordResult(
      'AC-02',
      'Timeline 7 Executive Blocks (08:30 - 12:20 & 13:30 - 16:30)',
      is7BlocksSchedule && timeBlocksCount === 7,
      `Blocks Count: ${timeBlocksCount}, Span: ${timelineData[0]?.startTime} to ${timelineData[6]?.endTime}`
    );

    // Test Timer Start, Pause, Reset and Header Sync
    const initialHeaderText = await page.locator('#headerDeepWork').innerText();
    const initialStatsMinutes = await page.evaluate(() => state.stats.deepWorkMinutes);

    // Start timer
    await page.click('#timerToggleBtn');
    await page.waitForTimeout(2100); // Wait 2.1 seconds
    const runningTimerText = await page.locator('#timerDisplay').innerText();
    const runningStatsMinutes = await page.evaluate(() => state.stats.deepWorkMinutes);

    // Pause timer
    await page.click('#timerToggleBtn');
    await page.waitForTimeout(300);
    const isPaused = await page.evaluate(() => !state.timer.isRunning);

    // Reset timer
    await page.locator('button[title="Reset đồng hồ"]').click();
    await page.waitForTimeout(200);
    const resetTimerText = await page.locator('#timerDisplay').innerText();

    const timerPassed = runningTimerText !== '00:00:00' &&
      runningStatsMinutes > initialStatsMinutes &&
      isPaused &&
      resetTimerText === '00:00:00';

    recordResult(
      'AC-03',
      'Timer Start/Pause/Reset updates Deep Work Hours in Realtime',
      timerPassed,
      `Initial Header: "${initialHeaderText}", Running Display: "${runningTimerText}", Reset Display: "${resetTimerText}"`
    );

    // -------------------------------------------------------------
    // AC-04: SINGLE FOCUS WIP limit = 1
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-04: Single Focus WIP Limit = 1 ---');
    const singleCardsCount = await page.locator('#col-single > div').count();
    const singleBadgeText = await page.locator('#badge-single').innerText();

    // Test programmatic enforcement in handleSaveCard
    const singleLimitCheck = await page.evaluate(() => {
      // Current count in single
      const currentInSingle = state.cards.filter(c => c.column === 'single').length;
      // Try to validate WIP limit logic
      const existingSingle = state.cards.filter(c => c.column === 'single');
      return { currentInSingle, hasEnforcement: existingSingle.length >= 1 };
    });

    // Test creating 2nd card directly into single column
    await page.evaluate(() => {
      // Mock toast capture
      window.lastToast = null;
      const origShowToast = window.showToast;
      window.showToast = (msg, type) => {
        window.lastToast = { msg, type };
        origShowToast(msg, type);
      };
      
      openCardModal();
      document.getElementById('cardFormTitle').value = "Card Vi Phạm Single Focus";
      document.getElementById('cardFormPlatform').value = "youtube";
      document.getElementById('cardFormColumn').value = "single";
      document.getElementById('cardFormFirstPrinciple').value = "Nguyên lý kiểm thử WIP limit";
      document.getElementById('cardForm').dispatchEvent(new Event('submit'));
    });

    const singleWipBlocked = await page.evaluate(() => {
      const isBlocked = window.lastToast && window.lastToast.msg.includes('Single Focus');
      const inSingle = state.cards.filter(c => c.column === 'single').length;
      closeCardModal();
      return { isBlocked, inSingle };
    });

    recordResult(
      'AC-04',
      'SINGLE FOCUS WIP Limit = 1 Enforced & Blocks 2nd Card',
      singleCardsCount === 1 && singleLimitCheck.currentInSingle === 1 && singleWipBlocked.isBlocked && singleWipBlocked.inSingle === 1,
      `Rendered: ${singleCardsCount}, Badge: "${singleBadgeText}", 2nd Card Blocked: ${singleWipBlocked.isBlocked}`
    );

    // -------------------------------------------------------------
    // AC-05: DEEP WORK WIP limit = 3
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-05: Deep Work WIP Limit = 3 ---');
    const deepCardsCount = await page.locator('#col-deep > div').count();
    const deepBadgeText = await page.locator('#badge-deep').innerText();

    // Fill deep column to 3 cards
    await page.evaluate(() => {
      // Add 1 more to reach 3 in deep work
      state.cards.push({
        id: 'test-deep-3',
        title: 'Card Deep Work 3',
        platform: 'youtube',
        column: 'deep',
        first_principle: 'Test deep principle 3',
        goal: 'test',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      saveCards();
      renderKanbanBoard();
    });

    const countAt3 = await page.locator('#col-deep > div').count();
    const badgeAt3 = await page.locator('#badge-deep').innerText();

    // Now try to create a 4th card in deep
    await page.evaluate(() => {
      openCardModal();
      document.getElementById('cardFormTitle').value = "Card Vi Phạm Deep Work (4th)";
      document.getElementById('cardFormPlatform').value = "youtube";
      document.getElementById('cardFormColumn').value = "deep";
      document.getElementById('cardFormFirstPrinciple').value = "Nguyên lý kiểm thử Deep Work WIP limit";
      document.getElementById('cardForm').dispatchEvent(new Event('submit'));
    });

    const deepWipBlocked = await page.evaluate(() => {
      const isBlocked = window.lastToast && window.lastToast.msg.includes('Deep Work đã đạt giới hạn 3 cards');
      const inDeep = state.cards.filter(c => c.column === 'deep').length;
      closeCardModal();
      return { isBlocked, inDeep };
    });

    recordResult(
      'AC-05',
      'DEEP WORK WIP Limit = 3 Enforced & Blocks 4th Card',
      countAt3 === 3 && deepWipBlocked.isBlocked && deepWipBlocked.inDeep === 3,
      `Deep Count at 3: ${countAt3}, Badge at 3: "${badgeAt3}", 4th Card Blocked: ${deepWipBlocked.isBlocked}`
    );

    // -------------------------------------------------------------
    // AC-06: Chặn tạo card nếu thiếu First Principle
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-06: Mandatory First Principle Rule ---');
    await page.evaluate(() => {
      openCardModal();
      document.getElementById('cardFormTitle').value = "Card Không Có First Principle";
      document.getElementById('cardFormPlatform').value = "youtube";
      document.getElementById('cardFormColumn').value = "ideas";
      document.getElementById('cardFormFirstPrinciple').value = "   "; // Whitespace only
      document.getElementById('cardForm').dispatchEvent(new Event('submit'));
    });

    const firstPrincipleBlocked = await page.evaluate(() => {
      const toast = window.lastToast;
      const isBlocked = toast && toast.msg.includes('First Principle');
      const cardExists = state.cards.some(c => c.title === "Card Không Có First Principle");
      closeCardModal();
      return { isBlocked, cardExists };
    });

    recordResult(
      'AC-06',
      'Mandatory First Principle Validation Blocks Empty/Whitespace',
      firstPrincipleBlocked.isBlocked && !firstPrincipleBlocked.cardExists,
      `Blocked: ${firstPrincipleBlocked.isBlocked}, Card Exists: ${firstPrincipleBlocked.cardExists}`
    );

    // -------------------------------------------------------------
    // AC-07 & AC-08: Intercept Drag/Drop BLOCKED & DONE; Escape to revert
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-07: BLOCKED Intercept Modal & Escape Key ---');
    // Simulate drop into blocked
    await page.evaluate(() => {
      const card = state.cards.find(c => c.column === 'ideas');
      state.pendingMove = {
        cardId: card.id,
        targetCol: 'blocked',
        sourceCol: 'ideas',
        itemEl: document.querySelector(`[data-id="${card.id}"]`)
      };
      openBlockedModal(card);
    });

    const blockedModalVisible = await page.locator('#blockedModal').isVisible();

    // Test Escape key reverts
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const blockedModalClosedOnEsc = !(await page.locator('#blockedModal').isVisible());
    const pendingMoveCleared = await page.evaluate(() => state.pendingMove === null);

    // Test Valid Submission to BLOCKED
    await page.evaluate(() => {
      const card = state.cards.find(c => c.column === 'ideas');
      state.pendingMove = {
        cardId: card.id,
        targetCol: 'blocked',
        sourceCol: 'ideas',
        itemEl: null
      };
      openBlockedModal(card);
      document.getElementById('blockedModalOwner').value = 'Senior Editor Duy';
      document.getElementById('blockedModalETA').value = '2026-11-03 18:00';
      document.querySelector('#blockedModal form').dispatchEvent(new Event('submit'));
    });

    const blockedSubmissionSuccess = await page.evaluate(() => {
      const card = state.cards.find(c => c.owner === 'Senior Editor Duy');
      return card && card.column === 'blocked' && card.eta === '2026-11-03 18:00';
    });

    recordResult(
      'AC-07',
      'BLOCKED Intercept Modal (Owner + ETA Required, Esc to Revert)',
      blockedModalVisible && blockedModalClosedOnEsc && pendingMoveCleared && blockedSubmissionSuccess,
      `Modal Visible: ${blockedModalVisible}, Esc Closed: ${blockedModalClosedOnEsc}, Submission Success: ${blockedSubmissionSuccess}`
    );

    console.log('\n--- Testing AC-08: DONE Intercept Modal (Learned Insight Required) ---');
    // Simulate drop into done
    await page.evaluate(() => {
      const card = state.cards.find(c => c.column === 'ideas');
      state.pendingMove = {
        cardId: card.id,
        targetCol: 'done',
        sourceCol: 'ideas',
        itemEl: null
      };
      openDoneModal(card);
    });

    const doneModalVisible = await page.locator('#doneModal').isVisible();

    // Test cancel / escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const doneModalClosedOnEsc = !(await page.locator('#doneModal').isVisible());

    // Test Valid Submission with Learned
    await page.evaluate(() => {
      const card = state.cards.find(c => c.column === 'ideas');
      state.pendingMove = {
        cardId: card.id,
        targetCol: 'done',
        sourceCol: 'ideas',
        itemEl: null
      };
      openDoneModal(card);
      document.getElementById('doneModalLearned').value = 'Hook phản trực giác tăng CTR lên 35% trong 48h đầu';
      document.querySelector('#doneModal form').dispatchEvent(new Event('submit'));
    });

    const doneSubmissionSuccess = await page.evaluate(() => {
      const card = state.cards.find(c => c.learned && c.learned.includes('Hook phản trực giác'));
      return card && card.column === 'done';
    });

    recordResult(
      'AC-08',
      'DONE Intercept Modal (Learned Insight Required, Esc to Revert)',
      doneModalVisible && doneModalClosedOnEsc && doneSubmissionSuccess,
      `Modal Visible: ${doneModalVisible}, Esc Closed: ${doneModalClosedOnEsc}, Card Moved to Done: ${doneSubmissionSuccess}`
    );

    // -------------------------------------------------------------
    // AC-09: Thẻ CTR < 2% tự động gắn cảnh báo đỏ và gợi ý Delete/Repurpose
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-09: Low CTR Badge & Cull Suggestion ---');
    const lowCtrCards = await page.locator('#col-delete [data-action="cull"]').count();
    const hasLowCtrBadgeText = await page.locator('#col-delete').innerHTML();
    const containsCtrWarning = hasLowCtrBadgeText.includes('CTR LOW:');

    // Test clicking Cull suggestion
    await page.locator('#col-delete [data-action="cull"]').first().click();
    await page.waitForTimeout(800);

    const chatHistoryAfterCull = await page.evaluate(() => {
      return state.chatHistory.map(h => ({ role: h.role, text: h.text }));
    });

    const cullTriggeredAI = chatHistoryAfterCull.some(h =>
      h.role === 'assistant' && (h.text.includes('PHÁN QUYẾT XÓA BỎ') || h.text.includes('ELON MUSK'))
    );

    recordResult(
      'AC-09',
      'Low CTR (< 2.0%) Warning Badge & Cull Suggestion Trigger',
      lowCtrCards > 0 && containsCtrWarning && cullTriggeredAI,
      `Low CTR Badges Found: ${lowCtrCards}, Contains Warning: ${containsCtrWarning}, Cull AI Response: ${cullTriggeredAI}`
    );

    // -------------------------------------------------------------
    // AC-10: Cấu hình Gemini API và 5 Quick Action Engines hoạt động
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-10: Gemini API Configuration & 5 Quick Engines ---');
    // Check Settings Modal
    await page.locator('button[title="Cài đặt API Key & AI Provider"]').click();
    const settingsModalVisible = await page.locator('#settingsModal').isVisible();
    const providerSelectVal = await page.locator('#settingsProvider').inputValue();
    const modelInputVal = await page.locator('#settingsModel').inputValue();
    await page.locator('button:has-text("Đóng")').click();

    // Test each of the 5 quick actions with heuristic fallback
    const quickActions = [
      { key: 'hook', expectedInReply: 'HOOKS PHÁ VỠ KHUÔN MẪU' },
      { key: 'breakdown', expectedInReply: 'SCRIPT BREAKDOWN' },
      { key: 'delete_advisor', expectedInReply: 'PHÁN QUYẾT XÓA BỎ' },
      { key: 'repurpose', expectedInReply: 'TÁI CHẾ NỘI DUNG' },
      { key: 'tester', expectedInReply: 'FIRST PRINCIPLES' }
    ];

    let all5ActionsPassed = true;
    for (const action of quickActions) {
      await page.evaluate((aKey) => {
        triggerQuickAction(aKey);
      }, action.key);
      await page.waitForTimeout(700);

      const latestMsg = await page.evaluate(() => {
        const last = state.chatHistory[state.chatHistory.length - 1];
        return last ? last.text : '';
      });

      const matched = latestMsg.includes(action.expectedInReply);
      if (!matched) {
        all5ActionsPassed = false;
        console.log(`       Quick Action '${action.key}' failed check. Reply: ${latestMsg.slice(0, 80)}...`);
      }
    }

    recordResult(
      'AC-10',
      'Gemini API Settings & 5 Quick Action Engines with Local Fallback',
      settingsModalVisible && providerSelectVal === 'gemini' && all5ActionsPassed,
      `Settings Modal: ${settingsModalVisible}, Default Model: "${modelInputVal}", All 5 Engines Succeeded: ${all5ActionsPassed}`
    );

    // -------------------------------------------------------------
    // AC-11: Export JSON hoạt động an toàn
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-11: Export Data JSON ---');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button[title="Export dữ liệu sao lưu ra JSON"]').click()
    ]);

    const downloadPath = await download.path();
    const exportedRaw = fs.readFileSync(downloadPath, 'utf8');
    const exportedJSON = JSON.parse(exportedRaw);

    const isExportValid = (exportedJSON.version === '2.0' || exportedJSON.version === '2.1') &&
      Array.isArray(exportedJSON.cards) &&
      exportedJSON.cards.length > 0 &&
      Array.isArray(exportedJSON.timeBlocks) &&
      exportedJSON.timeBlocks.length === 7 &&
      typeof exportedJSON.stats === 'object';

    recordResult(
      'AC-11',
      'Export JSON (Full Schema: Cards, TimeBlocks, Stats, Settings)',
      isExportValid,
      `Exported Cards: ${exportedJSON.cards.length}, TimeBlocks: ${exportedJSON.timeBlocks.length}, Version: ${exportedJSON.version}`
    );

    // -------------------------------------------------------------
    // AC-12: Import JSON hoạt động an toàn và có Schema Validation
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-12: Import JSON with Strict Schema Validation ---');
    // Test 1: Corrupted / Invalid Schema should be REJECTED
    const invalidPayload = {
      version: '2.0',
      cards: [
        { id: '', title: '', column: 'invalid_column' } // Invalid card
      ]
    };
    const invalidTempPath = path.resolve(__dirname, 'temp_invalid.json');
    fs.writeFileSync(invalidTempPath, JSON.stringify(invalidPayload));

    await page.setInputFiles('#importFileInput', invalidTempPath);
    await page.waitForTimeout(300);

    const rejectedInvalid = await page.evaluate(() => {
      const toast = window.lastToast;
      return toast && toast.type === 'error' && toast.msg.includes('Từ chối Import');
    });

    // Test 2: Valid Import Restores 100% Data
    const validImportPayload = {
      version: '2.0',
      cards: [
        {
          id: 'imported-card-1',
          title: 'Khôi phục từ file Backup An Toàn',
          platform: 'youtube',
          column: 'single',
          first_principle: 'Định luật bảo toàn dữ liệu',
          goal: '100% restore rate',
          metrics: { ctr: 5.5, views: 50000, retention: 55.0 }
        }
      ],
      timeBlocks: timelineData,
      stats: { deepWorkMinutes: 300, tasksDeletedCount: 10 }
    };

    const validTempPath = path.resolve(__dirname, 'temp_valid.json');
    fs.writeFileSync(validTempPath, JSON.stringify(validImportPayload));

    await page.setInputFiles('#importFileInput', validTempPath);
    await page.waitForTimeout(500);

    const restoreSuccess = await page.evaluate(() => {
      const card = state.cards.find(c => c.id === 'imported-card-1');
      const headerHours = document.getElementById('headerDeepWork').innerText;
      const headerDeleted = document.getElementById('headerTasksDeleted').innerText;
      return {
        cardFound: !!card,
        cardTitle: card ? card.title : null,
        headerHours,
        headerDeleted,
        cardCount: state.cards.length
      };
    });

    // Clean up temporary test files
    if (fs.existsSync(invalidTempPath)) fs.unlinkSync(invalidTempPath);
    if (fs.existsSync(validTempPath)) fs.unlinkSync(validTempPath);

    const ac12Passed = rejectedInvalid && restoreSuccess.cardFound && restoreSuccess.cardCount === 1;

    recordResult(
      'AC-12',
      'Import JSON with Strict Schema Validation & 100% State Recovery',
      ac12Passed,
      `Rejected Invalid: ${rejectedInvalid}, Restored Card: "${restoreSuccess.cardTitle}", Deep Work Header: "${restoreSuccess.headerHours}"`
    );

    // -------------------------------------------------------------
    // AC-13: Ngôn ngữ thiết kế Apple HIG (Dark/Light mode, SF Pro, Frosted Glass, Squircle, Hairline)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-13: Apple HIG Design Language & Theme Switcher ---');
    // Check typography, font stacks and tailwind configuration
    const designTokens = await page.evaluate(() => {
      const tailwindFonts = tailwind.config.theme.extend.fontFamily;
      const lightVariantPlugin = tailwind.config.plugins.length > 0;
      const htmlClasses = document.documentElement.className;
      return { tailwindFonts, lightVariantPlugin, htmlClasses };
    });

    const hasSFProFont = designTokens.tailwindFonts.sans.includes('"SF Pro Display"') ||
      designTokens.tailwindFonts.sans.includes('-apple-system');

    // Toggle theme to Light mode
    await page.locator('button[title="Chuyển chế độ Sáng / Tối"]').click();
    await page.waitForTimeout(300);

    const lightModeState = await page.evaluate(() => {
      const isHtmlLight = document.documentElement.classList.contains('light');
      const isHtmlNotDark = !document.documentElement.classList.contains('dark');
      const moonVisible = !document.getElementById('moonIcon').classList.contains('hidden');
      const sunHidden = document.getElementById('sunIcon').classList.contains('hidden');
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      return { isHtmlLight, isHtmlNotDark, moonVisible, sunHidden, bodyBg };
    });

    // Toggle theme back to Dark mode
    await page.locator('button[title="Chuyển chế độ Sáng / Tối"]').click();
    await page.waitForTimeout(300);

    const darkModeState = await page.evaluate(() => {
      const isHtmlDark = document.documentElement.classList.contains('dark');
      const sunVisible = !document.getElementById('sunIcon').classList.contains('hidden');
      return { isHtmlDark, sunVisible };
    });

    // Check Apple HIG Elements: Glassmorphism, Hairlines, Squircle borders
    const higClassesCheck = await page.evaluate(() => {
      const hasGlassCard = document.querySelectorAll('.glass-card').length > 0;
      const hasGlassHeader = document.querySelectorAll('.glass-header').length > 0;
      const hasRounded2xl = document.querySelectorAll('.rounded-2xl').length > 0;
      const hasRounded3xl = document.querySelectorAll('.rounded-3xl').length > 0;
      const hasRoundedFull = document.querySelectorAll('.rounded-full').length > 0;
      const hasSegmented = document.querySelectorAll('.platform-filter-btn').length > 0;
      return {
        hasGlassCard,
        hasGlassHeader,
        hasRounded2xl,
        hasRounded3xl,
        hasRoundedFull,
        hasSegmented
      };
    });

    const higPassed = hasSFProFont &&
      designTokens.lightVariantPlugin &&
      lightModeState.isHtmlLight &&
      darkModeState.isHtmlDark &&
      higClassesCheck.hasGlassCard &&
      higClassesCheck.hasGlassHeader &&
      higClassesCheck.hasRounded2xl &&
      higClassesCheck.hasRounded3xl &&
      higClassesCheck.hasSegmented;

    recordResult(
      'AC-13',
      'Apple HIG Design (SF Pro Stack, Dark/Light Mode, Squircle, Frosted Glass, Hairlines)',
      higPassed,
      `SF Pro: ${hasSFProFont}, Light Variant: ${designTokens.lightVariantPlugin}, Light Mode: ${lightModeState.isHtmlLight}, Dark Mode: ${darkModeState.isHtmlDark}, Glass Classes: ${higClassesCheck.hasGlassCard}`
    );

    // -------------------------------------------------------------
    // AC-14: Song ngữ Việt - Anh (Bilingual VI/EN) với Language Selector trong Cài đặt
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-14: Bilingual VI/EN Support & Settings Language Selector ---');
    // Open Settings Modal
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);

    const settingsVisible = await page.locator('#settingsModal').isVisible();
    const langViBtnVisible = await page.locator('#langBtnVi').isVisible();
    const langEnBtnVisible = await page.locator('#langBtnEn').isVisible();

    // 1. Switch to English
    await page.locator('#langBtnEn').click();
    await page.waitForTimeout(300);

    // Verify DOM updates to English immediately
    const enState = await page.evaluate(() => {
      const htmlLang = document.documentElement.lang;
      const addCardText = document.getElementById('headerAddCardText')?.innerText;
      const timelineTitle = document.getElementById('timelineTitle')?.innerText;
      const kanbanTitle = document.getElementById('kanbanTitle')?.innerText;
      const colIdeasDesc = document.getElementById('col-ideas-desc')?.innerText;
      const copilotTitle = document.getElementById('copilotTitle')?.innerText;
      const inputPlaceholder = document.getElementById('aiPromptInput')?.getAttribute('placeholder');
      const closeBtnText = document.getElementById('settingsCloseBtn')?.innerText;
      const savedSettings = JSON.parse(localStorage.getItem('ccc_settings_v2') || '{}');
      return {
        htmlLang,
        addCardText,
        timelineTitle,
        kanbanTitle,
        colIdeasDesc,
        copilotTitle,
        inputPlaceholder,
        closeBtnText,
        persistedLang: savedSettings.language
      };
    });

    const enValid = enState.htmlLang === 'en' &&
      enState.addCardText === 'Add Card' &&
      enState.timelineTitle.toLowerCase().includes('level 1') &&
      enState.kanbanTitle.toLowerCase().includes('level 2') &&
      enState.colIdeasDesc.includes('First Principle Required') &&
      enState.copilotTitle.toLowerCase().includes('musk ai copilot') &&
      enState.closeBtnText === 'Close' &&
      enState.persistedLang === 'en';

    // 2. Switch back to Vietnamese
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);

    // Verify DOM updates back to Vietnamese
    const viState = await page.evaluate(() => {
      const htmlLang = document.documentElement.lang;
      const addCardText = document.getElementById('headerAddCardText')?.innerText;
      const timelineTitle = document.getElementById('timelineTitle')?.innerText;
      const kanbanTitle = document.getElementById('kanbanTitle')?.innerText;
      const colIdeasDesc = document.getElementById('col-ideas-desc')?.innerText;
      const closeBtnText = document.getElementById('settingsCloseBtn')?.innerText;
      const savedSettings = JSON.parse(localStorage.getItem('ccc_settings_v2') || '{}');
      return {
        htmlLang,
        addCardText,
        timelineTitle,
        kanbanTitle,
        colIdeasDesc,
        closeBtnText,
        persistedLang: savedSettings.language
      };
    });

    const viValid = viState.htmlLang === 'vi' &&
      viState.addCardText === 'Thêm Card' &&
      viState.timelineTitle.toLowerCase().includes('tầng 1') &&
      viState.kanbanTitle.toLowerCase().includes('tầng 2') &&
      viState.colIdeasDesc.includes('Bắt buộc First Principle') &&
      viState.closeBtnText === 'Đóng' &&
      viState.persistedLang === 'vi';

    // Close Settings Modal
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const ac14Passed = settingsVisible && langViBtnVisible && langEnBtnVisible && enValid && viValid;

    recordResult(
      'AC-14',
      'Bilingual VI/EN Support (Language Selector in Settings Modal, Instant UI Translation, LocalStorage Persistence)',
      ac14Passed,
      `EN: [Lang: ${enState.htmlLang}, AddCard: "${enState.addCardText}", CloseBtn: "${enState.closeBtnText}"], VI: [Lang: ${viState.htmlLang}, AddCard: "${viState.addCardText}", CloseBtn: "${viState.closeBtnText}"]`
    );

    // -------------------------------------------------------------
    // AC-15: Dynamic Google Fonts Typography (Be Vietnam Pro for VI, Inter for EN)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-15: Dynamic Google Fonts Typography ---');

    // 1. Verify Google Fonts preconnect and stylesheet links exist in <head>
    const fontLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link')).map(l => ({
        rel: l.getAttribute('rel'),
        href: l.getAttribute('href') || '',
        crossorigin: l.getAttribute('crossorigin')
      }));
      const hasPreconnectGoogle = links.some(l => l.rel === 'preconnect' && l.href.includes('fonts.googleapis.com'));
      const hasPreconnectGstatic = links.some(l => l.rel === 'preconnect' && l.href.includes('fonts.gstatic.com'));
      const hasFontStylesheet = links.some(l => l.rel === 'stylesheet' && l.href.includes('Be+Vietnam+Pro') && l.href.includes('Inter'));
      const tailwindHasFontVar = tailwind.config.theme.extend.fontFamily.sans.includes('var(--font-primary)');
      return {
        hasPreconnectGoogle,
        hasPreconnectGstatic,
        hasFontStylesheet,
        tailwindHasFontVar
      };
    });

    // 2. Open Settings Modal and verify font switching dynamically
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);

    // Switch to Vietnamese
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);

    const viFontState = await page.evaluate(() => {
      const rootVar = document.documentElement.style.getPropertyValue('--font-primary');
      const bodyFont = window.getComputedStyle(document.body).fontFamily;
      return { rootVar, bodyFont };
    });

    const isViFontValid = viFontState.rootVar.includes('Be Vietnam Pro') &&
      viFontState.bodyFont.includes('Be Vietnam Pro');

    // Switch to English
    await page.locator('#langBtnEn').click();
    await page.waitForTimeout(300);

    const enFontState = await page.evaluate(() => {
      const rootVar = document.documentElement.style.getPropertyValue('--font-primary');
      const bodyFont = window.getComputedStyle(document.body).fontFamily;
      return { rootVar, bodyFont };
    });

    const isEnFontValid = enFontState.rootVar.includes('Inter') &&
      enFontState.bodyFont.includes('Inter');

    // Switch back to Vietnamese
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);

    const viRevertState = await page.evaluate(() => {
      const rootVar = document.documentElement.style.getPropertyValue('--font-primary');
      const bodyFont = window.getComputedStyle(document.body).fontFamily;
      return { rootVar, bodyFont };
    });

    const isViRevertValid = viRevertState.rootVar.includes('Be Vietnam Pro') &&
      viRevertState.bodyFont.includes('Be Vietnam Pro');

    // Close Settings Modal
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const ac15Passed = fontLinks.hasPreconnectGoogle &&
      fontLinks.hasPreconnectGstatic &&
      fontLinks.hasFontStylesheet &&
      fontLinks.tailwindHasFontVar &&
      isViFontValid &&
      isEnFontValid &&
      isViRevertValid;

    recordResult(
      'AC-15',
      'Dynamic Google Fonts Typography (Be Vietnam Pro for VI, Inter for EN, Realtime Switch without Reload)',
      ac15Passed,
      `Head Links: Google=${fontLinks.hasPreconnectGoogle}, Gstatic=${fontLinks.hasPreconnectGstatic}, CSS=${fontLinks.hasFontStylesheet}; VI Font: "${viFontState.bodyFont.slice(0, 35)}...", EN Font: "${enFontState.bodyFont.slice(0, 35)}..."`
    );

    // -------------------------------------------------------------
    // AC-16: Timeline Lịch Làm Việc Thực Tế & Cảnh Báo Block 60m
    // (08:30 - 12:20 & 13:30 - 16:30, 60m blocks + 5m breaks, chime + banner alert)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-16: Real-World Executive Schedule & 60m Alerts ---');
    
    // 1. Check morning & afternoon blocks structure
    const blocksEvaluation = await page.evaluate(() => {
      const b = state.timeBlocks;
      const morningValid = b[0].startTime === '08:30' && b[0].endTime === '09:30' && b[0].durationMinutes === 60 &&
                           b[1].startTime === '09:35' && b[1].endTime === '10:35' && b[1].durationMinutes === 60 &&
                           b[2].startTime === '10:40' && b[2].endTime === '11:40' && b[2].durationMinutes === 60 &&
                           b[3].startTime === '11:45' && b[3].endTime === '12:20' && b[3].durationMinutes === 35;
      const afternoonValid = b[4].startTime === '13:30' && b[4].endTime === '14:30' && b[4].durationMinutes === 60 &&
                             b[5].startTime === '14:35' && b[5].endTime === '15:35' && b[5].durationMinutes === 60 &&
                             b[6].startTime === '15:40' && b[6].endTime === '16:30' && b[6].durationMinutes === 50;
      return { morningValid, afternoonValid, total: b.length };
    });

    // 2. Check break badges in DOM
    const breakBadgesCount = await page.locator('.break-badge').count();

    // 3. Check Web Audio Chime and 60m alert banner
    const alertBannerInitialHidden = await page.evaluate(() => {
      const banner = document.getElementById('blockAlertBanner');
      return banner && banner.classList.contains('hidden');
    });

    // Trigger block completion alert
    await page.evaluate(() => {
      triggerBlockAlert('Test Deep Script 60m Block');
    });
    await page.waitForTimeout(300);

    const alertBannerVisible = await page.evaluate(() => {
      const banner = document.getElementById('blockAlertBanner');
      const title = document.getElementById('blockAlertTitle')?.innerText || '';
      const msg = document.getElementById('blockAlertMessage')?.innerText || '';
      return !banner.classList.contains('hidden') && msg.includes('60') && msg.includes('5');
    });

    // Dismiss alert banner
    await page.locator('#btnDismissBlockAlert').click();
    await page.waitForTimeout(300);

    const alertBannerDismissed = await page.evaluate(() => {
      const banner = document.getElementById('blockAlertBanner');
      return banner && banner.classList.contains('hidden');
    });

    const ac16Passed = blocksEvaluation.morningValid &&
      blocksEvaluation.afternoonValid &&
      blocksEvaluation.total === 7 &&
      breakBadgesCount >= 5 &&
      alertBannerInitialHidden &&
      alertBannerVisible &&
      alertBannerDismissed;

    recordResult(
      'AC-16',
      'Timeline Executive Working Hours (08:30-12:20 & 13:30-16:30, 60m Blocks, 5m Breaks & Web Audio/Banner Alert)',
      ac16Passed,
      `Morning: ${blocksEvaluation.morningValid}, Afternoon: ${blocksEvaluation.afternoonValid}, Breaks Badges: ${breakBadgesCount}, Alert Banner Functional: ${alertBannerVisible && alertBannerDismissed}`
    );

    // -------------------------------------------------------------
    // AC-17: Musk First Principles Handbook (5-Step Algorithm) in Settings Modal (Bilingual VI/EN)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-17: Musk First Principles Handbook in Settings ---');
    
    // Open Settings Modal
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);

    // Click Handbook tab
    await page.locator('#tabBtnHandbook').click();
    await page.waitForTimeout(300);

    const isHandbookTabActive = await page.evaluate(() => {
      const tab = document.getElementById('settingsTabHandbook');
      return tab && !tab.classList.contains('hidden');
    });

    // Verify 5 steps and Creator tips in Vietnamese
    const viHandbookState = await page.evaluate(() => {
      return {
        step1: document.getElementById('handbookStep1Title')?.innerText || '',
        step2: document.getElementById('handbookStep2Title')?.innerText || '',
        step3: document.getElementById('handbookStep3Title')?.innerText || '',
        step4: document.getElementById('handbookStep4Title')?.innerText || '',
        step5: document.getElementById('handbookStep5Title')?.innerText || '',
        step1Tip: document.getElementById('handbookStep1Tip')?.innerText || '',
        step2Tip: document.getElementById('handbookStep2Tip')?.innerText || ''
      };
    });

    const isViHandbookValid = viHandbookState.step1.includes('Đặt câu hỏi') &&
      viHandbookState.step2.includes('Xóa bỏ') &&
      viHandbookState.step3.includes('Đơn giản hóa') &&
      viHandbookState.step4.includes('Tăng tốc') &&
      viHandbookState.step5.includes('Tự động hóa') &&
      viHandbookState.step1Tip.includes('Mẹo Creator');

    // Switch to English and check English translation
    await page.locator('#tabBtnApi').click();
    await page.waitForTimeout(200);
    await page.locator('#langBtnEn').click();
    await page.waitForTimeout(300);
    await page.locator('#tabBtnHandbook').click();
    await page.waitForTimeout(200);

    const enHandbookState = await page.evaluate(() => {
      return {
        step1: document.getElementById('handbookStep1Title')?.innerText || '',
        step2: document.getElementById('handbookStep2Title')?.innerText || '',
        step3: document.getElementById('handbookStep3Title')?.innerText || '',
        step4: document.getElementById('handbookStep4Title')?.innerText || '',
        step5: document.getElementById('handbookStep5Title')?.innerText || '',
        step1Tip: document.getElementById('handbookStep1Tip')?.innerText || ''
      };
    });

    const isEnHandbookValid = enHandbookState.step1.includes('Question Every Requirement') &&
      enHandbookState.step2.includes('Delete Any Part') &&
      enHandbookState.step3.includes('Simplify & Single Focus') &&
      enHandbookState.step4.includes('Accelerate Cycle Time') &&
      enHandbookState.step5.includes('Automate') &&
      enHandbookState.step1Tip.includes('Creator Tip');

    // Switch back to Vietnamese
    await page.locator('#tabBtnApi').click();
    await page.waitForTimeout(200);
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);

    const ac17Passed = isHandbookTabActive && isViHandbookValid && isEnHandbookValid;

    recordResult(
      'AC-17',
      'Musk First Principles Handbook (5-Step Algorithm with Creator Tips & Bilingual VI/EN)',
      ac17Passed,
      `Tab Active: ${isHandbookTabActive}, VI Verified: ${isViHandbookValid}, EN Verified: ${isEnHandbookValid}`
    );

    // -------------------------------------------------------------
    // AC-18: Meta Fanpage Integration (Auto-load Đặt Sân Nhanh, Masked Token, Graph API Test)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-18: Meta Fanpage Integration ---');
    
    // Switch to Fanpage tab
    await page.locator('#tabBtnFanpage').click();
    await page.waitForTimeout(300);

    const fanpageState = await page.evaluate(() => {
      const tab = document.getElementById('settingsTabFanpage');
      const isVisible = tab && !tab.classList.contains('hidden');
      const pageName = document.getElementById('settingsFbPageName')?.value || '';
      const pageId = document.getElementById('settingsFbPageId')?.value || '';
      const token = document.getElementById('settingsFbToken')?.value || '';
      const tokenPreview = document.getElementById('fbTokenPreview')?.innerText || '';
      const badge = document.getElementById('fbConnectedBadge')?.innerText || '';
      const tokenInputType = document.getElementById('settingsFbToken')?.type || '';
      return { isVisible, pageName, pageId, token, tokenPreview, badge, tokenInputType };
    });

    const isAutoLoadedValid = fanpageState.isVisible &&
      fanpageState.pageName === 'Đặt Sân Nhanh' &&
      fanpageState.pageId === '1234257116429910' &&
      fanpageState.token.startsWith('EAALZAoxk') &&
      fanpageState.token.endsWith('CS3wt') &&
      fanpageState.tokenPreview.includes('EAALZAoxk') &&
      fanpageState.tokenPreview.includes('CS3wt') &&
      fanpageState.badge.includes('Đặt Sân Nhanh') &&
      fanpageState.badge.includes('1234257116429910') &&
      fanpageState.tokenInputType === 'password';

    // Test token visibility toggle
    await page.locator('#btnToggleFbTokenMask').click();
    await page.waitForTimeout(200);
    const tokenTypeAfterToggle = await page.evaluate(() => document.getElementById('settingsFbToken')?.type);
    await page.locator('#btnToggleFbTokenMask').click(); // toggle back
    await page.waitForTimeout(200);

    // Test Fanpage Connection button
    await page.locator('#btnTestFanpage').click();
    await page.waitForFunction(() => {
      const text = document.getElementById('fbConnectionStatus')?.innerText || '';
      return !text.includes('Đang kết nối') && text.length > 0;
    }, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(200);

    const connectionStatusText = await page.locator('#fbConnectionStatus').innerText();
    const isConnectionSuccess = connectionStatusText.includes('✅') &&
      (connectionStatusText.includes('Token hợp lệ') || connectionStatusText.includes('Graph API OK'));

    // Close Settings Modal
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const ac18Passed = isAutoLoadedValid &&
      tokenTypeAfterToggle === 'text' &&
      isConnectionSuccess;

    recordResult(
      'AC-18',
      'Meta Fanpage Integration (Auto-load Đặt Sân Nhanh, ID 1234257116429910, Masked Token & Test Connection)',
      ac18Passed,
      `Auto-loaded: ${isAutoLoadedValid}, Mask Toggle: ${tokenTypeAfterToggle === 'text'}, Connection Status: "${connectionStatusText}"`
    );

    // -------------------------------------------------------------
    // AC-19: Column Header Contextual Guidance (Centralized in 6 Column Headers, Minimal Task Items)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-19: Column Header Contextual Guidance (Bilingual VI/EN) ---');

    // Step 1: Verify task cards are clean - NO hint buttons or boxes inside individual cards
    const totalCards = await page.locator('#kanbanContainer [data-id], .kanban-dropzone > [data-id]').count();
    const taskHintButtonsCount = await page.locator('.card-hint-btn, .kanban-dropzone [data-action="toggle-hint"]').count();
    const taskHintBoxesCount = await page.locator('.card-hint-box, .kanban-dropzone .card-hint-box').count();
    const isTaskItemsClean = totalCards > 0 && taskHintButtonsCount === 0 && taskHintBoxesCount === 0;

    // Step 2: Verify presence of exactly 6 column hint buttons and 6 column hint boxes at column headers
    const colHintButtonsCount = await page.locator('.col-hint-btn, [data-action="toggle-col-hint"]').count();
    const colHintBoxesCount = await page.locator('.col-hint-box').count();
    const has6ColHints = colHintButtonsCount === 6 && colHintBoxesCount === 6;

    // All 6 hint boxes should be initially hidden
    const allInitiallyHidden = await page.evaluate(() => {
      const boxes = document.querySelectorAll('.col-hint-box');
      return boxes.length === 6 && Array.from(boxes).every(b => b.classList.contains('hidden'));
    });

    // Step 3: Test opening column hint on DELETE column
    const deleteHintBtn = page.locator('#col-hint-btn-delete');
    const deleteHintBox = page.locator('#col-hint-delete');

    await deleteHintBtn.click();
    await page.waitForTimeout(200);
    const openedVisible = await deleteHintBox.evaluate(el => !el.classList.contains('hidden'));

    // Verify content of Column Hint in Vietnamese
    const viPurposeText = await deleteHintBox.locator('.col-hint-purpose').innerText();
    const viHowText = await deleteHintBox.locator('.col-hint-how').innerText();
    const viHeaderTitle = await deleteHintBox.locator('.col-hint-header-text').innerText();

    const isViContentValid = viPurposeText.includes('Tác dụng') &&
      viHowText.includes('Cách hoạt động') &&
      viHeaderTitle.includes('Gợi ý');

    // Step 4: Test close button inside the column hint box
    const closeBtn = deleteHintBox.locator('[data-action="close-col-hint"]');
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await page.waitForTimeout(200);
    }
    const closedAfterCloseBtn = await deleteHintBox.evaluate(el => el.classList.contains('hidden'));

    // Step 5: Test Click-Outside to close column hint
    await deleteHintBtn.click();
    await page.waitForTimeout(200);
    const reopened = await deleteHintBox.evaluate(el => !el.classList.contains('hidden'));
    // Click outside (e.g. on kanban title)
    await page.locator('#kanbanTitle').click();
    await page.waitForTimeout(200);
    const closedAfterClickOutside = await deleteHintBox.evaluate(el => el.classList.contains('hidden'));

    // Step 6: Switch to English and verify bilingual column hint translation
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);
    await page.locator('#langBtnEn').click();
    await page.waitForTimeout(300);
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    // Open first column hint again in English
    await deleteHintBtn.click();
    await page.waitForTimeout(200);

    const enPurposeText = await deleteHintBox.locator('.col-hint-purpose').innerText();
    const enHowText = await deleteHintBox.locator('.col-hint-how').innerText();
    const enHeaderTitle = await deleteHintBox.locator('.col-hint-header-text').innerText();

    const isEnContentValid = enPurposeText.includes('Purpose') &&
      enHowText.includes('How it works') &&
      enHeaderTitle.includes('Guidance');

    // Close hint before switching back
    await page.locator('#kanbanTitle').click();
    await page.waitForTimeout(200);

    // Switch back to Vietnamese
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const ac19Passed = isTaskItemsClean &&
      has6ColHints &&
      allInitiallyHidden &&
      openedVisible &&
      closedAfterCloseBtn &&
      reopened &&
      closedAfterClickOutside &&
      isViContentValid &&
      isEnContentValid;

    recordResult(
      'AC-19',
      'Column Header Contextual Guidance (Centralized 6 Column Hints, Clean Task Items, Bilingual VI/EN, Toggle & Click-Outside)',
      ac19Passed,
      `TaskItemsClean: ${isTaskItemsClean} (TaskHintBtns: ${taskHintButtonsCount}), 6ColHints: ${has6ColHints}, Opened: ${openedVisible}, ClosedBtn: ${closedAfterCloseBtn}, ClickOutside: ${closedAfterClickOutside}, VI Valid: ${isViContentValid}, EN Valid: ${isEnContentValid}`
    );

    // -------------------------------------------------------------
    // AC-20: Timeline Schedule Editor Modal (Apple HIG, Add/Edit/Delete, Reset Defaults, Bilingual)
    // -------------------------------------------------------------
    console.log('\n--- Testing AC-20: Timeline Schedule Editor Modal ---');

    // Step 1: Open Schedule Modal via Button
    const editScheduleBtn = page.locator('#btnEditTimelineSchedule');
    const scheduleModal = page.locator('#scheduleModal');
    const isEditBtnVisible = await editScheduleBtn.isVisible();

    await editScheduleBtn.click();
    await page.waitForTimeout(300);
    const isModalOpened = await scheduleModal.evaluate(el => !el.classList.contains('hidden'));
    const initialRowsCount = await page.locator('#scheduleBlocksList [data-schedule-block-index]').count();

    // Step 2: Edit first block (Title and Duration) and Save
    const firstTitleInput = page.locator('#scheduleBlocksList [data-schedule-block-index="0"] .schedule-input-title');
    const firstDurationSelect = page.locator('#scheduleBlocksList [data-schedule-block-index="0"] .schedule-select-duration');

    await firstTitleInput.fill('Kế hoạch Vũ Trụ SpaceX v2');
    await firstDurationSelect.selectOption('90');
    await page.locator('#btnSaveSchedule').click();
    await page.waitForTimeout(400);

    const isModalClosedAfterSave = await scheduleModal.evaluate(el => el.classList.contains('hidden'));
    const renderedFirstTitle = await page.locator('#timelineGrid > div:first-child h4').innerText();
    const renderedFirstDuration = await page.locator('#timelineGrid > div:first-child').innerText();
    const storageBlocksStr = await page.evaluate(() => localStorage.getItem('ccc_timeblocks_v2'));
    const isStorageUpdated = storageBlocksStr && storageBlocksStr.includes('Kế hoạch Vũ Trụ SpaceX v2');

    const isEditSaved = renderedFirstTitle.includes('Kế hoạch Vũ Trụ SpaceX v2') &&
      renderedFirstDuration.includes('90m') &&
      isStorageUpdated;

    // Step 3: Add a new block (+ Thêm Block Mới)
    await editScheduleBtn.click();
    await page.waitForTimeout(300);
    await page.locator('#btnAddScheduleBlock').click();
    await page.waitForTimeout(200);

    const rowsCountAfterAdd = await page.locator('#scheduleBlocksList [data-schedule-block-index]').count();
    const lastRowIndex = rowsCountAfterAdd - 1;
    const lastTitleInput = page.locator(`#scheduleBlocksList [data-schedule-block-index="${lastRowIndex}"] .schedule-input-title`);
    const lastDurationSelect = page.locator(`#scheduleBlocksList [data-schedule-block-index="${lastRowIndex}"] .schedule-select-duration`);
    await lastTitleInput.fill('Block 8: Đêm Trăng Nghiên Cứu');
    await lastDurationSelect.selectOption('45');

    await page.locator('#btnSaveSchedule').click();
    await page.waitForTimeout(400);

    const timelineCardsCountAfterAdd = await page.locator('#timelineGrid > div').count();
    const isAddBlockSaved = rowsCountAfterAdd === 8 && timelineCardsCountAfterAdd === 8;

    // Step 4: Delete a block
    await editScheduleBtn.click();
    await page.waitForTimeout(300);
    const deleteBtnLast = page.locator(`#scheduleBlocksList [data-schedule-block-index="${lastRowIndex}"] .btn-delete-schedule-block`);
    await deleteBtnLast.click();
    await page.waitForTimeout(200);

    const rowsCountAfterDelete = await page.locator('#scheduleBlocksList [data-schedule-block-index]').count();
    await page.locator('#btnSaveSchedule').click();
    await page.waitForTimeout(400);

    const timelineCardsCountAfterDelete = await page.locator('#timelineGrid > div').count();
    const isDeleteBlockSaved = rowsCountAfterDelete === 7 && timelineCardsCountAfterDelete === 7;

    // Step 5: Reset to Default Schedule (Khôi phục lịch chuẩn của Sếp)
    await editScheduleBtn.click();
    await page.waitForTimeout(300);
    await page.locator('#btnResetScheduleDefault').click();
    await page.waitForTimeout(200);
    await page.locator('#btnSaveSchedule').click();
    await page.waitForTimeout(400);

    const resetTimelineData = await page.evaluate(() => {
      return {
        count: state.timeBlocks.length,
        firstTitle: state.timeBlocks[0].title,
        firstStart: state.timeBlocks[0].startTime,
        lastEnd: state.timeBlocks[6].endTime
      };
    });

    const isResetSuccess = resetTimelineData.count === 7 &&
      resetTimelineData.firstStart === '08:30' &&
      resetTimelineData.lastEnd === '16:30';

    // Step 6: Escape key to close Schedule Modal
    await editScheduleBtn.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const isClosedByEscape = await scheduleModal.evaluate(el => el.classList.contains('hidden'));

    // Step 7: Bilingual Support (English Translation Verification)
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);
    await page.locator('#langBtnEn').click();
    await page.waitForTimeout(300);
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const enBtnText = await editScheduleBtn.innerText();
    await editScheduleBtn.click();
    await page.waitForTimeout(300);

    const enModalTitle = await page.locator('#scheduleModalTitle').innerText();
    const enSaveBtn = await page.locator('#btnSaveSchedule').innerText();
    const enAddBtn = await page.locator('#btnAddScheduleBlock').innerText();
    const enResetBtn = await page.locator('#btnResetScheduleDefault').innerText();

    const isEnBilingualValid = enBtnText.includes('Edit Schedule') &&
      enModalTitle.toLowerCase().includes('schedule editor') &&
      enSaveBtn.includes('Save Schedule') &&
      enAddBtn.includes('Add New Block') &&
      enResetBtn.includes('Reset to Boss');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Switch back to Vietnamese
    await page.locator('#btnSettings').click();
    await page.waitForTimeout(300);
    await page.locator('#langBtnVi').click();
    await page.waitForTimeout(300);
    await page.locator('#settingsCloseBtn').click();
    await page.waitForTimeout(300);

    const viBtnText = await editScheduleBtn.innerText();
    const isViBilingualValid = viBtnText.includes('Tùy Chỉnh Lịch');

    const ac20Passed = isEditBtnVisible &&
      isModalOpened &&
      initialRowsCount === 7 &&
      isModalClosedAfterSave &&
      isEditSaved &&
      isAddBlockSaved &&
      isDeleteBlockSaved &&
      isResetSuccess &&
      isClosedByEscape &&
      isEnBilingualValid &&
      isViBilingualValid;

    recordResult(
      'AC-20',
      'Timeline Schedule Editor Modal (Apple HIG, Add/Edit/Delete, Reset Defaults, Bilingual VI/EN)',
      ac20Passed,
      `EditBtn: ${isEditBtnVisible}, ModalOpen: ${isModalOpened}, EditSaved: ${isEditSaved}, AddBlock: ${isAddBlockSaved}, DeleteBlock: ${isDeleteBlockSaved}, ResetDefault: ${isResetSuccess}, EscClose: ${isClosedByEscape}, EN: ${isEnBilingualValid}, VI: ${isViBilingualValid}`
    );

    // -------------------------------------------------------------
    // OVERALL SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('QA AUDIT SUMMARY & VERDICT:');
    console.log('================================================================');
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = testResults.filter(r => !r.passed).length;

    testResults.forEach(r => {
      const mark = r.passed ? 'PASS' : 'FAIL';
      console.log(`[${mark}] ${r.acId}: ${r.name}`);
    });

    console.log(`\nTotal: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
    const finalVerdict = failedTests === 0 ? 'PASS' : 'FAIL';
    console.log(`FINAL VERDICT: [${finalVerdict}]`);
    console.log('================================================================');

    if (failedTests > 0) {
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Unhandled QA test error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runQATestSuite();
