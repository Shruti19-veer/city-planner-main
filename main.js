let scene, camera, renderer, controls;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let violationsPanel;
let violationsList;
let lastViolations = [];
let currentWeather = 'sunny';
let isAutoCycle = true;
const weatherCycle = ['sunny', 'rain', 'snow'];
let weatherTimer;

const gridSize = 13;
const tileSize = 2;
let grid = [];
let mode = 'urban';
let currentBuilding = 'school';

const buildings = {
  urban: ['school', 'factory', 'home', 'hospital', 'park'],
  rural: ['field', 'well', 'road', 'forest', 'ruralSchool', 'house']
};

const buildingColors = {
  school: 0xff9999, factory: 0xaaaaaa, home: 0xffcc99,
  hospital: 0xff6666, park: 0x99ff99, field: 0xccaa66,
  well: 0x66ccff, road: 0x666666, forest: 0x339933,
  ruralSchool: 0xffaa77, house: 0xffbb99
};
const scoreWeights = {
  zoning: 0.25,
  traffic: 0.2,
  services: 0.2,
  greenSpace: 0.15,
  walkability: 0.1,
  sustainability: 0.1
};

// Add to your building definitions
const buildingScores = {
  school: { value: 5, radius: 3 },
  hospital: { value: 5, radius: 3 },
  park: { value: 4, radius: 4 },
  home: { value: 3, radius: 2 },
  factory: { value: -2, radius: 3 },
  field: { value: 2, radius: 2 },
  well: { value: 3, radius: 2 },
  forest: { value: 4, radius: 4 },
  ruralSchool: { value: 4, radius: 3 },
  house: { value: 3, radius: 2 },
  road: { value: 1, radius: 1 }
};
// IoT Bot Animation Variables
let currentFrame = 0;
const totalFrames = 89;
let animationInterval;
let floatInterval;
let isAnimating = false;

const alertMessages = {
  'factoryNearSchool': '⚠️ Factory too close to a school — kids deserve clean air!',
  'factoryNearHospital': '⚠️ Hospital too close to factory — patients need clean air to heal!',
  'roadNearWell': '💧 Water alert! Don\'t place roads near wells.',
  'roadNearForest': '🌳 Forest destruction alert — keep roads away.',
  'fieldNearHome': '🛑 Pesticide danger! Fields shouldn\'t border homes',
  'fieldNoWell': '💧 Your field is thirsty — place a well nearby.',
  'houseNoWellOrSchool': '🚰🚸 Houses need nearby wells or rural schools',
  'schoolNoHomes': '🏫 Kids can\'t walk miles — place homes near rural schools.',
  'factoryNearNature': '⚠️ Factory pollution risk! Don\'t place near natural resources.',
  'pollutedHome': '😞 That home is surrounded by pollution sources — bad living conditions.',
  'schoolCrowding': '📚 Too many schools together — spread them out!'
};

const buildingButtonsContainer = document.createElement('div');
buildingButtonsContainer.id = 'building-buttons';
buildingButtonsContainer.style.marginTop = '10px';
document.getElementById('ui').appendChild(buildingButtonsContainer);

const alertTexture = new THREE.TextureLoader().load('images/alert.png');
const alertMaterial = new THREE.SpriteMaterial({ map: alertTexture });

// Initialize IoT Bot with floating animation and message system
let iotBotInitialized = false;
let iotBotController;

function initIoTBot() {
  if (document.getElementById('iot-bot-container')) return iotBotController;

  const container = document.createElement('div');
  container.id = 'iot-bot-container';
  document.body.appendChild(container);

  const botImg = document.createElement('img');
  botImg.id = 'iot-bot';
  botImg.src = 'images/frame_000.png';
  botImg.style.width = '100px';
  container.appendChild(botImg);

  const messageBubble = document.createElement('div');
  messageBubble.id = 'iot-bot-message';
  messageBubble.className = ''; // will toggle 'visible' class
  container.appendChild(messageBubble);

  let currentFrame = 0;
  const totalFrames = 89;
  setInterval(() => {
    currentFrame = (currentFrame + 1) % totalFrames;
    const frameStr = currentFrame.toString().padStart(3, '0');
    botImg.src = `images/frame_${frameStr}.png`;
  }, 40); //for increasing robot speed, lower the num faster the animation

  let messageQueue = [];
  let isShowingMessage = false;

  function showNextMessage() {
    if (messageQueue.length === 0 || isShowingMessage) return;
    isShowingMessage = true;
    const msg = messageQueue.shift();
    messageBubble.textContent = msg;
    messageBubble.classList.add('visible');
    setTimeout(() => {
      messageBubble.classList.remove('visible');
      setTimeout(() => {
        isShowingMessage = false;
        showNextMessage();
      }, 300);
    }, 3000);
  }

  iotBotController = {
    showMessage: function(msg) {
      messageQueue.unshift(msg);
      if (!isShowingMessage) showNextMessage();
    },
    queueMessage: function(msg) {
      messageQueue.push(msg);
      if (!isShowingMessage) showNextMessage();
    },
    clearQueue: function() {
      messageQueue = [];
      messageBubble.classList.remove('visible');
      isShowingMessage = false;
    },
    skipMessages: function() {
      messageQueue = [];
      messageBubble.classList.remove('visible');
      isShowingMessage = false;
    }
  };

  return iotBotController;
}


