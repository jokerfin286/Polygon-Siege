/* ============================================================
   Localisation — English / Русский
   ============================================================ */

export type Lang = 'en' | 'ru';

const LANG_KEY = 'polygon-siege-lang-v1';

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'ru' || v === 'en') return v;
    // auto-detect from browser
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ru') || nav.startsWith('uk') || nav.startsWith('be') || nav.startsWith('kk')) return 'ru';
  } catch { /* ignore */ }
  return 'en';
}

export function saveLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
}

/* ------------------------- UI strings ------------------------- */

type Dict = Record<string, string>;

const EN: Dict = {
  // start screen
  tagline: 'GEOMETRIC SURVIVAL · {n} UPGRADES',
  title1: 'POLYGON',
  title2: 'SIEGE',
  intro: "You are a shape. The red ones are coming. Absorb new cores, mount new weapons, recruit helpers — and out-shape them all.",
  play: '▶ PLAY',
  best: 'BEST {n}',
  firstRun: 'FIRST RUN',
  armory: '🛒 ARMORY',
  move: 'move',
  dash: 'dash',
  pause: 'pause',
  touchHint: 'TOUCH: drag anywhere to move',
  yourCores: 'YOUR CORES',
  theRedSiege: 'THE RED SIEGE',
  hp: 'HP',
  spd: 'spd',
  footer: 'Enemies scale forever. The first TYRANT arrives at 2:30. Good luck.',
  xpShort: 'XP',

  // enemy attack blurbs
  atk_melee: 'charges',
  atk_laser: 'lasers',
  atk_bullets: 'bullets',
  atk_radial: 'bullet ring',
  atk_slam: 'shockwave',
  atk_spawn: 'spawns',

  // high scores
  highScores: 'HIGH SCORES',
  local: 'LOCAL',
  noRuns: 'No runs yet. Make history.',

  // level up
  levelN: 'LEVEL {n}',
  evolve: 'EVOLVE',
  reroll: '⟳ REROLL',
  rerollEmpty: 'NO REROLLS — BUY IN ARMORY',
  kind_stat: 'UPGRADE',
  kind_weapon: 'WEAPON',
  kind_shape: 'SHAPE CORE',
  kind_helper: 'HELPER',
  kind_special: 'SPECIAL',
  rarity_0: 'COMMON',
  rarity_1: 'RARE',
  rarity_2: 'EPIC',
  rarity_3: 'LEGENDARY',
  lv: 'LV',

  // pause
  paused: 'PAUSED',
  escResume: 'ESC TO RESUME',
  score: 'SCORE',
  level: 'LEVEL',
  kills: 'KILLS',
  tiers: 'TIERS',
  shape: 'SHAPE',
  yourBuild: 'YOUR BUILD',
  picked: '{n} picked',
  resume: '▶ RESUME',
  restart: '⟲ RESTART',
  menu: '⌂ MENU',
  mainMenu: '⌂ MAIN MENU',
  noUpgradesYet: 'No upgrades yet — level up to pick some.',
  more: '+{n} more…',
  grp_stat: 'UPGRADES',
  grp_weapon: 'WEAPONS',
  grp_shape: 'SHAPE CORES',
  grp_helper: 'HELPERS',
  grp_special: 'SPECIALS',

  // game over
  runTerminated: 'RUN TERMINATED',
  shattered: 'SHATTERED',
  finalScore: 'FINAL SCORE',
  newBest: '★ NEW PERSONAL BEST',
  coinsEarned: '+{n} coins earned',
  wave: 'WAVE',
  time: 'TIME',
  fellAs: 'FELL AS',
  finalBuild: 'FINAL BUILD',
  retry: '⟲ RETRY',
  spaceKey: '[SPACE]',

  // shop
  shopTitle: 'ARMORY',
  tab_shop: 'UPGRADES',
  tab_reroll: 'REROLLS',
  tab_color: 'COLOR',
  tab_location: 'LOCATION',
  maxed: 'MAXED',
  buyLv: 'LV {n}',
  colorHint: "Choose your shape's colour. Unlock premium tints with coins.",
  locationHint: 'Pick your battleground. Each arena has its own style, backdrop and hazardous mood.',
  active: '✓ ACTIVE',
  select: 'SELECT',

  // rerolls tab
  rerollTitle: 'REROLL TOKENS',
  rerollDesc: 'Spend a token during a level-up to redraw all three upgrade cards. Tokens are consumed permanently — stock up before a run.',
  rerollStock: 'IN STOCK',
  rerollMax: 'MAX {n}',
  rerollBuy: 'BUY TOKEN',
  rerollFull: 'STOCK FULL',
  rerollNote: 'You can hold at most {n} tokens at a time.',

  // in-canvas HUD & banners
  bnr_survive: 'SURVIVE',
  bnr_wave: 'WAVE {n}',
  bnr_core: '{name} CORE',
  bnr_secondwind: 'SECOND WIND!',
  bnr_tyrantDown: 'TYRANT DOWN',
  bnr_tyrantIn: '⚠ TYRANT INBOUND',
  hud_score: 'SCORE',
  hud_wave: 'WAVE {n}',
  hud_lv: 'LV {n}',
  hud_combo: 'x{n} COMBO',
  hint_dodge: 'DODGE THE RED SHAPES',
  hint_controls: 'DRAG anywhere · or WASD / Arrows',
  language: 'LANGUAGE',
  close: '✕',
};

