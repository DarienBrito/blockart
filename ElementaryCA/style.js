import React, { useRef } from 'react'
import Sketch from 'react-p5'
import MersenneTwister from 'mersenne-twister'

/*

Create your Custom style to be turned into a EthBlock.art Mother NFT

Basic rules:
 - use a minimum of 1 and a maximum of 4 "modifiers", modifiers are values between 0 and 1,
 - use a minimum of 1 and a maximum of 3 colors, the color "background" will be set at the canvas root
 - Use the block as source of entropy, no Math.random() allowed!
 - You can use a "shuffle bag" using data from the block as seed, a MersenneTwister library is provided

 Arguments:
  - block: the blockData, in this example template you are given 3 different blocks to experiment with variations, check App.js to learn more
  - mod[1-3]: template modifier arguments with arbitrary defaults to get your started
  - color: template color argument with arbitrary default to get you started

Getting started:
 - Write p5.js code, comsuming the block data and modifier arguments,
   make it cool and use no random() internally, component must be pure, output deterministic
 - Customize the list of arguments as you wish, given the rules listed below
 - Provide a set of initial /default values for the implemented arguments, your preset.
 - Think about easter eggs / rare attributes, display something different every 100 blocks? display something unique with 1% chance?

 - check out p5.js documentation for examples!
*/