function updateBuildingButtons() {
  buildingButtonsContainer.innerHTML = '';
  const types = buildings[mode];

  types.forEach(type => {
    const btn = document.createElement('button');
    btn.className = (type === currentBuilding) ? 'active' : '';
    
    const img = document.createElement('img');
    img.src = `images/${type}.png`;
    img.alt = type;

    const label = document.createElement('span');
    label.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    
    btn.appendChild(img);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      currentBuilding = type;
      updateBuildingButtons();
    });

    buildingButtonsContainer.appendChild(btn);
  });
}

function setupUI() {
  document.getElementById('urbanBtn').addEventListener('click', () => {
    mode = 'urban';
    currentBuilding = 'school';
    setActive('urbanBtn');
    updateBuildingButtons();
  });
  
  document.getElementById('ruralBtn').addEventListener('click', () => {
    mode = 'rural';
    currentBuilding = 'field';
    setActive('ruralBtn');
    updateBuildingButtons();
  });

   document.getElementById('weatherBtn').addEventListener('click', () => {
    const options = document.getElementById('weatherOptions');
    options.style.display = options.style.display === 'flex' ? 'none' : 'flex';
  });

  document.querySelectorAll('.weather-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const weatherType = btn.dataset.weather;
      const isAuto = weatherType === 'auto';
      setWeather(weatherType, isAuto);
      document.getElementById('weatherOptions').style.display = 'none';
    });
  });
  
  document.getElementById('iotBtn').addEventListener('click', runIoTInspection);
// Add skip button
  const skipBtn = document.createElement('button');
  skipBtn.id = 'skip-btn';
   // Create image element
  const skipImg = document.createElement('img');
  skipImg.src = 'images/skip.png'; // Path to your skip icon
  skipImg.alt = 'Skip';
  skipImg.style.width = '40px'; // Adjust size as needed
  skipImg.style.marginRight = '6px'; // Space between icon and text
  
  // Create text span
  const skipText = document.createElement('span');
  skipText.textContent = 'Show All';
  skipBtn.appendChild(skipImg);
  skipBtn.appendChild(skipText);
  skipBtn.addEventListener('click', () => {
    if (iotBotController) iotBotController.skipMessages();
    toggleViolationsPanel();
  });
  
  // Insert after IoT button
  const iotBtnContainer = document.getElementById('iotBtn').parentNode;
  iotBtnContainer.insertBefore(skipBtn, document.getElementById('iotBtn').nextSibling);
  
  updateBuildingButtons();
  initViolationsPanel(); // Initialize the panel
  setupScoreUI()
}
  
function setupScoreUI() {
  const existingBtn = document.getElementById('scoreBtn');
  if (existingBtn) {
    existingBtn.remove();
  }
  const scoreBtn = document.createElement('button');
  scoreBtn.id = 'scoreBtn';
  const scoreImg = document.createElement('img');
  scoreImg.src = 'images/checkscore.png'; // You'll need to add this image
  scoreImg.alt = 'Score';
  scoreImg.style.width = '40px';
  
  const scoreText = document.createElement('span');
  scoreText.textContent = 'Check Score';
  
  scoreBtn.appendChild(scoreImg);
  scoreBtn.appendChild(scoreText);
  scoreBtn.addEventListener('click', calculateCityScore);
  scoreBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Score button clicked");
    calculateCityScore();
  });
  // Insert after existing buttons
  const buttonContainer = document.getElementById('iotBtn').parentNode;
  buttonContainer.insertBefore(scoreBtn, document.getElementById('iotBtn').nextSibling);
  
  // Create score panel
  const scorePanel = document.createElement('div');
  scorePanel.id = 'score-panel';
  document.body.appendChild(scorePanel);
}
 
