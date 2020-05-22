
/* ts viewer */

/* eslint-disable import/prefer-default-export */
/* eslint-disable import/no-extraneous-dependencies */

/*remove links to kiteware site:  import 'vtk.js/Sources/favicon'; */
import JSZip from 'jszip';

import macro from 'vtk.js/Sources/macro';

import HttpDataAccessHelper from 'vtk.js/Sources/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import vtkFullScreenRenderWindow from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkURLExtract from 'vtk.js/Sources/Common/Core/URLExtract';

import vtkTSReader from 'vtk.js/Sources/IO/Geometry/TSReader';

import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkProperty from 'vtk.js/Sources/Rendering/Core/Property';
import vtkBoundingBox from 'vtk.js/Sources/common/DataModel/BoundingBox';

import style from './TSViewer.module.css';

const iOS = /iPad|iPhone|iPod/.test(window.navigator.platform);
let autoInit = true;
const userParams = vtkURLExtract.extractURLParameters();

/** housekeeping on actor **/
// scene.push({ name, polydata, mapper, actor });
const scene = [];

// need to expose at the top level
let fullScreenRenderer;
let renderer;
let renderWindow;
let resetCamera;
let render;

function onClick(event) {
  const el = event.target;
  const index = Number(el.dataset.index);
  const actor = scene[index].actor;
  const visibility = actor.getVisibility();

  actor.setVisibility(!visibility);
  if (visibility) {
    el.classList.remove('visible');
  } else {
    el.classList.add('visible');
  }
  render();
}

//WTRA-SGFZ-PLMS-Northern_San_Gabriel_fault-CFM4.ts
function trimExt(fname) {
   // trim path   
   var dname=fname.substring(fname.lastIndexOf('/')+1);
   // trim abb and ext
   var n = dname.split('-');
   return n[3];
}

/** color housekeeping **/
//https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript

var track_color_entry=0;
var seed = 1;
function nextValue() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function setColor(property) {
   track_color_entry++;
   let Rc=nextValue();
   let Rg=nextValue();
   let Rb=nextValue();
//   window.console.log("color ",Rc, " ", Rg, " ", Rb);
   property.setDiffuseColor(Rc,Rg,Rb);
}

// Add class to body if iOS device --------------------------------------------

if (iOS) {
  document.querySelector('body').classList.add('is-ios-device');
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function emptyContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function loadZipContent(zipContent) {
  const renderer = fullScreenRenderer.getRenderer();
  const renderWindow = fullScreenRenderer.getRenderWindow();
  const fileContents = { ts: {} };
  const zip = new JSZip();
  zip.loadAsync(zipContent).then(() => {
    let workLoad = 0;

    function done() {
      if (workLoad !== 0) {
        return;
      }

      const promises = [];
      Promise.all(promises).then(() => {
        // Create pipeline from ts 
        Object.keys(fileContents.ts).forEach((tsFilePath) => {
          window.console.log("retrieve.. ",tsFilePath);

          const tsReader = fileContents.ts[tsFilePath];

          const size = tsReader.getNumberOfOutputPorts();
          for (let i = 0; i < size; i++) {
            const source = tsReader.getOutputData(i);
            const mapper = vtkMapper.newInstance();
            const actor = vtkActor.newInstance();
            let name = source.get('name').name;
            if ( name === undefined) {
               name = trimExt(tsFilePath);
            }
            scene.push({ name, source, mapper, actor });

// color
    const prop = vtkProperty.newInstance();
    setColor(prop);
    prop.setOpacity(0.8);
    actor.setProperty(prop);

            actor.setMapper(mapper);
            mapper.setInputData(source);
            renderer.addActor(actor);
          }
        });
        buildControlUI();
        renderer.resetCamera();
        renderWindow.render();
      });
    }

    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.match(/\.ts$/i)) {
        workLoad++;
        zipEntry.async('string').then((txt) => {
          const reader = vtkTSReader.newInstance();
          reader.parseAsText(txt);
          fileContents.ts[relativePath] = reader;
          workLoad--;
          done();
        });
      }
    });
  });
}

// https://ourcodeworld.com/articles/read/164/how-to-convert-an-uint8array-to-string-in-javascript
function Decodeuint8arr(uint8array){
    return new TextDecoder("utf-8").decode(uint8array);
}

function arrayBufferToString(arrayBuffer,callback) {
    var bb = new Blob([arrayBuffer]);
    var f = new FileReader();
    f.onload = function(e) {
        callback(e.target.result);
    };
    f.readAsText(bb);
}

function loadTSContent(tsContent, name) {
  const renderer = fullScreenRenderer.getRenderer();
  const renderWindow = fullScreenRenderer.getRenderWindow();
  const tsReader = vtkTSReader.newInstance();
  let tsContentString=Decodeuint8arr(tsContent);
  tsReader.parseAsText(tsContentString);
  const nbOutputs = tsReader.getNumberOfOutputPorts();
  for (let idx = 0; idx < nbOutputs; idx++) {
    const source = tsReader.getOutputData(idx);
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();
    scene.push({ name, source, mapper, actor });

// color
    const prop = vtkProperty.newInstance();
    setColor(prop);
    prop.setOpacity(0.8);
    actor.setProperty(prop);

    actor.setMapper(mapper);
    mapper.setInputData(source);
    renderer.addActor(actor);
  }
  buildControlUI();
  renderer.resetCamera();
  renderWindow.render();
}

