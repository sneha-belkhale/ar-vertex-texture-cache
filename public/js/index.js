var scene, camera, renderer, controls;
var squidMesh;
var exrPos, exrNorm;
var exrPosBytes, exrNormBytes;
var texWidth, texHeight;
var count;
var startTime;
var timeDelta = 0;
var fps = 20.0 //fps
var numOfFrames = 128
var totalDuration = numOfFrames * (1 / fps) * 1000 ;
var timeInFrames = 0.001;
var forward = false;
var vrDisplay, vrControls, arView;
// Squid model progress
function onProgress (xhr) {
  if ( xhr.lengthComputable ) {
    var percentComplete = xhr.loaded / xhr.total * 100;
    console.log( Math.round(percentComplete, 2) + '% downloaded' );
  }
};

function onError (err) {
  console.log(err);
};
THREE.ARUtils.getARDisplay().then(function (display) {
  if (display) {
    vrDisplay = display;
    init();
  } else {
    THREE.ARUtils.displayUnsupportedMessage();
  }
});
function init () {
  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();

  // Creating the ARView, which is the object that handles
  // the rendering of the camera stream behind the three.js
  // scene
  arView = new THREE.ARView(vrDisplay, renderer);

  // The ARPerspectiveCamera is very similar to THREE.PerspectiveCamera,
  // except when using an AR-capable browser, the camera uses
  // the projection matrix provided from the device, so that the
  // perspective camera's depth planes and field of view matches
  // the physical camera on the device.
  camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  // VRControls is a utility from three.js that applies the device's
  // orientation/position to the perspective camera, keeping our
  // real world and virtual world in sync.
  vrControls = new THREE.VRControls(camera);

  // Bind our event handlers
  //window.addEventListener('resize', onWindowResize, false);



  /*************** SET UP THE MATERIAL FOR FBX GEOMETRY ***************/
  var uniform = {
    emissive: {type: 'c', value: new THREE.Color(0x00000)},
    specular: {type: 'c', value: new THREE.Color(0xFFFFFF)},
    shininess: {value: 10},
    // Houdini simulation bounding box for the vertex shader
    bbox_max: {value: 200.236846924},
    bbox_min: {value: -619.393371582}
  }

  // Use the built in phong fragment shader to handle lighting
  var phongShader = THREE.ShaderLib.phong;
  var phongUniform = THREE.UniformsUtils.clone(phongShader.uniforms); //copy over the remaining values

  this.uniforms = THREE.UniformsUtils.merge([phongUniform, uniform])

  var material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: vertexShaderStr,
    fragmentShader: phongShader.fragmentShader,
    lights: true,
    side: THREE.DoubleSide,
    transparent: true,
    //derivatives: true //so that we can calculate the actual normal at each vertex in the fragment shader
  });

  /*************** FBX GEOMETRY AND EXR TEXTURE LOADING ***************/
  let manager = new THREE.LoadingManager();
  let FBXLoader = new THREE.FBXLoader( manager );

  FBXLoader.load( 'assets/squid_mesh.fbx', function ( object ) {
    object.traverse((child) => {
      if ( child instanceof THREE.Mesh ) {
        squidMesh = new THREE.Mesh(child.geometry, material);
      }
    });
    scene.add(squidMesh);
  }, onProgress, onError );

  // Fetch our position and normal map exr's simultaneously
  Promise.all([fetch("assets/squid_pos.exr"), fetch("assets/squid_norm.exr")]).then(res => {
    return Promise.all([res[0].arrayBuffer(), res[1].arrayBuffer()]);
  }).then(buffers => {

    // Parse exr images from loaded buffers
    exrPos = new Module.EXRLoader(buffers[0]);
    exrNorm = new Module.EXRLoader(buffers[1]);

    // Cache image data to this variables to avoid call
    // to this member functions in the render for loop
    exrPosBytes = exrPos.getBytes();
    exrNormBytes = exrNorm.getBytes();
    texWidth = exrPos.width();
    texHeight = exrPos.height();

    // Populate the first set of position and normal
    count = squidMesh.geometry.attributes.position.count;
    var texPos = new Float32Array ( count * 3 )
    var texNorm = new Float32Array ( count * 3 )

    // Add the position and normal as a shader attribute
    squidMesh.geometry.addAttribute( 'texPos', new THREE.BufferAttribute( texPos, 3 ) );
    squidMesh.geometry.addAttribute( 'texNorm', new THREE.BufferAttribute( texNorm, 3 ) );

    // Start the animation now
    startTime = Date.now();
    animate();  // Lets gooooo!
  });

  /*************** SET UP THE LIGHTS FOR THE SCENE ***************/
  var sphere = new THREE.SphereGeometry( 10, 16, 8 );
  light1 = new THREE.PointLight( 0xff0040, 0.3 );
  light1.add( new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( { color: 0xff0040 } ) ) );
  light1.position.set(500,100,-300);
  scene.add( light1 );
  light2 = new THREE.PointLight( 0x0040ff, 0.4 );
  light2.add( new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( { color: 0x0040ff } ) ) );
  light2.position.set(500,-100,300);
  scene.add( light2 );
  light3 = new THREE.PointLight( 0x80ff80, 0.4 );
  light3.add( new THREE.Mesh( sphere, new THREE.MeshBasicMaterial( { color: 0x80ff80 } ) ) );
  light3.position.set(-500,100,-500);
  scene.add( light3 );

  stats = new Stats();
  document.body.appendChild( stats.dom );
}

function animate() {
  requestAnimationFrame( animate );
  render();
  stats.update();
}

function render() {
  // Change direction of animation when ready
  if (timeInFrames === 0.99) {
    startTime = Date.now() + 0.01;
    forward = false;
  }
  if (timeInFrames === 0.0) {
    startTime = Date.now() + 0.01;
    forward = true;
  }
  // Update the timeInFrames2
  timeDelta = Date.now() - startTime;
  if (forward) {
    timeInFrames = Math.min(timeDelta / totalDuration, 0.99);
  } else {
    timeInFrames = 0.99 - Math.min(timeDelta / totalDuration, 0.99);
  }
  // Update the position and normal displacement attributes for the current timeInFrames (or row of EXR)
  var posValues = squidMesh.geometry.attributes.texPos.array;
  var normValues = squidMesh.geometry.attributes.texNorm.array;

  for (i = 0; i < count; i++) {
    var u = Math.floor(squidMesh.geometry.attributes.uv2.array[2*i] * texWidth);
    var v = Math.floor((squidMesh.geometry.attributes.uv2.array[2*i+1] - timeInFrames) * texHeight);
    var t = 4 * (v * texWidth + u);
    posValues[3*i] = exrPosBytes[t];
    posValues[3*i+1] = exrPosBytes[t+1];
    posValues[3*i+2] = exrPosBytes[t+2];
    normValues[3*i] = exrNormBytes[t];
    normValues[3*i+1] = exrNormBytes[t+1];
    normValues[3*i+2] = exrNormBytes[t+2];
  }
  //NEEDS UPDATE!!
  squidMesh.geometry.attributes.texPos.needsUpdate = true;
  squidMesh.geometry.attributes.texNorm.needsUpdate = true;

  renderer.clearColor();
  arView.render();
  camera.updateProjectionMatrix();
  vrControls.update();
  renderer.clearDepth();
  renderer.render( scene, camera );
}