// Scoring functions
function calculateCityScore() {
  console.log("CalculateCityScore function triggered"); // Debug 1
  
  try {
    console.log("Starting score calculations..."); // Debug 2
    
    const scores = {
      zoning: checkZoningCompliance(),
      traffic: analyzeTrafficFlow(),
      services: evaluateServiceCoverage(),
      greenSpace: calculateGreenSpace(),
      walkability: calculateWalkability(),
      sustainability: calculateSustainability()
    };

    console.log("Intermediate scores:", scores); // Debug 3

    const totalScore = Object.keys(scores).reduce((sum, key) => {
      return sum + (scores[key] * (scoreWeights[key] || 0));
    }, 0);

    console.log("Total score calculated:", totalScore); // Debug 4
    
    displayScoreResults(totalScore, scores);
    
    if (iotBotController) {
      const feedback = getScoreFeedback(totalScore);
      console.log("Sending feedback to IoT bot:", feedback); // Debug 5
      iotBotController.queueMessage(`🏆 City Score: ${Math.round(totalScore)}/100 - ${feedback}`);
    }
  } catch (error) {
    console.error("Error calculating city score:", error); // Debug 6
    if (iotBotController) {
      iotBotController.queueMessage("⚠️ Error calculating score. Please try again.");
    }
  }
}

function checkZoningCompliance() {
  let violations = 0;
  let total = 0;
  
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const building = grid[x][z];
      if (!building) continue;
      
      total++;
      const type = building.userData.type;
      
      // Check for zoning violations
      if (type === 'factory' && checkNearby(x, z, ['school', 'hospital', 'park'], 2)) {
        violations++;
      }
      if (type === 'road' && checkNearby(x, z, ['well', 'forest'], 1)) {
        violations++;
      }
    }
  }
  
  return total > 0 ? 100 - (violations / total * 100) : 100;
}

function analyzeTrafficFlow() {
  const roadCount = countBuildings('road');
  const intersections = countIntersections();
  
  // More roads and intersections generally mean better traffic flow
  const roadScore = Math.min(roadCount / (gridSize * 0.5) * 50, 50);
  const intersectionScore = Math.min(intersections / (gridSize * 0.3) * 50, 50);
  
  return roadScore + intersectionScore;
}

function evaluateServiceCoverage() {
  let coverage = 0;
  const serviceBuildings = ['school', 'hospital', 'well', 'ruralSchool'];
  
  serviceBuildings.forEach(type => {
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        if (grid[x][z]?.userData.type === type) {
          const radius = buildingScores[type].radius;
          coverage += countNearby(x, z, 'home', radius) + countNearby(x, z, 'house', radius);
        }
      }
    }
  });
  
  const maxPossible = countBuildings('home') + countBuildings('house');
  return maxPossible > 0 ? (coverage / maxPossible) * 100 : 100;
}

function calculateGreenSpace() {
  const greenBuildings = ['park', 'forest', 'field'];
  let greenCount = 0;
  
  greenBuildings.forEach(type => {
    greenCount += countBuildings(type);
  });
  
  return (greenCount / (gridSize * gridSize)) * 100;
}

function calculateWalkability() {
  let walkableHomes = 0;
  const totalHomes = countBuildings('home') + countBuildings('house');
  
  if (totalHomes === 0) return 100; // Perfect score if no homes
  
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const building = grid[x][z];
      if (!building || (building.userData.type !== 'home' && building.userData.type !== 'house')) continue;
      
      // Check for nearby amenities and roads
      const hasAmenities = checkNearby(x, z, ['school', 'hospital', 'park', 'well', 'ruralSchool'], 2);
      const hasRoad = checkNearby(x, z, 'road', 1);
      
      if (hasAmenities && hasRoad) {
        walkableHomes++;
      }
    }
  }
  
  return totalHomes > 0 ? (walkableHomes / totalHomes) * 100 : 100;
}

