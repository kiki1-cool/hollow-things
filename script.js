import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// ============================================================
// HOLLOW THINGS
// DRAWER + FLASHLIGHT + BLACKOUT + WARDROBES + MONSTER + AUDIO
// ============================================================

// ============================================================
// DOM
// ============================================================

const game = document.getElementById("game");
const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

if (!game || !startScreen || !startButton) {
  throw new Error("Hollow Things: required HTML elements are missing.");
}

// ============================================================
// GAME STATE
// ============================================================

let gameStarted = false;

let drawerOpened = false;
let flashlightCollected = false;
let flashlightOn = false;

let interactionLocked = false;

let playerInsideWardrobe = false;
let activeWardrobe = null;

// ============================================================
// INPUT
// ============================================================

const keys = {};

let yaw = 0;
let pitch = 0;

let lastTime = performance.now();

// ============================================================
// INTERACTION PROMPT
// ============================================================

const interactionPrompt = document.createElement("div");

interactionPrompt.id = "interactionPrompt";
interactionPrompt.textContent = "E — OPEN DRAWER";

Object.assign(interactionPrompt.style, {
  position: "fixed",
  left: "50%",
  bottom: "11%",
  transform: "translateX(-50%)",
  color: "rgba(255,255,255,0.88)",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textAlign: "center",
  pointerEvents: "none",
  opacity: "0",
  transition: "opacity 0.18s ease",
  zIndex: "30",
  textShadow: "0 1px 8px rgba(0,0,0,0.95)"
});

document.body.appendChild(interactionPrompt);

function showPrompt(text) {
  interactionPrompt.textContent = text;
  interactionPrompt.style.opacity = "1";
}

function hidePrompt() {
  interactionPrompt.style.opacity = "0";
}

// ============================================================
// THREE.JS
// ============================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x080705);

scene.fog = new THREE.Fog(
  0x080705,
  7,
  42
);

// ============================================================
// CAMERA
// ============================================================

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.05,
  150
);

camera.position.set(
  0,
  1.7,
  5
);

camera.rotation.order = "YXZ";

// ============================================================
// RENDERER
// ============================================================

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio || 1,
    1.5
  )
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

game.appendChild(renderer.domElement);

// ============================================================
// CONSTANTS
// ============================================================

const CELL_SIZE = 4;

const WALL_HEIGHT = 3.4;
const WALL_THICKNESS = 0.35;

const MAZE_WIDTH = 11;
const MAZE_HEIGHT = 11;

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.28;

const WALK_SPEED = 3.2;
const SPRINT_SPEED = 5.4;

const DRAWER_INTERACTION_DISTANCE = 2.5;
const FLASHLIGHT_INTERACTION_DISTANCE = 2.3;
const WARDROBE_INTERACTION_DISTANCE = 1.9;

const WARDROBE_COUNT = 8;

const WARDROBE_WIDTH = 1.65;
const WARDROBE_HEIGHT = 2.65;
const WARDROBE_DEPTH = 0.85;

// ============================================================
// MONSTER SETTINGS
// ============================================================

// Slightly faster than player's sprint.
const MONSTER_SPEED = 4.8;
const MONSTER_CHASE_SPEED = 5.8;

// Recalculate its route frequently.
const MONSTER_REPATH_TIME = 0.28;

// It starts hunting almost immediately.
const MONSTER_START_DELAY = 2.5;

// ============================================================
// TEXTURE GENERATOR
// ============================================================

function createNoiseTexture(
  baseColor,
  variation,
  size = 256
) {
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create texture canvas."
    );
  }

  const image = ctx.createImageData(
    size,
    size
  );

  const base = new THREE.Color(
    baseColor
  );

  for (
    let i = 0;
    i < image.data.length;
    i += 4
  ) {
    const noise =
      (Math.random() - 0.5) *
      variation;

    image.data[i] =
      THREE.MathUtils.clamp(
        base.r * 255 + noise,
        0,
        255
      );

    image.data[i + 1] =
      THREE.MathUtils.clamp(
        base.g * 255 + noise,
        0,
        255
      );

    image.data[i + 2] =
      THREE.MathUtils.clamp(
        base.b * 255 + noise,
        0,
        255
      );

    image.data[i + 3] = 255;
  }

  ctx.putImageData(
    image,
    0,
    0
  );

  const texture =
    new THREE.CanvasTexture(canvas);

  texture.wrapS =
    THREE.RepeatWrapping;

  texture.wrapT =
    THREE.RepeatWrapping;

  texture.colorSpace =
    THREE.SRGBColorSpace;

  return texture;
}

// ============================================================
// TEXTURES
// ============================================================

const wallTexture =
  createNoiseTexture(
    0xb5a96f,
    28
  );

wallTexture.repeat.set(
  2,
  1.5
);

const floorTexture =
  createNoiseTexture(
    0x5a5447,
    35
  );

floorTexture.repeat.set(
  8,
  8
);

const ceilingTexture =
  createNoiseTexture(
    0x77736b,
    20
  );

ceilingTexture.repeat.set(
  7,
  7
);

// ============================================================
// MATERIALS
// ============================================================

const wallMaterial =
  new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.92,
    metalness: 0
  });

const floorMaterial =
  new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 1,
    metalness: 0
  });

const ceilingMaterial =
  new THREE.MeshStandardMaterial({
    map: ceilingTexture,
    roughness: 0.95,
    metalness: 0
  });

const darkMetalMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x242321,
    roughness: 0.68,
    metalness: 0.5
  });

const woodMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x3b3023,
    roughness: 0.82,
    metalness: 0
  });

const wardrobeWoodMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x30261d,
    roughness: 0.9,
    metalness: 0
  });

const wardrobeInsideMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x080706,
    roughness: 1,
    metalness: 0
  });

const fluorescentMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xe8e2c7,
    emissive: 0xfff3c4,
    emissiveIntensity: 2.5,
    roughness: 0.35
  });

// ============================================================
// FLOOR
// ============================================================

const floorSize =
  MAZE_WIDTH * CELL_SIZE + 8;

const floor =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      floorSize,
      floorSize
    ),
    floorMaterial
  );

floor.rotation.x =
  -Math.PI / 2;

floor.receiveShadow = true;

scene.add(floor);

// ============================================================
// CEILING
// ============================================================

const ceiling =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      floorSize,
      floorSize
    ),
    ceilingMaterial
  );

ceiling.rotation.x =
  Math.PI / 2;

ceiling.position.y =
  WALL_HEIGHT;

scene.add(ceiling);

// ============================================================
// LIGHTING
// ============================================================

const ambientLight =
  new THREE.AmbientLight(
    0xffe8c4,
    0.012
  );

scene.add(
  ambientLight
);

const hemisphereLight =
  new THREE.HemisphereLight(
    0xffeac0,
    0x050403,
    0.018
  );

scene.add(
  hemisphereLight
);

// ============================================================
// MAZE
// ============================================================

const maze = [];
const wallMeshes = [];
const wallCollisionBoxes = [];

function createCell(x, z) {
  return {
    x,
    z,
    visited: false,
    north: true,
    east: true,
    south: true,
    west: true
  };
}

function buildMazeGrid() {
  maze.length = 0;

  for (
    let z = 0;
    z < MAZE_HEIGHT;
    z++
  ) {
    const row = [];

    for (
      let x = 0;
      x < MAZE_WIDTH;
      x++
    ) {
      row.push(
        createCell(x, z)
      );
    }

    maze.push(row);
  }
}

