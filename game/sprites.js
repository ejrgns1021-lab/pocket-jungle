// 픽셀 스프라이트 원본 데이터 (문자 1개 = 픽셀 1개, 색은 PALETTE 참고)
export const PALETTE = {
  '.': null,
  K: '#182018', W: '#f8f8f0', R: '#e83830', r: '#a82020',
  G: '#389848', g: '#206830', L: '#78d858', S: '#f8c898',
  B: '#3868b8', b: '#204078', Y: '#f8d838', P: '#9858d8',
  p: '#683098', O: '#f88828', C: '#68d8f8', M: '#889890',
  m: '#586860', T: '#a86838', t: '#784820', E: '#f85888'
}

/**
 * 문자열 그리드를 오프스크린 캔버스로 미리 구워 둔다.
 * swap: { 'L': 'C' } 처럼 색 문자를 바꿔 같은 그림의 다른 색 버전을 만든다 (정령 진화에 사용).
 */
export function bakeSprite(rows, scale, flashWhite = false, swap = null) {
  const h = rows.length
  const w = rows[0].length
  const c = document.createElement('canvas')
  c.width = w * scale
  c.height = h * scale
  const cx = c.getContext('2d')
  cx.imageSmoothingEnabled = false
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x]
      if (swap && swap[ch]) ch = swap[ch]
      const col = PALETTE[ch]
      if (!col) continue
      cx.fillStyle = flashWhite ? (ch === 'K' ? '#202830' : '#ffffff') : col
      cx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  return c
}

export const TRAINER_F1 = [
  '.....KKKKKK.....', '....KRRRRRRK....', '...KRRRRWWWRK...', '...KKKKKKKKKK...',
  '...KSSSSSSSSK...', '...KSKSSSSKSK...', '....KSSSSSSK....', '.KKKBBBBBBBBKK..',
  'KRRRKBBBBBBKSK..', '.KK.KBWBBWBKSK..', '....KBBBBBBKK...', '....KbbbbbbK....',
  '....Kbb..bbK....', '...KRRK..KRRK...', '...KKKK...KK....', '................'
]
export const TRAINER_F2 = [
  '.....KKKKKK.....', '....KRRRRRRK....', '...KRRRRWWWRK...', '...KKKKKKKKKK...',
  '...KSSSSSSSSK...', '...KSKSSSSKSK...', '....KSSSSSSK....', '..KKBBBBBBBBKK..',
  '.KRRKBBBBBBKSK..', 'KRR.KBWBBWBKSK..', '.KK.KBBBBBBKK...', '....KbbbbbbK....',
  '....Kbb..bbK....', '....KK...KRRK...', '.........KKKK...', '................'
]

export const SPIRIT_F1 = [
  '...KK..KK...', '..KLLKKLLK..', '..KLLLLLLK..', '.KLKLLLLKLK.',
  '.KLLLLLLLLK.', '..KKLYYLLKK.', '.KCCGGGGGCCK', '..KKGGGGKK..',
  '...KGGGGK...', '....KKKK....', '............', '............'
]