let DEFAULT_SIZE = 500
const CustomStyle = ({
  block,
  canvasRef,
  attributesRef,
  width,
  height,
  handleResize,
  mod1 = 0.25, // Scale percentage (the smaller the more detail, but also heavier to compute)
  mod2 = 0.0, // Shape probability (0 blocks, < 0.5 higher prob blocks, > 0.5 higher prob circles, 1 circle)
  mod3 = 0.0, // Shape mode prob (Center/Corner)
  color1 = '#ffffff', // dead
  color2 = '#000000', // alive
  background = '#ffffff'
}) => {
  const shuffleBag = useRef()
  const ca_rule = useRef()
  const ca_class = useRef()
  const ca_percent = useRef()
  const ca_simmetry = useRef()
  const ca_rarity = useRef()

  const { hash } = block

  /*
    CA1D 
    ===============
    www.darienbrito.com
    info@darienbrito.com

    1D cellular automata generated with data
    from block transactions.
  */

  class CellularAutomata {
    constructor(p5, rule, width, height, scale, margin) {
      this.p5 = p5
      this.rules = null
      this.cells = []
      this.scale = scale
      this.generation = 0
      this.ratio = height / width
      this.woffset = width * 0.25 * this.ratio
      this.hoffset = height * 0.25
      this.width = (width - this.woffset) / scale
      this.height = (height - this.hoffset) / scale

      // Built later
      this.injection = []
      this.injectionPoints = 0
      this.injectionCounter = 0
      this.wholeSystem = []
    }

    init(rule, injection, injectionPoints) {
      this.setRule(rule)
      this.applyBlockInjection(injection, injectionPoints)
      this.start()
    }

    setRule(rule) {
      this.rules = this.parseRule(rule)
    }

    applyBlockInjection(injection, injectionPoints) {
      this.injection = injection
      this.injectionPoints = injectionPoints
    }

    parseRule(rule) {
      let binary = rule.toString(2)
      binary = '00000000'.substr(binary.length) + binary
      return binary
    }

    start() {
      // Prepare whole stack
      this.wholeSystem[this.generation] = []

      for (let i = 0; i < this.width; i++) {
        this.cells[i] = 0
        this.wholeSystem[this.generation][i] = 0
      }

      // Set middle cell alive to ensure some generation
      let center = this.p5.int(this.cells.length / 2)
      this.cells[center] = 1
      this.wholeSystem[this.generation][center] = 1
      this.generation++
    }

    //////////////////////////
    // Injection functions
    //////////////////////////

    getInjectionPoint(i) {
      let point = parseInt(this.injection[i].x * 255, 10) % this.height
      return point
    }

    injectSeed() {
      // Inject seed
      let idx = parseInt(this.injection[this.injectionCounter].y * 255, 10) % this.width
      this.cells[idx] = 1
      this.injectionCounter++
    }

    checkInjection() {
      // Inject whenever told, except on first generation
      for (let i = 0; i < this.injectionPoints; i++) {
        if (this.generation == this.getInjectionPoint(i)) {
          this.injectSeed()
        }
      }
    }

    //////////////////////////
    // Generation utilities
    //////////////////////////

    modulo(n, m) {
      return ((n % m) + m) % m
    }

    generate() {
      let next = []

      //Check if injection should happen
      this.checkInjection()

      // Check neighbours
      let dim = this.cells.length
      for (let i = 0; i < dim; i++) {
        let l = this.cells[this.modulo(i - 1, dim)]
        let c = this.cells[i]
        let r = this.cells[this.modulo(i + 1, dim)]
        next[i] = this.executeRules(l, c, r)
      }

      // Prepare whole stack
      this.wholeSystem[this.generation] = []

      // Update
      for (let i = 0; i < this.cells.length; i++) {
        this.cells[i] = next[i]
        this.wholeSystem[this.generation][i] = next[i]
      }

      this.generation++
    }

    generateAll() {
      while (!this.isComplete()) {
        this.generate()
      }
    }

    executeRules(a, b, c) {
      // Binary to decimal
      let idx = 7 - parseInt(this.p5.str(a) + this.p5.str(b) + this.p5.str(c), 2)
      let rule = parseInt(this.rules[idx], 10)
      return rule
    }

    isComplete() {
      return this.generation >= this.height
    }

    //////////////////////////
    // Drawing
    //////////////////////////

    getRandomPair(i) {
      let idx = this.p5.int(i % this.injection.length)
      let rand = this.injection[idx]
      //this.p5.print('Thing', rand, idx)
      return rand
    }

    drawRect(i, j, s) {
      this.p5.rect(i, j, s, s)
    }

    drawEllipse(i, j, s, mode) {
      this.p5.ellipseMode(mode)
      this.p5.ellipse(i, j, s, s)
    }

    drawAlternate(i, j, s, p, mode) {
      // Alternate shape using the injected random values
      let pair = this.getRandomPair(i)
      let px = i * this.scale + this.woffset * 0.5
      let py = j * this.scale + this.hoffset * 0.5

      if (pair.x > p) {
        this.drawRect(px, py, s)
      } else {
        this.drawEllipse(px, py, s, mode)
      }
    }

    drawShape(i, j, s, p, p2) {
      let mode = this.p5.CENTER
      let pair = this.getRandomPair(i)
      if (pair.y > p2) {
        mode = this.p5.CORNER
      }

      this.drawAlternate(i, j, s, p, mode)
    }

    display() {
      for (let i = 0; i < this.cells.length; i++) {
        this.p5.fill(this.cells[i] * 255)
        this.p5.rect(i * this.scale, 0, this.scale, this.scale)
      }
    }

    displayAll(scale, deadColor, aliveColor, shapeProb, ellipseModeProb) {
      let finalScale = this.scale * scale
      let colors = [deadColor, aliveColor]
      for (let j = 0; j < this.wholeSystem.length; j++) {
        for (let i = 0; i < this.wholeSystem[j].length; i++) {
          let state = this.wholeSystem[j][i]
          this.p5.fill(colors[state])
          this.p5.noStroke()
          this.drawShape(i, j, finalScale, shapeProb, ellipseModeProb)
        }
      }
    }

    displayMirrored(scale, deadColor, aliveColor, shapeProb, ellipseModeProb) {
      let finalScale = this.scale * scale
      let colors = [deadColor, aliveColor]

      let cy = this.p5.int(this.wholeSystem.length / 2)
      let cx = this.p5.int(this.wholeSystem[0].length / 2)
      for (let j = 0; j < this.wholeSystem.length; j++) {
        let idy = j >= cy ? cy - (j % cy) : j
        for (let i = 0; i < this.wholeSystem[idy].length; i++) {
          let idx = i >= cx ? cx - (i % cx) : i
          let state = this.wholeSystem[idy][idx]
          this.p5.fill(colors[state])
          this.p5.noStroke()
          this.drawShape(i, j, finalScale, shapeProb, ellipseModeProb)
        }
      }
    }
  }

  function makeCanvas(p5, caSystem, rule, margin) {
    // Margin
    p5.rectMode(p5.CORNER)
    p5.noStroke()
    p5.fill(0)
    p5.rect(0, 0, width, margin)
    p5.rect(0, 0, margin, height)
    p5.rect(width - margin, 0, margin, height)
    p5.rect(0, height - margin, width, margin)

    let size = width * 0.01
    let binary = caSystem.parseRule(rule)
    let len = binary.length
    let total = size * len
    let gap = 1
    let inner = 10
    p5.push()
    p5.translate(width - total - margin - gap * len - inner, -inner, 0)
    for (let i = 0; i < len; i++) {
      let val = parseInt(binary[i], 10)

      let x = i * (size + gap)
      let y = height - margin - size

      p5.noFill()
      p5.stroke(0, 50)
      p5.rectMode(p5.CENTER)
      p5.ellipseMode(p5.CENTER)
      p5.ellipse(x, y, size, size)

      p5.noStroke()
      p5.fill(val * 255)
      p5.ellipse(x, y, size * 0.5, size * 0.5)
    }
    p5.pop()
  }

  function mapModifier(p5, val, toMin, toMax) {
    return parseInt(p5.map(val, 0.0, 1.0, toMin, toMax), 10)
  }

  function findPercentage(v) {
    let pct = Math.round((v.length / 255) * 100)
    return pct
  }

  function findClass(rule) {
    // Class I - Void
    let c1 = [0, 8, 32, 40, 64, 72, 96, 104, 128, 136, 160, 168, 192, 200, 224, 232]

    // Class II Periodic
    let c2 = [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      19,
      20,
      21,
      23,
      24,
      25,
      27,
      29,
      31,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      41,
      42,
      43,
      44,
      46,
      47,
      48,
      49,
      51,
      52,
      53,
      55,
      56,
      59,
      61,
      63,
      65,
      66,
      67,
      68,
      69,
      70,
      71,
      74,
      76,
      78,
      79,
      80,
      81,
      83,
      84,
      85,
      87,
      88,
      92,
      93,
      95,
      97,
      98,
      100,
      103,
      106,
      108,
      111,
      112,
      113,
      115,
      116,
      117,
      119,
      120,
      123,
      125,
      127,
      130,
      132,
      134,
      138,
      139,
      140,
      142,
      143,
      144,
      148,
      151,
      152,
      155,
      159,
      162,
      164,
      166,
      170,
      171,
      172,
      173,
      174,
      175,
      176,
      180,
      183,
      184,
      185,
      187,
      189,
      191,
      194,
      196,
      201,
      202,
      203,
      204,
      205,
      207,
      208,
      209,
      211,
      212,
      213,
      215,
      216,
      217,
      219,
      221,
      223,
      226,
      227,
      228,
      229,
      231,
      233,
      234,
      235,
      236,
      237,
      239,
      240,
      241,
      243,
      244,
      245,
      247,
      248,
      249,
      251,
      253,
      255
    ]

    // Class III Structure
    let c3 = [
      18,
      22,
      26,
      28,
      50,
      54,
      57,
      58,
      60,
      62,
      73,
      77,
      82,
      90,
      91,
      94,
      99,
      102,
      105,
      109,
      110,
      114,
      118,
      122,
      124,
      126,
      129,
      131,
      133,
      137,
      141,
      145,
      146,
      147,
      150,
      153,
      154,
      156,
      157,
      158,
      161,
      163,
      165,
      167,
      177,
      178,
      179,
      181,
      182,
      186,
      188,
      190,
      193,
      195,
      197,
      198,
      199,
      206,
      210,
      214,
      218,
      220,
      222,
      230,
      238,
      242,
      246,
      250,
      252,
      254
    ]

    // Class IV Chaotic
    let c4 = [30, 45, 75, 86, 89, 101, 107, 121, 135, 149, 169, 225]

    if (c1.includes(rule)) {
      return ['Emptied', findPercentage(c1)]
    } else if (c2.includes(rule)) {
      return ['Periodic', findPercentage(c2)]
    } else if (c3.includes(rule)) {
      return ['Structured', findPercentage(c3)]
    } else if (c4.includes(rule)) {
      return ['Chaotic', findPercentage(c4)]
    }
  }

  function findExtraRarity(p5, caClass, mirrored) {
    if (caClass === 'Periodic' && mirrored) {
      return 25
    } else if (caClass === 'Structured' && mirrored) {
      return 50
    } else if (caClass === 'Emptied' && mirrored) {
      return 75
    } else if (caClass === 'Chaotic' && mirrored) {
      return 100
    } else {
      return 0
    }
  }

  // setup() initializes p5 and the canvas element, can be mostly ignored in our case (check draw())
  const setup = (p5, canvasParentRef) => {
    // Keep reference of canvas element for snapshots
    let _p5 = p5.createCanvas(width, height).parent(canvasParentRef)
    canvasRef.current = p5

    attributesRef.current = () => {
      return {
        // This is called when the final image is generated, when creator opens the Mint NFT modal.
        // should return an object structured following opensea/enjin metadata spec for attributes/properties
        // https://docs.opensea.io/docs/metadata-standards
        // https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1155.md#erc-1155-metadata-uri-json-schema

        attributes: [
          {
            display_type: 'number',
            trait_type: 'Rule',
            value: ca_rule.current
          },

          {
            trait_type: 'Class',
            value: ca_class.current
          },

          {
            display_type: 'boost_percentage',
            trait_type: 'Scarcity reward',
            value: ca_percent.current
          },

          {
            trait_type: 'Symmetry',
            value: ca_simmetry.current
          },

          {
            display_type: 'boost_number',
            trait_type: 'Rarity boost',
            value: ca_rarity.current
          }
        ]
      }
    }
  }

  // draw() is called right after setup and in a loop
  // disabling the loop prevents controls from working correctly
  // code must be deterministic so every loop instance results in the same output

  // Basic example of a drawing something using:
  // a) the block hash as initial seed (shuffleBag)
  // b) individual transactions in a block (seed)
  // c) custom parameters creators can customize (mod1, color1)
  // d) final drawing reacting to screen resizing (M)
  const draw = (p5) => {
    let WIDTH = width
    let HEIGHT = height
    let DIM = Math.min(WIDTH, HEIGHT)
    let M = DIM / DEFAULT_SIZE

    p5.background(background)

    // reset shuffle bag
    let seed = parseInt(hash.slice(0, 16), 16)
    shuffleBag.current = new MersenneTwister(seed)
    let objs = block.transactions.map((t) => {
      let seed = parseInt(t.hash.slice(0, 16), 16)
      return {
        y: shuffleBag.current.random(),
        x: shuffleBag.current.random(),
        radius: seed / 1000000000000000
      }
    })

    // objs.map((dot, i) => {
    //   p5.stroke(color1)
    //   p5.strokeWeight(1 + mod2 * 10)
    //   p5.ellipse(200 * dot.y * 6 * M, 100 * dot.x * 6 * M, dot.radius * M * mod1)
    // })

    /* 
  ==============  
  Parameters
  ==============

  0) All values from the MersenneTwister are potentially used as activation seeds for each cell generation.
  1) mod1 controls the size percentage of the final shapes
  2) mod3 controls how the shapes are rendered based on probability
  3) mod4 specifies the probability of an alternate shape if the selected mode allows for intercalation
  */

    let r = objs[parseInt(objs[0].x * (objs.length - 1), 10)].x
    let rule = mapModifier(p5, r, 0, 255)
    let sThres = p5.int(p5.log(width, 2) - 2)
    let scale = p5.pow(2, mapModifier(p5, mod1, 1, sThres)) // only powers of 2

    let shapeProb = mod2
    let modeProb = mod3
    let margin = parseInt(width * (0.125 * 0.125), 10)
    let caSystem = new CellularAutomata(p5, rule, width, height, scale, margin)

    let injection = objs
    let injectionPoints = objs[parseInt(objs[1].x * (objs.length - 1), 10)].x
    let dead = color1
    let alive = color2
    let rarityProb = objs[parseInt(objs[2].x * (objs.length - 1), 10)].x

    // Attributes
    let activeRarity = rarityProb >= 0.98 // Rarity prob (2 % chance to get one)
    let symmetry = activeRarity === true ? 'Mirrored' : 'Normal'
    let classData = findClass(rule)
    let extraRarity = findExtraRarity(p5, classData[0], activeRarity)

    caSystem.init(rule, injection, injectionPoints)
    //caSystem.display() // test first generation
    caSystem.generateAll()

    if (!activeRarity) {
      caSystem.displayAll(1, dead, alive, shapeProb, modeProb, activeRarity)
    } else {
      caSystem.displayMirrored(1, dead, alive, shapeProb, modeProb, activeRarity)
    }

    // Draw the edges of the vanvas
    makeCanvas(p5, caSystem, rule, margin)

    ca_rule.current = rule
    ca_class.current = classData[0]
    ca_percent.current = 100 - classData[1] // More boost for scarce items
    ca_simmetry.current = symmetry
    ca_rarity.current = extraRarity
  }

  return <Sketch setup={setup} draw={draw} windowResized={handleResize} />
}

export default CustomStyle