function generateMaze() {
  buildMazeGrid();

  const startX =
    Math.floor(
      MAZE_WIDTH / 2
    );

  const startZ =
    Math.floor(
      MAZE_HEIGHT / 2
    );

  const stack = [];

  const start =
    maze[startZ][startX];

  start.visited = true;

  stack.push(start);

  const directions = [
    {
      dx: 0,
      dz: -1,
      wall: "north",
      opposite: "south"
    },
    {
      dx: 1,
      dz: 0,
      wall: "east",
      opposite: "west"
    },
    {
      dx: 0,
      dz: 1,
      wall: "south",
      opposite: "north"
    },
    {
      dx: -1,
      dz: 0,
      wall: "west",
      opposite: "east"
    }
  ];

  while (
    stack.length > 0
  ) {
    const current =
      stack[
        stack.length - 1
      ];

    const available = [];

    for (
      const dir of directions
    ) {
      const nx =
        current.x + dir.dx;

      const nz =
        current.z + dir.dz;

      if (
        nx >= 0 &&
        nx < MAZE_WIDTH &&
        nz >= 0 &&
        nz < MAZE_HEIGHT
      ) {
        const next =
          maze[nz][nx];

        if (
          next &&
          !next.visited
        ) {
          available.push({
            dir,
            next
          });
        }
      }
    }

    if (
      available.length === 0
    ) {
      stack.pop();
      continue;
    }

    const chosen =
      available[
        Math.floor(
          Math.random() *
          available.length
        )
      ];

    current[
      chosen.dir.wall
    ] = false;

    chosen.next[
      chosen.dir.opposite
    ] = false;

    chosen.next.visited =
      true;

    stack.push(
      chosen.next
    );
  }

  const sx =
    Math.floor(
      MAZE_WIDTH / 2
    );

  const sz =
    Math.floor(
      MAZE_HEIGHT / 2
    );

  maze[sz][sx].south =
    false;

  if (
    maze[sz + 1] &&
    maze[sz + 1][sx]
  ) {
    maze[sz + 1][sx].north =
      false;
  }

  maze[sz][sx].east =
    false;

  if (
    maze[sz][sx + 1]
  ) {
    maze[sz][sx + 1].west =
      false;
  }
}

function cellToWorldX(x) {
  return (
    (x -
      (MAZE_WIDTH - 1) / 2) *
    CELL_SIZE
  );
}

function cellToWorldZ(z) {
  return (
    (z -
      (MAZE_HEIGHT - 1) / 2) *
    CELL_SIZE
  );
}

function worldToCellX(x) {
  return THREE.MathUtils.clamp(
    Math.round(
      x / CELL_SIZE +
      (MAZE_WIDTH - 1) / 2
    ),
    0,
    MAZE_WIDTH - 1
  );
}

function worldToCellZ(z) {
  return THREE.MathUtils.clamp(
    Math.round(
      z / CELL_SIZE +
      (MAZE_HEIGHT - 1) / 2
    ),
    0,
    MAZE_HEIGHT - 1
  );
}

function addWall(
  x,
  z,
  horizontal
) {
  const geometry =
    horizontal
      ? new THREE.BoxGeometry(
          CELL_SIZE +
          WALL_THICKNESS,
          WALL_HEIGHT,
          WALL_THICKNESS
        )
      : new THREE.BoxGeometry(
          WALL_THICKNESS,
          WALL_HEIGHT,
          CELL_SIZE +
          WALL_THICKNESS
        );

  const wall =
    new THREE.Mesh(
      geometry,
      wallMaterial
    );

  wall.position.set(
    x,
    WALL_HEIGHT / 2,
    z
  );

  wall.receiveShadow = true;

  scene.add(wall);

  wallMeshes.push(wall);

  wallCollisionBoxes.push(
    new THREE.Box3().setFromObject(
      wall
    )
  );
}

function buildMaze() {
  generateMaze();

  for (
    let z = 0;
    z < MAZE_HEIGHT;
    z++
  ) {
    for (
      let x = 0;
      x < MAZE_WIDTH;
      x++
    ) {
      const cell =
        maze[z][x];

      const wx =
        cellToWorldX(x);

      const wz =
        cellToWorldZ(z);

      if (cell.north) {
        addWall(
          wx,
          wz -
          CELL_SIZE / 2,
          true
        );
      }

      if (cell.west) {
        addWall(
          wx -
          CELL_SIZE / 2,
          wz,
          false
        );
      }

      if (
        z ===
        MAZE_HEIGHT - 1 &&
        cell.south
      ) {
        addWall(
          wx,
          wz +
          CELL_SIZE / 2,
          true
        );
      }

      if (
        x ===
        MAZE_WIDTH - 1 &&
        cell.east
      ) {
        addWall(
          wx +
          CELL_SIZE / 2,
          wz,
          false
        );
      }
    }
  }
}

buildMaze();

// ============================================================
// FLUORESCENT LIGHTS
// ============================================================

const fluorescentLights = [];

function addFluorescentLight(
  x,
  z
) {
  const housing =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.7,
        0.08,
        0.32
      ),
      darkMetalMaterial
    );

  housing.position.set(
    x,
    WALL_HEIGHT - 0.1,
    z
  );

  scene.add(housing);

  const tube =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.45,
        0.035,
        0.18
      ),
      fluorescentMaterial
    );

  tube.position.set(
    x,
    WALL_HEIGHT - 0.045,
    z
  );

  scene.add(tube);

  const light =
    new THREE.PointLight(
      0xffe7b0,
      2.25,
      10.5,
      2
    );

  light.position.set(
    x,
    WALL_HEIGHT - 0.3,
    z
  );

  scene.add(light);

  fluorescentLights.push({
    light,
    tube,
    baseIntensity: 2.25,
    baseEmission: 2.5
  });
}

for (
  let z = 1;
  z < MAZE_HEIGHT;
  z += 2
) {
  for (
    let x = 1;
    x < MAZE_WIDTH;
    x += 2
  ) {
    addFluorescentLight(
      cellToWorldX(x),
      cellToWorldZ(z)
    );
  }
}

// ============================================================
// DRAWER
// ============================================================

const drawerGroup =
  new THREE.Group();

const drawerCellX =
  Math.floor(
    MAZE_WIDTH / 2
  );

const drawerCellZ =
  Math.floor(
    MAZE_HEIGHT / 2
  );

const drawerX =
  cellToWorldX(
    drawerCellX
  );

const drawerZ =
  cellToWorldZ(
    drawerCellZ
  );

drawerGroup.position.set(
  drawerX,
  0,
  drawerZ
);

scene.add(
  drawerGroup
);

const cabinet =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.35,
      1.7,
      0.75
    ),
    woodMaterial
  );

cabinet.position.y =
  0.85;

cabinet.castShadow = true;
cabinet.receiveShadow = true;

drawerGroup.add(
  cabinet
);

const cabinetTop =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.5,
      0.12,
      0.85
    ),
    darkMetalMaterial
  );

cabinetTop.position.y =
  1.72;

drawerGroup.add(
  cabinetTop
);

const drawer =
  new THREE.Group();

drawer.position.set(
  0,
  0.85,
  0.40
);

drawerGroup.add(
  drawer
);

const drawerBody =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.12,
      0.42,
      0.65
    ),
    woodMaterial
  );

drawerBody.castShadow = true;

drawer.add(
  drawerBody
);

const drawerFront =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.22,
      0.58,
      0.08
    ),
    darkMetalMaterial
  );

drawerFront.position.z =
  0.37;

drawer.add(
  drawerFront
);

const drawerHandle =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.32,
      0.06,
      0.07
    ),
    darkMetalMaterial
  );

drawerHandle.position.set(
  0,
  0,
  0.44
);

drawer.add(
  drawerHandle
);

// ============================================================
// FLASHLIGHT
// ============================================================

const flashlight =
  new THREE.Group();

const flashlightBody =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.075,
      0.09,
      0.55,
      12
    ),
    darkMetalMaterial
  );

flashlightBody.rotation.z =
  Math.PI / 2;

flashlight.add(
  flashlightBody
);

const flashlightHead =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.11,
      0.1,
      0.13,
      12
    ),
    darkMetalMaterial
  );

flashlightHead.rotation.z =
  Math.PI / 2;

flashlightHead.position.x =
  0.32;

flashlight.add(
  flashlightHead
);

const flashlightGlow =
  new THREE.Mesh(
    new THREE.CircleGeometry(
      0.065,
      16
    ),
    new THREE.MeshBasicMaterial({
      color: 0x403d35
    })
  );

flashlightGlow.rotation.y =
  Math.PI / 2;

flashlightGlow.position.x =
  0.39;

flashlight.add(
  flashlightGlow
);

flashlight.position.set(
  -0.18,
  0.25,
  0.03
);

flashlight.visible = false;

drawer.add(
  flashlight
);

// ============================================================
// FIXED FLASHLIGHT BEAM
// ============================================================

const flashlightLight =
  new THREE.SpotLight(
    0xfff0cc,
    0,
    30,
    Math.PI / 7,
    0.55,
    0
  );

// IMPORTANT:
// No adaptive range.
// No wall-distance shrinking.
// No raycast changing the light.
// No shadow map on the flashlight that can make the beam
// appear to disappear against nearby geometry.
flashlightLight.castShadow = false;