const RU: Dict = {
  tagline: 'ГЕОМЕТРИЧЕСКОЕ ВЫЖИВАНИЕ · {n} УЛУЧШЕНИЙ',
  title1: 'ОСАДА',
  title2: 'ПОЛИГОНОВ',
  intro: 'Ты — фигура. Красные наступают. Поглощай новые ядра, ставь оружие, нанимай помощников — и переиграй их всех.',
  play: '▶ ИГРАТЬ',
  best: 'РЕКОРД {n}',
  firstRun: 'ПЕРВЫЙ ЗАБЕГ',
  armory: '🛒 АРСЕНАЛ',
  move: 'движение',
  dash: 'рывок',
  pause: 'пауза',
  touchHint: 'СЕНСОР: веди пальцем в любом месте',
  yourCores: 'ТВОИ ЯДРА',
  theRedSiege: 'КРАСНАЯ ОСАДА',
  hp: 'ХП',
  spd: 'скор',
  footer: 'Враги усиливаются бесконечно. Первый ТИРАН приходит на 2:30. Удачи.',
  xpShort: 'ОП',

  atk_melee: 'таранит',
  atk_laser: 'лазеры',
  atk_bullets: 'пули',
  atk_radial: 'кольцо пуль',
  atk_slam: 'ударная волна',
  atk_spawn: 'плодит',

  highScores: 'РЕКОРДЫ',
  local: 'ЛОКАЛЬНО',
  noRuns: 'Забегов ещё нет. Впиши себя в историю.',

  levelN: 'УРОВЕНЬ {n}',
  evolve: 'ЭВОЛЮЦИЯ',
  reroll: '⟳ ПЕРЕБРОС',
  rerollEmpty: 'НЕТ ЖЕТОНОВ — КУПИ В АРСЕНАЛЕ',
  kind_stat: 'УЛУЧШЕНИЕ',
  kind_weapon: 'ОРУЖИЕ',
  kind_shape: 'ЯДРО ФИГУРЫ',
  kind_helper: 'ПОМОЩНИК',
  kind_special: 'ОСОБОЕ',
  rarity_0: 'ОБЫЧНОЕ',
  rarity_1: 'РЕДКОЕ',
  rarity_2: 'ЭПИЧЕСКОЕ',
  rarity_3: 'ЛЕГЕНДАРНОЕ',
  lv: 'УР',

  paused: 'ПАУЗА',
  escResume: 'ESC — ПРОДОЛЖИТЬ',
  score: 'ОЧКИ',
  level: 'УРОВЕНЬ',
  kills: 'УБИЙСТВ',
  tiers: 'РАНГОВ',
  shape: 'ФИГУРА',
  yourBuild: 'ТВОЯ СБОРКА',
  picked: 'выбрано: {n}',
  resume: '▶ ПРОДОЛЖИТЬ',
  restart: '⟲ ЗАНОВО',
  menu: '⌂ МЕНЮ',
  mainMenu: '⌂ ГЛАВНОЕ МЕНЮ',
  noUpgradesYet: 'Улучшений пока нет — повышай уровень.',
  more: '+{n} ещё…',
  grp_stat: 'УЛУЧШЕНИЯ',
  grp_weapon: 'ОРУЖИЕ',
  grp_shape: 'ЯДРА ФИГУР',
  grp_helper: 'ПОМОЩНИКИ',
  grp_special: 'ОСОБЫЕ',

  runTerminated: 'ЗАБЕГ ОКОНЧЕН',
  shattered: 'РАЗБИТ',
  finalScore: 'ИТОГОВЫЙ СЧЁТ',
  newBest: '★ НОВЫЙ ЛИЧНЫЙ РЕКОРД',
  coinsEarned: '+{n} монет получено',
  wave: 'ВОЛНА',
  time: 'ВРЕМЯ',
  fellAs: 'ПАЛ КАК',
  finalBuild: 'ИТОГОВАЯ СБОРКА',
  retry: '⟲ ЗАНОВО',
  spaceKey: '[ПРОБЕЛ]',

  shopTitle: 'АРСЕНАЛ',
  tab_shop: 'УЛУЧШЕНИЯ',
  tab_reroll: 'ПЕРЕБРОСЫ',
  tab_color: 'ЦВЕТ',
  tab_location: 'АРЕНА',
  maxed: 'МАКСИМУМ',
  buyLv: 'УР {n}',
  colorHint: 'Выбери цвет своей фигуры. Премиум-оттенки открываются за монеты.',
  locationHint: 'Выбери поле боя. У каждой арены свой стиль, фон и настроение.',
  active: '✓ АКТИВНА',
  select: 'ВЫБРАТЬ',

  rerollTitle: 'ЖЕТОНЫ ПЕРЕБРОСА',
  rerollDesc: 'Потрать жетон при повышении уровня, чтобы заново разыграть все три карты. Жетоны расходуются безвозвратно — запасайся перед забегом.',
  rerollStock: 'В ЗАПАСЕ',
  rerollMax: 'МАКС {n}',
  rerollBuy: 'КУПИТЬ ЖЕТОН',
  rerollFull: 'ЗАПАС ПОЛОН',
  rerollNote: 'Одновременно можно хранить не больше {n} жетонов.',

  bnr_survive: 'ВЫЖИВАЙ',
  bnr_wave: 'ВОЛНА {n}',
  bnr_core: 'ЯДРО: {name}',
  bnr_secondwind: 'ВТОРОЕ ДЫХАНИЕ!',
  bnr_tyrantDown: 'ТИРАН ПОВЕРЖЕН',
  bnr_tyrantIn: '⚠ ПРИБЛИЖАЕТСЯ ТИРАН',
  hud_score: 'ОЧКИ',
  hud_wave: 'ВОЛНА {n}',
  hud_lv: 'УР {n}',
  hud_combo: 'x{n} КОМБО',
  hint_dodge: 'УВОРАЧИВАЙСЯ ОТ КРАСНЫХ',
  hint_controls: 'ВЕДИ ПАЛЬЦЕМ · или WASD / Стрелки',
  language: 'ЯЗЫК',
  close: '✕',
};

