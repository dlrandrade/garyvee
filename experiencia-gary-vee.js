(function () {
  const APP_DATA = window.GARY_APP_DATA;
  if (!APP_DATA || !Array.isArray(APP_DATA.chapters) || !APP_DATA.chapters.length) {
    console.error('Dados da experiencia nao carregados.');
    return;
  }

  const STORAGE_KEY = 'gary_vee_game_reader_v5';
  const BOOK_CREDIT = '30 lições que aprendi... por @DanielLuzz';
  const FONT_DISPLAY = '"Outfit", "Inter", system-ui, sans-serif';
  const FONT_PROSE = '"EB Garamond", Georgia, "Times New Roman", serif';

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

  const runtimeConfig = {
    supabaseUrl: '',
    supabaseKey: ''
  };

  const state = loadState();
  selectedChapterId = String(state.selectedChapter || 1).padStart(2, '0');

  const el = {
    toastArea: byId('toastArea'),
    topProgress: byId('topProgress'),

    authShell: byId('authShell'),
    authTitle: byId('authTitle'),
    authSubtitle: byId('authSubtitle'),
    authForm: byId('authForm'),
    authEmail: byId('authEmail'),
    authPassword: byId('authPassword'),
    btnAuthSubmit: byId('btnAuthSubmit'),
    btnAuthToggle: byId('btnAuthToggle'),
    authSwitchLabel: byId('authSwitchLabel'),
    main: byId('main-content'),

    accountName: byId('accountName'),
    accountEmail: byId('accountEmail'),
    btnAccountMenu: byId('btnAccountMenu'),
    accountMenu: byId('accountMenu'),
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

    kpiDone: byId('kpiDone'),
    kpiStreak: byId('kpiStreak'),
    kpiXp: byId('kpiXp'),

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
    storyFooterBook: byId('storyFooterBook'),
    postCanvas: byId('postCanvas'),
    progressCanvas: byId('progressCanvas'),

    btnDownloadPost: byId('btnDownloadPost'),
    btnCopyCaption: byId('btnCopyCaption'),
    btnDailyShare: byId('btnDailyShare'),
    btnExportProgress: byId('btnExportProgress'),
    btnCopyProgress: byId('btnCopyProgress'),

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
      selectedTheme: 'Todos',
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
      merged.selectedTheme = merged.selectedTheme || 'Todos';
      return merged;
    } catch (_e) {
      return fallback;
    }
  }

  function saveState(options) {
    const opts = options || {};
    state.selectedChapter = Number(selectedChapterId);
    state.selectedTheme = selectedTheme;
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

    window.setTimeout(function () {
      node.remove();
    }, 3600);
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

  function compactText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function wordCount(text) {
    const clean = compactText(text);
    return clean ? clean.split(' ').length : 0;
  }

  function compressMeaning(text, targetWords) {
    const clean = compactText(text);
    if (!clean) return '';

    const words = clean.split(' ');
    if (words.length <= targetWords) return clean;

    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const out = [];
    let count = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
      if (!sentenceWords.length) continue;

      if (count + sentenceWords.length <= targetWords || out.length === 0) {
        out.push(sentence.trim());
        count += sentenceWords.length;
      }

      if (count >= targetWords) {
        break;
      }
    }

    if (out.length) return out.join(' ').replace(/\s+/g, ' ').trim();
    return words.slice(0, targetWords).join(' ').trim();
  }

  let authMode = 'login';

  function setAuthMode(mode) {
    authMode = mode === 'signup' ? 'signup' : 'login';
    const isLogin = authMode === 'login';

    el.authTitle.textContent = isLogin ? 'Entrar' : 'Criar conta';
    el.authSubtitle.textContent = isLogin
      ? 'Acesse para sincronizar seu progresso.'
      : 'Crie uma conta para salvar seu progresso na nuvem.';
    el.btnAuthSubmit.textContent = isLogin ? 'Entrar' : 'Criar conta';
    el.authPassword.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
    el.authSwitchLabel.textContent = isLogin ? 'Primeira vez?' : 'Já tem conta?';
    el.btnAuthToggle.textContent = isLogin ? 'Criar conta' : 'Entrar';
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
      closeAccountMenu();
    }
  }

  function closeAccountMenu() {
    if (!el.accountMenu || !el.btnAccountMenu) return;
    el.accountMenu.classList.add('is-hidden');
    el.btnAccountMenu.setAttribute('aria-expanded', 'false');
  }

  function toggleAccountMenu() {
    if (!el.accountMenu || !el.btnAccountMenu) return;
    const nextIsHidden = !el.accountMenu.classList.contains('is-hidden');
    if (nextIsHidden) {
      closeAccountMenu();
      return;
    }
    el.accountMenu.classList.remove('is-hidden');
    el.btnAccountMenu.setAttribute('aria-expanded', 'true');
  }

  async function getRuntimeConfig() {
    const fallback = window.__APP_CONFIG__ || {};
    let fromApi = {};

    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) {
        fromApi = await res.json();
      }
    } catch (_error) {
      fromApi = {};
    }

    const supabaseUrl =
      fromApi.supabaseUrl ||
      fromApi.NEXT_PUBLIC_SUPABASE_URL ||
      fallback.supabaseUrl ||
      fallback.NEXT_PUBLIC_SUPABASE_URL ||
      '';

    const supabaseKey =
      fromApi.supabasePublishableKey ||
      fromApi.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      fromApi.supabaseAnonKey ||
      fromApi.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      fallback.supabasePublishableKey ||
      fallback.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      fallback.supabaseAnonKey ||
      fallback.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '';

    runtimeConfig.supabaseUrl = String(supabaseUrl || '').trim();
    runtimeConfig.supabaseKey = String(supabaseKey || '').trim();
  }

  function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      showToast('SDK do Supabase nao carregado.', 'error');
      return;
    }

    if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseKey) {
      showToast('Variaveis do Supabase ausentes na Vercel.', 'error');
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      cloudEnabled = true;
    } catch (error) {
      console.error(error);
      showToast('Falha ao iniciar Supabase.', 'error');
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

  function userDisplayName(user) {
    if (!user) return 'Leitor';

    if (user.user_metadata && typeof user.user_metadata.full_name === 'string' && user.user_metadata.full_name.trim()) {
      return user.user_metadata.full_name.trim();
    }

    const email = user.email || '';
    if (!email.includes('@')) return email || 'Leitor';
    const namePart = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
    return namePart ? namePart.replace(/\b\w/g, (c) => c.toUpperCase()) : email;
  }

  function updateAccountUi(user) {
    if (!user) return;

    el.accountName.textContent = userDisplayName(user);
    el.accountEmail.textContent = user.email || 'Sem e-mail';
  }

  async function handleSignedIn(user) {
    currentUser = user;
    updateAccountUi(user);
    toggleAppShell(true);

    if (!appBooted) {
      bootApp();
    }

    await hydrateCloudState();
    renderAll();

    showToast('Sessao ativa para ' + (user.email || 'usuario') + '.', 'success');
  }

  async function hydrateCloudState() {
    if (!cloudEnabled || !currentUser || !supabaseClient) return;

    isHydratingCloud = true;
    try {
      const result = await supabaseClient
        .from('reader_state')
        .select('data, selected_chapter, xp, start_date')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }

      if (result.data && result.data.data) {
        applySnapshot(result.data.data);

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
      showToast('Falha ao carregar progresso em nuvem.', 'error');
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
    }, 560);
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
    const sourceLabel = 'Fonte Gary Vee: ' + String(chapter.source || '').replace('Obra relacionada: ', '').trim();

    if (variant === 'tool') {
      const toolkit = chapter.toolkit || { name: 'Ferramenta', formula: '', how: [] };
      const steps = Array.isArray(toolkit.how) ? toolkit.how : [];

      return {
        main: compactText(toolkit.name || chapter.title),
        bodyA: toolkit.formula
          ? compressMeaning('Formula: ' + toolkit.formula + '. Execute com consistencia e ajuste semanal.', 20)
          : compressMeaning('Aplique a ferramenta do capitulo agora e transforme teoria em resultado.', 20),
        bodyB: compressMeaning(steps.slice(0, 2).join(' | ') || chapter.actions[0] || chapter.reflection, 20),
        footer: sourceLabel
      };
    }

    return {
      main: compactText(chapter.quotePt),
      bodyA: compressMeaning(chapter.lesson, 24),
      bodyB: compressMeaning('Acao de hoje: ' + (chapter.actions[0] || chapter.reflection), 20),
      footer: sourceLabel
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

    if (forceTemplate) {
      applyShareTemplate(chapter, el.shareVariantSelect.value);
    } else {
      updatePostPreview();
    }
  }

  function updatePostPreview() {
    const format = el.shareFormatSelect.value;
    el.storyFrame.dataset.format = format;

    el.storyMain.textContent = String(el.shareMainInput.value || '').trim();
    el.storyBodyA.textContent = String(el.shareBodyInput.value || '').trim();
    el.storyBodyB.textContent = String(el.shareBodyInputB.value || '').trim();
    el.storyFooter.textContent = String(el.shareTagInput.value || '').trim();
    el.storyFooterBook.textContent = BOOK_CREDIT;
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

  function drawWithLetterSpacing(ctx, text, x, y, spacing) {
    let cursor = x;
    for (const char of String(text || '')) {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + spacing;
    }
  }

  function postCaption() {
    return [
      String(el.shareMainInput.value || '').trim(),
      '',
      String(el.shareBodyInput.value || '').trim(),
      '',
      String(el.shareBodyInputB.value || '').trim(),
      '',
      String(el.shareTagInput.value || '').trim(),
      BOOK_CREDIT
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
    bg.addColorStop(0, '#020617');
    bg.addColorStop(0.48, '#0f172a');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const glowA = ctx.createRadialGradient(width * 0.84, height * 0.1, 20, width * 0.84, height * 0.1, 460);
    glowA.addColorStop(0, 'rgba(249,193,2,0.24)');
    glowA.addColorStop(1, 'rgba(249,193,2,0)');
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, width, height);

    const glowB = ctx.createRadialGradient(width * 0.12, height * 0.88, 20, width * 0.12, height * 0.88, 520);
    glowB.addColorStop(0, 'rgba(30,41,59,0.44)');
    glowB.addColorStop(1, 'rgba(30,41,59,0)');
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, width, height);

    const blockW = Math.round(width * (format === 'feed' ? 0.74 : 0.72));
    const x = Math.round((width - blockW) / 2);

    let titleText = compactText(String(el.shareMainInput.value || '').toUpperCase());
    let bodyAText = compactText(String(el.shareBodyInput.value || ''));
    let bodyBText = compactText(String(el.shareBodyInputB.value || ''));
    const sourceText = compactText(String(el.shareTagInput.value || ''));
    const creditText = BOOK_CREDIT;

    const minTitle = format === 'feed' ? 42 : 46;
    const minBody = format === 'feed' ? 42 : 45;
    const minSource = format === 'feed' ? 18 : 20;
    const minCredit = format === 'feed' ? 17 : 18;

    let titleSize = format === 'feed' ? 62 : 66;
    let bodySize = format === 'feed' ? 66 : 72;
    let sourceSize = format === 'feed' ? 32 : 34;
    let creditSize = format === 'feed' ? 30 : 32;

    const topMargin = format === 'feed' ? 170 : 230;
    const bottomMargin = format === 'feed' ? 110 : 150;
    const gapMainBody = format === 'feed' ? 36 : 44;
    const gapBodies = format === 'feed' ? 22 : 28;
    const gapBodyFooter = format === 'feed' ? 20 : 24;
    const gapFooterCredit = 0;

    function layoutHeight() {
      ctx.font = '800 ' + titleSize + 'px ' + FONT_DISPLAY;
      const titleLines = wrapText(ctx, titleText, blockW);
      const titleLH = Math.round(titleSize * 1.18);

      ctx.font = '500 ' + bodySize + 'px ' + FONT_PROSE;
      const bodyALines = wrapText(ctx, bodyAText, blockW);
      const bodyBLines = wrapText(ctx, bodyBText, blockW);
      const bodyLH = Math.round(bodySize * 1.2);

      ctx.font = '600 ' + sourceSize + 'px ' + FONT_DISPLAY;
      const sourceLines = wrapText(ctx, sourceText, blockW);
      const sourceLH = Math.round(sourceSize * 1.25);

      ctx.font = '500 ' + creditSize + 'px ' + FONT_DISPLAY;
      const creditLines = wrapText(ctx, creditText, blockW);
      const creditLH = Math.round(creditSize * 1.25);

      const heightUsed =
        topMargin +
        (titleLines.length * titleLH) +
        gapMainBody +
        (bodyALines.length * bodyLH) +
        gapBodies +
        (bodyBLines.length * bodyLH) +
        gapBodyFooter +
        (sourceLines.length * sourceLH) +
        gapFooterCredit +
        (creditLines.length * creditLH);

      return {
        fits: heightUsed <= (height - bottomMargin),
        titleLines,
        bodyALines,
        bodyBLines,
        sourceLines,
        creditLines,
        titleLH,
        bodyLH,
        sourceLH,
        creditLH
      };
    }

    let layout = layoutHeight();
    let guard = 0;

    while (!layout.fits && guard < 140) {
      guard += 1;

      if (titleSize > minTitle) titleSize -= 1;
      if (bodySize > minBody) bodySize -= 1;
      if (sourceSize > minSource) sourceSize -= 1;
      if (creditSize > minCredit) creditSize -= 1;

      layout = layoutHeight();

      if (!layout.fits && titleSize === minTitle && bodySize === minBody) {
        if (wordCount(bodyAText) > 20) {
          bodyAText = compressMeaning(bodyAText, Math.max(18, wordCount(bodyAText) - 5));
        }
        if (wordCount(bodyBText) > 16) {
          bodyBText = compressMeaning(bodyBText, Math.max(14, wordCount(bodyBText) - 4));
        }
        layout = layoutHeight();
      }
    }

    let y = topMargin;

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 ' + titleSize + 'px ' + FONT_DISPLAY;
    layout.titleLines.forEach(function (line) {
      drawWithLetterSpacing(ctx, line, x, y, -1);
      y += layout.titleLH;
    });

    y += gapMainBody;

    ctx.fillStyle = '#ffffff';
    ctx.font = '500 ' + bodySize + 'px ' + FONT_PROSE;
    layout.bodyALines.forEach(function (line) {
      ctx.fillText(line, x, y);
      y += layout.bodyLH;
    });

    y += gapBodies;
    layout.bodyBLines.forEach(function (line) {
      ctx.fillText(line, x, y);
      y += layout.bodyLH;
    });

    y += gapBodyFooter;

    ctx.fillStyle = '#f9c102';
    ctx.font = '600 ' + sourceSize + 'px ' + FONT_DISPLAY;
    layout.sourceLines.forEach(function (line) {
      drawWithLetterSpacing(ctx, line, x, y, 1);
      y += layout.sourceLH;
    });

    y += gapFooterCredit;
    ctx.fillStyle = 'rgba(249,193,2,0.92)';
    ctx.font = '500 ' + creditSize + 'px ' + FONT_DISPLAY;
    layout.creditLines.forEach(function (line) {
      ctx.fillText(line, x, y);
      y += layout.creditLH;
    });

    const link = document.createElement('a');
    link.download = 'gary-vee-capitulo-' + chapterId + '-' + variant + '-' + format + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Post exportado em PNG (' + format.toUpperCase() + ').', 'success');

    persistShareExport({
      chapter_id: chapterId,
      post_format: format,
      post_variant: variant,
      headline: String(el.shareMainInput.value || '').trim(),
      body_a: String(el.shareBodyInput.value || '').trim(),
      body_b: String(el.shareBodyInputB.value || '').trim(),
      footer: String(el.shareTagInput.value || '').trim() + ' | ' + BOOK_CREDIT,
      caption: postCaption()
    }).catch(function (error) {
      console.error(error);
      showToast('Falha ao salvar historico de post.', 'error');
    });
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(postCaption());
      showToast('Legenda copiada.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Nao foi possivel copiar automaticamente.', 'error');
    }
  }

  function progressText() {
    const status = computeStatus(state);
    const streak = getStreak(state);
    const percent = Math.round((status.completed / APP_DATA.chapters.length) * 100);

    return [
      'Meu progresso no Gary Vee Learning Experience',
      '',
      '- Capítulos concluídos: ' + status.completed + '/' + APP_DATA.chapters.length,
      '- Streak: ' + streak + ' dias',
      '- XP acumulado: ' + state.xp,
      '- Progresso total: ' + percent + '%',
      '',
      'Estou no desafio de leitura diária. Vem comigo.'
    ].join('\n');
  }

  async function exportProgressPng() {
    await document.fonts.ready;

    const status = computeStatus(state);
    const streak = getStreak(state);
    const percent = Math.round((status.completed / APP_DATA.chapters.length) * 100);

    const canvas = el.progressCanvas;
    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#020617');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const userName = currentUser ? userDisplayName(currentUser) : 'Leitor';

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 58px ' + FONT_DISPLAY;
    ctx.fillText('Meu progresso de leitura Gary Vee', 86, 130);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '500 36px ' + FONT_DISPLAY;
    ctx.fillText(userName + ' • desafio 30 em 30', 86, 185);

    const cards = [
      { label: 'Capítulos', value: status.completed + '/' + APP_DATA.chapters.length },
      { label: 'Streak', value: String(streak) + ' dias' },
      { label: 'XP', value: String(state.xp) },
      { label: 'Progresso', value: String(percent) + '%' }
    ];

    cards.forEach(function (card, index) {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 86 + col * 460;
      const y = 250 + row * 210;

      ctx.fillStyle = 'rgba(15,23,42,0.9)';
      ctx.strokeStyle = 'rgba(148,163,184,0.32)';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, 390, 170, 22, true, true);

      ctx.fillStyle = '#f9c102';
      ctx.font = '700 24px ' + FONT_DISPLAY;
      ctx.fillText(card.label.toUpperCase(), x + 28, y + 52);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px ' + FONT_DISPLAY;
      ctx.fillText(card.value, x + 28, y + 118);
    });

    const barX = 86;
    const barY = 710;
    const barW = 908;
    const barH = 20;

    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(ctx, barX, barY, barW, barH, 999, true, false);

    const progressW = Math.round((percent / 100) * barW);
    const grad = ctx.createLinearGradient(barX, barY, barX + progressW, barY + barH);
    grad.addColorStop(0, '#f9c102');
    grad.addColorStop(1, '#d1a302');
    ctx.fillStyle = grad;
    roundRect(ctx, barX, barY, progressW, barH, 999, true, false);

    ctx.fillStyle = '#ffffff';
    ctx.font = '500 30px ' + FONT_PROSE;
    ctx.fillText('Consistencia > motivacao. Um capitulo por dia.', 86, 790);

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '500 28px ' + FONT_PROSE;
    ctx.fillText('Entre na plataforma e acompanhe seu avanço com gamificacao.', 86, 840);

    ctx.fillStyle = '#f9c102';
    ctx.font = '700 22px ' + FONT_DISPLAY;
    ctx.fillText('GARY VEE LEARNING EXPERIENCE', 86, 1240);

    const link = document.createElement('a');
    link.download = 'progresso-gary-vee.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast('Card de progresso exportado.', 'success');

    persistShareExport({
      chapter_id: String(chapterOfDay().id),
      post_format: 'feed',
      post_variant: 'progress',
      headline: 'Progresso de leitura',
      body_a: progressText(),
      body_b: '',
      footer: 'Gary Vee Learning Experience',
      caption: progressText()
    }).catch(function (error) {
      console.error(error);
      showToast('Nao foi possivel salvar historico do progresso.', 'error');
    });
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  async function copyProgressText() {
    try {
      await navigator.clipboard.writeText(progressText());
      showToast('Resumo de progresso copiado.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Nao foi possivel copiar o progresso.', 'error');
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

    el.btnMarkDone.textContent = done ? 'Concluido ✔' : 'Marcar capitulo concluido';
    el.btnDoneBottom.textContent = done ? 'Capitulo ja concluido ✔' : 'Concluir capitulo + XP';
    el.btnDoneMobile.textContent = done ? 'Concluido ✔' : 'Concluir';

    renderFlashcards(chapter);
    bindShareForChapter(chapter, true);
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

    el.kpiDone.textContent = String(status.completed);
    el.kpiStreak.textContent = String(streak);
    el.kpiXp.textContent = String(state.xp);

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

    el.layoutMain.classList.toggle('focus-mode', focusMode);
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

      const rotateY = -24 + px * 16;
      const rotateX = 8 - py * 10;
      el.bookMockup.style.transform = 'rotateY(' + rotateY + 'deg) rotateX(' + rotateX + 'deg)';
    });

    el.bookStage.addEventListener('mouseleave', function () {
      el.bookMockup.style.transform = 'rotateY(-24deg) rotateX(8deg)';
    });
  }

  function setupReadingEvents() {
    el.search.addEventListener('input', renderChapterList);

    if (el.btnAccountMenu && el.accountMenu) {
      el.btnAccountMenu.addEventListener('click', function (ev) {
        ev.stopPropagation();
        toggleAccountMenu();
      });

      el.accountMenu.addEventListener('click', function (ev) {
        ev.stopPropagation();
      });

      document.addEventListener('click', function () {
        closeAccountMenu();
      });
    }

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

    el.btnExportProgress.addEventListener('click', exportProgressPng);
    el.btnCopyProgress.addEventListener('click', copyProgressText);

    window.addEventListener('scroll', trackScrollProgress, { passive: true });

    document.addEventListener('keydown', function (ev) {
      const key = ev.key.toLowerCase();
      if (key === 'n') goNext();
      if (key === 'p') goPrev();
      if (key === 'd') completeChapter(selectedChapterId);
      if (key === 'escape') closeAccountMenu();
    });

    bindBookMotion();
  }

  function setupAuthEvents() {
    el.btnAuthToggle.addEventListener('click', function () {
      setAuthMode(authMode === 'login' ? 'signup' : 'login');
    });

    el.authForm.addEventListener('submit', async function (ev) {
      ev.preventDefault();

      if (!cloudEnabled || !supabaseClient) {
        showToast('Configure o Supabase na Vercel para habilitar login.', 'error');
        return;
      }

      const email = el.authEmail.value.trim();
      const password = el.authPassword.value;

      if (!email || !password) {
        showToast('Preencha e-mail e senha.', 'error');
        return;
      }

      if (authMode === 'signup' && password.length < 6) {
        showToast('Senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
      }

      el.btnAuthSubmit.disabled = true;

      try {
        if (authMode === 'signup') {
          const result = await supabaseClient.auth.signUp({ email: email, password: password });
          if (result.error) {
            showToast('Cadastro falhou: ' + result.error.message, 'error');
            return;
          }
          if (!result.data || !result.data.session) {
            const loginResult = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
            if (loginResult.error) {
              showToast('Conta criada. Confirme o e-mail e entre novamente.', 'success');
              return;
            }
          }
          showToast('Conta criada e autenticada.', 'success');
          return;
        }

        const result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (result.error) {
          showToast('Login falhou: ' + result.error.message, 'error');
          return;
        }
        showToast('Login realizado com sucesso.', 'success');
      } finally {
        el.btnAuthSubmit.disabled = false;
      }
    });

    el.btnSignOut.addEventListener('click', async function () {
      if (!cloudEnabled || !supabaseClient) {
        toggleAppShell(false);
        showToast('Sessao encerrada.', 'success');
        return;
      }

      try {
        if (syncTimer) {
          window.clearTimeout(syncTimer);
          syncTimer = null;
        }
        await persistReaderSnapshot();
      } catch (error) {
        console.error(error);
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

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/service-worker.js').catch(function (error) {
        console.error('SW registration failed:', error);
      });
    });
  }

  function bootApp() {
    if (appBooted) return;
    appBooted = true;

    setupReadingEvents();
    renderAll();
  }

  async function init() {
    registerServiceWorker();
    setupAuthEvents();
    setAuthMode('login');

    await getRuntimeConfig();
    initSupabase();
    await restoreSession();

    if (!cloudEnabled) {
      showToast('Sem config de Supabase ativa. Defina env na Vercel.', 'error');
    }
  }

  init();
})();