scene.add(
  flashlightLight
);

const flashlightTarget =
  new THREE.Object3D();

scene.add(
  flashlightTarget
);

flashlightLight.target =
  flashlightTarget;

// ============================================================
// WARDROBE SYSTEM
// ============================================================

const wardrobes = [];

function getWardrobeCandidates() {
  const candidates = [];

  const centerX =
    Math.floor(
      MAZE_WIDTH / 2
    );

  const centerZ =
    Math.floor(
      MAZE_HEIGHT / 2
    );

  for (
    let z = 1;
    z < MAZE_HEIGHT - 1;
    z++
  ) {
    for (
      let x = 1;
      x < MAZE_WIDTH - 1;
      x++
    ) {
      const cell =
        maze[z][x];

      if (!cell) continue;

      const centerDistance =
        Math.abs(
          x - centerX
        ) +
        Math.abs(
          z - centerZ
        );

      if (
        centerDistance < 2
      ) {
        continue;
      }

      if (cell.north) {
        candidates.push({
          x,
          z,
          direction: "north"
        });
      }

      if (cell.south) {
        candidates.push({
          x,
          z,
          direction: "south"
        });
      }

      if (cell.west) {
        candidates.push({
          x,
          z,
          direction: "west"
        });
      }

      if (cell.east) {
        candidates.push({
          x,
          z,
          direction: "east"
        });
      }
    }
  }

  return candidates;
}

function wardrobeCandidateIsFarEnough(
  candidate,
  selected
) {
  for (
    const item of selected
  ) {
    const dx =
      candidate.x -
      item.x;

    const dz =
      candidate.z -
      item.z;

    if (
      Math.sqrt(
        dx * dx +
        dz * dz
      ) < 2.5
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================
// CREATE WARDROBE
// ============================================================

function createWardrobe(
  candidate
) {
  const wardrobe =
    new THREE.Group();

  const cellX =
    cellToWorldX(
      candidate.x
    );

  const cellZ =
    cellToWorldZ(
      candidate.z
    );

  const wallOffset =
    WALL_THICKNESS / 2 +
    WARDROBE_DEPTH / 2 -
    0.03;

  if (
    candidate.direction ===
    "north"
  ) {
    wardrobe.position.set(
      cellX,
      0,
      cellZ -
      CELL_SIZE / 2 +
      wallOffset
    );

    wardrobe.rotation.y = 0;
  }

  if (
    candidate.direction ===
    "south"
  ) {
    wardrobe.position.set(
      cellX,
      0,
      cellZ +
      CELL_SIZE / 2 -
      wallOffset
    );

    wardrobe.rotation.y =
      Math.PI;
  }

  if (
    candidate.direction ===
    "west"
  ) {
    wardrobe.position.set(
      cellX -
      CELL_SIZE / 2 +
      wallOffset,
      0,
      cellZ
    );

    wardrobe.rotation.y =
      -Math.PI / 2;
  }

  if (
    candidate.direction ===
    "east"
  ) {
    wardrobe.position.set(
      cellX +
      CELL_SIZE / 2 -
      wallOffset,
      0,
      cellZ
    );

    wardrobe.rotation.y =
      Math.PI / 2;
  }

  scene.add(
    wardrobe
  );

  // ----------------------------------------------------------
  // BACK
  // ----------------------------------------------------------

  const back =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        WARDROBE_WIDTH,
        WARDROBE_HEIGHT,
        0.12
      ),
      wardrobeWoodMaterial
    );

  back.position.set(
    0,
    WARDROBE_HEIGHT / 2,
    -WARDROBE_DEPTH / 2
  );

  back.castShadow = true;
  back.receiveShadow = true;

  wardrobe.add(back);

  // ----------------------------------------------------------
  // SIDES
  // ----------------------------------------------------------

  const leftSide =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.12,
        WARDROBE_HEIGHT,
        WARDROBE_DEPTH
      ),
      wardrobeWoodMaterial
    );

  leftSide.position.set(
    -WARDROBE_WIDTH / 2,
    WARDROBE_HEIGHT / 2,
    0
  );

  leftSide.castShadow = true;

  wardrobe.add(
    leftSide
  );

  const rightSide =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.12,
        WARDROBE_HEIGHT,
        WARDROBE_DEPTH
      ),
      wardrobeWoodMaterial
    );

  rightSide.position.set(
    WARDROBE_WIDTH / 2,
    WARDROBE_HEIGHT / 2,
    0
  );

  rightSide.castShadow = true;

  wardrobe.add(
    rightSide
  );

  // ----------------------------------------------------------
  // TOP
  // ----------------------------------------------------------

  const top =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        WARDROBE_WIDTH,
        0.12,
        WARDROBE_DEPTH
      ),
      wardrobeWoodMaterial
    );

  top.position.y =
    WARDROBE_HEIGHT;

  top.castShadow = true;

  wardrobe.add(top);

  // ----------------------------------------------------------
  // INTERIOR
  // ----------------------------------------------------------

  const interior =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        WARDROBE_WIDTH - 0.18,
        WARDROBE_HEIGHT - 0.18,
        WARDROBE_DEPTH - 0.12
      ),
      wardrobeInsideMaterial
    );

  interior.position.y =
    WARDROBE_HEIGHT / 2;

  wardrobe.add(
    interior
  );

  // ==========================================================
  // REAL HINGE DOORS
  // ==========================================================

  const leftDoor =
    new THREE.Group();

  const rightDoor =
    new THREE.Group();

  // True hinge positions.
  leftDoor.position.set(
    -WARDROBE_WIDTH / 2 + 0.05,
    0,
    WARDROBE_DEPTH / 2
  );

  rightDoor.position.set(
    WARDROBE_WIDTH / 2 - 0.05,
    0,
    WARDROBE_DEPTH / 2
  );

  wardrobe.add(
    leftDoor
  );

  wardrobe.add(
    rightDoor
  );

  // ----------------------------------------------------------
  // LEFT DOOR PANEL
  // ----------------------------------------------------------

  const doorWidth =
    WARDROBE_WIDTH / 2 - 0.05;

  const leftDoorMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        doorWidth,
        2.45,
        0.09
      ),
      wardrobeWoodMaterial
    );

  // The panel extends inward FROM the hinge.
  leftDoorMesh.position.set(
    doorWidth / 2,
    1.225,
    0
  );

  leftDoorMesh.castShadow = true;

  leftDoor.add(
    leftDoorMesh
  );

  // ----------------------------------------------------------
  // RIGHT DOOR PANEL
  // ----------------------------------------------------------

  const rightDoorMesh =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        doorWidth,
        2.45,
        0.09
      ),
      wardrobeWoodMaterial
    );

  rightDoorMesh.position.set(
    -doorWidth / 2,
    1.225,
    0
  );

  rightDoorMesh.castShadow = true;

  rightDoor.add(
    rightDoorMesh
  );

  // ----------------------------------------------------------
  // HANDLES
  // ----------------------------------------------------------

  const handleMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.5,
      metalness: 0.8
    });

  const leftHandle =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.05,
        0.18,
        0.08
      ),
      handleMaterial
    );

  leftHandle.position.set(
    doorWidth - 0.08,
    1.2,
    0.07
  );

  leftDoor.add(
    leftHandle
  );

  const rightHandle =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.05,
        0.18,
        0.08
      ),
      handleMaterial
    );

  rightHandle.position.set(
    -doorWidth + 0.08,
    1.2,
    0.07
  );

  rightDoor.add(
    rightHandle
  );

  const data = {
    group: wardrobe,

    x: candidate.x,
    z: candidate.z,

    direction:
      candidate.direction,

    back,
    leftSide,
    rightSide,

    leftDoor,
    rightDoor,

    leftDoorMesh,
    rightDoorMesh,

    open: false,
    animating: false
  };

  wardrobes.push(data);

  return data;
}

// ============================================================
// SPAWN WARDROBES
// ============================================================

const wardrobeCandidates =
  getWardrobeCandidates();

const selectedWardrobes = [];

wardrobeCandidates.sort(
  () => Math.random() - 0.5
);

for (
  const candidate
  of wardrobeCandidates
) {
  if (
    selectedWardrobes.length >=
    WARDROBE_COUNT
  ) {
    break;
  }

  if (
    wardrobeCandidateIsFarEnough(
      candidate,
      selectedWardrobes
    )
  ) {
    selectedWardrobes.push(
      candidate
    );
  }
}

