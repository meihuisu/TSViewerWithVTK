
/* ts viewer */

/*NOTE: zip fileURL input with background ts is not implemented */

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
import vtkCamera from 'vtk.js/Sources/Rendering/Core/Camera';

import vtkOrientationMarkerWidget from 'vtk.js/Sources/Interaction/Widgets/OrientationMarkerWidget'
import vtkGeoAxesActor from 'vtk.js/Sources/Rendering/Core/GeoAxesActor';
import * as vtkMath from 'vtk.js/Sources/Common/Core/Math';
import vtkInteractiveOrientationWidget from 'vtk.js/Sources/Widgets/Widgets3D/InteractiveOrientationWidget';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';

import vtkOutlineFilter from 'vtk.js/Sources/Filters/General/OutlineFilter';

import vtkBoundingBox from 'vtk.js/Sources/Common/DataModel/BoundingBox';
import vtkPoints from 'vtk.js/Sources/Common/Core/Points';
import vtkPointSet from 'vtk.js/Sources/Common/DataModel/PointSet';
import vtkPolyData from 'vtk.js/Sources/Common/DataModel/PolyData';

import style from './TSViewer.module.css';

const iOS = /iPad|iPhone|iPod/.test(window.navigator.platform);
const userParams = vtkURLExtract.extractURLParameters();
var autoInit = true;
var fileCount = 0;
var fileIdx = 0;

/** housekeeping on actor **/
// scene.push({ name, source/polydata, mapper, actor });
const scene = [];
// shoreline_scene.push({ name, source/polydata, mapper, actor });
const shoreline_scene = [];
// bounds_scene.push({name, outline,mapper, actor})
const bounds_scene = [];
// final_bounds_scene.push({'master', outline, mapper, actor });
const final_bounds_scene = [];

// need to expose at the top level
var fullScreenRenderer;
var renderer;
var renderWindow;
var orientationWidget;
var activeCamera;
var boundingBox;

/***
  MISC
***/

function debug_printCamera(note) {
  let pos=activeCamera.getPosition();
  let angle=activeCamera.getViewAngle();
  let vmatrix=activeCamera.getViewMatrix();
  let viewup=activeCamera.getViewUp();
  let focal=activeCamera.getFocalPoint();
  window.console.log("===camera, "+note);
  window.console.log("  position "+pos.toString());
  window.console.log("  angle    ",angle);
  window.console.log("  viewup   "+viewup.toString());
  window.console.log("  focal    "+focal.toString());
  window.console.log("  viewMatrix    "+vmatrix.toString());
}


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
  renderWindow.render();
}

// https://s3-us-west-2.amazonaws.com/files.scec.org/s3fs-public/projects/cfm/CFM5/CFM52_preferred/500m/CRFA-BPPM-WEST-Big_Pine_fault-CFM2_m500.ts
//    also ... -LEGG-CFM4_m500.ts
// http://localhost/~mei/testV/cfm_data/CFM_1571460363892.zip
// cfm_data/WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5.ts

function trim4Name(fname) {
   // trim path   
   var dname=fname.substring(fname.lastIndexOf('/')+1);
   var nname=dname.substring(0,dname.lastIndexOf('.'));

   // trim abb and ext
   var n = nname.split('-');
   var idx=nname.lastIndexOf('-')+1;
   if(idx != null) { // or a simple zip file
     var pre=nname.substring(0,idx-1);
     var post=nname.substring(idx);
     var n = pre.split('-');
     var sz=n.length;
     if(sz >= 4) {
       nname=pre.substring(15,);
       if(post != null) {
         nname= nname+"("+post+")";
       }
     }
   }

   return nname;
}


/***
  SHORELINE + SURFACE FAULT
***/

function addShoreline() {
  if(shoreline_scene.length > 0) {
    return;
  }
  window.console.log("add shoreline ");
  const name="California shoreline";
  const polydata = vtkPolyData.newInstance();
//XXXX  fill-in in polydata
  const source=polydata.getOutputData();
  const mapper = vtkMapper.newInstance();
  const actor = vtkActor.newInstance();
  shoreline_scene.push({ name, source, mapper, actor });

  const prop = vtkProperty.newInstance();
  prop.setDiffuseColor(0,1,1);
  prop.setOpacity(1);
  actor.setProperty(prop);
  mapper.setInputData(source);
  render.addActor(actor);
}