function calculateSustainability() {
  let score = 50; // Base score
  
  // Bonus for green spaces
  const greenSpaces = countBuildings('park') + countBuildings('forest');
  score += Math.min(greenSpaces * 2, 20);
  
  // Penalty for factories
  const factories = countBuildings('factory');
  score -= Math.min(factories * 5, 30);
  
  // Bonus for well placement
  const fields = countBuildings('field');
  const wells = countBuildings('well');
  if (fields > 0) {
    score += Math.min((wells / fields) * 20, 20);
  }
  
  return Math.max(0, Math.min(score, 100)); // Keep between 0-100
}

// Helper functions
function countBuildings(type) {
  let count = 0;
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      if (grid[x][z]?.userData.type === type) count++;
    }
  }
  return count;
}

function countIntersections() {
  let intersections = 0;
  for (let x = 1; x < gridSize - 1; x++) {
    for (let z = 1; z < gridSize - 1; z++) {
      if (grid[x][z]?.userData.type === 'road') {
        // Check if this road connects to others in 4 directions
        const connections = [
          grid[x-1][z]?.userData.type === 'road',
          grid[x+1][z]?.userData.type === 'road',
          grid[x][z-1]?.userData.type === 'road',
          grid[x][z+1]?.userData.type === 'road'
        ].filter(Boolean).length;
        
        if (connections >= 3) intersections++;
      }
    }
  }
  return intersections;
}

function displayScoreResults(totalScore, breakdown) {
  const scorePanel = document.getElementById('score-panel');
  scorePanel.innerHTML = '';
    if (!scorePanel) {
    console.log("Creating score panel"); // Debug 9
    scorePanel = document.createElement('div');
    scorePanel.id = 'score-panel';
    document.body.appendChild(scorePanel);
  }
  // Create score display
  const scoreDisplay = document.createElement('div');
  scoreDisplay.className = 'score-display';
  
  const scoreValue = document.createElement('div');
  scoreValue.className = 'score-value';
  scoreValue.textContent = Math.round(totalScore);
  
  const scoreLabel = document.createElement('div');
  scoreLabel.className = 'score-label';
  scoreLabel.textContent = 'City Score';
  
  // Create gauge visualization
  const scoreGauge = document.createElement('div');
  scoreGauge.className = 'score-gauge';
  const gaugeFill = document.createElement('div');
  gaugeFill.className = 'gauge-fill';
  gaugeFill.style.width = `${totalScore}%`;
  scoreGauge.appendChild(gaugeFill);
  
  // Create breakdown
  const breakdownList = document.createElement('div');
  breakdownList.className = 'breakdown-list';
  
  Object.keys(breakdown).forEach(key => {
    const item = document.createElement('div');
    item.className = 'breakdown-item';
    
    const label = document.createElement('span');
    label.className = 'breakdown-label';
    label.textContent = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()) + ':';
    
    const value = document.createElement('span');
    value.className = 'breakdown-value';
    value.textContent = Math.round(breakdown[key]);
    
    const bar = document.createElement('div');
    bar.className = 'breakdown-bar';
    const barFill = document.createElement('div');
    barFill.className = 'bar-fill';
    barFill.style.width = `${breakdown[key]}%`;
    bar.appendChild(barFill);
    
    item.appendChild(label);
    item.appendChild(value);
    item.appendChild(bar);
    breakdownList.appendChild(item);
  });
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    scorePanel.classList.remove('visible');
  });
  
  // Assemble panel
  scoreDisplay.appendChild(scoreValue);
  scoreDisplay.appendChild(scoreLabel);
  scoreDisplay.appendChild(scoreGauge);
  
  scorePanel.appendChild(closeBtn);
  scorePanel.appendChild(scoreDisplay);
  scorePanel.appendChild(breakdownList);
  
  scorePanel.classList.add('visible');
}

function getScoreFeedback(score) {
  if (score >= 90) return "Master Planner! Your city is nearly perfect!";
  if (score >= 75) return "Great job! Just a few improvements needed.";
  if (score >= 60) return "Good start, but needs more planning.";
  if (score >= 40) return "Needs significant improvements.";
  return "Consider redesigning your city layout.";
}

// Add after setupUI()
function initWeather() {
  startWeatherCycle();
  updateWeatherButton();
}

function startWeatherCycle() {
  if (!isAutoCycle) return;
  
  clearInterval(weatherTimer);
  weatherTimer = setInterval(() => {
    const currentIndex = weatherCycle.indexOf(currentWeather);
    const nextIndex = (currentIndex + 1) % weatherCycle.length;
    const nextWeather = weatherCycle[nextIndex];
    
    // Alert 30 sec before change
    if (iotBotController) {
      iotBotController.queueMessage(
        `🔔 Weather shifting to ${nextWeather} in 30 sec!`
      );
    }
    
    setTimeout(() => {
      setWeather(nextWeather, true);
    }, 30000);
  }, 60000); // Full cycle every 60 sec
}