for (
  const candidate
  of selectedWardrobes
) {
  createWardrobe(
    candidate
  );
}

// ============================================================
// WARDROBE DISTANCE
// ============================================================

function getNearestWardrobe() {
  let nearest = null;

  let nearestDistance =
    Infinity;

  for (
    const wardrobe
    of wardrobes
  ) {
    const dx =
      camera.position.x -
      wardrobe.group.position.x;

    const dz =
      camera.position.z -
      wardrobe.group.position.z;

    const distance =
      Math.sqrt(
        dx * dx +
        dz * dz
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance =
        distance;

      nearest =
        wardrobe;
    }
  }

  return {
    wardrobe: nearest,
    distance: nearestDistance
  };
}

// ============================================================
// OPEN WARDROBE
// ============================================================

function openWardrobe(
  wardrobe
) {
  if (
    wardrobe.open ||
    wardrobe.animating
  ) {
    return;
  }

  wardrobe.animating =
    true;

  hidePrompt();

  const startLeft =
    wardrobe.leftDoor.rotation.y;

  const startRight =
    wardrobe.rightDoor.rotation.y;

  const endLeft =
    -Math.PI * 0.52;

  const endRight =
    Math.PI * 0.52;

  const startTime =
    performance.now();

  const duration = 700;

  function animateOpen(
    now
  ) {
    const progress =
      THREE.MathUtils.clamp(
        (now - startTime) /
        duration,
        0,
        1
      );

    const eased =
      THREE.MathUtils.smootherstep(
        progress,
        0,
        1
      );

    wardrobe.leftDoor.rotation.y =
      THREE.MathUtils.lerp(
        startLeft,
        endLeft,
        eased
      );

    wardrobe.rightDoor.rotation.y =
      THREE.MathUtils.lerp(
        startRight,
        endRight,
        eased
      );

    if (
      progress < 1
    ) {
      requestAnimationFrame(
        animateOpen
      );
    } else {
      wardrobe.leftDoor.rotation.y =
        endLeft;

      wardrobe.rightDoor.rotation.y =
        endRight;

      wardrobe.open = true;
      wardrobe.animating = false;

      playWardrobeSound(false);

      showPrompt(
        "F — ENTER WARDROBE"
      );
    }
  }

  requestAnimationFrame(
    animateOpen
  );
}

// ============================================================
// ENTER WARDROBE
// ============================================================

function enterWardrobe(
  wardrobe
) {
  if (
    !wardrobe.open ||
    wardrobe.animating ||
    playerInsideWardrobe
  ) {
    return;
  }

  playerInsideWardrobe = true;
  activeWardrobe = wardrobe;

  hidePrompt();

  wardrobe.group.updateMatrixWorld(
    true
  );

  const localPosition =
    new THREE.Vector3(
      0,
      PLAYER_HEIGHT,
      0.02
    );

  const worldPosition =
    localPosition.applyMatrix4(
      wardrobe.group.matrixWorld
    );

  camera.position.x =
    worldPosition.x;

  camera.position.z =
    worldPosition.z;

  playWardrobeEnterSound();

  showPrompt(
    "F — CLOSE WARDROBE"
  );
}

// ============================================================
// CLOSE WARDROBE
// ============================================================

function closeWardrobe(
  wardrobe
) {
  if (
    !wardrobe.open ||
    wardrobe.animating
  ) {
    return;
  }

  wardrobe.animating =
    true;

  hidePrompt();

  if (
    playerInsideWardrobe
  ) {
    wardrobe.group.updateMatrixWorld(
      true
    );

    const exitDirection =
      new THREE.Vector3(
        0,
        0,
        1.2
      );

    exitDirection.applyQuaternion(
      wardrobe.group.quaternion
    );

    camera.position.x +=
      exitDirection.x;

    camera.position.z +=
      exitDirection.z;

    playerInsideWardrobe = false;
    activeWardrobe = null;
  }

  const startLeft =
    wardrobe.leftDoor.rotation.y;

  const startRight =
    wardrobe.rightDoor.rotation.y;

  const startTime =
    performance.now();

  const duration = 700;

  function animateClose(
    now
  ) {
    const progress =
      THREE.MathUtils.clamp(
        (now - startTime) /
        duration,
        0,
        1
      );

    const eased =
      THREE.MathUtils.smootherstep(
        progress,
        0,
        1
      );

    wardrobe.leftDoor.rotation.y =
      THREE.MathUtils.lerp(
        startLeft,
        0,
        eased
      );

    wardrobe.rightDoor.rotation.y =
      THREE.MathUtils.lerp(
        startRight,
        0,
        eased
      );

    if (
      progress < 1
    ) {
      requestAnimationFrame(
        animateClose
      );
    } else {
      wardrobe.leftDoor.rotation.y =
        0;

      wardrobe.rightDoor.rotation.y =
        0;

      wardrobe.open = false;
      wardrobe.animating = false;

      playWardrobeSound(true);
    }
  }

  requestAnimationFrame(
    animateClose
  );
}

// ============================================================
// PLAYER COLLISION
// ============================================================

