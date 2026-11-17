// Interface do jogo aberto por uma pessoa (GAME.ui): tela de início, pausa, benchmark, volta roteirizada para assistir,
// poses, teclas de ferramenta e leitura do controle. Nas ferramentas de trabalho/ (captura, poses, teste, medição) nada
// disto é ligado: sem menu, sem painel, sem som.
const ST = { INICIO: 0, JOGO: 1, PAUSA: 2, BENCH: 3, FITA: 4, RESULT: 5, POSE: 6 };
const UI = { st: ST.INICIO, back: ST.JOGO, el: null, tag: null, res: null, b0: null, b1: null, b2: null, vol: null, volTxt: '', bench: null, benchN: 0, padPrev: 0, padN: 0, pose: -1, stats: false, warm: false };
const $ = id => document.getElementById(id);
function uiInit() {
  UI.el = $('ui'); UI.tag = $('tag'); UI.res = $('res'); UI.b0 = $('b0'); UI.b1 = $('b1'); UI.b2 = $('b2'); UI.vol = $('vol');
  hudInit(); uiWarmup();
  try { const b = +localStorage.getItem('uno-melhor'); if (b > 20 && b < 600) LAP[2] = b; } catch (e) { /* sem armazenamento local: a melhor volta vale só nesta sessão */ }
  UI.b0.onclick = () => { if (UI.st === ST.INICIO) { sndStart(); uiSet(ST.JOGO); } else uiResume(); };
  UI.b1.onclick = () => benchStart();
  UI.b2.onclick = () => uiDrive();   // MOD (fork): reinicia a volta (carro no grid, cronômetro, última volta e aviso zerados; a melhor volta fica)
  addEventListener('keydown', uiKey);
  document.addEventListener('visibilitychange', () => { if (document.hidden && (UI.st === ST.JOGO || UI.st === ST.FITA || UI.st === ST.BENCH)) uiPause(); });
  addEventListener('gamepadconnected', padCount); addEventListener('gamepaddisconnected', padCount);
  const h = $('hint'); if (h) h.style.display = 'none';
  uiSet(ST.INICIO);
}
// troca de estado: mostra/esconde menu, painel e etiqueta, pausa/retoma o som
function uiSet(st) {
  const menu = st === ST.INICIO || st === ST.PAUSA || st === ST.RESULT;
  UI.st = st; UI.el.style.display = menu ? 'flex' : 'none'; UI.el.className = st === ST.INICIO ? 'ini' : '';
  UI.b0.textContent = st === ST.INICIO ? 'Começar' : st === ST.RESULT ? 'Voltar a dirigir' : 'Continuar';
  UI.b1.style.display = st === ST.INICIO ? 'none' : ''; UI.b2.style.display = st === ST.PAUSA ? '' : 'none'; UI.volTxt = null; UI.vol.style.display = 'none'; UI.b1.textContent = st === ST.RESULT ? 'Repetir benchmark' : 'Benchmark';
  UI.res.style.display = st === ST.RESULT ? 'block' : 'none';
  UI.tag.textContent = st === ST.BENCH ? 'Benchmark: volta roteirizada de 60 s · Esc cancela' : st === ST.FITA ? 'Volta roteirizada · R assume o volante · Esc menu' : st === ST.POSE ? 'Pose ' + (UI.pose + 1) + ' · ' + POSES[UI.pose].nome + ' · 1 a 6 trocam · Esc volta a dirigir' : '';
  UI.tag.style.display = UI.tag.textContent ? 'block' : 'none';
  hudShow(st === ST.JOGO || st === ST.FITA || (st === ST.PAUSA && UI.back !== ST.BENCH));
  sndRun(st === ST.JOGO || st === ST.FITA || st === ST.BENCH);
  if (menu) UI.b0.focus(); else UI.b0.blur();
  _lastT = 0;
}
function uiPause() { if (UI.st === ST.BENCH) benchStop(); UI.back = UI.st === ST.FITA ? ST.FITA : ST.JOGO; uiSet(ST.PAUSA); }
function uiResume() {
  if (UI.st === ST.RESULT || UI.st === ST.POSE) uiDrive(); else if (UI.st === ST.PAUSA) uiSet(UI.back);
}
// volta ao volante: carro no grid, câmeras e simulação soltas
function uiDrive() { GS.frozen = false; GS.freeCam = false; GS.replayOn = false; gameRestart(); uiSet(ST.JOGO); }
function uiReplay() { if (!GS.replay) return; GS.frozen = false; GS.freeCam = false; GS.replayOn = true; gameRestart(); uiSet(ST.FITA); }
function uiPose(i) { if (UI.st === ST.BENCH) benchStop(); UI.pose = i; poseApply(i); GS.replayOn = false; uiSet(ST.POSE); }
function uiKey(e) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const c = e.code, st = UI.st;
  if (c === 'KeyM') { sndMute(!SND.mute); return; }
  if (c === 'KeyH') { UI.stats = !UI.stats; hudStats(UI.stats); if (st !== ST.BENCH) perfAttach(UI.stats, 12); return; }
  if (st === ST.INICIO) return;                                   // na tela de início só o botão começa o jogo (e o som)
  if (c === 'Escape') { if (st === ST.JOGO || st === ST.FITA || st === ST.BENCH) uiPause(); else uiResume(); e.preventDefault(); }
  else if (c === 'KeyB') benchStart();
  else if (c === 'KeyF') uiReplay();
  else if (c === 'KeyR' && st === ST.FITA) uiDrive();
  else if (c.length === 6 && c.startsWith('Digit') && c[5] >= '1' && c[5] <= '6') uiPose(+c[5] - 1);
}
// ---- benchmark: a volta roteirizada de 60 s em tempo real, sem painel, medindo tempo de quadro e (se houver) tempo de GPU
function benchStart() {
  if (!GS.replay || UI.st === ST.INICIO) return;
  GS.frozen = false; GS.freeCam = false; GS.replayOn = true; gameRestart(); UI.bench = null; UI.benchN++; UI.res.innerHTML = '<h2>Benchmark · calculando…</h2>';
  perfAttach(true, 1); perfStart(); uiSet(ST.BENCH);
}
function benchStop() { PERF.rec = false; perfAttach(UI.stats, 12); GS.replayOn = false; }
function benchEnd() {
  const id = UI.benchN; PERF.rec = false; uiSet(ST.RESULT);
  setTimeout(() => {   // espera as últimas leituras de tempo de GPU chegarem
    if (id !== UI.benchN || UI.st !== ST.RESULT) return;
    const r = perfReport(), stat = a => { a = a.slice(5).filter(x => x > 0).sort((p, q) => p - q); const n = a.length; return n ? { n, media: a.reduce((p, q) => p + q, 0) / n, p99: a[Math.min(n - 1, Math.round(0.99 * (n - 1)))], max: a[n - 1], acima: a.filter(x => Math.round(x * 10) > 167).length } : null; };   // acima: quadros que passaram de 16,7 ms (na resolução de 0,1 ms do relógio)
    const q = stat(r.raf), g = PERF.qs ? stat(r.gpu) : null, f = x => x.toFixed(2).replace('.', ',');
    benchStop(); gameRestart();
    UI.bench = { quadros: r.n, quadro_ms: q, gpu_ms: g, fps: q ? 1000 / q.media : 0, acima_16_7: q ? q.acima : 0, gpu_acima_16_7: g ? g.acima : null, tick: 3600, resolucao: G.W + '×' + G.H };
    const row = (n, s) => '<tr><th>' + n + '</th>' + (s ? '<td>' + f(s.media) + '</td><td>' + f(s.p99) + '</td><td>' + f(s.max) + '</td>' : '<td colspan=3>indisponível neste navegador</td>') + '</tr>';
    UI.res.innerHTML = '<h2>Benchmark · volta roteirizada de 60 s · ' + G.W + '×' + G.H + '</h2><table><tr><th></th><th>média (ms)</th><th>percentil 99 (ms)</th><th>máximo (ms)</th></tr>' + row('Tempo de quadro', q) + row('Tempo de GPU', g) + '</table>' +
      '<p>' + (q ? q.acima + ' de ' + q.n + ' quadros passaram de 16,7 ms de intervalo' + (g ? ' · ' + g.acima + ' passaram de 16,7 ms de GPU' : '') + ' · ' + f(1000 / q.media) + ' quadros por segundo' : '') + '</p>';
  }, 400);
}
// ---- controle (Gamepad API, layout padrão). Só é consultado enquanto houver um controle ligado.
function padCount() { let n = 0; const l = navigator.getGamepads ? navigator.getGamepads() : []; for (let i = 0; i < l.length; i++) if (l[i] && l[i].connected) n++; UI.padN = n; if (!n) { GS.padKeys = 0; UI.padPrev = 0; } }
// A API devolve um retrato novo dos controles a cada consulta (vetor e números criados pelo navegador): fica isolado aqui.
const PADR = new Float64Array(3), PADB = new Int32Array(1);
function apiGamepad() {
  const l = navigator.getGamepads(); let p = null;
  for (let i = 0; i < l.length; i++) { const g = l[i]; if (g && g.connected && (!p || (g.mapping === 'standard' && p.mapping !== 'standard'))) p = g; }
  if (!p) { PADB[0] = -1; return; }
  const b = p.buttons, n = b.length; let m = 0; for (let i = 0; i < n && i < 16; i++) if (b[i].pressed) m |= 1 << i;
  PADB[0] = m; PADR[0] = n > 7 ? b[7].value : 0; PADR[1] = n > 6 ? b[6].value : 0; PADR[2] = p.axes.length ? p.axes[0] : 0;
}
// traduz a leitura do controle (PADB, PADR) para as mesmas teclas do jogo + valores analógicos (PADV)
function padPoll() { apiGamepad(); padApply(); }
function padApply() {
  const m = PADB[0]; if (m < 0) { GS.padKeys = 0; return; }
  let k = K_PAD | K_PADS, x = PADR[2]; const rt = PADR[0], lt = PADR[1], ax = x < 0 ? -x : x;
  PADV[0] = rt < 0.04 ? 0 : rt; PADV[1] = lt < 0.04 ? 0 : lt;
  if (ax < 0.12) x = 0; else { const u = (ax - 0.12) / 0.88; x = (x < 0 ? -1 : 1) * u * (0.45 + 0.55 * u); }   // zona morta + curva suave no centro
  PADV[2] = x;
  if (rt > 0.06) k |= K_W; if (lt > 0.06) k |= K_S;
  if (m & 1) k |= K_SPACE; if (m & 8) k |= K_C; if (m & 4) k |= K_R; if (m & 32) k |= K_V;
  GS.padKeys = k;
  const edge = m & ~UI.padPrev; UI.padPrev = m;
  if (edge & 516) padMenu(edge);
}
// botões de menu do controle, na borda: Start abre/fecha o menu; X assume o volante durante a volta roteirizada
function padMenu(edge) {
  if (UI.warm) return;
  if (edge & 512) { if (UI.st === ST.JOGO || UI.st === ST.FITA || UI.st === ST.BENCH) uiPause(); else if (UI.st !== ST.INICIO) uiResume(); }
  else if (UI.st === ST.FITA) uiDrive();
}
// Aquece o JIT das funções novas que rodam uma vez por quadro (controle, painel, estatísticas): são baratas, e sem isto o V8
// levaria dezenas de segundos de jogo para otimizá-las — rodando até lá no interpretador, que aloca a cada conta.
// (A parte do som que lê a simulação, sndControl, é aquecida junto com a física em gameWarmup.)
function uiWarmup() {
  const H = HUD, g = H.g, t = H.t, s = H.s, sc = document.createElement('canvas'); sc.width = sc.height = 4; const x = sc.getContext('2d'), V = H.V, rt3 = RT[3];
  const po = PERF.on; UI.warm = true; H.g = H.t = H.s = x; PERF.on = true;
  for (let i = 0; i < 6000; i++) {
    PADB[0] = i % 97 === 0 ? -1 : (i * 7919) & 0xffff; PADR[0] = (i % 50) / 49; PADR[1] = (i % 31) / 60; PADR[2] = Math.sin(i * 0.7); padApply();
    if (i % 2) continue;
    V[0] = (i * 7) % 2100; V[1] = (i * 13) % 7400; V[2] = i % 6; V[3] = (i * 331) % 70000; V[4] = i % 5 ? (i * 17) % 9000 : -1; V[5] = i % 3 ? (i * 19) % 9000 : -1; hudDraw(); hudRead();
    RT[3] = 300 + i % 300; PERF.live[0] = i % 4 ? i % 40 : 0; hudStatsFrame();
  }
  H.g = g; H.t = t; H.s = s; H.K.fill(-9); H.acc.fill(0); RT[3] = rt3; PERF.live[0] = 0; GS.padKeys = 0; UI.padPrev = 0; PADB[0] = -1; PERF.on = po; UI.warm = false;
}
// chamado no começo de cada quadro; devolve true quando o jogo está parado num menu (não simula nem renderiza)
function uiFrame() {
  if (UI.padN) padPoll();
  const st = UI.st;
  return st === ST.INICIO || st === ST.PAUSA || st === ST.RESULT || st === ST.POSE;
}
// MOD (fork): aviso de volta inválida (faixa vermelha no alto da tela)
const VOLMSG = ['', 'VOLTA INVÁLIDA · voltou à pista com R', 'VOLTA INVÁLIDA · saiu dos limites da pista', 'VOLTA INVÁLIDA · atalho'];
function volFrame() {
  const k = GS.lapBad; let t = '';
  if (k) t = VOLMSG[k]; else if (GS.lapEndT > RT[0]) t = 'A volta anterior foi inválida e não conta';
  if (t !== UI.volTxt) { UI.volTxt = t; UI.vol.textContent = t; UI.vol.style.display = t ? 'block' : 'none'; }
}
// chamado depois de simular e renderizar o quadro
function uiAfter() {
  const st = UI.st;
  if (st === ST.BENCH) { if (GS.tick60 >= 3600) benchEnd(); }
  else {
    if (st === ST.FITA && GS.tick60 >= GS.replay.length) { GS.replayOn = false; uiSet(ST.JOGO); }
    if (HUD.vis) hudFrame();
    volFrame();
    if (GS.lapNew) { GS.lapNew = false; try { localStorage.setItem('uno-melhor', LAP[2].toFixed(3)); } catch (e) { /* idem */ } }
  }
  if (HUD.stats) hudStatsFrame();
  sndFrame();
}