function setWeather(type, isAuto) {
  currentWeather = type;
  isAutoCycle = isAuto;

  // ✅ remove any old overlay
  document.body.classList.remove('weather-rain', 'weather-snow');

  // ✅ add new overlay class
  if (type === 'rain') {
    document.body.classList.add('weather-rain');
    checkDrainage();
  } else if (type === 'snow') {
    document.body.classList.add('weather-snow');
    checkHeating();
  }

  updateWeatherButton();

  if (iotBotController) {
    if (isAuto) {
      iotBotController.queueMessage(`Weather changed to ${type} (Auto)`);
    } else {
      iotBotController.queueMessage(`🌦️ Manual override: ${type} activated!`);
    }
  }

  if (isAuto) {
    startWeatherCycle();
  } else {
    clearInterval(weatherTimer); // ✅ stop auto mode if manual
  }
}
function updateWeatherButton() {
  document.querySelectorAll('.weather-option').forEach(btn => {
    btn.classList.remove('active');
    if ((isAutoCycle && btn.dataset.weather === 'auto') || 
        (!isAutoCycle && btn.dataset.weather === currentWeather)) {
      btn.classList.add('active');
    }
  });
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(gridSize, 20, gridSize * 1.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(light);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  createGrid();
  setupUI();
  initWeather();
  iotBotController = initIoTBot();

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('click', onClick);
  animate();
}

function createGrid() {
  const planeGeo = new THREE.PlaneGeometry(gridSize * tileSize, gridSize * tileSize);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((gridSize * tileSize) / 2, 0, (gridSize * tileSize) / 2);
  scene.add(plane);

  grid = Array(gridSize).fill().map(() => Array(gridSize).fill(null));
}

function placeBuilding(x, z, type) {
  if (grid[x][z]) {
    scene.remove(grid[x][z]);
    if (grid[x][z].alertIcon) scene.remove(grid[x][z].alertIcon);
  }

  const geometry = new THREE.BoxGeometry(tileSize * 0.9, 1, tileSize * 0.9);
  const material = new THREE.MeshStandardMaterial({ color: buildingColors[type] });
  const cube = new THREE.Mesh(geometry, material);

  cube.position.set(x * tileSize + tileSize / 2, 0.5, z * tileSize + tileSize / 2);
  cube.userData = { type, x, z };
  scene.add(cube);
  grid[x][z] = cube;
}

function onClick(event) {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (intersects.length > 0) {
    const point = intersects[0].point;
    const x = Math.floor(point.x / tileSize);
    const z = Math.floor(point.z / tileSize);

    if (x >= 0 && x < gridSize && z >= 0 && z < gridSize) {
      placeBuilding(x, z, currentBuilding);
    }
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setActive(id) {
  document.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function runIoTInspection() {
  const foundViolations = [];

  // Clear previous alerts and messages
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      if (grid[x][z]?.alertIcon) {
        scene.remove(grid[x][z].alertIcon);
      }
    }
  }
  if (iotBotController) iotBotController.clearQueue();

  // Find all violations
  const violations = [];
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const building = grid[x][z];
      if (!building) continue;

      const type = building.userData.type;
      let violationType = null;

      // Urban violations
     if (mode === 'urban') {
  if (type === 'school' && checkNearby(x, z, 'factory', 2)) {
    violationType = 'factoryNearSchool';
  }
  else if (type === 'hospital' && checkNearby(x, z, 'factory', 2)) {
    violationType = 'factoryNearHospital'; // New specific violation
  }
  else if ((type === 'school' || type === 'hospital') && checkNearby(x, z, 'factory', 2)) {
    violationType = 'factoryNearSensitive'; // Fallback generic violation
  }
  else if (type === 'school' && countNearby(x, z, 'school', 1) > 3) {
    violationType = 'schoolCrowding';
  }
  else if (type === 'home' && allBadNeighbors(x, z)) {
    violationType = 'pollutedHome';
  }
}
      // Rural violations
      else if (mode === 'rural') {
        if ((type === 'well' || type === 'forest') && checkNearby(x, z, 'road', 1)) {
          violationType = type === 'well' ? 'roadNearWell' : 'roadNearForest';
        }
        else if (type === 'road' && checkNearby(x, z, 'forest', 1)) {
          violationType = 'roadNearForest';
        }
        else if (type === 'field' && checkNearby(x, z, 'house', 1)) {
          violationType = 'fieldNearHome';
        }
        else if (type === 'field' && !checkNearby(x, z, 'well', 2)) {
          violationType = 'fieldNoWell';
        }
        else if (type === 'house' && (!checkNearby(x, z, 'well', 3) && !checkNearby(x, z, 'ruralSchool', 3))) {
          violationType = 'houseNoWellOrSchool';
        }
        else if (type === 'ruralSchool' && !checkNearby(x, z, 'house', 3)) {
          violationType = 'schoolNoHomes';
        }
        else if (type === 'factory' && (checkNearby(x, z, 'well', 1) || checkNearby(x, z, 'forest', 1) || checkNearby(x, z, 'field', 1))) {
          violationType = 'factoryNearNature';
        }
      }

      if (violationType) {
        // Add alert icon
        const sprite = new THREE.Sprite(alertMaterial);
        sprite.scale.set(1, 1, 1);
        sprite.position.set(building.position.x, 1.5, building.position.z);
        scene.add(sprite);
        building.alertIcon = sprite;
        
        // Add to violations list
        const violation = {
          coords: `(${x},${z})`,
          message: alertMessages[violationType],
          x: x,
          z: z
        };
        foundViolations.push(violation);
        
        if (iotBotController) {
          iotBotController.queueMessage(`${violation.coords} ${violation.message}`);
        }
      }
    }
  }

  if (foundViolations.length === 0 && iotBotController) {
    iotBotController.queueMessage("✅ No violations found!");
  }
  populateViolationsList(foundViolations); // Moved inside the function
}

