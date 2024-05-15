import * as THREE from 'three';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from '/node_modules/three/examples/jsm/loaders/RGBELoader.js';

//by Philip Reinhold - 2024. Erstellt für Three.js & Demozwecke für das Projekt GranCanariaVR.
//weiterbearbeitbar durch Svenja Raetzsch.

const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();

const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const app = document.getElementById('app');

let assetsLoaded = 0;
const totalAssets = 4;  // Update this if you add more assets

function updateLoadingBar() {
  assetsLoaded++;
  const progress = assetsLoaded / totalAssets;
  loadingBar.style.width = progress * 100 + '%';
  if (progress === 1) {
    loadingScreen.style.display = 'none';
    app.style.display = 'block';
  }
}

// Wasser Effekt - Nebel, um die Distanz zum HDRi zu verstärken
const fogColor = new THREE.Color(0x082044);
const fogNear = 10;
const fogFar = 400;
scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimierung der Pixeldichte
document.body.appendChild(renderer.domElement);

// Licht hinzufügen, um die Fische besser sichtbar zu machen
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 1, 0).normalize();
scene.add(directionalLight);

// Loader für die 3D-Modelle
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);

let sharkModel;
let secondSharkModel;
let questModel;
let questRotationSpeed = 0.001;
let sharkOrbitRadiusX = 1.5;
let sharkOrbitRadiusY = 0.75;
let sharkOrbitSpeed = 0.0035;  // Leicht erhöhte Geschwindigkeit
let outerOrbitRadius = 200;  // Initialer größerer Radius
let outerOrbitSpeed = 0.002;  // Leicht erhöhte Geschwindigkeit
let innerAngle = 0;
let outerAngle = 0;
let secondSharkInnerAngle = Math.PI / 2; // Versetzter Startwinkel für zweiten Hai
let secondSharkOuterAngle = Math.PI / 2; // Versetzter Startwinkel für zweiten Hai
let secondSharkOrbitSpeed = 0.0045; // Leicht unterschiedliche Geschwindigkeit für zweiten Hai
let secondSharkOuterOrbitSpeed = 0.0025; // Leicht unterschiedliche Geschwindigkeit für zweiten Hai
let sharkHeightY = 0;  // Initiale Höhe des ersten Angelsharks auf der Y-Achse
const secondSharkYOffset = 100 + (Math.random() * 100);  // Zufällige Versetzung für den zweiten Hai

// Mausposition
let mouse = new THREE.Vector2();
let questDistanceThreshold = 100; // Abstandsschwelle für Quest-Rotation stoppen

// Partikel erstellen mit Instanced Meshes
const particleCount = 2000;  // Reduzierte Partikelanzahl
const particleGeometry = new THREE.SphereGeometry(0.25, 8, 8); // Vergrößerte Partikel
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.1 });

const particles = new THREE.InstancedMesh(particleGeometry, particleMaterial, particleCount);
const dummy = new THREE.Object3D();

for (let i = 0; i < particleCount; i++) {
    dummy.position.set(
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 500
    );
    dummy.updateMatrix();
    particles.setMatrixAt(i, dummy.matrix);
}

scene.add(particles);
updateLoadingBar();

// Funktion zum Erstellen eines Fischschwarms
const createFishSwarm = (fishCount, fishOrbitRadius, fishHeightY, fishSpeed, fishYOffset) => {
    const fishGeometry = new THREE.SphereGeometry(1, 16, 16);  // Geometrie für die Fische (Sphären)
    const fishMaterial = new THREE.MeshStandardMaterial({ color: 0x00008b, side: THREE.DoubleSide, roughness: 0.5, metalness: 1 });  // Dunkelblaue, reflektierende Fische

    const fishGroup = new THREE.Group();
    for (let i = 0; i < fishCount; i++) {
        const fish = new THREE.Mesh(fishGeometry, fishMaterial);
        fish.scale.set(1, 0.5, 1);  // Skalierung zu Ovalen
        fish.position.set(
            (Math.random() - 0.5) * 300,
            (Math.random() - 0.5) * 300,
            (Math.random() - 0.5) * 300
        );
        fish.rotation.set(0, Math.random() * Math.PI * 2, 0);
        fish.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * fishSpeed,
            (Math.random() - 0.5) * fishSpeed,
            (Math.random() - 0.5) * fishSpeed
        );
        fishGroup.add(fish);
    }
    scene.add(fishGroup);

    return { fishGroup, fishOrbitRadius, fishHeightY, fishSpeed, fishYOffset };
};