function collidesWithWall(
  x,
  z
) {
  for (
    const box
    of wallCollisionBoxes
  ) {
    if (
      x + PLAYER_RADIUS >
      box.min.x &&
      x - PLAYER_RADIUS <
      box.max.x &&
      z + PLAYER_RADIUS >
      box.min.z &&
      z - PLAYER_RADIUS <
      box.max.z
    ) {
      return true;
    }
  }

  if (
    !playerInsideWardrobe
  ) {
    for (
      const wardrobe
      of wardrobes
    ) {
      const boxes = [
        new THREE.Box3().setFromObject(
          wardrobe.back
        ),
        new THREE.Box3().setFromObject(
          wardrobe.leftSide
        ),
        new THREE.Box3().setFromObject(
          wardrobe.rightSide
        )
      ];

      if (
        !wardrobe.open
      ) {
        boxes.push(
          new THREE.Box3().setFromObject(
            wardrobe.leftDoorMesh
          )
        );

        boxes.push(
          new THREE.Box3().setFromObject(
            wardrobe.rightDoorMesh
          )
        );
      }

      for (
        const box of boxes
      ) {
        if (
          x + PLAYER_RADIUS >
          box.min.x &&
          x - PLAYER_RADIUS <
          box.max.x &&
          z + PLAYER_RADIUS >
          box.min.z &&
          z - PLAYER_RADIUS <
          box.max.z
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

function tryMove(
  dx,
  dz
) {
  if (
    playerInsideWardrobe
  ) {
    return;
  }

  const nextX =
    camera.position.x + dx;

  const nextZ =
    camera.position.z + dz;

  if (
    !collidesWithWall(
      nextX,
      camera.position.z
    )
  ) {
    camera.position.x =
      nextX;
  }

  if (
    !collidesWithWall(
      camera.position.x,
      nextZ
    )
  ) {
    camera.position.z =
      nextZ;
  }
}

// ============================================================
// AUDIO ENGINE
// ============================================================

let audioContext = null;
let masterGain = null;
let monsterHumGain = null;

let audioStarted = false;

let lastPlayerStep = 0;
let lastMonsterStep = 0;

let monsterBreathTimer = 0;

function initializeAudio() {
  if (audioStarted) {
    return;
  }

  const AudioContext =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContext) {
    console.warn(
      "Web Audio API is not supported."
    );

    return;
  }

  audioContext =
    new AudioContext();

  masterGain =
    audioContext.createGain();

  masterGain.gain.value =
    0.22;

  masterGain.connect(
    audioContext.destination
  );

  monsterHumGain =
    audioContext.createGain();

  monsterHumGain.gain.value =
    0;

  monsterHumGain.connect(
    masterGain
  );

  const oscillator =
    audioContext.createOscillator();

  oscillator.type = "sine";

  oscillator.frequency.value =
    43;

  oscillator.connect(
    monsterHumGain
  );

  oscillator.start();

  audioStarted = true;
}

function playTone(
  frequency,
  duration,
  volume,
  type = "sine"
) {
  if (
    !audioContext ||
    !masterGain
  ) {
    return;
  }

  const now =
    audioContext.currentTime;

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type =
    type;

  oscillator.frequency.setValueAtTime(
    frequency,
    now
  );

  gain.gain.setValueAtTime(
    0,
    now
  );

  gain.gain.linearRampToValueAtTime(
    volume,
    now + 0.01
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + duration
  );

  oscillator.connect(gain);
  gain.connect(masterGain);

  oscillator.start(now);

  oscillator.stop(
    now + duration + 0.03
  );
}

function playNoise(
  duration,
  volume,
  filterFrequency = 900
) {
  if (
    !audioContext ||
    !masterGain
  ) {
    return;
  }

  const buffer =
    audioContext.createBuffer(
      1,
      Math.floor(
        audioContext.sampleRate *
        duration
      ),
      audioContext.sampleRate
    );

  const data =
    buffer.getChannelData(0);

  for (
    let i = 0;
    i < data.length;
    i++
  ) {
    data[i] =
      Math.random() * 2 - 1;
  }

  const source =
    audioContext.createBufferSource();

  const filter =
    audioContext.createBiquadFilter();

  const gain =
    audioContext.createGain();

  filter.type =
    "lowpass";

  filter.frequency.value =
    filterFrequency;

  const now =
    audioContext.currentTime;

  gain.gain.setValueAtTime(
    volume,
    now
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + duration
  );

  source.buffer =
    buffer;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  source.start();
  source.stop(
    now + duration
  );
}

// ============================================================
// FOOTSTEPS
// ============================================================

function playPlayerFootstep() {
  playNoise(
    0.07,
    0.16,
    550
  );

  playTone(
    75,
    0.07,
    0.035,
    "triangle"
  );
}

function playMonsterFootstep() {
  playNoise(
    0.13,
    0.28,
    320
  );

  playTone(
    48,
    0.13,
    0.12,
    "triangle"
  );
}

// ============================================================
// WARDROBE SOUNDS
// ============================================================

function playWardrobeSound(
  closing
) {
  if (!audioStarted) {
    return;
  }

  playNoise(
    closing ? 0.32 : 0.4,
    0.18,
    850
  );

  playTone(
    closing ? 95 : 120,
    0.22,
    0.045,
    "sine"
  );
}

function playWardrobeEnterSound() {
  playTone(
    58,
    0.22,
    0.06,
    "sine"
  );

  playNoise(
    0.18,
    0.08,
    500
  );
}

// ============================================================
// MONSTER BREATHING
// ============================================================

function playMonsterBreath() {
  if (!audioStarted) {
    return;
  }

  playNoise(
    0.75,
    0.08,
    700
  );
}

// ============================================================
// AUDIO UPDATE
// ============================================================

function updateAudio(
  delta,
  playerMoving,
  monsterMoving
) {
  if (!audioStarted) {
    return;
  }

  const sprinting =
    keys["ShiftLeft"] ||
    keys["ShiftRight"];

  if (
    playerMoving
  ) {
    lastPlayerStep -=
      delta;

    const interval =
      sprinting
        ? 0.27
        : 0.43;

    if (
      lastPlayerStep <= 0
    ) {
      playPlayerFootstep();

      lastPlayerStep =
        interval;
    }
  } else {
    lastPlayerStep = 0;
  }

  if (
    monsterMoving
  ) {
    lastMonsterStep -=
      delta;

    const interval =
      monsterState ===
      "chase"
        ? 0.30
        : 0.42;

    if (
      lastMonsterStep <= 0
    ) {
      playMonsterFootstep();

      lastMonsterStep =
        interval;
    }
  } else {
    lastMonsterStep = 0;
  }

  if (
    monsterState ===
    "chase" &&
    !playerInsideWardrobe
  ) {
    monsterBreathTimer -=
      delta;

    if (
      monsterBreathTimer <= 0
    ) {
      playMonsterBreath();

      monsterBreathTimer =
        THREE.MathUtils.randFloat(
          1.2,
          2.1
        );
    }

    if (
      monsterHumGain
    ) {
      const distance =
        monster.position.distanceTo(
          new THREE.Vector3(
            camera.position.x,
            0,
            camera.position.z
          )
        );

      const proximity =
        THREE.MathUtils.clamp(
          1 -
          distance / 18,
          0,
          1
        );

      const volume =
        0.025 +
        proximity * 0.11;

      monsterHumGain.gain.setTargetAtTime(
        volume,
        audioContext.currentTime,
        0.25
      );
    }
  } else {
    if (
      monsterHumGain
    ) {
      monsterHumGain.gain.setTargetAtTime(
        0,
        audioContext.currentTime,
        0.5
      );
    }
  }
}

// ============================================================
// MONSTER
// ============================================================

const monster =
  new THREE.Group();

const monsterBodyMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x171615,
    roughness: 0.95,
    metalness: 0
  });

const monsterDarkMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x090909,
    roughness: 1,
    metalness: 0
  });

const monsterEyeMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xeeeecc,
    emissive: 0xfff1bd,
    emissiveIntensity: 3.5,
    roughness: 0.25
  });

// ============================================================
// MONSTER BODY
// ============================================================

const monsterTorso =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.36,
      0.5,
      1.45,
      10
    ),
    monsterBodyMaterial
  );

monsterTorso.position.y =
  1.15;

monsterTorso.scale.z =
  0.72;

monsterTorso.castShadow = true;

monster.add(
  monsterTorso
);

const monsterChest =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.58,
      0.85,
      0.42
    ),
    monsterDarkMaterial
  );

monsterChest.position.set(
  0,
  1.25,
  -0.05
);

monster.add(
  monsterChest
);

// ============================================================
// HEAD
// ============================================================

const monsterHead =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.34,
      12,
      10
    ),
    monsterBodyMaterial
  );

monsterHead.position.y =
  2.05;

monsterHead.scale.set(
  0.86,
  1.18,
  0.82
);

monsterHead.castShadow = true;

monster.add(
  monsterHead
);

const monsterNeck =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.18,
      0.24,
      0.35,
      10
    ),
    monsterDarkMaterial
  );

monsterNeck.position.y =
  1.72;

monster.add(
  monsterNeck
);

// ============================================================
// EYES
// ============================================================

const leftEye =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.055,
      10,
      8
    ),
    monsterEyeMaterial
  );

leftEye.position.set(
  -0.13,
  2.08,
  -0.285
);

monster.add(
  leftEye
);

const rightEye =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.055,
      10,
      8
    ),
    monsterEyeMaterial
  );

rightEye.position.set(
  0.13,
  2.08,
  -0.285
);

monster.add(
  rightEye
);

const monsterMouth =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.25,
      0.06,
      0.04
    ),
    monsterDarkMaterial
  );

monsterMouth.position.set(
  0,
  1.91,
  -0.285
);

monster.add(
  monsterMouth
);

// ============================================================
// SHOULDERS
// ============================================================

const leftShoulder =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.22,
      10,
      8
    ),
    monsterBodyMaterial
  );

leftShoulder.position.set(
  -0.47,
  1.58,
  0
);

leftShoulder.scale.set(
  1,
  1.2,
  0.9
);

monster.add(
  leftShoulder
);

const rightShoulder =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.22,
      10,
      8
    ),
    monsterBodyMaterial
  );

rightShoulder.position.set(
  0.47,
  1.58,
  0
);

rightShoulder.scale.set(
  1,
  1.2,
  0.9
);

monster.add(
  rightShoulder
);

// ============================================================
// ARMS
// ============================================================

const leftArm =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.11,
      0.15,
      1.15,
      8
    ),
    monsterBodyMaterial
  );

leftArm.position.set(
  -0.52,
  1.0,
  0
);

leftArm.rotation.z =
  -0.12;

monster.add(
  leftArm
);

const rightArm =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.11,
      0.15,
      1.15,
      8
    ),
    monsterBodyMaterial
  );

rightArm.position.set(
  0.52,
  1.0,
  0
);

rightArm.rotation.z =
  0.12;

monster.add(
  rightArm
);

// ============================================================
// HANDS
// ============================================================

const leftHand =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.15,
      9,
      8
    ),
    monsterDarkMaterial
  );

leftHand.position.set(
  -0.56,
  0.4,
  0
);

monster.add(
  leftHand
);

const rightHand =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      0.15,
      9,
      8
    ),
    monsterDarkMaterial
  );

rightHand.position.set(
  0.56,
  0.4,
  0
);

monster.add(
  rightHand
);

// ============================================================
// LEGS
// ============================================================

const leftLeg =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.14,
      0.17,
      1.1,
      8
    ),
    monsterBodyMaterial
  );

leftLeg.position.set(
  -0.22,
  0.32,
  0
);

monster.add(
  leftLeg
);