const E16 = '................'
export const ENEMY_GRIDS = {
  caterpillar: [
    ['....KK..........', '...KRRK..KKKK...', '....KK..KLLLLK..', '.......KLKLLKLK.', '.......KLLLLLLK.', '......KKLYYYLLKK', '.....KLLLLLLLLK.', '....KLLYYYYLLK..', '...KLLLLLLLLK...', '..KLLYYYYLLK....', '..KLLLLLLKK.....', '...KKKKKK.......', E16, E16, E16, E16],
    ['....KK..........', '...KRRK..KKKK...', '....KK..KLLLLK..', '.......KLKLLKLK.', '.......KLLLLLLK.', '......KKLYYYLLKK', '.....KLLLLLLLLK.', '....KLLYYYYLLK..', '...KLLLLLLLLK...', '...KLLYYYYLLK...', '....KLLLLLLKK...', '.....KKKKKK.....', E16, E16, E16, E16]
  ],
  sprout: [
    ['...KK..KK..KK...', '..KLLKKLLKKLLK..', '...KLLLLLLLLK...', '....KKKKKKKK....', '...KBBBBBBBBK...', '..KBBBBBBBBBBK..', '..KBBRBBBBBRBK..', '..KBBBBBBBBBBK..', '...KBBBBBBBBK...', '....KK....KK....', '...KbbK..KbbK...', E16, E16, E16, E16, E16],
    ['....KK.KK.KK....', '...KLLKLLKLLK...', '....KLLLLLLK....', '....KKKKKKKK....', '...KBBBBBBBBK...', '..KBBBBBBBBBBK..', '..KBBRBBBBBRBK..', '..KBBBBBBBBBBK..', '...KBBBBBBBBK...', '....KK....KK....', '....KbbKKbbK....', E16, E16, E16, E16, E16]
  ],
  spider: [
    ['....KKKKKKKK....', '..KKPPPPPPPPKK..', '.KPPpPPPPPPpPPK.', 'KPPpPPPPPPPPpPPK', 'KPPPPYYPPYYPPPPK', 'KPPPPPPPPPPPPPPK', '.KPPPPWWWWPPPPK.', 'KK..KKKKKKKK..KK', 'K.KK..K..K..KK.K', '..K...K..K...K..', E16, E16, E16, E16, E16, E16],
    ['....KKKKKKKK....', '..KKPPPPPPPPKK..', '.KPPpPPPPPPpPPK.', 'KPPpPPPPPPPPpPPK', 'KPPPPYYPPYYPPPPK', 'KPPPPPPPPPPPPPPK', '.KPPPPWWWWPPPPK.', '.KK.KKKKKKKK.KK.', '..KK.K....K.KK..', '.....K....K.....', E16, E16, E16, E16, E16, E16]
  ],
  viper: [
    ['.....KKKKKK.....', '....KPPPPPPK....', '...KPPYPPYPPK...', '...KPPPPPPPPK...', '....KKpWWpKK....', '.....KppppK.....', '...KKPPPPPPKK...', '..KPPPPYYYYPPK..', '..KPPPPPPPPPPK..', '...KKPPPPPPKK...', '.....KKppKK.....', '.......KK.......', E16, E16, E16, E16],
    ['......KKKKKK....', '.....KPPPPPPK...', '....KPPYPPYPPK..', '....KPPPPPPPPK..', '.....KKpWWpKK...', '....KppppK......', '..KKPPPPPPKK....', '.KPPPPYYYYPPK...', '.KPPPPPPPPPPK...', '..KKPPPPPPKK....', '....KKppKK......', '......KK........', E16, E16, E16, E16]
  ],
  hornet: [
    ['..KKKK....KKKK..', '.KCCCCK..KCCCCK.', '..KKKKK..KKKKK..', '.....KKKKKK.....', '....KYYYYYYK....', '...KYRYYYYRYK...', '....KYYYYYYK....', '...KKYYYYYYKK...', '..KYYYYKKKKYYK..', '...KYYKKKKYYK...', '....KYYYYYYK....', '.....KKYYKK.....', '......KKKK......', E16, E16, E16],
    ['....KK....KK....', '...KCCK..KCCK...', '....KKK..KKK....', '.....KKKKKK.....', '....KYYYYYYK....', '...KYRYYYYRYK...', '....KYYYYYYK....', '...KKYYYYYYKK...', '..KYYYYKKKKYYK..', '...KYYKKKKYYK...', '....KYYYYYYK....', '.....KKYYKK.....', '......KKKK......', E16, E16, E16]
  ],
  golem: [
    ['....KKKKKKKK....', '..KKMMMMMMMMKK..', '.KMGGGGMMMMMMMK.', 'KMMGGGGMMMMMMMMK', 'KMMMRRMMMMRRMMMK', 'KMMMMMMMMMMMMMMK', 'KmmMMMMMMMMMMmmK', '.KmmMMMMMMMMmmK.', '..KKmmmmmmmmKK..', '..KmmK....KmmK..', '..KKKK....KKKK..', E16, E16, E16, E16, E16],
    [E16, '....KKKKKKKK....', '..KKMMMMMMMMKK..', '.KMGGGGMMMMMMMK.', 'KMMGGGGMMMMMMMMK', 'KMMMRRMMMMRRMMMK', 'KMMMMMMMMMMMMMMK', 'KmmMMMMMMMMMMmmK', '.KmmMMMMMMMMmmK.', '..KKmmmmmmmmKK..', '.KmmK......KmmK.', '.KKKK......KKKK.', E16, E16, E16, E16]
  ]
}

