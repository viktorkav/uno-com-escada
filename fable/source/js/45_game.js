// Jogo: entrada, laço de passo fixo, reprodução dos comandos gravados, câmeras e pose do carro.
const GS = {
  held: 0, keys: 0, prevKeys: 0, cam: 0, replay: null, replayOn: false, ai: false, tick60: 0, acc: 0, sub: 0, alpha: 1, cut: true,
  body: m4(), tmp: m4(), tmp2: m4(), ground: m4(), spin: new Float32Array(4), susp: new Float32Array(4),
  cx: 0, cy: 0, cz: 0, yaw: 0, steer: 0, speed: 0,                 // estado interpolado
  chaseYaw: 0, chaseY: 0, chaseInit: false, hoodPos: new Float32Array(6),
  tvData: new Float32Array(64 * 4), tvN: 0, tvCur: -1, tvAim: new Float32Array(3), tvFov: 0.3, pl: new Float64Array(2),
  v3: new Float32Array(6), fxOn: true, frozen: false, freeCam: false,
  padKeys: 0, lapSeen: 0, lapMax: 0, lapNew: false, lapBad: 0, cutS: 0, lapEndT: 0,   // lapBad: 0 volta válida, 1 usou R, 2 quatro rodas fora, 3 atalho
};
// Cronômetro: LAP[0] instante (s de simulação) em que a volta atual começou, [1] última volta, [2] melhor volta, [3] 1 = cronômetro correndo
const LAP = new Float64Array(4);
// Controle (Gamepad API): PADV[0] gatilho direito, [1] gatilho esquerdo, [2] analógico esquerdo já com zona morta e curva. Preenchido por padPoll.
const PADV = new Float64Array(3);
const KEYMAP = { KeyW: K_W, ArrowUp: K_W, KeyS: K_S, ArrowDown: K_S, KeyA: K_A, ArrowLeft: K_A, KeyD: K_D, ArrowRight: K_D, Space: K_SPACE, KeyC: K_C, KeyR: K_R, KeyV: K_V };
// MOD (fork): tecla C passa por 5 câmeras: perseguição nível 1 (original), nível 2, nível 3, capô, TV.
// Cada nível da perseguição: [distância atrás do carro, altura da câmera, distância à frente do ponto de mira, altura do ponto de mira]
let CHASE_LV = 0, CAMSEQ = 0;
const CHASE_LVS = [[5.3, 1.62, 1.6, 0.95], [7.2, 2.8, 8, 1.1], [6.5, 3.6, 12, 0.9]];
const CAMMAP = [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]];   // [GS.cam, nível]
function onKeyDown(e) { const k = KEYMAP[e.code]; if (k) { GS.held |= k; e.preventDefault(); } }
function onKeyUp(e) { const k = KEYMAP[e.code]; if (k) { GS.held &= ~k; e.preventDefault(); } }
function onBlur() { GS.held = 0; }