const rightLeg =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.14,
      0.17,
      1.1,
      8
    ),
    monsterBodyMaterial
  );

rightLeg.position.set(
  0.22,
  0.32,
  0
);

monster.add(
  rightLeg
);

// ============================================================
// MONSTER EYE LIGHT
// ============================================================

const monsterEyeLight =
  new THREE.PointLight(
    0xffe9ad,
    0.25,
    2.5,
    2
  );

monsterEyeLight.position.set(
  0,
  2.04,
  -0.35
);

monster.add(
  monsterEyeLight
);

// ============================================================
// MONSTER START LOCATION
// ============================================================

// Start only a couple of maze cells away from the player.
// This guarantees the monster enters the game early.
const playerStartCell = {
  x: drawerCellX,
  z: drawerCellZ
};

const nearbyMonsterCandidates = [];

for (
  let z = 0;
  z < MAZE_HEIGHT;
  z++
) {
  for (
    let x = 0;
    x < MAZE_WIDTH;
    x++
  ) {
    const distance =
      Math.abs(
        x - playerStartCell.x
      ) +
      Math.abs(
        z - playerStartCell.z
      );

    if (
      distance >= 2 &&
      distance <= 3
    ) {
      nearbyMonsterCandidates.push({
        x,
        z,
        distance
      });
    }
  }
}

// Prefer a cell that is actually connected to the
// player's starting cell.
let monsterStartCell =
  nearbyMonsterCandidates[
    Math.floor(
      Math.random() *
      nearbyMonsterCandidates.length
    )
  ];

if (!monsterStartCell) {
  monsterStartCell = {
    x: playerStartCell.x + 2,
    z: playerStartCell.z
  };
}

monster.position.set(
  cellToWorldX(
    monsterStartCell.x
  ),
  0,
  cellToWorldZ(
    monsterStartCell.z
  )
);

scene.add(
  monster
);

// ============================================================
// MONSTER AI
// ============================================================

let monsterState =
  "follow";

let monsterPath = [];

let monsterPathIndex = 0;

let monsterRepathTimer =
  0;

let monsterAnimationTime =
  0;

let monsterActiveTimer =
  0;

// ============================================================
// MAZE PATHFINDING
// ============================================================

function getWalkableNeighbors(
  x,
  z
) {
  const result = [];

  const cell =
    maze[z]?.[x];

  if (!cell) {
    return result;
  }

  if (
    !cell.north &&
    z > 0
  ) {
    result.push({
      x,
      z: z - 1
    });
  }

  if (
    !cell.east &&
    x < MAZE_WIDTH - 1
  ) {
    result.push({
      x: x + 1,
      z
    });
  }

  if (
    !cell.south &&
    z < MAZE_HEIGHT - 1
  ) {
    result.push({
      x,
      z: z + 1
    });
  }

  if (
    !cell.west &&
    x > 0
  ) {
    result.push({
      x: x - 1,
      z
    });
  }

  return result;
}

function findMazePath(
  startX,
  startZ,
  targetX,
  targetZ
) {
  startX =
    THREE.MathUtils.clamp(
      startX,
      0,
      MAZE_WIDTH - 1
    );

  startZ =
    THREE.MathUtils.clamp(
      startZ,
      0,
      MAZE_HEIGHT - 1
    );

  targetX =
    THREE.MathUtils.clamp(
      targetX,
      0,
      MAZE_WIDTH - 1
    );

  targetZ =
    THREE.MathUtils.clamp(
      targetZ,
      0,
      MAZE_HEIGHT - 1
    );

  const queue = [
    {
      x: startX,
      z: startZ
    }
  ];

  const visited =
    new Set();

  const previous =
    new Map();

  const key = (
    x,
    z
  ) =>
    `${x},${z}`;

  visited.add(
    key(
      startX,
      startZ
    )
  );

  while (
    queue.length > 0
  ) {
    const current =
      queue.shift();

    if (
      current.x === targetX &&
      current.z === targetZ
    ) {
      const path = [];

      let node =
        current;

      while (node) {
        path.unshift(node);

        node =
          previous.get(
            key(
              node.x,
              node.z
            )
          ) || null;
      }

      return path;
    }

    const neighbors =
      getWalkableNeighbors(
        current.x,
        current.z
      );

    for (
      const next of neighbors
    ) {
      const nextKey =
        key(
          next.x,
          next.z
        );

      if (
        visited.has(nextKey)
      ) {
        continue;
      }

      visited.add(nextKey);

      previous.set(
        nextKey,
        current
      );

      queue.push(next);
    }
  }

  return [];
}

// ============================================================
// MONSTER PATH
// ============================================================

function updateMonsterPath() {
  const monsterCellX =
    worldToCellX(
      monster.position.x
    );

  const monsterCellZ =
    worldToCellZ(
      monster.position.z
    );

  const playerCellX =
    worldToCellX(
      camera.position.x
    );

  const playerCellZ =
    worldToCellZ(
      camera.position.z
    );

  monsterPath =
    findMazePath(
      monsterCellX,
      monsterCellZ,
      playerCellX,
      playerCellZ
    );

  monsterPathIndex = 1;
}

// ============================================================
// MONSTER MOVEMENT
// ============================================================

function moveMonster(
  delta
) {
  if (
    playerInsideWardrobe
  ) {
    return false;
  }

  if (
    monsterPath.length < 2
  ) {
    return false;
  }

  const targetCell =
    monsterPath[
      monsterPathIndex
    ];

  if (!targetCell) {
    return false;
  }

  const target =
    new THREE.Vector3(
      cellToWorldX(
        targetCell.x
      ),
      0,
      cellToWorldZ(
        targetCell.z
      )
    );

  const dx =
    target.x -
    monster.position.x;

  const dz =
    target.z -
    monster.position.z;

  const distance =
    Math.sqrt(
      dx * dx +
      dz * dz
    );

  if (
    distance < 0.12
  ) {
    monsterPathIndex++;

    return true;
  }

  const speed =
    monsterState ===
    "chase"
      ? MONSTER_CHASE_SPEED
      : MONSTER_SPEED;

  const amount =
    Math.min(
      speed * delta,
      distance
    );

  monster.position.x +=
    (dx / distance) *
    amount;

  monster.position.z +=
    (dz / distance) *
    amount;

  const angle =
    Math.atan2(
      dx,
      dz
    );

  monster.rotation.y =
    THREE.MathUtils.lerp(
      monster.rotation.y,
      angle,
      Math.min(
        delta * 12,
        1
      )
    );

  return true;
}

// ============================================================
// MONSTER ANIMATION
// ============================================================

function animateMonster(
  delta,
  moving
) {
  monsterAnimationTime +=
    delta;

  const speed =
    monsterState ===
    "chase"
      ? 11
      : 8;

  const wave =
    Math.sin(
      monsterAnimationTime *
      speed
    );

  if (moving) {
    leftArm.rotation.z =
      -0.12 +
      wave * 0.34;

    rightArm.rotation.z =
      0.12 -
      wave * 0.34;

    leftLeg.rotation.x =
      wave * 0.3;

    rightLeg.rotation.x =
      -wave * 0.3;

    monsterTorso.rotation.z =
      wave * 0.035;
  } else {
    leftArm.rotation.z =
      -0.12;

    rightArm.rotation.z =
      0.12;

    leftLeg.rotation.x =
      0;

    rightLeg.rotation.x =
      0;
  }

  const breathing =
    Math.sin(
      monsterAnimationTime *
      1.6
    ) *
    0.025;

  monsterTorso.scale.y =
    1 +
    breathing;

  monsterHead.rotation.z =
    Math.sin(
      monsterAnimationTime *
      0.8
    ) *
    0.025;

  if (
    monsterState ===
    "chase"
  ) {
    monsterEyeLight.intensity =
      0.45;

    monsterEyeMaterial.emissiveIntensity =
      5;
  } else {
    monsterEyeLight.intensity =
      0.2;

    monsterEyeMaterial.emissiveIntensity =
      3.5;
  }
}

// ============================================================
// MONSTER UPDATE
// ============================================================