const TABLES: Record<Lang, Dict> = { en: EN, ru: RU };

export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let s = TABLES[lang][key] ?? TABLES.en[key] ?? key;
  if (params) {
    for (const k in params) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(params[k]));
  }
  return s;
}

/* ------------------------- game data ------------------------- */

interface NameDesc { name: string; desc?: string }

export const RU_SHAPES: Record<string, NameDesc> = {
  circle:   { name: 'Круг',        desc: 'Сбалансирован. Метает диски.' },
  triangle: { name: 'Треугольник', desc: 'Быстрый и острый. Пробивные лазеры.' },
  square:   { name: 'Квадрат',     desc: 'Крепкий. Поливает очередями пуль.' },
  pentagon: { name: 'Пятиугольник',desc: 'Агрессивный. Самонаводящиеся сферы.' },
  hexagon:  { name: 'Шестиугольник', desc: 'Стреляет кольцами болтов.' },
  heptagon: { name: 'Семиугольник',desc: 'Цепная молния между врагами.' },
  octagon:  { name: 'Восьмиугольник', desc: 'Колоссальная пушка. ОЧЕНЬ медленный.' },
};

export const RU_ENEMIES: Record<string, string> = {
  ecircle: 'Точка', etriangle: 'Клин', esquare: 'Блок', epentagon: 'Громила',
  ehexagon: 'Улей', eheptagon: 'Вертун', eoctagon: 'Колосс', edecagon: 'ТИРАН',
};