function toggleShoreline() {
// should only be one
  const actor = shoreline_scene[0].actor;
  const visibility = actor.getVisibility();
  actor.setVisibility(!visibility);
}

/***
  DIRECTION MARKER
***/

function majorAxis(vec3, idxA, idxB) {
  const axis = [0, 0, 0];
  const idx = Math.abs(vec3[idxA]) > Math.abs(vec3[idxB]) ? idxA : idxB;
  const value = vec3[idx] > 0 ? 1 : -1;
  axis[idx] = value;
  return axis;
}

function reset2North(direction) {

  activeCamera.setPosition(0,0,1);
  activeCamera.setViewUp(0,1,0);
  activeCamera.setFocalPoint(0,0,0);

  const viewUp = activeCamera.getViewUp();
  const focalPoint = activeCamera.getFocalPoint();
  const position = activeCamera.getPosition();

  const distance = Math.sqrt(
    vtkMath.distance2BetweenPoints(position, focalPoint)
  );
  activeCamera.setPosition(
    focalPoint[0] + direction[0] * distance,
    focalPoint[1] + direction[1] * distance,
    focalPoint[2] + direction[2] * distance
  );

  if (direction[0]) {
    activeCamera.setViewUp(majorAxis(viewUp, 1, 2));
  }
  if (direction[1]) {
    activeCamera.setViewUp(majorAxis(viewUp, 0, 2));
  }
  if (direction[2]) {
    activeCamera.setViewUp(majorAxis(viewUp, 0, 1));
  }
  orientationWidget.updateMarkerOrientation();
  renderer.resetCamera();
  renderWindow.render();
}

function toggleNorth() {
  reset2North([0,1,0]);
  renderWindow.render();

}

function buildOrientationMarker() {

  window.console.log("buiding -- orientation marker");
  const axes = vtkGeoAxesActor.newInstance();
  orientationWidget = vtkOrientationMarkerWidget.newInstance({
    actor: axes,
    interactor: renderWindow.getInteractor(),
  });
  orientationWidget.setEnabled(true);
  orientationWidget.setViewportCorner(
    vtkOrientationMarkerWidget.Corners.BOTTOM_RIGHT
  );
  orientationWidget.setViewportSize(0.20);
  orientationWidget.setMinPixelSize(100);
  orientationWidget.setMaxPixelSize(300);

// ----------------------------------------------------------------------------
// Widget manager
// ----------------------------------------------------------------------------

  const widgetManager = vtkWidgetManager.newInstance();
  widgetManager.setRenderer(orientationWidget.getRenderer());

  const widget = vtkInteractiveOrientationWidget.newInstance();
  widget.placeWidget(axes.getBounds());
  widget.setBounds(axes.getBounds());
  widget.setPlaceFactor(1);

  const vw = widgetManager.addWidget(widget);

// Manage user interaction
vw.onOrientationChange(({ up, direction0, action, event }) => {

  let direction=[0,1,0];

  activeCamera.setPosition(0,0,1);
  activeCamera.setViewUp(0,1,0);
  activeCamera.setFocalPoint(0,0,0);

  const viewUp = activeCamera.getViewUp();
  const focalPoint = activeCamera.getFocalPoint();
  const position = activeCamera.getPosition();

  const distance = Math.sqrt(
    vtkMath.distance2BetweenPoints(position, focalPoint)
  );
  activeCamera.setPosition(
    focalPoint[0] + direction[0] * distance,
    focalPoint[1] + direction[1] * distance,
    focalPoint[2] + direction[2] * distance
  );

  if (direction[0]) {
    activeCamera.setViewUp(majorAxis(viewUp, 1, 2));
  }
  if (direction[1]) {
    activeCamera.setViewUp(majorAxis(viewUp, 0, 2));
  }
  if (direction[2]) {
    activeCamera.setViewUp(majorAxis(viewUp, 0, 1));
  }

  renderer.resetCamera();
  orientationWidget.updateMarkerOrientation();
  widgetManager.enablePicking();
  renderWindow.render();
});

  renderer.resetCamera();
  renderWindow.render();
}

/***
  VIEW
***/