function checkNearby(x, z, types, radius) {
  if (!Array.isArray(types)) types = [types]; // Handle both arrays and single values
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
        const obj = grid[nx][nz];
        if (obj && types.includes(obj.userData.type)) return true;
      }
    }
  }
  return false;
}

function countNearby(x, z, type, radius) {
  let count = 0;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
        const obj = grid[nx][nz];
        if (obj && obj.userData.type === type) count++;
      }
    }
  }
  return count;
}


function checkDrainage() {
  // Example: Find areas needing drainage
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      if (grid[x][z]?.userData.type === 'road' && 
          checkNearby(x, z, 'factory', 2)) {
        iotBotController.queueMessage(
          `💧 Heavy rain! Check drainage near (${x},${z})`
        );
      }
    }
  }
}

function checkHeating() {
  // Example: Find homes needing insulation
  // Add your own logic here
}

function allBadNeighbors(x, z) {
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nx < gridSize && nz >= 0 && nz < gridSize) {
        const type = grid[nx][nz]?.userData.type;
        if (type !== 'road' && type !== 'factory') return false;
        count++;
      }
    }
  }
  return count > 0;
}
function initViolationsPanel() {
  if (document.getElementById('violations-panel')) return;
  
  violationsPanel = document.createElement('div');
  violationsPanel.id = 'violations-panel';
  
  const title = document.createElement('h3');
  title.textContent = 'Violations List';
  violationsPanel.appendChild(title);
  
  violationsList = document.createElement('ul');
  violationsList.id = 'violations-list';
  violationsPanel.appendChild(violationsList);
  
  document.body.appendChild(violationsPanel);
}

function toggleViolationsPanel() {
  if (!violationsPanel) createViolationsPanel();
  violationsPanel.classList.toggle('visible');
}

function populateViolationsList(violations) {
  violationsList.innerHTML = '';
  lastViolations = violations;
  
  violations.forEach(violation => {
    const li = document.createElement('li');
    li.textContent = `${violation.coords} ${violation.message}`;
    
    li.addEventListener('mouseenter', () => {
      const [x, z] = violation.coords.match(/\d+/g).map(Number);
      if (grid[x] && grid[x][z]) {
        grid[x][z].material.color.setHex(0xff0000);
      }
    });
    
    li.addEventListener('mouseleave', () => {
      const [x, z] = violation.coords.match(/\d+/g).map(Number);
      if (grid[x] && grid[x][z]) {
        grid[x][z].material.color.setHex(buildingColors[grid[x][z].userData.type]);
      }
    });
    
    violationsList.appendChild(li);
  });
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

init();