export const RU_WEAPONS: Record<string, NameDesc> = {
  disc:    { name: 'Диски',   desc: 'Вращающиеся диски пробивают 2 врагов.' },
  laser:   { name: 'Лазер',   desc: 'Мгновенный луч, прошивает всех в линии.' },
  bullet:  { name: 'Пули',    desc: 'Две скорострельные пули. Без остановки.' },
  orb:     { name: 'Сферы',   desc: 'Тяжёлые самонаводящиеся сферы.' },
  volley:  { name: 'Залп',    desc: 'Кольцо из шести болтов во все стороны.' },
  arc:     { name: 'Дуга',    desc: 'Молния, скачущая между врагами.' },
  shell:   { name: 'Снаряд',  desc: 'Медленный снаряд с огромным взрывом.' },
  blades:  { name: 'Клинки',  desc: 'Орбитальные клинки рубят всё рядом.' },
  nova:    { name: 'Нова',    desc: 'Пульсирующая ударная волна вокруг тебя.' },
  missile: { name: 'Ракеты',  desc: 'Рой ракет, взрывающихся при попадании.' },
  rail:    { name: 'Рельсотрон', desc: 'Заряженный слиток стирает целый ряд.' },
};

export const RU_UPGRADES: Record<string, NameDesc> = {
  dmg:      { name: 'Усилитель урона', desc: '+16% урона всему оружию' },
  rate:     { name: 'Скорострельность', desc: '+13% скорости стрельбы' },
  hp:       { name: 'Укрепление', desc: '+22 к макс. ХП (и лечит их)' },
  spd:      { name: 'Двигатели', desc: '+8% скорости передвижения' },
  pspd:     { name: 'Баллистика', desc: '+12% скорости снарядов' },
  crit:     { name: 'Точность', desc: '+5% шанса крита' },
  critd:    { name: 'Жестокость', desc: '+25% урона от критов' },
  pickup:   { name: 'Магнетизм', desc: '+35% радиуса притяжения сфер' },
  xpm:      { name: 'Прозрение', desc: '+15% получаемого опыта' },
  armor:    { name: 'Броня', desc: '−1 урона от каждого удара' },
  regen:    { name: 'Наноремонт', desc: '+0.6 ХП восстановления в секунду' },
  psize:    { name: 'Крупный калибр', desc: '+10% размера снарядов' },
  pierce:   { name: 'Пробитие', desc: '+1 пробитие снарядов' },
  multi:    { name: 'Раздвоение', desc: '+1 снаряд за выстрел' },
  cd:       { name: 'Разгон', desc: '−6% перезарядки всему' },
  knock:    { name: 'Импульс', desc: '+35% силы отбрасывания' },
  thorns:   { name: 'Шипы', desc: 'Отражает 4 урона при контакте' },
  leech:    { name: 'Вампиризм', desc: 'Лечит 1.2% от нанесённого урона' },
  score:    { name: 'Слава', desc: '+10% очков из всех источников' },
  lifespan: { name: 'Дальний выстрел', desc: '+20% времени жизни снарядов' },
  aoe:      { name: 'Радиус взрыва', desc: '+15% размера взрывов' },
  haste:    { name: 'Адреналин', desc: '+8% скорости бега и стрельбы' },

  w_disc:    { name: 'Диски',    desc: 'Взять: вращающиеся пробивные диски' },
  w_laser:   { name: 'Лазер',    desc: 'Взять: мгновенный пробивной луч' },
  w_bullet:  { name: 'Пули',     desc: 'Взять: парные скорострельные пули' },
  w_orb:     { name: 'Сферы',    desc: 'Взять: тяжёлые самонаводящиеся сферы' },
  w_volley:  { name: 'Залп',     desc: 'Взять: кольцо из 6 болтов' },
  w_arc:     { name: 'Дуга',     desc: 'Взять: цепная молния' },
  w_shell:   { name: 'Снаряд',   desc: 'Взять: взрывной пушечный снаряд' },
  w_blades:  { name: 'Клинки',   desc: 'Взять: орбитальные клинки-шредеры' },
  w_nova:    { name: 'Нова',     desc: 'Взять: пульсирующие ударные волны' },
  w_missile: { name: 'Ракеты',   desc: 'Взять: взрывной самонаводящийся рой' },
  w_rail:    { name: 'Рельсотрон', desc: 'Взять: заряженный слиток, стирающий ряд' },
  wslot:     { name: 'Оружейный отсек', desc: '+1 слот оружия (носи больше)' },
  wpower:    { name: 'Синергия',  desc: '+15% урона за каждое доп. оружие' },
  aux:       { name: 'Вспомогательный огонь', desc: 'Второстепенное оружие стреляет само' },

  shape_triangle: { name: 'Ядро: Треугольник', desc: 'Стань Треугольником — быстрый, хрупкий, лазеры' },
  shape_square:   { name: 'Ядро: Квадрат',     desc: 'Стань Квадратом — крепкий стрелок пулями' },
  shape_pentagon: { name: 'Ядро: Пятиугольник',desc: 'Стань Пятиугольником — сферы, +урон' },
  shape_hexagon:  { name: 'Ядро: Шестиугольник', desc: 'Стань Шестиугольником — залпы, +ХП' },
  shape_heptagon: { name: 'Ядро: Семиугольник',desc: 'Стань Семиугольником — цепная молния' },
  shape_octagon:  { name: 'Ядро: Восьмиугольник', desc: 'Стань Восьмиугольником — пушка. Медленно, но убойно' },

  drone:        { name: 'Дрон-помощник', desc: '+1 орбитальный дрон, стреляющий за тебя' },
  droneDmg:     { name: 'Боезапас дронов', desc: '+25% урона дронов и турелей' },
  droneRate:    { name: 'Приводы дронов', desc: '+15% скорострельности дронов' },
  orbit:        { name: 'Орбитальный страж', desc: '+1 орбитальная сфера (блокирует и бьёт)' },
  turret:       { name: 'Набор часового', desc: 'Ставит доп. автотурель каждую волну' },
  mine:         { name: 'Минёр', desc: 'Оставляет мины при движении' },
  companion:    { name: 'Союзная фигура', desc: 'Дружественная фигура сражается рядом' },
  companionDmg: { name: 'Мощь союзника', desc: '+30% урона и размера союзника' },
  shieldorbs:   { name: 'Ярость стражей', desc: '+20% скорости и урона орбит' },

  dash:      { name: 'Привод рывка', desc: 'ОТКРЫТЬ РЫВОК — бросок вперёд (Пробел / кнопка)' },
  dashcd:    { name: 'Катушки рывка', desc: '−25% перезарядки рывка' },
  shieldmax: { name: 'Барьер', desc: '+1 заряд щита, блокирующий удар' },
  shieldreg: { name: 'Катушка барьера', desc: '−35% времени перезарядки щита' },
  secondwind:{ name: 'Второе дыхание', desc: 'Одно воскрешение с 50% ХП' },
  regenkill: { name: 'Ремонт с убийств', desc: 'Лечит 0.35 ХП за убийство' },

  homing:    { name: 'Поле наведения', desc: 'Снаряды подкручиваются к врагам' },
  ricochet:  { name: 'Рикошет', desc: 'Снаряды отскакивают к новой цели' },
  explode:   { name: 'Нестабильные попадания', desc: '15% шанс взрыва при попадании' },
  chainhit:  { name: 'Цепная реакция', desc: 'Попадания бьют молнией по соседям' },
  exec:      { name: 'Палач', desc: '+18% урона врагам ниже 35% ХП' },
  giant:     { name: 'Убийца гигантов', desc: '+22% урона крупным врагам' },
  swarm:     { name: 'Истребитель роя', desc: '+25% урона мелким врагам' },
  deathbomb: { name: 'Посмертный взрыв', desc: 'Враги взрываются при смерти' },
  bloom:     { name: 'Цветение пуль', desc: 'Снаряды раскалываются в конце пути' },
  freeze:    { name: 'Крио-удары', desc: '25% шанс заморозить врага' },
  slowfield: { name: 'Гравитационный колодец', desc: 'Враги рядом замедлены на 22%' },
  bombdrop:  { name: 'Ковровая бомбардировка', desc: 'Автоматически роняет бомбы вокруг' },
  glass:     { name: 'Хрустальная пушка', desc: '+35% урона, −12% макс. ХП' },
  timewarp:  { name: 'Замедление времени', desc: 'Время замедляется ниже 30% ХП' },
  xpwave:    { name: 'Всплеск мудрости', desc: 'Повышение уровня разбрасывает опыт' },
  combo:     { name: 'Двигатель комбо', desc: '+50% окна комбо и роста очков' },
  lucky:     { name: 'Удачный расклад', desc: 'Чаще выпадают редкие улучшения' },
  barrels:    { name: 'Обоймы на грани', desc: '+1 ствол по периметру фигуры (до 5)' },
  focus:      { name: 'Сосредоточенный огонь', desc: 'Периметрные стволы сходятся на 8% плотнее' },
  fire:       { name: 'Зажигательные', desc: 'Попадания поджигают врагов — урон со временем' },
  firedmg:    { name: 'Адский огонь', desc: '+30% урона и длительности горения' },
  frost:      { name: 'Крио-ядро', desc: 'Попадания замораживают врагов' },
  frostpow:   { name: 'Абсолютный ноль', desc: '+25% шанса и длительности заморозки' },
  shock:      { name: 'Грозовое ядро', desc: 'Попадания бьют молнией по соседям' },
  shockpow:   { name: 'Перезаряд', desc: '+30% урона молнии и дальности прыжка' },
  poison:     { name: 'Ядовитые наконечники', desc: 'Попадания накладывают яд' },
  void:       { name: 'Метка Пустоты', desc: 'Попадания срывают броню — враги получают больше урона' },
  laserDrone: { name: 'Лазерная оса', desc: '+1 лазерный дрон с пробивными лучами' },
  frostDrone: { name: 'Крио-клещ', desc: '+1 крио-дрон, замораживающий при попадании' },
  fireDrone:  { name: 'Угольный разведчик', desc: '+1 огненный дрон, обжигающий врагов' },
  shockDrone: { name: 'Искровая букашка', desc: '+1 искровой дрон с цепной молнией' },
  healDrone:  { name: 'Мед-под', desc: '+1 дрон-медик, восстанавливающий здоровье' },
  shieldDrone:{ name: 'Эгида', desc: '+1 дрон-эгида, заряжающий щит' },
  sniper:     { name: 'Снайперское гнездо', desc: 'Ставит дальнобойную снайперскую турель' },
  flamethrower:{ name: 'Испепелитель', desc: 'Ставит огнемётную турель ближнего боя' },
  beacon:     { name: 'Маяк ауры', desc: 'Маяк ускоряет стрельбу, пока ты рядом' },
  wolf:       { name: 'Вожак стаи', desc: '+1 агрессивный волк-компаньон' },
  golem:      { name: 'Каменный голем', desc: '+1 танк-голем, притягивающий огонь' },
  prism:      { name: 'Световая призма', desc: '+1 орбитальная призма, преломляющая лучи' },
  overheat:   { name: 'Перегрев', desc: 'Скорострельность растёт при непрерывной стрельбе' },
  mark:       { name: 'Метка охотника', desc: 'Первый удар помечает врага: +25% урона' },
};