// 0, surface - edge
// 1, wire
// 2, surface + edge
var toWire=0;
function toggleRepresentation() {
  toWire = ( toWire + 1 ) % 3;
  scene.forEach((item, idx) => {
    var actor=item.actor;
    var prop = actor.getProperty();
    switch (toWire) {
       case 0:
         setRepresentationToSurface(prop);
         break;
       case 1:
         setRepresentationToWireframe(prop);
         break;
       case 2:
         setRepresentationToSurfaceWithEdge(prop);
         break;
    }
  })
  renderWindow.render();
}

function setRepresentationToWireframe(property) {
   property.setRepresentationToWireframe();
   property.setEdgeVisibility(0);
}

function setRepresentationToSurface(property) {
   property.setRepresentationToSurface();
   property.setEdgeVisibility(0);
}

function setRepresentationToSurfaceWithEdge(property) {
   property.setRepresentationToSurface();
   property.setEdgeVisibility(1);
   property.setEdgeColor(0,0,0);
}

function setRepresentationToPoints(property) {
   property.setRepresentationToPoints();
}



/***
  COLOR
***/

/*
  https://stackoverflow.com/questions/521295/
      seeding-the-random-number-generator-in-javascript
*/
var track_color_entry=0;
var seed = 1;
function nextValue() {
    var x = Math.sin(seed++) * 10000;
    return (Math.round((x - Math.floor(x))*1000)/1000);
}
 
function setInitialColor(property) {
   track_color_entry++;
   let Rc=nextValue();
   let Rg=nextValue();
   let Rb=nextValue();
   property.setDiffuseColor(Rc,Rg,Rb);
}

function getColor(actor) {
   var prop = actor.getProperty();
   var color = prop.getDiffuseColor();
   var Rc=color[0];
   var Rg=color[1];
   var Rb=color[2];
   var Rcx=Math.floor(Rc * 255.0 + 0.5);
   var Rgx=Math.floor(Rg * 255.0 + 0.5);
   var Rbx=Math.floor(Rb * 255.0 + 0.5);
//   window.console.log("new color ",Rcx, " ", Rgx, " ", Rbx);
   return [ Rcx, Rgx, Rbx ];
}

// https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb
function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function getHexColor(actor) {
   var prop = actor.getProperty();
   var color = prop.getDiffuseColor();
   var Rc=color[0];
   var Rg=color[1];
   var Rb=color[2];
   var Rcx=Math.floor(Rc * 255.0 + 0.5);
   var Rgx=Math.floor(Rg * 255.0 + 0.5);
   var Rbx=Math.floor(Rb * 255.0 + 0.5);
   var rt=rgbToHex(Rcx, Rgx, Rbx);
   return rt;
}

function hex2rgb(hex) {
  return ['0x' + hex[1] + hex[2] | 0, '0x' + hex[3] + hex[4] | 0, '0x' + hex[5] + hex[6] | 0];
}

function getRGBColorFromHex(hex) {
  var rgb=hex2rgb(hex);
  return rgb;
}

function getOpacity(actor) {
   var prop = actor.getProperty();
   var opacity = prop.getOpacity();
   return opacity;
}

function changeOpacity(idx,opacity) {
  window.console.log("Call changeOpacity..",idx," and ", opacity);
  const actor = scene[idx].actor;
  var prop = actor.getProperty();
  prop.setOpacity(opacity);
  renderWindow.render();
}

/***
  BOUNDS
***/

