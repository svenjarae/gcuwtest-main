import * as THREE from 'three';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from '/node_modules/three/examples/jsm/loaders/RGBELoader.js';

//by Philip Reinhold - 2024. Erstellt für Three.js & Demozwecke für das Projekt GranCanariaVR.
//weiterbearbeitbar durch Svenja Raetzsch.

const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();

// Wasser Effekt - Nebel, um die Distanz zum HDRi zu verstärken, weiter unten hab ich noch Partikel hinzugefügt, finde sie noch etwas schnell aber generel nice.
const fogColor = new THREE.Color(0x082044);
const fogNear = 10;
const fogFar = 400;
scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Loader für die 3D-Modelle - du kannst auch eigene Modelle hochladen oder mir sagen, welche ich noch erstellen könnte. Hammerhai, FIsche? Barracuda schwärme? Sollte halt nie zuviel werden.
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

// Partikel erstellen
const particles = [];
const particleCount = 6000;  // Reduzierte Partikelanzahl
const particleRadius = 0.5;  // Kleine Partikel
const particleMaterial = new THREE.MeshBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.1 });  // Durchsichtigeres, entsättigtes Material

for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.SphereGeometry(particleRadius, 8, 8);
    const particle = new THREE.Mesh(geometry, particleMaterial);

    particle.position.set(
        (Math.random() - 0.5) * 500, // Weiter verengte Distanz
        (Math.random() - 0.5) * 500, // Weiter verengte Distanz
        (Math.random() - 0.5) * 500  // Weiter verengte Distanz
    );

    scene.add(particle);
    particles.push(particle);
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
createSlider('Outer Radius', 10, 500, 10, outerOrbitRadius, (event) => {
    outerOrbitRadius = parseFloat(event.target.value);
});
createSlider('Outer Speed', 0.001, 0.02, 0.001, outerOrbitSpeed, (event) => {
    outerOrbitSpeed = parseFloat(event.target.value);
});

// Mausbewegung überwachen
document.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
        },
        function (error) {
            console.log('Ein Fehler ist aufgetreten');
        }
    );
}

// Laden des Quest-Headset-Modells
loader.load(
    'public/models/quest3.gltf',
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

        // Laden und Platzieren des ersten Hais
        loadAndPlaceShark('public/models/Angelote/AngelShark.gltf', (model, mixer) => {
            sharkModel = model;
            sharkModel.position.copy(center);
            sharkModel.position.y += sharkHeightY;

            // Laden und Platzieren des zweiten Hais
            loadAndPlaceShark('public/models/Angelote/AngelShark.gltf', (model2, mixer2) => {
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
                    particles.forEach(particle => {
                        particle.position.x += (Math.random() - 0.5) * 0.01; // Sehr langsame Bewegung
                        particle.position.y += (Math.random() - 0.5) * 0.01; // Sehr langsame Bewegung
                        particle.position.z += (Math.random() - 0.5) * 0.01; // Sehr langsame Bewegung
                    });

                    // Partikel um die Z-Achse rotieren lassen
                    particles.forEach(particle => {
                        const angle = 0.001; // Langsame Rotation
                        const x = particle.position.x;
                        const z = particle.position.z;
                        particle.position.x = x * Math.cos(angle) - z * Math.sin(angle);
                        particle.position.z = x * Math.sin(angle) + z * Math.cos(angle);
                    });
                }

                animateSharks();
            });
        });
    },
    function (xhr) {
        console.log((xhr.loaded / xhr.total) + '% geladen');
    },
    function (error) {
        console.log('Ein Fehler ist aufgetreten');
    }
);

// HDRi Loading (Backdrop and Environment Map usw…)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.outputEncoding = THREE.sRGBEncoding;
new RGBELoader().load('/images/ocean_bluewater_phil.hdr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
});

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

//joa das wars erstmal, ich hoffe es gefällt als idee? Klar schieberegler etc sind erstmal zum erkunden, füg gern weitere dazu das wir n schickes Outlay finden.