export const RU_SHOP: Record<string, NameDesc> = {
  s_dmg:    { name: 'Боеголовка',   desc: 'Начинать забег с +8% урона' },
  s_hp:     { name: 'Оплот',        desc: 'Начинать с +20 макс. ХП' },
  s_regen:  { name: 'Нанокровь',    desc: 'Начинать с +0.5 ХП/сек регенерации' },
  s_spd:    { name: 'Форсаж',       desc: 'Начинать с +5% скорости бега' },
  s_crit:   { name: 'Наведение',    desc: 'Начинать с +3% шанса крита' },
  s_rate:   { name: 'Автозарядка',  desc: 'Начинать с +6% скорострельности' },
  s_pickup: { name: 'Магнитная катушка', desc: 'Начинать с +25% магнита сфер' },
  s_xp:     { name: 'Нейролинк',    desc: 'Начинать с +8% опыта' },
  s_armor:  { name: 'Активная броня', desc: 'Начинать с +1 брони (плоский блок)' },
  s_luck:   { name: 'Фортуна',      desc: 'Чаще выпадают редкие улучшения' },
  s_coin:   { name: 'Инвестор',     desc: '+15% монет за забег' },
};

export const RU_THEMES: Record<string, NameDesc> = {
  nebula:  { name: 'Туманность',  desc: 'Звёздная пыль и далёкие светила' },
  void:    { name: 'Глубокая Пустота', desc: 'Дрейфующие обломки в тишине' },
  sunset:  { name: 'Солнечная Вспышка', desc: 'Жаркие дюны и восходящие угли' },
  toxic:   { name: 'Токсичное Болото', desc: 'Сотовая топь и пузыри газа' },
  ice:     { name: 'Крио-Поле',   desc: 'Ледяные осколки и метель' },
  crimson: { name: 'Багровая Война', desc: 'Руины, пепел и сирены' },
  gold:    { name: 'Золотой Зал', desc: 'Древние кольца и парящая пыльца' },
};