// Erstellen Sie zwei Fischschwärme
const fishSwarms = [
    createFishSwarm(200, 200, 500, 0.00025, 0),
    createFishSwarm(200, 200, 500, 0.0002, 0.5 * Math.PI)
];
updateLoadingBar();

// Regeln für Schwarmverhalten
const separationDistance = 15;
const alignmentDistance = 50;
const cohesionDistance = 50;
const maxVelocity = 0.01;
const avoidSpeed = 0.05;

function applyBoidsRules(fish, neighbors) {
    let separation = new THREE.Vector3();
    let alignment = new THREE.Vector3();
    let cohesion = new THREE.Vector3();
    let count = 0;

    neighbors.forEach(neighbor => {
        const distance = fish.position.distanceTo(neighbor.position);
        if (distance > 0 && distance < separationDistance) {
            let diff = new THREE.Vector3().subVectors(fish.position, neighbor.position);
            diff.divideScalar(distance);
            separation.add(diff);
        }
        if (distance < alignmentDistance) {
            alignment.add(neighbor.userData.velocity);
        }
        if (distance < cohesionDistance) {
            cohesion.add(neighbor.position);
            count++;
        }
    });

    if (count > 0) {
        alignment.divideScalar(count).normalize().multiplyScalar(maxVelocity);
        cohesion.divideScalar(count).sub(fish.position).normalize().multiplyScalar(maxVelocity);
    }

    fish.userData.velocity.add(separation).add(alignment).add(cohesion).clampLength(0, maxVelocity);
}

function applyAvoidance(swarm1, swarm2) {
    swarm1.fishGroup.children.forEach(fish1 => {
        swarm2.fishGroup.children.forEach(fish2 => {
            const distance = fish1.position.distanceTo(fish2.position);
            if (distance < separationDistance * 2) {
                const diff = new THREE.Vector3().subVectors(fish1.position, fish2.position).normalize().multiplyScalar(avoidSpeed);
                fish1.userData.velocity.add(diff);
                fish2.userData.velocity.add(diff.negate());
            }
        });
    });
}

// Erstellen Sie GUI-Elemente zur Steuerung
const guiContainer = document.getElementById('controls');

const createSlider = (labelText, min, max, step, value, onChange) => {
    const label = document.createElement('label');
    label.textContent = labelText;
    guiContainer.appendChild(label);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;
    slider.classList.add('slider');
    slider.addEventListener('input', onChange);
    guiContainer.appendChild(slider);
    guiContainer.appendChild(document.createElement('br'));
};

createSlider('Shark Height Y', -500, 500, 10, sharkHeightY, (event) => {
    sharkHeightY = parseFloat(event.target.value);
    if (sharkModel) {
        sharkModel.position.y = sharkHeightY;
    }
    if (secondSharkModel) {
        secondSharkModel.position.y = sharkHeightY + secondSharkYOffset;
    }
});

// Mausbewegung überwachen
document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Joystick-Bewegungssteuerung
const leftJoystick = document.getElementById('left-joystick');
const rightJoystick = document.getElementById('right-joystick');

let isLeftJoystickActive = false;
let isRightJoystickActive = false;
let leftJoystickStart = { x: 0, y: 0 };
let rightJoystickStart = { x: 0, y: 0 };

leftJoystick.addEventListener('mousedown', (event) => {
    isLeftJoystickActive = true;
    leftJoystickStart.x = event.clientX;
    leftJoystickStart.y = event.clientY;
});
rightJoystick.addEventListener('mousedown', (event) => {
    isRightJoystickActive = true;
    rightJoystickStart.x = event.clientX;
    rightJoystickStart.y = event.clientY;
});
document.addEventListener('mouseup', () => {
    isLeftJoystickActive = false;
    isRightJoystickActive = false;
});
document.addEventListener('mousemove', (event) => {
    if (isLeftJoystickActive) {
        const deltaX = event.clientX - leftJoystickStart.x;
        const deltaY = event.clientY - leftJoystickStart.y;
        camera.position.x -= deltaX * 0.01;
        camera.position.y += deltaY * 0.01;
        leftJoystickStart.x = event.clientX;
        leftJoystickStart.y = event.clientY;
    }
    if (isRightJoystickActive) {
        const deltaX = event.clientX - rightJoystickStart.x;
        camera.position.z -= deltaX * 0.01;
        rightJoystickStart.x = event.clientX;
    }
});