function updateMonster(
  delta
) {
  if (!gameStarted) {
    return false;
  }

  monsterActiveTimer +=
    delta;

  if (
    monsterActiveTimer <
    MONSTER_START_DELAY
  ) {
    animateMonster(
      delta,
      false
    );

    return false;
  }

  if (
    playerInsideWardrobe
  ) {
    monsterState =
      "search";

    monsterRepathTimer -=
      delta;

    if (
      monsterRepathTimer <= 0
    ) {
      updateMonsterPath();

      monsterRepathTimer =
        0.8;
    }

    const moving =
      moveMonster(
        delta
      );

    animateMonster(
      delta,
      moving
    );

    return moving;
  }

  const distanceToPlayer =
    monster.position.distanceTo(
      new THREE.Vector3(
        camera.position.x,
        0,
        camera.position.z
      )
    );

  if (
    distanceToPlayer < 10
  ) {
    monsterState =
      "chase";
  } else {
    monsterState =
      "follow";
  }

  monsterRepathTimer -=
    delta;

  if (
    monsterRepathTimer <= 0
  ) {
    updateMonsterPath();

    monsterRepathTimer =
      MONSTER_REPATH_TIME;
  }

  const moving =
    moveMonster(
      delta
    );

  animateMonster(
    delta,
    moving
  );

  return moving;
}

// ============================================================
// KEYBOARD
// ============================================================

// E = DRAWER + FLASHLIGHT ONLY
window.addEventListener(
  "keydown",
  (event) => {
    keys[event.code] = true;

    if (
      event.code === "KeyE" &&
      !event.repeat
    ) {
      interactDrawerAndFlashlight();
    }

    // F = WARDROBE ONLY
    if (
      event.code === "KeyF" &&
      !event.repeat
    ) {
      interactWardrobe();
    }
  }
);

window.addEventListener(
  "keyup",
  (event) => {
    keys[event.code] = false;
  }
);

window.addEventListener(
  "keydown",
  (event) => {
    if (
      event.code === "KeyW" ||
      event.code === "KeyA" ||
      event.code === "KeyS" ||
      event.code === "KeyD" ||
      event.code === "Space"
    ) {
      event.preventDefault();
    }
  },
  {
    passive: false
  }
);

// ============================================================
// MOUSE LOOK
// ============================================================

document.addEventListener(
  "mousemove",
  (event) => {
    if (!gameStarted) {
      return;
    }

    if (
      document.pointerLockElement !==
      renderer.domElement
    ) {
      return;
    }

    yaw -=
      event.movementX *
      0.0022;

    pitch -=
      event.movementY *
      0.0022;

    pitch =
      THREE.MathUtils.clamp(
        pitch,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );

    camera.rotation.y =
      yaw;

    camera.rotation.x =
      pitch;
  }
);

// ============================================================
// START GAME
// ============================================================

function startGame() {
  if (gameStarted) {
    return;
  }

  gameStarted = true;

  initializeAudio();

  if (
    audioContext &&
    audioContext.state ===
    "suspended"
  ) {
    audioContext.resume();
  }

  startScreen.classList.add(
    "hidden"
  );

  camera.position.set(
    drawerX,
    PLAYER_HEIGHT,
    drawerZ + 2.35
  );

  yaw = 0;
  pitch = 0;

  camera.rotation.y = 0;
  camera.rotation.x = 0;

  hidePrompt();

  // Reset monster timer.
  monsterActiveTimer = 0;

  if (
    renderer.domElement
      .requestPointerLock
  ) {
    renderer.domElement.requestPointerLock();
  }
}

startButton.addEventListener(
  "click",
  startGame
);

renderer.domElement.addEventListener(
  "click",
  () => {
    if (
      gameStarted &&
      document.pointerLockElement !==
      renderer.domElement
    ) {
      renderer.domElement.requestPointerLock();
    }
  }
);

// ============================================================
// DRAWER DISTANCE
// ============================================================

function distanceToDrawer() {
  const dx =
    camera.position.x -
    drawerGroup.position.x;

  const dz =
    camera.position.z -
    drawerGroup.position.z;

  return Math.sqrt(
    dx * dx +
    dz * dz
  );
}

// ============================================================
// WARDROBE INTERACTION — F ONLY
// ============================================================

function interactWardrobe() {
  if (!gameStarted) {
    return;
  }

  if (
    interactionLocked
  ) {
    return;
  }

  // Inside wardrobe:
  // F closes it.
  if (
    playerInsideWardrobe &&
    activeWardrobe
  ) {
    closeWardrobe(
      activeWardrobe
    );

    return;
  }

  const nearest =
    getNearestWardrobe();

  if (
    !nearest.wardrobe ||
    nearest.distance >=
    WARDROBE_INTERACTION_DISTANCE
  ) {
    return;
  }

  if (
    !nearest.wardrobe.open
  ) {
    openWardrobe(
      nearest.wardrobe
    );
  } else {
    enterWardrobe(
      nearest.wardrobe
    );
  }
}

// ============================================================
// DRAWER + FLASHLIGHT INTERACTION — E ONLY
// ============================================================

function interactDrawerAndFlashlight() {
  if (!gameStarted) {
    return;
  }

  if (
    interactionLocked
  ) {
    return;
  }

  const drawerDistance =
    distanceToDrawer();

  // OPEN DRAWER
  if (
    !drawerOpened &&
    drawerDistance <
    DRAWER_INTERACTION_DISTANCE
  ) {
    openDrawer();

    return;
  }

  // PICK UP FLASHLIGHT
  if (
    drawerOpened &&
    !flashlightCollected &&
    drawerDistance <
    FLASHLIGHT_INTERACTION_DISTANCE
  ) {
    collectFlashlight();

    return;
  }

  // TOGGLE FLASHLIGHT
  if (
    flashlightCollected
  ) {
    toggleFlashlight();
  }
}

// ============================================================
// OPEN DRAWER
// ============================================================

function openDrawer() {
  if (drawerOpened) {
    return;
  }

  drawerOpened = true;

  interactionLocked =
    true;

  hidePrompt();

  flashlight.visible =
    true;

  const startZ =
    drawer.position.z;

  const endZ =
    startZ + 0.72;

  const startTime =
    performance.now();

  const duration = 500;

  function animateDrawer(
    now
  ) {
    const progress =
      THREE.MathUtils.clamp(
        (now - startTime) /
        duration,
        0,
        1
      );

    const eased =
      THREE.MathUtils.smootherstep(
        progress,
        0,
        1
      );

    drawer.position.z =
      THREE.MathUtils.lerp(
        startZ,
        endZ,
        eased
      );

    if (
      progress < 1
    ) {
      requestAnimationFrame(
        animateDrawer
      );
    } else {
      drawer.position.z =
        endZ;

      interactionLocked =
        false;

      if (
        !flashlightCollected
      ) {
        showPrompt(
          "E — PICK UP FLASHLIGHT"
        );
      }
    }
  }

  requestAnimationFrame(
    animateDrawer
  );
}

// ============================================================
// COLLECT FLASHLIGHT
// ============================================================

function collectFlashlight() {
  if (
    flashlightCollected
  ) {
    return;
  }

  flashlightCollected =
    true;

  hidePrompt();

  drawer.remove(
    flashlight
  );

  camera.add(
    flashlight
  );

  flashlight.position.set(
    0.38,
    -0.30,
    -0.62
  );

  flashlight.rotation.set(
    -0.12,
    -0.20,
    -0.10
  );

  flashlight.visible =
    true;

  playTone(
    420,
    0.12,
    0.04,
    "sine"
  );

  playTone(
    650,
    0.16,
    0.03,
    "sine"
  );
}

// ============================================================
// FLASHLIGHT TOGGLE
// ============================================================

function toggleFlashlight() {
  flashlightOn =
    !flashlightOn;

  // FIXED 30-METER RANGE.
  // It does not change based on nearby walls/objects.
  flashlightLight.distance = 30;
  flashlightLight.angle =
    Math.PI / 7;
  flashlightLight.penumbra =
    0.55;
  flashlightLight.decay =
    0;

  flashlightLight.intensity =
    flashlightOn
      ? 8
      : 0;

  flashlightGlow.material.color.set(
    flashlightOn
      ? 0xfff5d5
      : 0x403d35
  );

  playTone(
    flashlightOn
      ? 520
      : 280,
    0.07,
    0.025,
    "sine"
  );
}

// ============================================================
// FLASHLIGHT UPDATE
// ============================================================