// bounding box =[xMin, xMax, yMin, yMax, zMin, zMax]
function addFinalBoundingBox() {
  window.console.log("show final bounding box");

  const outline = vtkOutlineFilter.newInstance();
  const bb=boundingBox.getBounds();
  window.console.log("bb", bb.toString());
  outline.setInputData(boundingBox);

  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(outline.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().set({ lineWidth: 20 , color: [1,0,0] });
  renderer.addActor(actor);
  const name='name';
  final_bounds_scene.push({name, outline,mapper, actor});

  renderer.resetCamera();
  renderWindow.render();

}

function addBoundingBox(data,name) {

  const outline = vtkOutlineFilter.newInstance();
  outline.setInputData(data);

  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(outline.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.setVisibility(0);
  actor.getProperty().set({ lineWidth: 15, color: [0.80,0.83,0.85] });
  renderer.addActor(actor);
  bounds_scene.push({name, outline,mapper, actor});

  renderer.resetCamera();
  renderWindow.render();
}

// 0, 
// 1, 
// 2, 
var toBounds=0;
function toggleBounds() {
  toBounds = ( toBounds + 1 ) % 3;
  switch (toBounds) {
     case 0:
       setBounds();
       break;
     case 1:
       setBoundsToAll();
       break;
     case 2:
       setBoundsToNone();
       break;
  }
  renderWindow.render();
}

function setBounds() {
  const actor=final_bounds_scene[0].actor;
  actor.setVisibility(1);
}

function setBoundsToAll() {
  let actor=final_bounds_scene[0].actor;
  actor.setVisibility(1);
  bounds_scene.forEach((item, idx) => {
    actor=item.actor;
    actor.setVisibility(1);
  });
}

function setBoundsToNone() {
  let actor=final_bounds_scene[0].actor;
  const visibility = actor.getVisibility();
  actor.setVisibility(0);
  bounds_scene.forEach((item, idx) => {
    actor=item.actor;
    actor.setVisibility(0);
  });
}





/***
  LEGEND
***/

// iterating mulitple times as data increases
function buildControlLegend() {
  window.console.log("buildControlLegend..");
  const htmlBuffer = [
    '<style>.visible { font-weight: bold; } .click { cursor: pointer; min-width: 150px;}</style>',
    ];
  htmlBuffer.push(
    `<button id="Boundsbtn" type="button" title="show bounding boxes" onClick="toggleBounds()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Northbtn" type="button" title="reset view to North" onClick="toggleNorth()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Legendbtn" type="button" title="show Legend" onClick="toggleLegend()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Reprbtn" type="button" title="switch Repr" onClick="toggleRepresentation()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<table><thead><tr class=size-row" aria-hidden="true"></tr></thead>`);
  htmlBuffer.push(`<tbody>`);
  scene.forEach((item, idx) => {
    var ii=item;
    var actor=item.actor;
    var color=getColor(actor);
    var color_hex=getHexColor(actor);
    htmlBuffer.push(
    `<tr><td>
<input type="color" id="color_${idx}" name="${idx}" style="width:20px;" value="${color_hex}" onchange=changeColor(${idx},this.value)>
<input type="range" id="opacity_${idx}" type="button" style="width:25px" min="0.1" max="1" step="0.1" value="0.8" onchange=changeOpacity(${idx},this.value)>
     </td><td><div class="click visible" data-index="${idx}">${item.name}</div></td></tr>`);

  });
  htmlBuffer.push(`</tbody>`);

  // remove old one
  fullScreenRenderer.removeController();
  fullScreenRenderer.addController(htmlBuffer.join('\n'));

  const nodes = document.querySelectorAll('.click');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    el.onclick = onClick;
  }
}

//  <input type="color" id="favcolor" name="favcolor" value="#ff0000"><br><br>
function changeColor(idx, hex_color) {
  var rgb=getRGBColorFromHex(hex_color);
  var r=rgb[0];
  var g=rgb[1];
  var b=rgb[2];

  var nr= Math.floor(((r - 0.5)/255)*100)/100;
  var ng= Math.floor(((g - 0.5)/255)*100)/100;
  var nb= Math.floor(((b - 0.5)/255)*100)/100;

  const actor = scene[idx].actor;
  var property = actor.getProperty();
  property.setDiffuseColor(nr,ng,nb);
  renderWindow.render();
}

function toggleLegend() {
  fullScreenRenderer.toggleControllerVisibility();
}

/***
  LOADING
***/

//   Add class to body if iOS device 
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
          window.console.log("retrieve, tsFilePath>>",tsFilePath);

          const tsReader = fileContents.ts[tsFilePath];

          const size = tsReader.getNumberOfOutputPorts();
          for (let i = 0; i < size; i++) {
            const source = tsReader.getOutputData(i);
            const mapper = vtkMapper.newInstance();
            const actor = vtkActor.newInstance();
            let name = source.get('name').name;
            if ( name === undefined) {
               name = trim4Name(tsFilePath);
            }
            scene.push({ name, source, mapper, actor });
            boundingBox.addBounds(source.getBounds());
            addBoundingBox(source);
// color
            const prop = vtkProperty.newInstance();
            setInitialColor(prop);
            prop.setOpacity(0.8);
            actor.setProperty(prop);

            actor.setMapper(mapper);
            mapper.setInputData(source);
            renderer.addActor(actor);
          }
        });
        buildControlLegend();
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