// Funktion zum Laden und Platzieren der Haie
function loadAndPlaceShark(modelPath, callback) {
    loader.load(
        modelPath,
        function (gltf) {
            const sharkModel = gltf.scene;
            scene.add(sharkModel);

            const sharkScale = 200; // Anpassen der Größe des Angelshark-Modells
            sharkModel.scale.set(sharkScale, sharkScale, sharkScale);

            // Animationen des Angelshark-Modells abrufen und anwenden
            const mixer = new THREE.AnimationMixer(sharkModel);
            gltf.animations.forEach(animation => {
                const action = mixer.clipAction(animation);
                action.play();
            });

            callback(sharkModel, mixer);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total) * 100 + '% geladen');
            updateLoadingBar();
        },
        function (error) {
            console.log('Ein Fehler ist aufgetreten', error);
        }
    );
}

// Laden des Quest-Headset-Modells
loader.load(
    '/models/quest3.gltf',
    function (gltf) {
        questModel = gltf.scene;
        scene.add(questModel);

        questModel.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                node.material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    wireframe: true,
                });
            }
        });

        const scale = 1;
        questModel.scale.set(scale, scale, scale);

        const box = new THREE.Box3().setFromObject(questModel);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        camera.position.copy(center);
        camera.position.x += size / 2.0;
        camera.position.y += size / -1.0;  // Leicht untersichtige Position
        camera.position.z += size / 3.0;
        camera.lookAt(center);

        updateLoadingBar();

        // Laden und Platzieren des ersten Hais
        loadAndPlaceShark('/models/Angelote/AngelShark.gltf', (model, mixer) => {
            sharkModel = model;
            sharkModel.position.copy(center);
            sharkModel.position.y += sharkHeightY;

            // Laden und Platzieren des zweiten Hais
            loadAndPlaceShark('/models/Angelote/AngelShark.gltf', (model2, mixer2) => {
                secondSharkModel = model2;
                secondSharkModel.position.copy(center);
                secondSharkModel.position.y += sharkHeightY + secondSharkYOffset;

                function animateSharks() {
                    requestAnimationFrame(animateSharks);
                    mixer.update(0.01); // Aktualisieren der Animationsmischerzeit
                    mixer2.update(0.01); // Aktualisieren der Animationsmischerzeit für zweiten Hai

                    // Innerer Kreis für den ersten Hai
                    innerAngle += sharkOrbitSpeed;
                    const innerX = Math.cos(innerAngle) * sharkOrbitRadiusX;
                    const innerY = Math.sin(innerAngle) * sharkOrbitRadiusY;

                    // Äußerer Kreis für den ersten Hai
                    outerAngle += outerOrbitSpeed;
                    const outerX = Math.cos(outerAngle) * outerOrbitRadius;
                    const outerZ = Math.sin(outerAngle) * outerOrbitRadius;

                    const sharkX = center.x + outerX + innerX;
                    const sharkY = center.y + innerY + sharkHeightY;
                    const sharkZ = center.z + outerZ;

                    sharkModel.position.set(sharkX, sharkY, sharkZ);

                    // Rotation entlang des Kreises für den ersten Hai
                    const tangent1 = new THREE.Vector3(-Math.sin(outerAngle), 0, Math.cos(outerAngle));
                    sharkModel.lookAt(sharkModel.position.clone().add(tangent1));

                    // Innerer Kreis für den zweiten Hai
                    secondSharkInnerAngle += secondSharkOrbitSpeed;
                    const innerX2 = Math.cos(secondSharkInnerAngle) * sharkOrbitRadiusX;
                    const innerY2 = Math.sin(secondSharkInnerAngle) * sharkOrbitRadiusY;

                    // Äußerer Kreis für den zweiten Hai
                    secondSharkOuterAngle += secondSharkOuterOrbitSpeed;
                    const outerX2 = Math.cos(secondSharkOuterAngle) * outerOrbitRadius;
                    const outerZ2 = Math.sin(secondSharkOuterAngle) * outerOrbitRadius;

                    const secondSharkX = center.x + outerX2 + innerX2;
                    const secondSharkY = center.y + innerY2 + sharkHeightY + secondSharkYOffset;
                    const secondSharkZ = center.z + outerZ2;

                    secondSharkModel.position.set(secondSharkX, secondSharkY, secondSharkZ);

                    // Rotation entlang des Kreises für den zweiten Hai
                    const tangent2 = new THREE.Vector3(-Math.sin(secondSharkOuterAngle), 0, Math.cos(secondSharkOuterAngle));
                    secondSharkModel.lookAt(secondSharkModel.position.clone().add(tangent2));

                    // Mausposition auf 3D-Koordinaten umrechnen
                    const mouseVector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
                    mouseVector.unproject(camera);

                    // Abstand zwischen Maus und Quest-Modell berechnen
                    const questDistance = mouseVector.distanceTo(center);

                    // Rotation des Quest-Modells stoppen, wenn die Maus in der Nähe ist
                    if (questDistance < questDistanceThreshold) {
                        questRotationSpeed = 0;
                    } else {
                        questRotationSpeed = 0.001;
                    }

                    // Quest-Modell drehen
                    questModel.rotation.y += questRotationSpeed;

                    // Partikel langsam und ruhig durch den gesamten Raum bewegen
                    for (let i = 0; i < particleCount; i++) {
                        const matrix = new THREE.Matrix4();
                        particles.getMatrixAt(i, matrix);
                        const position = new THREE.Vector3();
                        position.setFromMatrixPosition(matrix);
                        position.x += (Math.random() - 0.5) * 0.005; // Sehr langsame Bewegung
                        position.y += (Math.random() - 0.5) * 0.005; // Sehr langsame Bewegung
                        position.z += (Math.random() - 0.5) * 0.005; // Sehr langsame Bewegung
                        matrix.setPosition(position);
                        particles.setMatrixAt(i, matrix);
                    }
                    particles.instanceMatrix.needsUpdate = true;

                    // Partikel um die Z-Achse rotieren lassen
                    for (let i = 0; i < particleCount; i++) {
                        const matrix = new THREE.Matrix4();
                        particles.getMatrixAt(i, matrix);
                        const position = new THREE.Vector3();
                        position.setFromMatrixPosition(matrix);
                        const angle = 0.001; // Langsame Rotation
                        const x = position.x;
                        const z = position.z;
                        position.x = x * Math.cos(angle) - z * Math.sin(angle);
                        position.z = x * Math.sin(angle) + z * Math.cos(angle);
                        matrix.setPosition(position);
                        particles.setMatrixAt(i, matrix);
                    }
                    particles.instanceMatrix.needsUpdate = true;

                    // Fischschwärme bewegen und Schwarmverhalten anwenden
                    fishSwarms.forEach(({ fishGroup, fishOrbitRadius, fishHeightY, fishSpeed, fishYOffset }) => {
                        outerAngle += fishSpeed;
                        const fishX = Math.cos(outerAngle + fishYOffset) * fishOrbitRadius;
                        const fishZ = Math.sin(outerAngle + fishYOffset) * fishOrbitRadius * Math.sin((outerAngle + fishYOffset) * 2);
                        fishGroup.position.set(center.x + fishX, fishHeightY, center.z + fishZ);
                        fishGroup.rotation.y = outerAngle + Math.PI / 2;

                        fishGroup.children.forEach(fish => {
                            const neighbors = fishGroup.children.filter(neighbor => neighbor !== fish);
                            applyBoidsRules(fish, neighbors);

                            fish.position.add(fish.userData.velocity);
                            const fishDirection = new THREE.Vector3(-Math.sin(outerAngle + fishYOffset), 0, Math.cos(outerAngle + fishYOffset));
                            fish.lookAt(fish.position.clone().add(fishDirection));
                        });
                    });

                    // Vermeidung von Kollisionen zwischen den Schwärmen
                    applyAvoidance(fishSwarms[0], fishSwarms[1]);
                }

                animateSharks();
            });
        });
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total) + '% geladen');
        updateLoadingBar();
    },
    function (error) {
        console.log('Ein Fehler ist aufgetreten', error);
    }
);

// HDRi Loading (Backdrop and Environment Map usw…)
new RGBELoader().load('/images/ocean_bluewater_phil.hdr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
    updateLoadingBar();
});

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.outputEncoding = THREE.sRGBEncoding;

const controls = new OrbitControls(camera, renderer.domElement);
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function render() {
    renderer.render(scene, camera);
}

animate();