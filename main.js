import * as THREE from 'three';
import { Mesh } from 'three';

import {OrbitControls} from "/node_modules/three/examples/jsm/controls/OrbitControls.js";
import Stats from "/node_modules/three/examples/jsm/libs/stats.module.js";

import { GLTFLoader } from "/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "/node_modules/three/examples/jsm/loaders/DRACOLoader.js";

const canvas = document.querySelector('canvas.webgl');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight , 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
     antialias : true
})
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

//Loader für 3D Modell Quest Headset - noch nich das finale model aber das was ich hatte

const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( '/node_modules/three/examples/jsm/libs/draco/' );
loader.setDRACOLoader( dracoLoader );

camera.position.z = 15;

loader.load(
  '/models/quest3.gltf', 
  function ( gltf ) {
    const model = gltf.scene;
    scene.add( model );

    model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.material = new THREE.MeshBasicMaterial({
            color: 0xffffff, 
            wireframe: true,
          });
        }
      });
    
    const scale = 1; 
    model.scale.set(scale, scale, scale);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    camera.position.copy(center);
    camera.position.x += size / 3.0; 
    camera.position.y += size / 1.0; 
    camera.position.z += size / 1.0; 
    camera.lookAt(center);

// spheren - die chrombälschen größe is 62
    const sphereGeometry = new THREE.SphereGeometry(62, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, envMap: scene.environment });
    const sphere1 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    const sphere2 = sphere1.clone();

    // positionen der sphären
    sphere1.position.set(center.x + 250, center.y, center.z);
    sphere2.position.set(center.x - 250, center.y, center.z);

    // Kugeln evtl als 3D navi elemente? Oder eben andere 3d gegenstände nur beispiele
    scene.add(sphere1);
    scene.add(sphere2);

  },
  function ( xhr ) {
    console.log( ( xhr.loaded / xhr.total * 100 ) + '% geladen' );
  },
  function ( error ) {
    console.log( 'Ein Fehler ist aufgetreten' );
  }
);

// HDRi Loading (Backdrop and Environment Map usw…)

import {RGBELoader} from "/node_modules/three/examples/jsm/loaders/RGBELoader.js";
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.outputEncoding = THREE.sRGBEncoding;
new RGBELoader().load("/images/tufia_test4.hdr", function(texture){
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texture;
      scene.environment = texture;
})

const controls = new OrbitControls(camera, renderer.domElement);
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      render();
}
const stats = Stats();
document.body.appendChild(stats.dom);
function animate() {
      requestAnimationFrame(animate);
      controls.update(); // Fügt diese Zeile hinzu
      render();
      stats.update();
}
function render() {
      renderer.render(scene, camera);
}
animate();