export const RU_COLORS: Record<string, string> = {
  teal: 'Бирюза', sky: 'Небо', violet: 'Фиалка', lime: 'Лайм',
  rose: 'Роза', amber: 'Янтарь', coral: 'Коралл', pink: 'Пурпур',
  mint: 'Мята', white: 'Жемчуг', gold: 'Золото', crimson: 'Багрянец',
};

/* ------------------------- accessors ------------------------- */

export function shapeName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_SHAPES[id]?.name ?? fallback) : fallback;
}
export function shapeBlurb(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_SHAPES[id]?.desc ?? fallback) : fallback;
}
export function enemyName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_ENEMIES[id] ?? fallback) : fallback;
}
export function weaponName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_WEAPONS[id]?.name ?? fallback) : fallback;
}
export function weaponDesc(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_WEAPONS[id]?.desc ?? fallback) : fallback;
}
export function upgName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_UPGRADES[id]?.name ?? fallback) : fallback;
}
export function upgDesc(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_UPGRADES[id]?.desc ?? fallback) : fallback;
}
export function shopName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_SHOP[id]?.name ?? fallback) : fallback;
}
export function shopDesc(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_SHOP[id]?.desc ?? fallback) : fallback;
}
export function themeName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_THEMES[id]?.name ?? fallback) : fallback;
}
export function colorName(lang: Lang, id: string, fallback: string) {
  return lang === 'ru' ? (RU_COLORS[id] ?? fallback) : fallback;
}