function updateFlashlight() {
  if (
    !flashlightCollected
  ) {
    return;
  }

  const direction =
    new THREE.Vector3(
      0,
      0,
      -1
    );

  direction.applyQuaternion(
    camera.quaternion
  );

  flashlightLight.position.copy(
    camera.position
  );

  flashlightLight.position.add(
    direction
      .clone()
      .multiplyScalar(
        0.35
      )
  );

  // ALWAYS target 30 meters away.
  // No raycast.
  // No shrinking target.
  // No object-distance adjustment.
  flashlightTarget.position.copy(
    camera.position
  );

  flashlightTarget.position.add(
    direction.multiplyScalar(
      30
    )
  );

  flashlightLight.target =
    flashlightTarget;
}

// ============================================================
// MOVEMENT
// ============================================================

let playerIsMoving =
  false;

function updateMovement(
  delta
) {
  if (!gameStarted) {
    playerIsMoving = false;
    return;
  }

  if (
    playerInsideWardrobe
  ) {
    playerIsMoving = false;
    return;
  }

  let forwardInput = 0;
  let strafeInput = 0;

  if (keys["KeyW"]) {
    forwardInput += 1;
  }

  if (keys["KeyS"]) {
    forwardInput -= 1;
  }

  if (keys["KeyA"]) {
    strafeInput -= 1;
  }

  if (keys["KeyD"]) {
    strafeInput += 1;
  }

  if (
    forwardInput === 0 &&
    strafeInput === 0
  ) {
    playerIsMoving = false;
    return;
  }

  playerIsMoving = true;

  const length =
    Math.sqrt(
      forwardInput *
      forwardInput +
      strafeInput *
      strafeInput
    );

  forwardInput /=
    length;

  strafeInput /=
    length;

  const sprinting =
    keys["ShiftLeft"] ||
    keys["ShiftRight"];

  const speed =
    sprinting
      ? SPRINT_SPEED
      : WALK_SPEED;

  const distance =
    speed * delta;

  const forwardX =
    -Math.sin(yaw);

  const forwardZ =
    -Math.cos(yaw);

  const rightX =
    Math.cos(yaw);

  const rightZ =
    -Math.sin(yaw);

  const dx =
    (
      forwardX *
      forwardInput +
      rightX *
      strafeInput
    ) *
    distance;

  const dz =
    (
      forwardZ *
      forwardInput +
      rightZ *
      strafeInput
    ) *
    distance;

  tryMove(
    dx,
    dz
  );
}

// ============================================================
// INTERACTION PROMPT UPDATE
// ============================================================

function updateInteractionPrompt() {
  if (!gameStarted) {
    hidePrompt();
    return;
  }

  if (
    interactionLocked
  ) {
    hidePrompt();
    return;
  }

  // WARDROBE ALWAYS GETS PRIORITY.
  if (
    playerInsideWardrobe
  ) {
    showPrompt(
      "F — CLOSE WARDROBE"
    );

    return;
  }

  const nearest =
    getNearestWardrobe();

  if (
    nearest.wardrobe &&
    nearest.distance <
    WARDROBE_INTERACTION_DISTANCE
  ) {
    if (
      !nearest.wardrobe.open
    ) {
      showPrompt(
        "F — OPEN WARDROBE"
      );
    } else {
      showPrompt(
        "F — ENTER WARDROBE"
      );
    }

    return;
  }

  // DRAWER / FLASHLIGHT ARE E.
  const drawerDistance =
    distanceToDrawer();

  if (
    !drawerOpened
  ) {
    if (
      drawerDistance <
      DRAWER_INTERACTION_DISTANCE
    ) {
      showPrompt(
        "E — OPEN DRAWER"
      );
    } else {
      hidePrompt();
    }

    return;
  }

  if (
    !flashlightCollected
  ) {
    if (
      drawerDistance <
      FLASHLIGHT_INTERACTION_DISTANCE
    ) {
      showPrompt(
        "E — PICK UP FLASHLIGHT"
      );
    } else {
      hidePrompt();
    }

    return;
  }

  hidePrompt();
}

// ============================================================
// NORMAL FLICKER
// ============================================================

let flickerTimer = 0;
let blackoutTriggered = false;

function updateNormalFlicker(
  delta
) {
  if (
    blackoutTriggered
  ) {
    return;
  }

  flickerTimer -= delta;

  if (
    flickerTimer > 0
  ) {
    return;
  }

  flickerTimer =
    THREE.MathUtils.randFloat(
      2.5,
      7
    );

  if (
    Math.random() < 0.35
  ) {
    const selected =
      fluorescentLights[
        Math.floor(
          Math.random() *
          fluorescentLights.length
        )
      ];

    if (!selected) {
      return;
    }

    selected.light.intensity =
      selected.baseIntensity *
      0.15;

    selected.tube.material.emissiveIntensity =
      0.4;

    setTimeout(() => {
      if (
        blackoutTriggered
      ) {
        return;
      }

      selected.light.intensity =
        selected.baseIntensity;

      selected.tube.material.emissiveIntensity =
        selected.baseEmission;
    }, 100);
  }
}

// ============================================================
// BLACKOUT
// ============================================================

let blackoutTimer = 15;
let blackoutActive = false;
let blackoutRemaining = 0;

const savedLights = [];

function triggerBlackout() {
  if (
    blackoutTriggered
  ) {
    return;
  }

  blackoutTriggered =
    true;

  blackoutActive =
    true;

  savedLights.length = 0;

  for (
    const item
    of fluorescentLights
  ) {
    savedLights.push({
      light: item.light,
      intensity:
        item.light.intensity,
      tube: item.tube,
      emission:
        item.tube.material
          .emissiveIntensity
    });
  }

  savedLights.push({
    ambient: ambientLight,
    intensity:
      ambientLight.intensity
  });

  savedLights.push({
    hemisphere:
      hemisphereLight,
    intensity:
      hemisphereLight.intensity
  });

  let count = 0;

  playTone(
    38,
    0.8,
    0.12,
    "sine"
  );

  const flicker =
    setInterval(() => {
      count++;

      for (
        const item
        of fluorescentLights
      ) {
        const on =
          Math.random() >
          0.5;

        item.light.intensity =
          on
            ? item.baseIntensity *
            0.3
            : 0;

        item.tube.material.emissiveIntensity =
          on
            ? 0.7
            : 0;
      }

      if (
        count >= 8
      ) {
        clearInterval(
          flicker
        );

        for (
          const item
          of fluorescentLights
        ) {
          item.light.intensity = 0;

          item.tube.material.emissiveIntensity =
            0;
        }

        ambientLight.intensity = 0;
        hemisphereLight.intensity = 0;

        blackoutRemaining = 8;
      }
    }, 100);
}

function updateBlackout(
  delta
) {
  if (!gameStarted) {
    return;
  }

  if (
    !blackoutTriggered
  ) {
    blackoutTimer -= delta;

    if (
      blackoutTimer <= 0
    ) {
      triggerBlackout();
    }

    return;
  }

  if (
    !blackoutActive
  ) {
    return;
  }

  blackoutRemaining -=
    delta;

  if (
    blackoutRemaining <= 0
  ) {
    blackoutActive = false;

    for (
      const saved
      of savedLights
    ) {
      if (saved.light) {
        saved.light.intensity =
          saved.intensity;
      }

      if (saved.ambient) {
        saved.ambient.intensity =
          saved.intensity;
      }

      if (saved.hemisphere) {
        saved.hemisphere.intensity =
          saved.intensity;
      }

      if (saved.tube) {
        saved.tube.material.emissiveIntensity =
          saved.emission;
      }
    }

    if (
      flashlightCollected
    ) {
      flashlightLight.intensity =
        flashlightOn
          ? 8
          : 0;
    }
  }
}

// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );
  }
);

// ============================================================
// GAME LOOP
// ============================================================

function animate(now) {
  requestAnimationFrame(
    animate
  );

  const delta =
    Math.min(
      (now - lastTime) /
      1000,
      0.05
    );

  lastTime = now;

  updateMovement(
    delta
  );

  updateFlashlight();

  updateInteractionPrompt();

  updateNormalFlicker(
    delta
  );

  updateBlackout(
    delta
  );

  const monsterMoving =
    updateMonster(
      delta
    );

  updateAudio(
    delta,
    playerIsMoving,
    monsterMoving
  );

  renderer.render(
    scene,
    camera
  );
}

animate(
  performance.now()
);

// ============================================================
// NO EXTRA TEXT / NO "ads" REFERENCE
// ============================================================

console.log(
  "HOLLOW THINGS: corrected build — E for drawer/flashlight, F for wardrobes, fixed flashlight beam, fast early monster."
);
