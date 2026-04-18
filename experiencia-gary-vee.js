(function () {
  const APP_DATA = window.GARY_APP_DATA;
  if (!APP_DATA || !Array.isArray(APP_DATA.chapters) || !APP_DATA.chapters.length) {
    console.error('Dados da experiencia nao carregados.');
    return;
  }

  const QUICK_EMAIL = 'dlrandrade@gmail.com';
  const QUICK_PASSWORD = '190221';

  const SUPABASE_URL = 'https://uxwzcoemwgwrtymsahxl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4d3pjb2Vtd2d3cnR5bXNhaHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njc3NTAsImV4cCI6MjA5MjA0Mzc1MH0.k9TWLEQ7YaMiUjEo_UFtzxxRcjY0AvTMwQOizWohCMc';

  const STORAGE_KEY = 'gary_vee_game_reader_v4';

  const badgesConfig = [
    { id: 'start', label: 'Primeiro passo', check: (s) => Object.keys(s.done).length >= 1 },
    { id: 'chapter10', label: '10 capitulos', check: (s) => Object.keys(s.done).length >= 10 },
    { id: 'chapter20', label: '20 capitulos', check: (s) => Object.keys(s.done).length >= 20 },
    { id: 'chapter30', label: 'Livro completo', check: (s) => Object.keys(s.done).length >= 30 },
    { id: 'streak3', label: 'Streak 3 dias', check: (s) => getStreak(s) >= 3 },
    { id: 'streak7', label: 'Streak 7 dias', check: (s) => getStreak(s) >= 7 },
    { id: 'flash10', label: 'Fixacao 10x', check: (s) => Object.keys(s.flashDone || {}).filter((k) => s.flashDone[k]).length >= 10 },
    { id: 'discipline', label: 'Sem atrasos', check: (s) => computeStatus(s).lag <= 0 }
  ];

  let selectedTheme = 'Todos';
  let selectedChapterId = '01';
  let appBooted = false;
  let focusMode = false;

  let supabaseClient = null;
  let cloudEnabled = false;
  let currentUser = null;
  let isHydratingCloud = false;
  let syncTimer = null;
  let toastCounter = 0;

  const state = loadState();
  selectedChapterId = String(state.selectedChapter || 1).padStart(2, '0');

  const el = {
    toastArea: byId('toastArea'),
    topProgress: byId('topProgress'),

    authShell: byId('authShell'),
    main: byId('main-content'),

    tabLogin: byId('tabLogin'),
    tabSignup: byId('tabSignup'),
    loginPane: byId('loginPane'),
    signupPane: byId('signupPane'),

    loginForm: byId('loginForm'),
    signupForm: byId('signupForm'),
    loginEmail: byId('loginEmail'),
    loginPassword: byId('loginPassword'),
    signupEmail: byId('signupEmail'),
    signupPassword: byId('signupPassword'),

    btnQuickFill: byId('btnQuickFill'),
    btnSignOut: byId('btnSignOut'),

    chipRow: byId('chipRow'),
    chapterList: byId('chapterList'),
    search: byId('searchChapter'),

    chapterBadge: byId('chapterBadge'),
    chapterTitle: byId('chapterTitle'),
    chapterTheme: byId('chapterTheme'),
    chapterType: byId('chapterType'),
    chapterLayer: byId('chapterLayer'),
    quotePt: byId('quotePt'),
    quoteEn: byId('quoteEn'),
    chapterLesson: byId('chapterLesson'),
    anchorText: byId('anchorText'),
    toolName: byId('toolName'),
    toolFormula: byId('toolFormula'),
    toolList: byId('toolList'),
    actionsList: byId('actionsList'),
    reflectionText: byId('reflectionText'),
    entityGrid: byId('entityGrid'),
    sourceText: byId('sourceText'),
    citeRange: byId('citeRange'),
    flashcards: byId('flashcards'),

    statChapters: byId('statChapters'),
    statDone: byId('statDone'),
    statStreak: byId('statStreak'),
    xpValue: byId('xpValue'),
    xpBar: byId('xpBar'),
    goalMonth: byId('goalMonth'),
    chapterTodayPill: byId('chapterTodayPill'),
    trailStatus: byId('trailStatus'),
    badgeGrid: byId('badgeGrid'),
    crossInsight: byId('crossInsight'),
    entityCount: byId('entityCount'),

    layoutMain: byId('layoutMain'),
    sideCol: document.querySelector('.side-col'),
    navCard: document.querySelector('.nav-card'),

    btnPrev: byId('btnPrev'),
    btnNext: byId('btnNext'),
    btnPrevMobile: byId('btnPrevMobile'),
    btnNextMobile: byId('btnNextMobile'),
    btnDoneMobile: byId('btnDoneMobile'),

    btnMarkDone: byId('btnMarkDone'),
    btnDoneBottom: byId('btnDoneBottom'),
    btnChapterToday: byId('btnChapterToday'),
    btnOpenShare: byId('btnOpenShare'),
    btnFocus: byId('btnFocus'),

    shareStudio: byId('shareStudio'),
    shareChapterSelect: byId('shareChapterSelect'),
    shareFormatSelect: byId('shareFormatSelect'),
    shareVariantSelect: byId('shareVariantSelect'),
    shareMainInput: byId('shareMainInput'),
    shareBodyInput: byId('shareBodyInput'),
    shareBodyInputB: byId('shareBodyInputB'),
    shareTagInput: byId('shareTagInput'),

    storyFrame: byId('storyFrame'),
    storyMain: byId('storyMain'),
    storyBodyA: byId('storyBodyA'),
    storyBodyB: byId('storyBodyB'),
    storyFooter: byId('storyFooter'),
    postCanvas: byId('postCanvas'),

    btnDownloadPost: byId('btnDownloadPost'),
    btnCopyCaption: byId('btnCopyCaption'),
    btnDailyShare: byId('btnDailyShare'),

    bookMockup: byId('bookMockup'),
    bookStage: byId('bookStage')
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function dateKey(d) {
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return iso.slice(0, 10);
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function defaultState() {
    return {
      startDate: todayKey(),
      done: {},
      logs: [],
      xp: 0,
      flashSeen: {},
      flashDone: {},
      selectedChapter: 1,
      lastSyncAt: null
    };
  }

  function loadState() {
    const fallback = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      const merged = Object.assign({}, fallback, parsed || {});
      merged.done = merged.done || {};
      merged.logs = Array.isArray(merged.logs) ? merged.logs : [];
      merged.flashSeen = merged.flashSeen || {};
      merged.flashDone = merged.flashDone || {};
      return merged;
    } catch {
      return fallback;
    }
  }

  function saveState(options) {
    const opts = options || {};
    state.selectedChapter = Number(selectedChapterId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (opts.queueCloud !== false) {
      queueCloudSave();
    }
  }

  function serializeState() {
    return {
      startDate: state.startDate,
      done: state.done,
      logs: state.logs,
      xp: state.xp,
      flashSeen: state.flashSeen,
      flashDone: state.flashDone,
      selectedChapter: Number(selectedChapterId),
      selectedTheme: selectedTheme
    };
  }

  function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return;

    state.startDate = typeof snapshot.startDate === 'string' ? snapshot.startDate : state.startDate;
    state.done = snapshot.done && typeof snapshot.done === 'object' ? snapshot.done : {};
    state.logs = Array.isArray(snapshot.logs) ? snapshot.logs : [];
    state.xp = Number(snapshot.xp) || 0;
    state.flashSeen = snapshot.flashSeen && typeof snapshot.flashSeen === 'object' ? snapshot.flashSeen : {};
    state.flashDone = snapshot.flashDone && typeof snapshot.flashDone === 'object' ? snapshot.flashDone : {};

    selectedTheme = typeof snapshot.selectedTheme === 'string' ? snapshot.selectedTheme : 'Todos';
    const chapterNum = Number(snapshot.selectedChapter || 1);
    selectedChapterId = String(chapterNum).padStart(2, '0');
  }

  function showToast(message, type) {
    if (!el.toastArea) return;
    const kind = type || 'success';
    toastCounter += 1;

    const node = document.createElement('div');
    node.className = 'toast ' + (kind === 'error' ? 'error' : 'success');
    node.setAttribute('role', 'status');
    node.textContent = message;
    node.dataset.toastId = String(toastCounter);
    el.toastArea.appendChild(node);

    window.setTimeout(() => {
      node.remove();
    }, 3400);
  }

  function daysBetween(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.max(Math.round((db - da) / 86400000), 0);
  }

  function getStreak(s) {
    const logs = Array.from(new Set((s.logs || []).map((x) => x.date))).sort();
    if (!logs.length) return 0;

    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = dateKey(cursor);
      if (logs.includes(key)) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function computeStatus(s) {
    const today = todayKey();
    const dayNumber = daysBetween(s.startDate, today) + 1;
    const expected = Math.min(dayNumber, APP_DATA.readingGoalDays);
    const completed = Object.keys(s.done).length;
    const lag = expected - completed;
    return { dayNumber, expected, completed, lag };
  }

  function chapterOfDay() {
    const status = computeStatus(state);
    const index = Math.min(status.dayNumber, APP_DATA.chapters.length);
    const fallback = APP_DATA.chapters[index - 1] || APP_DATA.chapters[APP_DATA.chapters.length - 1];
    const firstUndone = APP_DATA.chapters.find((chapter) => !state.done[chapter.id]);
    return firstUndone || fallback;
  }

  function getChapterById(id) {
    return APP_DATA.chapters.find((chapter) => chapter.id === id) || APP_DATA.chapters[0];
  }

  function setAuthTab(tab) {
    const isLogin = tab === 'login';
    el.tabLogin.classList.toggle('active', isLogin);
    el.tabSignup.classList.toggle('active', !isLogin);

    el.tabLogin.setAttribute('aria-selected', String(isLogin));
    el.tabSignup.setAttribute('aria-selected', String(!isLogin));

    el.loginPane.classList.toggle('is-hidden', !isLogin);
    el.signupPane.classList.toggle('is-hidden', isLogin);
  }

  function toggleAppShell(isAuthenticated) {
    el.authShell.classList.toggle('is-hidden', !!isAuthenticated);
    el.main.classList.toggle('is-hidden', !isAuthenticated);

    const mobileActions = document.querySelector('.mobile-actions');
    if (mobileActions) {
      mobileActions.classList.toggle('is-hidden', !isAuthenticated);
    }

    if (isAuthenticated) {
      document.body.setAttribute('data-auth', 'in');
    } else {
      document.body.setAttribute('data-auth', 'out');
    }
  }

  function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      showToast('Supabase SDK nao carregou. Funciona somente local.', 'error');
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      cloudEnabled = true;
    } catch (error) {
      console.error(error);
      showToast('Falha ao iniciar Supabase. Mantendo modo local.', 'error');
      cloudEnabled = false;
      return;
    }

    supabaseClient.auth.onAuthStateChange(async function (_event, session) {
      if (session && session.user) {
        await handleSignedIn(session.user);
      } else {
        currentUser = null;
        toggleAppShell(false);
      }
    });
  }

  async function restoreSession() {
    if (!cloudEnabled || !supabaseClient) {
      toggleAppShell(false);
      return;
    }

    const sessionResult = await supabaseClient.auth.getSession();
    const session = sessionResult.data ? sessionResult.data.session : null;
    if (session && session.user) {
      await handleSignedIn(session.user);
    } else {
      toggleAppShell(false);
    }
  }

  async function handleSignedIn(user) {
    currentUser = user;
    toggleAppShell(true);

    if (!appBooted) {
      bootApp();
    }

    await hydrateCloudState();
    renderAll();

    showToast('Sessao ativa para ' + user.email + '.', 'success');
  }

  async function hydrateCloudState() {
    if (!cloudEnabled || !currentUser || !supabaseClient) return;

    isHydratingCloud = true;
    try {
      const query = supabaseClient
        .from('reader_state')
        .select('data, selected_chapter, xp, start_date')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      const result = await query;
      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }

      if (result.data && result.data.data) {
        const cloudData = result.data.data;
        applySnapshot(cloudData);

        if (result.data.selected_chapter) {
          selectedChapterId = String(result.data.selected_chapter).padStart(2, '0');
        }
        if (result.data.start_date) {
          state.startDate = result.data.start_date;
        }
        if (typeof result.data.xp === 'number') {
          state.xp = result.data.xp;
        }

        saveState({ queueCloud: false });
        return;
      }

      await persistReaderSnapshot();
    } catch (error) {
      console.error(error);
      showToast('Nao foi possivel carregar progresso da nuvem.', 'error');
    } finally {
      isHydratingCloud = false;
    }
  }

  function queueCloudSave() {
    if (!cloudEnabled || !supabaseClient || !currentUser || isHydratingCloud) return;

    if (syncTimer) {
      window.clearTimeout(syncTimer);
    }

    syncTimer = window.setTimeout(function () {
      persistReaderSnapshot().catch(function (error) {
        console.error(error);
      });
    }, 500);
  }

  async function persistReaderSnapshot() {
    if (!cloudEnabled || !supabaseClient || !currentUser || isHydratingCloud) return;

    const payload = {
      user_id: currentUser.id,
      selected_chapter: Number(selectedChapterId),
      xp: state.xp,
      start_date: state.startDate,
      data: serializeState(),
      updated_at: new Date().toISOString()
    };

    const result = await supabaseClient
      .from('reader_state')
      .upsert(payload, { onConflict: 'user_id' });

    if (result.error) {
      throw result.error;
    }

    state.lastSyncAt = new Date().toISOString();
  }

  async function persistChapterCompletion(chapterId, awardedXp) {
    if (!cloudEnabled || !supabaseClient || !currentUser) return;

    const payload = {
      user_id: currentUser.id,
      chapter_id: chapterId,
      completed_at: new Date().toISOString(),
      xp_awarded: awardedXp
    };

    const result = await supabaseClient
      .from('reading_progress')
      .upsert(payload, { onConflict: 'user_id,chapter_id' });

    if (result.error) {
      throw result.error;
    }
  }

  async function persistFlashProgress(chapterId, seenArray) {
    if (!cloudEnabled || !supabaseClient || !currentUser) return;

    const payload = {
      user_id: currentUser.id,
      chapter_id: chapterId,
      seen: seenArray,
      all_done: seenArray.every(Boolean),
      updated_at: new Date().toISOString()
    };

    const result = await supabaseClient
      .from('flashcard_progress')
      .upsert(payload, { onConflict: 'user_id,chapter_id' });

    if (result.error) {
      throw result.error;
    }
  }

  async function persistShareExport(record) {
    if (!cloudEnabled || !supabaseClient || !currentUser) return;

    const payload = Object.assign(
      {
        user_id: currentUser.id,
        created_at: new Date().toISOString()
      },
      record
    );

    const result = await supabaseClient.from('share_exports').insert(payload);
    if (result.error) {
      throw result.error;
    }
  }

  function renderChips() {
    el.chipRow.innerHTML = '';

    APP_DATA.themes.forEach(function (theme) {
      const btn = document.createElement('button');
      btn.className = 'chip' + (theme === selectedTheme ? ' active' : '');
      btn.textContent = theme;

      btn.addEventListener('click', function () {
        selectedTheme = theme;
        renderChips();
        renderChapterList();
        saveState();
      });

      el.chipRow.appendChild(btn);
    });
  }

  function chapterVisible(chapter) {
    const query = el.search.value.trim().toLowerCase();
    const byTheme = selectedTheme === 'Todos' || chapter.theme === selectedTheme;
    if (!byTheme) return false;

    if (!query) return true;

    const text = [
      chapter.title,
      chapter.quotePt,
      chapter.theme,
      chapter.source,
      chapter.toolkit && chapter.toolkit.name ? chapter.toolkit.name : ''
    ]
      .join(' ')
      .toLowerCase();

    return text.includes(query);
  }

  function renderChapterList() {
    el.chapterList.innerHTML = '';

    APP_DATA.chapters.filter(chapterVisible).forEach(function (chapter) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.className = 'chapter-link' + (chapter.id === selectedChapterId ? ' active' : '');

      link.innerHTML =
        '<div class="link-topline"><span>Cap ' +
        chapter.id +
        '</span>' +
        (state.done[chapter.id] ? '<span class="tag-done">Concluido</span>' : '') +
        '</div><div class="link-title">' +
        chapter.title +
        '</div>';

      link.addEventListener('click', function (ev) {
        ev.preventDefault();
        setChapter(chapter.id);
      });

      li.appendChild(link);
      el.chapterList.appendChild(li);
    });
  }

  function renderFlashcards(chapter) {
    const key = chapter.id;

    const cards = [
      { q: 'Qual e a frase ancora deste capitulo?', a: chapter.anchor },
      { q: 'Qual acao pratica voce aplicaria hoje?', a: chapter.actions[0] || 'Executar 1 passo pratico ainda hoje.' },
      { q: 'Qual reflexao orienta sua decisao?', a: chapter.reflection }
    ];

    const seen = state.flashSeen[key] || [false, false, false];

    el.flashcards.innerHTML = cards
      .map(function (card, index) {
        return (
          '<article class="flash-card ' +
          (seen[index] ? 'flipped' : '') +
          '" data-i="' +
          index +
          '">' +
          '<div class="flash-inner">' +
          '<div class="flash-face flash-front">' +
          '<span class="flash-label">Fixacao ' +
          (index + 1) +
          '</span><p class="flash-text">' +
          card.q +
          '</p></div>' +
          '<div class="flash-face flash-back">' +
          '<span class="flash-label">Resposta</span><p class="flash-text">' +
          card.a +
          '</p></div>' +
          '</div></article>'
        );
      })
      .join('');

    Array.from(el.flashcards.querySelectorAll('.flash-card')).forEach(function (cardEl) {
      cardEl.addEventListener('click', function () {
        const idx = Number(cardEl.dataset.i);
        cardEl.classList.toggle('flipped');

        const arr = state.flashSeen[key] || [false, false, false];
        arr[idx] = true;
        state.flashSeen[key] = arr;

        if (arr.every(Boolean) && !state.flashDone[key]) {
          state.flashDone[key] = true;
          state.xp += 30;
          showToast('Bonus de fixacao: +30 XP.', 'success');
        }

        saveState();
        renderDashboard();

        persistFlashProgress(key, arr).catch(function (error) {
          console.error(error);
          showToast('Falha ao sincronizar card de fixacao.', 'error');
        });
      });
    });
  }

  function shareTemplateFor(chapter, variant) {
    if (variant === 'tool') {
      const toolkit = chapter.toolkit || { name: 'Tool', formula: '', how: [] };
      const steps = Array.isArray(toolkit.how) ? toolkit.how : [];

      return {
        main: 'Tool do capitulo: ' + toolkit.name,
        bodyA: toolkit.formula
          ? 'Formula: ' + toolkit.formula + '. Transforme teoria em acao com um passo por vez.'
          : 'Ferramenta pratica para executar o aprendizado hoje.',
        bodyB:
          steps.slice(0, 2).join(' | ') ||
          'Aplique agora, mensure e refine. Sem execucao, insight vira ruido.',
        footer: 'Fonte Gary Vee: ' + chapter.source.replace('Obra relacionada: ', '')
      };
    }

    return {
      main: chapter.quotePt,
      bodyA: chapter.lesson,
      bodyB: chapter.actions[0] || chapter.reflection,
      footer: 'Fonte Gary Vee: ' + chapter.source.replace('Obra relacionada: ', '')
    };
  }

  function ensureShareChapterOptions() {
    if (!el.shareChapterSelect || el.shareChapterSelect.options.length) return;

    el.shareChapterSelect.innerHTML = APP_DATA.chapters
      .map(function (chapter) {
        return '<option value="' + chapter.id + '">Cap. ' + chapter.id + ' - ' + chapter.title + '</option>';
      })
      .join('');
  }

  function applyShareTemplate(chapter, variant) {
    const tpl = shareTemplateFor(chapter, variant);

    el.shareMainInput.value = tpl.main;
    el.shareBodyInput.value = tpl.bodyA;
    el.shareBodyInputB.value = tpl.bodyB;
    el.shareTagInput.value = tpl.footer;

    updatePostPreview();
  }

  function bindShareForChapter(chapter, forceTemplate) {
    ensureShareChapterOptions();

    el.shareChapterSelect.value = chapter.id;
    if (forceTemplate !== false) {
      applyShareTemplate(chapter, el.shareVariantSelect.value);
    } else {
      updatePostPreview();
    }
  }

  function updatePostPreview() {
    const format = el.shareFormatSelect.value;
    el.storyFrame.dataset.format = format;

    el.storyMain.textContent = el.shareMainInput.value.trim();
    el.storyBodyA.textContent = el.shareBodyInput.value.trim();
    el.storyBodyB.textContent = el.shareBodyInputB.value.trim();
    el.storyFooter.textContent = el.shareTagInput.value.trim();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
      const probe = line ? line + ' ' + word : word;
      if (ctx.measureText(probe).width <= maxWidth) {
        line = probe;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
    return lines;
  }

  function drawParagraph(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = wrapText(ctx, text, maxWidth);
    lines.forEach(function (line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    });
    return y;
  }

  function postCaption() {
    return [
      el.shareMainInput.value.trim(),
      '',
      el.shareBodyInput.value.trim(),
      '',
      el.shareBodyInputB.value.trim(),
      '',
      el.shareTagInput.value.trim()
    ].join('\n');
  }

  async function downloadPostPng() {
    await document.fonts.ready;

    const format = el.shareFormatSelect.value;
    const variant = el.shareVariantSelect.value;
    const chapterId = el.shareChapterSelect.value;

    const dims = format === 'feed' ? { width: 1080, height: 1350 } : { width: 1080, height: 1920 };

    const canvas = el.postCanvas;
    canvas.width = dims.width;
    canvas.height = dims.height;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0b0e13');
    bg.addColorStop(0.5, '#10161f');
    bg.addColorStop(1, '#0a0f15');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glow1 = ctx.createRadialGradient(width * 0.84, height * 0.12, 10, width * 0.84, height * 0.12, 450);
    glow1.addColorStop(0, 'rgba(124,211,255,0.22)');
    glow1.addColorStop(1, 'rgba(124,211,255,0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(width * 0.14, height * 0.82, 20, width * 0.14, height * 0.82, 520);
    glow2.addColorStop(0, 'rgba(243,178,77,0.20)');
    glow2.addColorStop(1, 'rgba(243,178,77,0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    const blockW = Math.round(width * (format === 'feed' ? 0.74 : 0.72));
    const x = Math.round((width - blockW) / 2);

    const topMargin = format === 'feed' ? 190 : 250;
    const gapMainToBody = format === 'feed' ? 62 : 80;
    const gapBodyToFooter = format === 'feed' ? 54 : 72;

    let y = topMargin;

    ctx.fillStyle = '#ffffff';
    ctx.font = format === 'feed'
      ? '700 62px "Classic", "Archivo Black", sans-serif'
      : '700 66px "Classic", "Archivo Black", sans-serif';
    y = drawParagraph(ctx, el.shareMainInput.value.trim(), x, y, blockW, format === 'feed' ? 72 : 80);

    y += gapMainToBody;

    ctx.fillStyle = '#ede8df';
    ctx.font = format === 'feed'
      ? '600 50px "Literature", "Cormorant Garamond", serif'
      : '600 54px "Literature", "Cormorant Garamond", serif';
    y = drawParagraph(ctx, el.shareBodyInput.value.trim(), x, y, blockW, format === 'feed' ? 58 : 64);

    y += 40;
    y = drawParagraph(ctx, el.shareBodyInputB.value.trim(), x, y, blockW, format === 'feed' ? 58 : 64);

    y += gapBodyToFooter;

    ctx.fillStyle = '#c9c1b2';
    ctx.font = format === 'feed'
      ? '500 34px "Literature", "Cormorant Garamond", serif'
      : '500 40px "Literature", "Cormorant Garamond", serif';
    drawParagraph(ctx, el.shareTagInput.value.trim(), x, y, blockW, format === 'feed' ? 42 : 48);

    const link = document.createElement('a');
    link.download = 'gary-vee-capitulo-' + chapterId + '-' + variant + '-' + format + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Post exportado em PNG (' + format.toUpperCase() + ').', 'success');

    persistShareExport({
      chapter_id: chapterId,
      post_format: format,
      post_variant: variant,
      headline: el.shareMainInput.value.trim(),
      body_a: el.shareBodyInput.value.trim(),
      body_b: el.shareBodyInputB.value.trim(),
      footer: el.shareTagInput.value.trim(),
      caption: postCaption()
    }).catch(function (error) {
      console.error(error);
      showToast('Falha ao salvar historico de post.', 'error');
    });
  }

  async function copyCaption() {
    const caption = postCaption();
    try {
      await navigator.clipboard.writeText(caption);
      showToast('Legenda copiada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Nao foi possivel copiar automaticamente.', 'error');
    }
  }

  function renderChapter() {
    const chapter = getChapterById(selectedChapterId);
    const done = !!state.done[chapter.id];

    el.chapterBadge.textContent = 'Capitulo ' + chapter.id;
    el.chapterTitle.textContent = chapter.title;
    el.chapterTheme.textContent = chapter.theme;
    el.chapterType.textContent = chapter.analysisMeta ? chapter.analysisMeta.type : 'conceito';
    el.chapterLayer.textContent = chapter.analysisMeta ? 'camada L' + chapter.analysisMeta.layer : 'camada n/a';

    el.quotePt.textContent = '"' + chapter.quotePt + '"';
    el.quoteEn.textContent = chapter.quoteEn;
    el.chapterLesson.textContent = chapter.lesson;
    el.anchorText.textContent = chapter.anchor;

    const toolkit = chapter.toolkit || { name: 'Tool', type: '-', formula: '-', how: [] };
    el.toolName.textContent = toolkit.name + ' (' + toolkit.type + ')';
    el.toolFormula.textContent = toolkit.formula || '-';

    el.toolList.innerHTML = (toolkit.how || [])
      .map(function (step) {
        return '<li>' + step + '</li>';
      })
      .join('');

    el.actionsList.innerHTML = chapter.actions
      .map(function (action, idx) {
        return (
          '<article class="action-item"><span class="idx">' +
          (idx + 1) +
          '</span><div>' +
          action +
          '</div></article>'
        );
      })
      .join('');

    el.reflectionText.textContent = chapter.reflection;
    el.sourceText.textContent = chapter.source;
    el.citeRange.textContent = chapter.analysisMeta ? chapter.analysisMeta.start + '-' + chapter.analysisMeta.end : 'n/a';

    el.entityGrid.innerHTML = (chapter.relatedEntities || [])
      .map(function (entity) {
        const href = entity.path || '#';
        return (
          '<a class="entity-card" href="' +
          href +
          '" target="_blank" rel="noopener noreferrer">' +
          '<small>' +
          (entity.type || 'entity') +
          '</small><span>' +
          (entity.name || 'Entidade') +
          '</span></a>'
        );
      })
      .join('');

    el.btnMarkDone.textContent = done ? 'Concluido ✔' : 'Marcar capitulo como concluido';
    el.btnDoneBottom.textContent = done ? 'Capitulo ja concluido ✔' : 'Concluir capitulo + XP';
    el.btnDoneMobile.textContent = done ? 'Concluido ✔' : 'Concluir';

    renderFlashcards(chapter);
    bindShareForChapter(chapter, false);
    renderChapterList();

    saveState();
  }

  function renderDashboard() {
    const status = computeStatus(state);
    const streak = getStreak(state);

    el.statChapters.textContent = String(APP_DATA.chapters.length);
    el.statDone.textContent = String(status.completed);
    el.statStreak.textContent = String(streak);
    el.xpValue.textContent = String(state.xp) + ' XP';

    const progress = Math.min((status.completed / APP_DATA.chapters.length) * 100, 100);
    el.xpBar.style.width = progress + '%';

    el.goalMonth.textContent = status.completed + '/' + APP_DATA.readingGoalDays;
    el.chapterTodayPill.textContent = chapterOfDay().id;
    el.trailStatus.textContent = status.lag <= 0 ? 'No ritmo' : 'Atraso: ' + status.lag;

    el.crossInsight.textContent = String(APP_DATA.crossInsight || '')
      .replace(/# Cross-Book Insight:\s*/g, '')
      .replace(/##/g, '\n')
      .slice(0, 900);

    el.entityCount.textContent = String(APP_DATA.entitiesCount || 0);

    el.badgeGrid.innerHTML = badgesConfig
      .map(function (badge) {
        const unlocked = badge.check(state);
        return '<div class="badge ' + (unlocked ? 'unlocked' : '') + '">' + badge.label + '</div>';
      })
      .join('');
  }

  function renderAll() {
    renderChips();
    renderDashboard();
    renderChapterList();
    renderChapter();
    updatePostPreview();
  }

  function setChapter(id) {
    selectedChapterId = id;
    renderChapter();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function completeChapter(id) {
    if (state.done[id]) {
      showToast('Capitulo ja estava concluido.', 'success');
      return;
    }

    state.done[id] = true;
    state.xp += 120;
    state.logs.push({ chapterId: id, date: todayKey() });

    saveState();
    renderDashboard();
    renderChapterList();

    showToast('Capitulo concluido. +120 XP.', 'success');

    persistChapterCompletion(id, 120).catch(function (error) {
      console.error(error);
      showToast('Falha ao registrar conclusao na nuvem.', 'error');
    });

    const chapter = getChapterById(id);
    const nextUndone = APP_DATA.chapters.find(function (c) {
      return c.number > chapter.number && !state.done[c.id];
    });

    if (nextUndone) {
      setChapter(nextUndone.id);
    }
  }

  function toggleFocusMode() {
    focusMode = !focusMode;

    if (el.navCard) {
      el.navCard.classList.toggle('is-hidden', focusMode);
    }
    if (el.sideCol) {
      el.sideCol.classList.toggle('is-hidden', focusMode);
    }

    el.btnFocus.textContent = focusMode ? 'Sair do foco' : 'Modo foco';
    showToast(focusMode ? 'Modo foco ativado.' : 'Modo foco desativado.', 'success');
  }

  function trackScrollProgress() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    el.topProgress.style.width = pct + '%';
  }

  function bindBookMotion() {
    if (!el.bookStage || !el.bookMockup) return;

    el.bookStage.addEventListener('mousemove', function (ev) {
      const rect = el.bookStage.getBoundingClientRect();
      const px = (ev.clientX - rect.left) / rect.width;
      const py = (ev.clientY - rect.top) / rect.height;

      const rotateY = -30 + px * 16;
      const rotateX = 10 - py * 10;
      el.bookMockup.style.transform = 'rotateY(' + rotateY + 'deg) rotateX(' + rotateX + 'deg)';
    });

    el.bookStage.addEventListener('mouseleave', function () {
      el.bookMockup.style.transform = 'rotateY(-25deg) rotateX(7deg)';
    });
  }

  function setupReadingEvents() {
    el.search.addEventListener('input', renderChapterList);

    const goPrev = function () {
      const chapter = getChapterById(selectedChapterId);
      const prev = APP_DATA.chapters.find(function (c) {
        return c.number === chapter.number - 1;
      });
      if (prev) setChapter(prev.id);
    };

    const goNext = function () {
      const chapter = getChapterById(selectedChapterId);
      const next = APP_DATA.chapters.find(function (c) {
        return c.number === chapter.number + 1;
      });
      if (next) setChapter(next.id);
    };

    el.btnPrev.addEventListener('click', goPrev);
    el.btnNext.addEventListener('click', goNext);
    el.btnPrevMobile.addEventListener('click', goPrev);
    el.btnNextMobile.addEventListener('click', goNext);

    el.btnMarkDone.addEventListener('click', function () {
      completeChapter(selectedChapterId);
    });
    el.btnDoneBottom.addEventListener('click', function () {
      completeChapter(selectedChapterId);
    });
    el.btnDoneMobile.addEventListener('click', function () {
      completeChapter(selectedChapterId);
    });

    el.btnChapterToday.addEventListener('click', function () {
      setChapter(chapterOfDay().id);
    });

    el.btnOpenShare.addEventListener('click', function () {
      el.shareStudio.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    el.btnFocus.addEventListener('click', toggleFocusMode);

    el.shareChapterSelect.addEventListener('change', function () {
      const chapter = getChapterById(el.shareChapterSelect.value);
      bindShareForChapter(chapter, true);
    });

    el.shareVariantSelect.addEventListener('change', function () {
      const chapter = getChapterById(el.shareChapterSelect.value || selectedChapterId);
      bindShareForChapter(chapter, true);
    });

    el.shareFormatSelect.addEventListener('change', updatePostPreview);

    ['shareMainInput', 'shareBodyInput', 'shareBodyInputB', 'shareTagInput'].forEach(function (id) {
      const input = byId(id);
      input.addEventListener('input', updatePostPreview);
    });

    el.btnDownloadPost.addEventListener('click', downloadPostPng);
    el.btnCopyCaption.addEventListener('click', copyCaption);
    el.btnDailyShare.addEventListener('click', function () {
      const chapter = chapterOfDay();
      el.shareChapterSelect.value = chapter.id;
      bindShareForChapter(chapter, true);
      showToast('Template do capitulo do dia aplicado.', 'success');
    });

    window.addEventListener('scroll', trackScrollProgress, { passive: true });

    document.addEventListener('keydown', function (ev) {
      const key = ev.key.toLowerCase();
      if (key === 'n') goNext();
      if (key === 'p') goPrev();
      if (key === 'd') completeChapter(selectedChapterId);
    });

    bindBookMotion();
  }

  function setupAuthEvents() {
    el.tabLogin.addEventListener('click', function () {
      setAuthTab('login');
    });

    el.tabSignup.addEventListener('click', function () {
      setAuthTab('signup');
    });

    el.btnQuickFill.addEventListener('click', function () {
      el.loginEmail.value = QUICK_EMAIL;
      el.loginPassword.value = QUICK_PASSWORD;
      setAuthTab('login');
      showToast('Credenciais de acesso rapido preenchidas.', 'success');
    });

    el.loginForm.addEventListener('submit', async function (ev) {
      ev.preventDefault();

      if (!cloudEnabled || !supabaseClient) {
        showToast('Supabase indisponivel para login.', 'error');
        return;
      }

      const email = el.loginEmail.value.trim();
      const password = el.loginPassword.value;

      if (!email || !password) {
        showToast('Preencha e-mail e senha.', 'error');
        return;
      }

      const result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        showToast('Login falhou: ' + result.error.message, 'error');
        return;
      }

      showToast('Login realizado com sucesso.', 'success');
    });

    el.signupForm.addEventListener('submit', async function (ev) {
      ev.preventDefault();

      if (!cloudEnabled || !supabaseClient) {
        showToast('Supabase indisponivel para cadastro.', 'error');
        return;
      }

      const email = el.signupEmail.value.trim();
      const password = el.signupPassword.value;

      if (!email || !password) {
        showToast('Preencha e-mail e senha.', 'error');
        return;
      }

      if (password.length < 6) {
        showToast('Senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
      }

      const result = await supabaseClient.auth.signUp({ email: email, password: password });
      if (result.error) {
        showToast('Cadastro falhou: ' + result.error.message, 'error');
        return;
      }

      if (result.data && result.data.session) {
        showToast('Conta criada e autenticada.', 'success');
      } else {
        const loginResult = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (loginResult.error) {
          showToast('Conta criada. Tente login manual.', 'success');
        } else {
          showToast('Conta criada e autenticada.', 'success');
        }
      }
    });

    el.btnSignOut.addEventListener('click', async function () {
      if (!cloudEnabled || !supabaseClient) {
        toggleAppShell(false);
        showToast('Sessao local encerrada.', 'success');
        return;
      }

      const result = await supabaseClient.auth.signOut();
      if (result.error) {
        showToast('Erro ao sair: ' + result.error.message, 'error');
        return;
      }

      toggleAppShell(false);
      showToast('Voce saiu da sessao.', 'success');
    });
  }

  function bootApp() {
    if (appBooted) return;
    appBooted = true;

    setupReadingEvents();
    renderAll();
  }

  async function init() {
    setupAuthEvents();
    setAuthTab('login');

    initSupabase();
    await restoreSession();

    if (!cloudEnabled) {
      showToast('Modo local ativo. Login depende do Supabase.', 'error');
    }
  }

  init();
})();