// carro provisório (caixa) com o mesmo contrato do modelo real, usado enquanto CAR não existe
const CARP = {
  wheelR: VP.R, hubs: [[VP.L / 2, VP.R, -0.67], [VP.L / 2, VP.R, 0.67], [-VP.L / 2, VP.R, -0.65], [-VP.L / 2, VP.R, 0.65]], slotBody: 0, slotWheel: [0, 0, 0, 0], _t: m4(), _u: m4(),
  build() {
    const fam = R.families.test || mkFamily('test', { src: 'mat_test' }), set = new MeshSet(fam); R.drawables.push(set);
    this.slotBody = objSlot(); for (let i = 0; i < 4; i++) this.slotWheel[i] = objSlot();
    let mb = new MeshBuilder(); mb.mat(2).color(0.42, 0.6, 0.78); mb.rbox(0.1, 0.62, 0, 3.64, 0.62, 1.55, 0.12, 4); mb.rbox(-0.35, 1.15, 0, 2.1, 0.58, 1.4, 0.15, 4);
    mb.mat(1).color(0.8, 0.8, 0.82); mb.box(0, 1.56, 0, 3.2, 0.06, 0.42);
    set.add(mb.upload(), this.slotBody, 3);
    mb = new MeshBuilder(); mb.mat(0).color(0.03, 0.03, 0.03); mb.push(m4rotX(m4(), PI / 2)); mb.cyl(0, -0.08, 0, VP.R, 0.08, VP.R, 24, true, true); mb.pop();
    mb.mat(0).color(0.7, 0.7, 0.7); mb.box(0.12, 0, 0.085, 0.1, 0.3, 0.01);
    const wm = mb.upload(); for (let i = 0; i < 4; i++) set.add(wm, this.slotWheel[i], 3);
  },
  inp: new Float64Array(2),
  place(body, spin, susp) {
    const steer = this.inp[0];
    objPrev(this.slotBody).set(objModel(this.slotBody)); objModel(this.slotBody).set(body);
    for (let i = 0; i < 4; i++) {
      const h = this.hubs[i], m = objModel(this.slotWheel[i]); objPrev(this.slotWheel[i]).set(m);
      m4translate(this._t, h[0], h[1] + susp[i], h[2]); m4mul(this._t, body, this._t);
      if (i < 2) { m4rotY(this._u, -steer); m4mul(this._t, this._t, this._u); }
      m4rotZ(this._u, -spin[i]); m4mul(m, this._t, this._u);
    }
  },
};
const carObj = () => (typeof CAR !== 'undefined' ? CAR : CARP);