function loadTSContent(bgIndex, tsContent, name) {
  const tsReader = vtkTSReader.newInstance();
  let tsContentString=Decodeuint8arr(tsContent);
  tsReader.parseAsText(tsContentString);
  const nbOutputs = tsReader.getNumberOfOutputPorts();

window.console.log("loadingTS..",name);
  fileIdx++;
  for (let idx = 0; idx < nbOutputs; idx++) {
    const source = tsReader.getOutputData(idx);
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();
    scene.push({ name, source, mapper, actor });
    boundingBox.addBounds(source.getBounds());
    addBoundingBox(source,name);

// color & representation
    const prop = vtkProperty.newInstance();
    setRepresentationToSurface(prop);
    setInitialColor(prop);
    prop.setOpacity(0.8);
    actor.setProperty(prop);

    actor.setMapper(mapper);
    mapper.setInputData(source);
    renderer.addActor(actor);
  }
  buildControlLegend();
  
  renderer.resetCamera();
  renderWindow.render();
  if(fileIdx == fileCount) {
    addFinalBoundingBox();
  }
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
  activeCamera = renderer.getActiveCamera();
  boundingBox = vtkBoundingBox.newInstance();

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
          boundingBox.addBounds(source.getBounds());
          addBoundingBox(source,name);

// color
          const prop = vtkProperty.newInstance();
          setInitialColor(prop);
          prop.setOpacity(0.8);
          actor.setProperty(prop);

          actor.setMapper(mapper);
          mapper.setInputData(source);
          renderer.addActor(actor);
        }
        buildControlLegend();
        renderer.resetCamera();
        renderWindow.render();
      };
      reader.readAsTex(options.file);
    } else {
      loadZipContent(options.file);
    }
  } else if (options.fileURL) {

    function retrieveFileContent(bgIndex, fname, name) {
      window.console.log("retrieve, fname>>",fname);

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
           loadTSContent(bgIndex,content, name);
           } else { 
             loadZipContent(content);
        }
      });
    }

// expect name=[n1,n2],fileURL=[f1,f2]
// or fileURL=f1
    let op=options.fileURL;
    let path=options.filePATH;
    let bg=options.background;
    let bg_handle=0; // if there is a shore ts file, let it be the last
    if(typeof op === 'string') {
        if(path) {
          retrieveFileContent(bg_handle, path+op, trim4Name(op));
          } else {
            retrieveFileContent(bg_handle, op, trim4Name(op));
        }
        } else {
          let cnt=op.length;
          for(var i=0; i<cnt; i++) {
            let f=op[i];
            if(path) {
              f=path+f;
            }
            if(bg) { 
              if(i == cnt-1) {
                bg_handle= cnt-1;
              }
            }
            if(options.name) {
              retrieveFileContent(bg_handle,f,options.name[i]);
              } else {
                retrieveFileContent(bg_handle,f,trim4Name(op[i]));
            }
          }
     }
  }// fileURL
}

export function autoInitLocalFileLoader(container) {
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


/***
   MAIN 
***/

if (userParams.file || userParams.fileURL) {
  const exampleContainer = document.querySelector('.content');
  const rootBody = document.querySelector('body');
  const myContainer = exampleContainer || rootBody;
  window.console.log("ABC",userParams.fileURL.length);
  fileCount=userParams.fileURL.length;
  if (myContainer) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }
  load(myContainer, userParams);
  buildOrientationMarker();
  toggleNorth();
}

renderer.resetCamera();
renderWindow.render();

// Auto setup if no method get called within 100ms
setTimeout(() => {
  if (autoInit) {
    autoInitLocalFileLoader();
    buildOrientationMarker();
    toggleNorth();
  }
}, 100);


// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.fileCount = fileCount;
global.fileIdx = fileIdx;
global.toggleBounds = toggleBounds;
global.toggleNorth = toggleNorth;
global.toggleLegend = toggleLegend;
global.changeColor = changeColor;
global.changeOpacity = changeOpacity;
global.toggleRepresentation = toggleRepresentation;
global.scene = scene;
global.fullScreenRenderer = fullScreenRenderer;

