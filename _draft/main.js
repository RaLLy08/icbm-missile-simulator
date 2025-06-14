import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000);



const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setSize(WIDTH, HEIGHT);
sceneContainer.appendChild( renderer.domElement );
renderer.setClearColor(0xabcdef);

renderer.setPixelRatio( window.devicePixelRatio );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.update();

const axesHelper = new THREE.AxesHelper(3); 
axesHelper.position.set(3, -3, 0);
scene.add(axesHelper);

const light = new THREE.AmbientLight(0xffffff, 2);

scene.add(light);

const modelLoader = new OBJLoader();


const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('public/textures/round-cake.png');
const texture2 = textureLoader.load('public/textures/round-cake2.png');

const rectTexture = textureLoader.load('public/textures/rect-cake.png');
const rectTexture2 = textureLoader.load('public/textures/rect-cake3.png');

// texture.repeat.set(0.2, 0.2); // scale the texture to fit the cake

// texture.wrapS = THREE.RepeatWrapping;
// texture.wrapT = THREE.RepeatWrapping;

let roundCakeObj = null;
let rectCakeObj = null;
let heartCakeObj = null;

modelLoader.load('public/models/round-cake.obj', function ( obj ) {
  obj.name = 'cake';
  roundCakeObj = obj;
  obj.traverse((child) => {
    if (child.isMesh) {
      child.material.map = texture;
      child.material.needsUpdate = true;
    }
  })

});
modelLoader.load('public/models/rect-cake.obj', function ( obj ) {
  obj.name = 'cake';
  rectCakeObj = obj;
});


modelLoader.load('public/models/heart-cake.obj', function ( obj ) {
  obj.name = 'cake';
  heartCakeObj = obj;

  obj.traverse((child) => {
    if (child.isMesh) {
      child.material.map = texture;
      child.material.needsUpdate = true;
    }
  })
});


const loadCake = (cakeObj) => {
  cakeObj.position.set(0, 0, 0);
  cakeObj.rotation.set(-Math.PI / 3, 0, 0);

  scene.traverse((object) => {
    if (object.name === 'cake') {
      scene.remove(object);
    }
  });

  scene.add(cakeObj);
};

const changeCakeColor = (color) => {
  scene.traverse((object) => {
    if (object.name === 'cake') {
      object.traverse((child) => {
        if (child.isMesh) {
          child.material.color.set(color);
        }
      });
    }
  });
};




const gui = new GUI();
const cakeFolder = gui.addFolder('Cake');

cakeFolder.add({ loadRound: () => { if (roundCakeObj) loadCake(roundCakeObj.clone()) } }, 'loadRound').name('Round Cake');
cakeFolder.add({ loadRect: () => { if (rectCakeObj) loadCake(rectCakeObj.clone()) } }, 'loadRect').name('Rect Cake');
cakeFolder.add({ loadHeart: () => { if (heartCakeObj) loadCake(heartCakeObj.clone()) } }, 'loadHeart').name('Heart Cake');

cakeFolder.addColor({ color: '#ffffff' }, 'color').onChange((color) => {
  changeCakeColor(color);
}).name('Cake Color');
cakeFolder.open();

const textureFolder = gui.addFolder('Texture');
const textureOptions = {
  'Round Cake': () => {
    if (roundCakeObj) {
      roundCakeObj.traverse((child) => {
        if (child.isMesh) {
          child.material.map = texture;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });
    }
  },
  'Round Cake 2': () => {
    if (roundCakeObj) {
      roundCakeObj.traverse((child) => {
        if (child.isMesh) {
          child.material.map = texture2;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });
    }
  },

  'Rect Cake': () => {
    if (rectCakeObj) {
      rectCakeObj.traverse((child) => {
        if (child.isMesh) {
          child.material.map = rectTexture;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });
    }
  },
  'Rect Cake 2': () => {
    if (rectCakeObj) {
      rectCakeObj.traverse((child) => {
        if (child.isMesh) {
          child.material.map = rectTexture2;
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;
        }
      });
    }
  }

};

for (const [key, value] of Object.entries(textureOptions)) {
  textureFolder.add({ [key]: value }, key).name(key);
}









camera.position.z = 10;


function animate() {
  renderer.render(scene, camera);
  controls.update();
  // scene.traverse((object) => {
  //   if (object.isMesh) {
  //     // object.rotation.x = -mouse.y;
  //     // object.rotation.y = -mouse.x;
  //   }
  // });
}
renderer.setAnimationLoop(animate);