const E24 = '........................'
export const BOSS_GRIDS = {
  thornbloom: [
    '.......KKKKKKKKKK.......', '.....KKEEEEEEEEEEKK.....', '....KEEEYYYYYYYYEEEK....', '...KEEEYYWWWWWWYYEEEK...',
    '...KEEEYWWWWWWWWYEEEK...', '....KKKKKKKKKKKKKKKK....', '...KLLLLLLLLLLLLLLLLK...', '..KLLGGGGGGGGGGGGGGLLK..',
    '.KKGGGGGGGGGGGGGGGGGGKK.', 'KGGGGGGGGGGGGGGGGGGGGGGK', 'KGGGGRRGGGGGGGGGGGRRGGGK', 'KGGGGGGGGGGGGGGGGGGGGGGK',
    'KGGGGGGWWWWWWWWWWGGGGGGK', '.KGGGGGGGGGGGGGGGGGGGGK.', '..KKggggggggggggggggKK..', '..KgggKK........KKgggK..',
    '..KKKK............KKKK..', E24, E24, E24, E24, E24, E24, E24
  ],
  mantis: [
    '..KK................KK..', '.KWWK....KKKKKK....KWWK.', '.KWWWK..KGGGGGGK..KWWWK.', '..KWWWK.KGRGGRGK.KWWWK..',
    '...KWWWK.KKKKKK.KWWWK...', '....KWWKKLLLLLLKKWWK....', '.....KKLLLLLLLLLLKK.....', '......KLLYYYYYYLLK......',
    '.....KLLLLLLLLLLLLK.....', '....KLLGGGGGGGGGGLLK....', '...KLLG..KKKKKK..GLLK...', '..KLLG..KGGGGGGK..GLLK..',
    '.......KGGK..KGGK.......', '......KGGK....KGGK......', '......KKKK....KKKK......', E24, E24, E24, E24, E24, E24, E24, E24, E24
  ],
  foxfire: [
    '....KK............KK....', '...KYYK..........KYYK...', '..KYYYYKKKKKKKKKKYYYYK..', '..KYYYYYYYYYYYYYYYYYYK..',
    '...KYYYYRRYYYYRRYYYYK...', '....KYYYYYYYYYYYYYYK....', '..KKKYYYYWWWWWWYYYYKKK..', '.KOOOKYYYYYYYYYYYYKOOOK.',
    'KOOOOOKYYYYYYYYYYKOOOOOK', 'KOOOOOOKYYYYYYYYKOOOOOOK', '.KOOOOOOKYYYYYYKOOOOOOK.', '..KKKKKKKYYYYYYKKKKKKK..',
    '........KYYYYYYK........', '.......KYYK..KYYK.......', '.......KKK....KKK.......', E24, E24, E24, E24, E24, E24, E24, E24, E24
  ],
  fairy: [
    '......KK........KK......', '.....KCCK......KCCK.....', '......KCCKKKKKKCCK......', '.......KLLLLLLLLK.......',
    '......KLLLLLLLLLLK......', '.....KLLCCLLLLCCLLK.....', '.....KLLCCLLLLCCLLK.....', '......KLLLLLLLLLLK......',
    '....KKKLLLLLLLLLLKKK....', '...KCCKLLLLLLLLLLKCCK...', '....KKKLLGGGGGGLLKKK....', '......KLLGGGGGGLLK......',
    '.......KLLLLLLLLK.......', '........KLL..LLK........', '........KK....KK........', E24, E24, E24, E24, E24, E24, E24, E24, E24
  ]
}

export const CHEST_GRID = [
  E16, E16, '..KKKKKKKKKKKK..', '.KYYYYYYYYYYYYK.', '.KYTTTTTTTTTTYK.', '.KYTTTTTTTTTTYK.',
  '.KKKKKKKKKKKKKK.', '.KYYYYYWWYYYYYK.', '.KYTTTTWWTTTTYK.', '.KYTTTTTTTTTTYK.',
  '.KYTTTTTTTTTTYK.', '.KYYYYYYYYYYYYK.', '..KKKKKKKKKKKK..', E16, E16, E16
]

export const TREE_GRID = [
  '.......KKKKKKKKKK.......', '.....KKLLLLLLLLLLKK.....', '...KKLLLLGGGGGGLLLLKK...', '..KLLLLGGGGGGGGGGLLLLK..',
  '.KLLLGGGGGGGGGGGGGGLLLK.', '.KLLGGGGGGLLLLGGGGGGLLK.', 'KLLGGGGGGLLLLLLGGGGGGLLK', 'KLLGGGGGGGGGGGGGGGGGGLLK',
  'KGGGggggGGGGGGGGggggGGGK', '.KGGggggggggggggggggGGK.', '.KKggggggggggggggggggKK.', '...KKKKKKKKKKKKKKKKKK...',
  '.......KTTTTTTTTK.......', '.......KTtTTTTtTK.......', '.......KTTTTTTTTK.......', '......KKtTTTTTTtKK......',
  '......KKKKKKKKKKKK......', E24
]

/** 정령 진화 단계별 색 교체표 (1단계는 원본) */
export const SPIRIT_STAGE_SWAPS = [
  null,
  { L: 'C', G: 'B', g: 'b', Y: 'W' },
  { L: 'Y', G: 'O', g: 'T', C: 'E', Y: 'R' }
]

export function buildAtlas() {
  const atlas = {
    trainer: [bakeSprite(TRAINER_F1, 2), bakeSprite(TRAINER_F2, 2)],
    spirits: SPIRIT_STAGE_SWAPS.map((sw) => bakeSprite(SPIRIT_F1, 2, false, sw)),
    chest: bakeSprite(CHEST_GRID, 2),
    tree: bakeSprite(TREE_GRID, 2),
    enemies: {}, enemiesFlash: {}, bosses: {}, bossesFlash: {}
  }
  for (const k of Object.keys(ENEMY_GRIDS)) {
    atlas.enemies[k] = ENEMY_GRIDS[k].map((g) => bakeSprite(g, 2))
    atlas.enemiesFlash[k] = ENEMY_GRIDS[k].map((g) => bakeSprite(g, 2, true))
  }
  for (const k of Object.keys(BOSS_GRIDS)) {
    atlas.bosses[k] = bakeSprite(BOSS_GRIDS[k], 3)
    atlas.bossesFlash[k] = bakeSprite(BOSS_GRIDS[k], 3, true)
  }
  return atlas
}