function gameInit() {
  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
  if (typeof REPLAY_B64 !== 'undefined') {
    const bin = atob(REPLAY_B64); let n = 0; for (let i = 1; i < bin.length; i += 2) n += bin.charCodeAt(i);
    GS.replay = new Uint8Array(n); let o = 0; for (let i = 0; i < bin.length; i += 2) { const k = bin.charCodeAt(i), c = bin.charCodeAt(i + 1); for (let q = 0; q < c; q++) GS.replay[o++] = k; }
  }
  GS.replayOn = Q.has('replay') && !!GS.replay; GS.ai = Q.has('auto');
  // câmeras de TV: as torres do cenário (WORLD.tvCams), ou posições calculadas do lado de fora das curvas
  if (typeof WORLD !== 'undefined' && WORLD.tvCams && WORLD.tvCams.length) {
    const q = new Float64Array(5);
    for (const c of WORLD.tvCams) {
      const o = GS.tvN++ * 4; GS.tvData[o] = ((c.s % TRK.L) + TRK.L) % TRK.L; GS.tvData[o + 1] = c.x; GS.tvData[o + 2] = c.y; GS.tvData[o + 3] = c.z;
      // reta de largada: câmera no começo da reta, junto ao muro dos boxes; vê o carro sair da última curva, passar e seguir
      // para o pórtico com o sol pelas costas
      if (GS.tvN === 1) { trackPos(TRK.L - 95, 5.9, q); GS.tvData[o] = TRK.L - 95; GS.tvData[o + 1] = q[0]; GS.tvData[o + 2] = q[1] + 3.4; GS.tvData[o + 3] = q[2]; }
    }
  } else {
    const st = [[70, -1, 5.5], [262, -1, 4.5], [330, 1, 4], [430, -1, 4.2], [545, -1, 4.5], [640, 1, 4.5], [745, -1, 4], [860, 1, 4.5], [985, -1, 4.2], [1090, -1, 5], [1200, 1, 4], [1300, -1, 4.2], [1390, -1, 4], [1470, -1, 4.5], [1548, -1, 5.5]];
    const p = new Float64Array(5);
    for (const [s, side, h] of st) {
      const i = Math.round(s / TRK.ds) % TRK.N, bar = side < 0 ? TRK.barL[i] : TRK.barR[i]; trackPos(s, side * (bar + 2.2), p);
      const o = GS.tvN++ * 4; GS.tvData[o] = s; GS.tvData[o + 1] = p[0]; GS.tvData[o + 2] = Math.max(hfAt(p[0], p[2]), p[1]) + h; GS.tvData[o + 3] = p[2];
    }
  }
  // colisão: usa o afastamento real do guard-rail do cenário quando existe (contorna a pit lane)
  if (typeof PROPS !== 'undefined' && PROPS.railD) for (let i = 0; i < TRK.N; i++) { const l = PROPS.railD(-1, i), r = PROPS.railD(1, i); if (l === l) TRK.barL[i] = Math.abs(l); if (r === r) TRK.barR[i] = Math.abs(r); }
  sndInit();
  gameWarmup();
  gameRestart();
}
// Aquece o JIT antes do jogo começar: roda a simulação (piloto automático + teclas variadas) passando por todos os ramos —
// três câmeras, ré, freio de mão, fora da pista, reposição — para o V8 otimizar o laço com informação de tipos completa.
// Sem isso, a primeira troca de câmera ou a primeira ré desotimizaria funções do laço e geraria lixo temporário.
function gameWarmup() {
  const fx = GS.fxOn, rp = GS.replayOn; GS.replayOn = false; GS.ai = false; RT[2] = 1 / 120;
  vehicleReset(TRK.L + TRK.startS, TRK.startD, 0);
  for (let i = 0; i < 9000; i++) {
    const ph = (i / 300) | 0, t = i / 120; let k = aiKeys(t);
    if (ph % 7 === 3) k = K_S; else if (ph % 7 === 5) k = K_W | K_D | (i % 60 < 30 ? K_SPACE : 0); else if (ph % 11 === 9) k = K_W | K_A;
    if (i % 1500 === 1499) k |= K_R; if (i % 400 === 399) k |= K_C;
    // metade das fases com as mesmas manobras vindas do controle (gatilhos e alavanca analógicos, olhar para trás)
    if (ph & 1) { const f = 0.3 + (i % 71) / 100; GS.padKeys = K_PAD | K_PADS | (ph % 4 === 1 ? K_V : 0) | (k & (K_W | K_S | K_SPACE | K_C | K_R)); PADV[0] = (k & K_W) ? f : 0; PADV[1] = (k & K_S) ? f : 0; PADV[2] = (((k & K_D) ? 1 : 0) - ((k & K_A) ? 1 : 0)) * f; k = i % 9 === 0 ? k & (K_A | K_D) : 0; } else GS.padKeys = 0;
    GS.held = k; GS.acc = PHYS_DT * (1 + (i % 3 === 0 ? 0.5 : 0)); gameTick(i % 4 === 0); sndControl();
    for (let q = 0; q < 3; q++) cascadeSetup(q);   // cascatas de sombra das três câmeras (inclusive o modo foco da TV): só contas, refeitas a cada quadro
  }
  // Cascatas de sombra: o encaixe em texel tem um ramo para coordenada de luz positiva e outro para negativa (e um caso em que
  // o arredondamento dá -0). A volta de aquecimento quase só passa por um deles; aqui os dois modos (normal e foco da TV)
  // veem os dois lados e a vizinhança do zero. Sem isto, o primeiro quadro do outro lado desotimizaria a função em pleno jogo.
  {
    const cs = R.casc, m = cs.view; lightView(m);
    const rx = m[0], ry = m[4], rz = m[8], ux = m[1], uy = m[5], uz = m[9], t0 = -m[12], s0 = -m[13];
    for (let k = 0; k < 3000; k++) {
      const sc = k < 1500 ? 0.004 : 0.9, t = t0 + (k % 1000 - 500) * sc, u = s0 + (k * 7 % 1000 - 500) * sc, x = rx * t + ux * u, y = ry * t + uy * u, z = rz * t + uz * u;
      cs.focusOn = true; cs.focus[0] = x; cs.focus[1] = y; cs.focus[2] = z; cascadeSetup(k % 3);
      cs.focusOn = false; setCamera(x, y, z, x + ux, y + uy, z + uz, 0.9); cascadeSetup(k % 3);
    }
  }
  GS.held = 0; GS.padKeys = 0; LAP[2] = 0; GS.fxOn = fx; GS.replayOn = rp; GS.ai = Q.has('auto'); RT[0] = 0; RT[2] = 1 / 60;
}
// Aquece a GPU antes do jogo começar: renderiza quadros de vários pontos do circuito nas três câmeras (com fumaça e marcas),
// para o driver compilar todas as variantes de pipeline e carregar todas as texturas agora, e não no meio da volta.
// De quebra mede o custo de GPU de cada vista (tempo de parede para a GPU concluir 4 quadros seguidos) e devolve o pior caso
// em ms por quadro: main() usa esse número para escolher a cadência (120 ou 60 quadros por segundo).
async function gamePrewarm() {
  RT[2] = 1 / 60; GS.frozen = true; let worst = 0;
  for (let i = 0; i < 36; i++) {
    vehicleReset(i * TRK.L / 36, (i % 3) - 1, 0); VEH.slip.fill(1); VEH.vx = 25; for (let k = 0; k < 6; k++) fxStep(); VEH.slip.fill(0); VEH.vx = 0;   // com velocidade: emite fumaça (estreia o pipeline de partículas)
    GS.cam = i % 3; GS.chaseInit = false; GS.tvCur = -1; GS.cut = true; gameTick(true); renderFrame(); gameTick(true); renderFrame();
    if (i >= 6) {   // as primeiras vistas ainda pagam compilação de pipelines: não entram na medida
      await G.dev.queue.onSubmittedWorkDone(); const t0 = performance.now();
      for (let k = 0; k < 4; k++) { gameTick(true); renderFrame(); }
      await G.dev.queue.onSubmittedWorkDone(); const ms = (performance.now() - t0) / 4; if (ms > worst) worst = ms;
    }
  }
  GS.frozen = false; gameRestart(); return worst;
}
function gameRestart() {
  const V = VEH; V.lapS = 0; V.offCount = 0; V.hits = 0; V.laps = 0; V.time = 0; V.steps = 0; V.spin.fill(0); V.susp.fill(0);
  vehicleReset(TRK.L + TRK.startS, TRK.startD, 0); GS.held = 0; GS.tick60 = 0; GS.acc = 0; GS.sub = 0; GS.keys = GS.prevKeys = 0; GS.cam = +(Q.get('cam') || 0); CAMSEQ = GS.cam === 1 ? 3 : GS.cam === 2 ? 4 : 0; CHASE_LV = 0; GS.lapBad = 0; GS.cutS = VEH.s; GS.lapEndT = 0; GS.chaseInit = false; GS.tvCur = -1; GS.cut = true;
  if (typeof fxReset === 'function') fxReset();
  GS.lapSeen = GS.lapMax = 0; LAP[0] = LAP[1] = LAP[3] = 0;
  GS.alpha = 1; gamePose(); gameCamera();
}
// um passo de física; a cada 2 passos (1/60 s) lê as teclas (gravadas, piloto automático ou teclado)
function gameStep() {
  if ((GS.sub & 1) === 0) {
    const t = GS.tick60 / 60; let k;
    if (GS.replayOn && GS.tick60 < GS.replay.length) k = GS.replay[GS.tick60];
    else if (GS.ai) k = t < 0.5 ? 0 : aiKeys(t);
    else { k = GS.held; if (GS.padKeys) k = padMerge(k); }
    GS.prevKeys = GS.keys; GS.keys = k; GS.tick60++;
    const edge = k & ~GS.prevKeys;
    if ((k ^ GS.prevKeys) & K_V) { GS.cut = true; GS.chaseInit = false; }   // olhar para trás é um corte de câmera
    if (edge & K_C) { CAMSEQ = (CAMSEQ + 1) % 5; GS.cam = CAMMAP[CAMSEQ][0]; CHASE_LV = CAMMAP[CAMSEQ][1]; GS.cut = true; GS.chaseInit = false; GS.tvCur = -1; }
    if (edge & K_R) { // devolve o carro à pista: no eixo, alinhado, parado
      const s = VEH.s; vehicleReset(s, clamp(VEH.d, -2, 2), 0); GS.cut = true; GS.chaseInit = false;
      GS.lapBad = GS.lapBad || 1; GS.cutS = VEH.s;   // MOD (fork): voltar à pista com R suja a volta
    }
  }
  GS.sub++;
  vehicleStep(GS.keys);
  // MOD (fork): regras de volta válida, no espírito dos limites de pista da F1.
  // Zebra pode. Se as quatro rodas ficam fora do asfalto/zebra (grama, brita...), a volta é invalidada; um salto grande de posição
  // ao longo da pista (atalho) também.
  { const Zn = VEH.wzone; let on = 0; for (let i = 0; i < 4; i++) { const zz = Zn[i]; if (zz === ZONE.ASPHALT || zz === ZONE.KERB || zz === ZONE.PIT) on++; }
    if (on === 0 && GS.lapBad === 0) GS.lapBad = 2;
    let dsC = VEH.s - GS.cutS; if (dsC > TRK.L / 2) dsC -= TRK.L; else if (dsC < -TRK.L / 2) dsC += TRK.L; GS.cutS = VEH.s;
    if ((dsC > 12 || dsC < -12) && GS.lapBad === 0) GS.lapBad = 3; }
  if (VEH.laps !== GS.lapSeen) lapCross();
  if (GS.fxOn && typeof fxStep === 'function') fxStep();
}
// junta o controle ao teclado: gatilhos e alavanca valem como entrada analógica (VIN); A/D do teclado têm prioridade na direção
function padMerge(k) {
  let pk = GS.padKeys; if (k & (K_A | K_D)) pk &= ~K_PADS;
  if (pk & K_PAD) { const a = PADV[0], b = PADV[1]; VIN[0] = (k & K_W) ? 1 : a; VIN[1] = (k & K_S) ? 1 : b; }
  if (pk & K_PADS) VIN[2] = PADV[2];
  return k | pk;
}
// O carro cruzou a linha de largada (s deu a volta). Só conta para a frente e uma vez por volta: dar ré sobre a linha e
// voltar não fecha volta. O instante do cruzamento é interpolado dentro do passo de física.
function lapCross() {
  const V = VEH;
  if (V.laps > GS.lapMax) {
    const st = V.vx * PHYS_DT, fr = st > 1e-6 ? V.s / st : 0, t = V.time - (fr < 0 ? 0 : fr > 1 ? 1 : fr) * PHYS_DT;
    if (LAP[3] === 1) {
      const lt = t - LAP[0];
      if (GS.lapBad) { LAP[1] = 0; GS.lapEndT = RT[0] + 5; }   // MOD (fork): volta inválida não tem tempo e não vira melhor volta
      else { LAP[1] = lt; if (!GS.replayOn && (LAP[2] === 0 || lt < LAP[2])) { LAP[2] = lt; GS.lapNew = true; } }
    }
    LAP[0] = t; LAP[3] = 1; GS.lapMax = V.laps; GS.lapBad = 0;
  }
  GS.lapSeen = V.laps;
}
// avança o jogo RT[2] segundos (fixed: múltiplo exato de 1/60, usado na captura) e prepara a renderização.
// Sem argumentos numéricos entre funções grandes: o V8 teria de pôr cada número em caixa (alocação) na chamada.
function gameTick(fixed) {
  const dt = RT[2];
  if (!GS.frozen) {
    if (fixed) { const n = (dt * 120 + 0.5) | 0; for (let i = 0; i < n; i++) gameStep(); GS.alpha = 1; }
    else { GS.acc += dt; let n = 0; while (GS.acc >= PHYS_DT && n < 8) { gameStep(); GS.acc -= PHYS_DT; n++; } if (n === 8) GS.acc = 0; GS.alpha = GS.acc / PHYS_DT; }
  }
  RT[1] = dt; RT[0] += dt;
  gamePose();
  if (!GS.freeCam) gameCamera();
  if (GS.cut) { R.cam.first = true; R.debug = 1; GS.cut = false; } else R.debug = 0;
  if (GS.fxOn && typeof fxFrame === 'function') fxFrame();
  if (SND.rec) sndRecTick();
}
// pose interpolada do carro → matrizes dos objetos
function gamePose() {
  const V = VEH, C = carObj(), P = VP, al = GS.alpha;
  const x = V.px + (V.x - V.px) * al, z = V.pz + (V.z - V.pz) * al, y = V.py + (V.y - V.py) * al;
  let dy = V.yaw - V.pyaw; if (dy > PI) dy -= TAU; else if (dy < -PI) dy += TAU; const yaw = V.pyaw + dy * al;
  const gp = V.pgPitch + (V.gPitch - V.pgPitch) * al, gr = V.pgRoll + (V.gRoll - V.pgRoll) * al, roll = V.proll + (V.roll - V.proll) * al, pitch = V.ppitch + (V.pitch - V.ppitch) * al, heave = V.pheave + (V.heave - V.pheave) * al;
  const c = Math.cos(yaw), s = Math.sin(yaw), ox = -(P.L / 2 - P.a);   // origem do modelo = centro do entre-eixos no chão
  GS.cx = x + c * ox; GS.cz = z + s * ox; GS.cy = y; GS.yaw = yaw; GS.steer = V.psteer + (V.steer - V.psteer) * al; GS.speed = Math.sqrt(V.vx * V.vx + V.vy * V.vy);
  const B = GS.body, T = GS.tmp, G0 = GS.ground;
  // base do chão: direção + inclinação da pista
  G0[0] = c; G0[1] = 0; G0[2] = s; G0[3] = 0; G0[4] = 0; G0[5] = 1; G0[6] = 0; G0[7] = 0; G0[8] = -s; G0[9] = 0; G0[10] = c; G0[11] = 0; G0[12] = GS.cx; G0[13] = GS.cy; G0[14] = GS.cz; G0[15] = 1;
  ROTQ[0] = gp; rotZQ(T); m4mul(G0, G0, T); ROTQ[0] = -gr; rotXQ(T); m4mul(G0, G0, T);
  // carroceria: rola/mergulha sobre a suspensão em torno de um eixo baixo
  m4ident(T); T[13] = 0.18 + heave; m4mul(B, G0, T);
  ROTQ[0] = -pitch; rotZQ(T); m4mul(B, B, T); ROTQ[0] = -roll; rotXQ(T); m4mul(B, B, T);
  m4ident(T); T[13] = -0.18; m4mul(B, B, T);
  // curso de cada roda para ela continuar no chão
  for (let i = 0; i < 4; i++) {
    const h = C.hubs[i], hy = B[1] * h[0] + B[5] * h[1] + B[9] * h[2] + B[13];
    let su = V.wy[i] + C.wheelR - hy; su = su < -0.09 ? -0.09 : su > 0.09 ? 0.09 : su;
    GS.susp[i] = su; GS.spin[i] = V.pspin[i] + (V.spin[i] - V.pspin[i]) * al;
  }
  C.inp[0] = GS.steer; C.inp[1] = GS.steer * 14; C.place(B, GS.spin, GS.susp);
  const bp = objParams(C.slotBody), k = GS.keys; bp[0] = ((k & K_S) && V.gear !== 0) || ((k & K_W) && V.gear === 0) ? 1 : 0; bp[1] = V.gear === 0 ? 1 : 0; bp[2] = 1;
  for (let i = 0; i < 4; i++) { const w = V.omega[i]; objParams(C.slotWheel[i])[0] = w < 0 ? -w : w; }
  FR.data.set(B, FO.carMat); m4inv(T, B); FR.data.set(T, FO.carInv);
  // rodas: a matriz anterior passa a ser a roda atual levada pelo deslocamento rígido da carroceria (anterior × atual⁻¹).
  // Assim o desfoque de movimento não espalha o pneu pelo asfalto por causa do giro; a rotação é mostrada pelo material.
  if (C.slotWheel[0] !== C.slotBody) { const D2 = GS.tmp2; m4mul(D2, objPrev(C.slotBody), T); for (let i = 0; i < 4; i++) m4mul(objPrev(C.slotWheel[i]), D2, objModel(C.slotWheel[i])); }
  const f = FR.data, o = FO.car; f[o] = bp[0]; f[o + 1] = GS.speed; f[o + 2] = GS.steer; f[o + 3] = 0;
  f[FO.car2] = (GS.tick60 < 30 && GS.speed < 0.5) ? 1 : 0;   // luzes de largada: acesas só enquanto o carro espera no grid
  R.cube.pos[0] = B[4] * 1.15 + B[12]; R.cube.pos[1] = B[5] * 1.15 + B[13]; R.cube.pos[2] = B[6] * 1.15 + B[14];
}
// rotações lendo o ângulo do registrador ROTQ[0] (sem números por argumento)
const ROTQ = new Float64Array(1);
function rotZQ(o) { const a = ROTQ[0], c = Math.cos(a), s = Math.sin(a); o.fill(0); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; o[10] = 1; o[15] = 1; }
function rotXQ(o) { const a = ROTQ[0], c = Math.cos(a), s = Math.sin(a); o.fill(0); o[0] = 1; o[5] = c; o[6] = s; o[9] = -s; o[10] = c; o[15] = 1; }
function camCut() { GS.cut = true; }
function gameCamera() {
  const V = VEH, c = Math.cos(GS.yaw), s = Math.sin(GS.yaw), dt = RT[1], q = CAMQ, lb = (GS.keys & K_V) ? -1 : 1;   // lb = -1: olhando para trás
  if (GS.cam === 0) {
    // perseguição: segue a direção do movimento com atraso
    let tgt = GS.yaw; if (GS.speed > 4) { let sa = Math.atan2(V.vy, V.vx > 1 ? V.vx : 1); sa = sa < -0.5 ? -0.5 : sa > 0.5 ? 0.5 : sa; tgt = GS.yaw + sa * 0.55; }
    if (!GS.chaseInit) { GS.chaseYaw = tgt; GS.chaseY = GS.cy; GS.chaseInit = true; }
    let dy = tgt - GS.chaseYaw; while (dy > PI) dy -= TAU; while (dy < -PI) dy += TAU;
    GS.chaseYaw += dy * (1 - Math.exp(-dt * 5.5)); GS.chaseY += (GS.cy - GS.chaseY) * (1 - Math.exp(-dt * 7));
    // (os fatores lb abaixo valem 1 olhando para a frente: a conta fica bit a bit a de antes)
    const LV = CHASE_LVS[CHASE_LV], dist = LV[0] + GS.speed * 0.022, cc = Math.cos(GS.chaseYaw), ss = Math.sin(GS.chaseYaw);
    const ex = GS.cx + c * 0.2 * lb - cc * dist * lb, ez = GS.cz + s * 0.2 * lb - ss * dist * lb; let ey = GS.chaseY + LV[1] - V.gPitch * dist * 0.6;
    _gq[0] = ex; _gq[1] = ez; hfAtQ(_gq); if (ey < _gq[6] + 0.55) ey = _gq[6] + 0.55;
    let rl = -V.ay * 0.004; rl = rl < -0.05 ? -0.05 : rl > 0.05 ? 0.05 : rl;
    q[0] = ex; q[1] = ey; q[2] = ez; q[3] = GS.cx + c * LV[2] * lb; q[4] = GS.cy + LV[3] + V.gPitch * LV[2]; q[5] = GS.cz + s * LV[2] * lb; q[6] = 0.93 + (GS.speed < 50 ? GS.speed : 50) * 0.0042; q[7] = rl;
  } else if (GS.cam === 1) {
    // capô: presa à carroceria
    const B = GS.body;
    q[0] = B[0] * 0.5 + B[4] * 1.15 + B[12]; q[1] = B[1] * 0.5 + B[5] * 1.15 + B[13]; q[2] = B[2] * 0.5 + B[6] * 1.15 + B[14];   // acima da base do para-brisa: capô inteiro, com a grelha de ventilação junto à base do quadro
    q[3] = B[0] * 6.5 + B[4] * 0.52 + B[12]; q[4] = B[1] * 6.5 + B[5] * 0.52 + B[13]; q[5] = B[2] * 6.5 + B[6] * 0.52 + B[14];
    q[6] = 1.0; q[7] = -(V.gRoll + V.roll) * 0.8;
    if (lb < 0) {   // para trás: do alto da tampa traseira, sem o carro no quadro
      q[0] = B[0] * -2.0 + B[4] * 1.05 + B[12]; q[1] = B[1] * -2.0 + B[5] * 1.05 + B[13]; q[2] = B[2] * -2.0 + B[6] * 1.05 + B[14];
      q[3] = B[0] * -9 + B[4] * 0.6 + B[12]; q[4] = B[1] * -9 + B[5] * 0.6 + B[13]; q[5] = B[2] * -9 + B[6] * 0.6 + B[14]; q[7] = -q[7];
    }
  } else {
    // TV: câmera fixa à beira da pista mais próxima à frente do carro, com lente longa
    let best = GS.tvCur, bd = 1e9; const n = GS.tvN, TV = GS.tvData;
    // escolhe a câmera mais próxima; a que já passou vale um pouco mais que a que está à frente (a tomada segue o carro indo embora)
    for (let i = 0; i < n; i++) { let d = TV[i * 4] - V.s; const hl = TRK.L * 0.5; while (d > hl) d -= TRK.L; while (d < -hl) d += TRK.L; d = (d < 0 ? -d * 0.7 : d) - (i === GS.tvCur ? 14 : 0); if (d < bd) { bd = d; best = i; } }
    const cut = best !== GS.tvCur; GS.tvCur = best; const tx = TV[best * 4 + 1], ty = TV[best * 4 + 2], tz = TV[best * 4 + 3];
    const ld = 0.8 + GS.speed * 0.1, ax = GS.cx + c * ld, ay = GS.cy + 0.75, az = GS.cz + s * ld, dist = Math.sqrt((ax - tx) * (ax - tx) + (ay - ty) * (ay - ty) + (az - tz) * (az - tz));
    let fov = 2 * Math.atan(3.3 / dist); fov = fov < 0.04 ? 0.04 : fov > 0.62 ? 0.62 : fov;
    if (cut) { GS.tvAim[0] = ax; GS.tvAim[1] = ay; GS.tvAim[2] = az; GS.tvFov = fov; GS.cut = true; }
    const k = 1 - Math.exp(-dt * 16); GS.tvAim[0] += (ax - GS.tvAim[0]) * k; GS.tvAim[1] += (ay - GS.tvAim[1]) * k; GS.tvAim[2] += (az - GS.tvAim[2]) * k; GS.tvFov += (fov - GS.tvFov) * (1 - Math.exp(-dt * 3));
    q[0] = tx; q[1] = ty; q[2] = tz; q[3] = GS.tvAim[0]; q[4] = GS.tvAim[1]; q[5] = GS.tvAim[2]; q[6] = GS.tvFov; q[7] = 0;
  }
  // sombras: com a lente longa da TV, as cascatas acompanham o carro
  R.casc.focusOn = GS.cam === 2; if (R.casc.focusOn) { R.casc.focus[0] = GS.cx; R.casc.focus[1] = GS.cy + 0.6; R.casc.focus[2] = GS.cz; }
  setCameraQ();
}
BUILD.push(async () => {
  if (GAME.mode === 'test' || GAME.mode === 'car') return;
  if (typeof CAR === 'undefined') CARP.build();
  GAME.init = gameInit; GAME.tick = gameTick; GAME.prewarm = gamePrewarm;
});