export function load(container, options) {
  autoInit = false;
  emptyContainer(container);

  fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
    background: [242, 242, 242],
    rootContainer: container,
    containerStyle: { height: '100%', width: '100%', position: 'absolute' },
  });

  renderer = fullScreenRenderer.getRenderer();
  renderWindow = fullScreenRenderer.getRenderWindow();

  resetCamera = renderer.resetCamera;
  render = renderWindow.render;

  if (options.file) {
    if (options.ext === 'ts') {
      const reader = new FileReader();
      reader.onload = function onLoad(e) {
        const tsReader = vtkTSReader.newInstance();
        tsReader.parseAsText(reader.result);
        const nbOutputs = tsReader.getNumberOfOutputPorts();
        for (let idx = 0; idx < nbOutputs; idx++) {
          const source = tsReader.getOutputData(idx);
          const mapper = vtkMapper.newInstance();
          const actor = vtkActor.newInstance();
          const name = source.get('name').name;
          scene.push({ name, source, mapper, actor });

// color
    const prop = vtkProperty.newInstance();
    setColor(prop);
    prop.setOpacity(0.8);
    actor.setProperty(prop);

          actor.setMapper(mapper);
          mapper.setInputData(source);
          renderer.addActor(actor);
        }
        buildControlUI();
        renderer.resetCamera();
        renderWindow.render();
      };
      reader.readAsTex(options.file);
    } else {
      loadZipContent(options.file);
    }
  } else if (options.fileURL) {

    function retrieveFileContent(fname, name) {
      window.console.log("retrieve..",fname);

      const ext = fname.substr((fname.lastIndexOf('.') + 1));
      const progressContainer = document.createElement('div');
      progressContainer.setAttribute('class', style.progress);
      container.appendChild(progressContainer);

      const progressCallback = (progressEvent) => {
        if (progressEvent.lengthComputable) {
          const percent = Math.floor(
            (100 * progressEvent.loaded) / progressEvent.total
          );
          progressContainer.innerHTML = `Loading ${percent}%`;
        } else {
          progressContainer.innerHTML = macro.formatBytesToProperUnit(
            progressEvent.loaded
          );
        }
      };
  
      HttpDataAccessHelper.fetchBinary(fname, {
        progressCallback,
      }).then((content) => {
        container.removeChild(progressContainer);
        if(ext === 'ts') {  // plain ts file
           loadTSContent(content, name);
           } else { 
             loadZipContent(content);
        }
      });
    }

// expect name=[n1,n2],fileURL=[f1,f2]
// or fileURL=f1
    let op=options.fileURL;
    if(typeof op === 'string') {
        retrieveFileContent(op, trimExt(op));
        } else {
          let cnt=op.length;
          for(var i=0; i<cnt; i++) {
            if(options.name) {
              retrieveFileContent(op[i],options.name[i]);
              } else {
                retrieveFileContent(op[i],trimExt(op[i]));
            }
          }
     }
  }// fileURL
}

export function initLocalFileLoader(container) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = container || exampleContainer || rootBody;

  if (myContainer !== container) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  } else {
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }

  const fileContainer = document.createElement('div');
  fileContainer.innerHTML = `<div class="${
    style.bigFileDrop
  }"/><input type="file" accept=".zip,.ts" style="display: none;"/>`;
  myContainer.appendChild(fileContainer);

  const fileInput = fileContainer.querySelector('input');

  function handleFile(e) {
    preventDefaults(e);
    const dataTransfer = e.dataTransfer;
    const files = e.target.files || dataTransfer.files;
    if (files.length === 1) {
      myContainer.removeChild(fileContainer);
      const ext = files[0].name.split('.').slice(-1)[0];
      load(myContainer, { file: files[0], ext });
    }
  }

  fileInput.addEventListener('change', handleFile);
  fileContainer.addEventListener('drop', handleFile);
  fileContainer.addEventListener('click', (e) => fileInput.click());
  fileContainer.addEventListener('dragover', preventDefaults);
}


function buildControlUI() {
  const htmlBuffer = [
    '<style>.visible { font-weight: bold; } .click { cursor: pointer; min-width: 150px;}</style>',
    ];
  htmlBuffer.push(
    `<button id="UIbtn" type="button" title="plot faults" onClick="toggleUI()" style='display:none;'></button>`
    );
  scene.forEach((item, idx) => {
    var ii=item;
    htmlBuffer.push(
    `<div class="click visible" data-index="${idx}">${item.name}</div>`
    );
  });

  // remove old one
  fullScreenRenderer.removeController();
  fullScreenRenderer.addController(htmlBuffer.join('\n'));

  const nodes = document.querySelectorAll('.click');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    el.onclick = onClick;
  }
}

function toggleUI() {
  fullScreenRenderer.toggleControllerVisibility();
}

// MAIN 

if (userParams.file || userParams.fileURL) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = exampleContainer || rootBody;
  if (myContainer) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }
  load(myContainer, userParams);
}

// Auto setup if no method get called within 100ms
setTimeout(() => {
  if (autoInit) {
    initLocalFileLoader();
  }
}, 100);


// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.toggleUI = toggleUI;
global.scene = scene;
global.fullScreenRenderer = fullScreenRenderer;
