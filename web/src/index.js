 
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

import vtkGMTReader from 'vtk.js/Sources/IO/Geometry/GMTReader';

import style from './TSViewer.module.css';

const iOS = /iPad|iPhone|iPod/.test(window.navigator.platform);
const userParams = vtkURLExtract.extractURLParameters();
var autoInit = true;
var fileCount = 0;
var fileIdx = 0;

/** housekeeping on actor **/
// 3D actor for each fault line, one per tsurf file,
// scene.push({ name, source/polydata, mapper, actor });
const scene = [];

// California shoreline actor from GMAT file
// coast_scene.push({ name, source/polydata, mapper, actor });
const coast_scene = [];

// fault trace/blind, from GMAT file, could have multiple traces with
// duplicate fault names
// trace_scene.push({ name, source/polydata, mapper, actor });
const trace_scene = [];
const blind_scene = [];

var GMT_cnt=0;
var toggled;

// bounding box, one  per fault line
const bounds_scene = [];
// overall bounding box, final_bounds_scene.push({'master', outline, mapper, actor });
const final_bounds_scene = [];

// need to expose at the top level
var fullScreenRenderer;
var renderer;
var renderWindow;
var orientationWidget;
var activeCamera;
var boundingBox;

var faultList=[];
var actorList=[];
var activeActorList=[];

// to track the original Camera View
var initialCameraView;
var initialPosition;
var initialFocalPoint;
var initialViewUp;

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

function onVisClick(event) {
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

// WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5
// WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5_m500
   var teststr=nname.substring(nname.lastIndexOf("-"));
   var sname=nname;
   if(teststr.includes('_')) {
     sname=dname.substring(0,nname.lastIndexOf("_"));
   }
   faultList.push(sname);

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
  SHORELINE + SURFACE TRACES
***/
function loadGMTContent(gmtContent, gtype) {
  const gmtReader = vtkGMTReader.newInstance();
  let gmtContentString=Decodeuint8arr(gmtContent);
  gmtReader.parseAsText(gmtContentString);
  const nbOutputs = gmtReader.getNumberOfOutputPorts();

  for (let idx = 0; idx < nbOutputs; idx++) {
    const source = gmtReader.getOutputData(idx); // polydata
    const name = source.get('name').name;
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    const prop = vtkProperty.newInstance();
    prop.setLineWidth(600);
    prop.setOpacity(1);

    switch (gtype) {
      case 'blind':
         blind_scene.push({ name, source, mapper, actor });
         actorList.push(actor);
         prop.setColor(0.8,0.1,0.1); 
         break;
      case 'trace':
         trace_scene.push({ name, source, mapper, actor });
         actorList.push(actor);
         prop.setColor(1,0.1,1); 
         break;
      case 'coast':
         coast_scene.push({ name, source, mapper, actor });
         prop.setColor(0,0.5,1); 
         break;
    }

    actor.setProperty(prop);
    actor.setVisibility(0);
    actor.setMapper(mapper);
    mapper.setInputData(source);
    renderer.addActor(actor);
  }
  window.console.log("loadingGMT..",nbOutputs);
  GMT_cnt++;
  if(GMT_cnt == 3 && toggled == undefined) {
    if(final_bounds_scene.length > 0 ) {
      toggled=true;
      toggleTraceAndFault(); 
      toggleShoreline();
    }
  }
}


function retrieveSurfaceTraces(container) {
  const blind_file="cfm_data/CFM5.2_blind.utm"
  const trace_file="cfm_data/CFM5.2_traces.utm"

  HttpDataAccessHelper.fetchBinary(blind_file, {}).then((content) => {
      loadGMTContent(content, 'blind');
  });
  HttpDataAccessHelper.fetchBinary(trace_file, {}).then((content) => {
      loadGMTContent(content, 'trace');
  });
}

function collectActiveTraceAndFault()
{
  const cnt=faultList.length;
  for(let i=0;i<cnt;i++) {
    const name=faultList[i];
    trace_scene.forEach((item, idx) => {
      let n=item.name; 
      if(n == name)  {
        let actor=item.actor;
        activeActorList.push(actor);
      }
    });
    blind_scene.forEach((item, idx) => {
      let n=item.name; 
      if(n == name)  {
        let actor=item.actor;
        activeActorList.push(actor);
      }
    });
  }
}


function toggleTraceAndFault() 
{
  const cnt=actorList.length;
  if(cnt == 0) {
    window.console.log("ERROR: trace list is empty");
    return;
  }
  for(let i=0;i<cnt; i++) {
    let item=actorList[i];
    let vis=item.getVisibility();
    item.setVisibility(!vis);
  };
  renderWindow.render();
  window.console.log("toggleTraceAndFault");
}

function retrieveShoreline(container) {
  if(coast_scene.length > 0) {
    return;
  }
  const coast_file="cfm_data/coast.utm"

  HttpDataAccessHelper.fetchBinary(coast_file, {}).then((content) => {
      loadGMTContent(content, 'coast');
  });
}

function toggleShoreline() {
  let cnt=coast_scene.length;
  if(cnt == 0) {
    window.console.log("ERROR: shoreline is empty");
    return;
  }

  for(let i=0; i<cnt; i++) {
    let item=coast_scene[i]; 
    let actor=item.actor;
    let vis = actor.getVisibility();
    actor.setVisibility(!vis);
  };
  renderWindow.render();
  window.console.log("toggleShorline");
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

function retrieveInitialCameraView() {
  initialPosition=activeCamera.getPosition();
  initialFocalPoint=activeCamera.getFocalPoint();
  initialViewUp=activeCamera.getViewUp();
  initialCameraView === activeCamera.getViewMatrix();
}

function resetInitialCameraView() {
  if( initialCameraView === undefined ) {
    return;
  }
  activeCamera.setPosition(initialPosition[0], initialPosition[1], initialPosition[2]);
  activeCamera.setFocalPoint(initialFocalPoint[0], initialFocalPoint[1], initialFocalPoint[2]);
  activeCamera.setViewUp(initialViewUp[0], initialViewUp[1], initialViewUp[2]);
  renderer.resetCamera();
  renderWindow.render();
}

function toggleNorth() {
  reset2North([0,1,0]);
  renderWindow.render();
}

function offTraceAndFault()
{
  const cnt=actorList.length;
  if(cnt == 0) {
    window.console.log("ERROR: trace list is empty");
    return 0;
  }
  // need to toggle off ?
  let item=actorList[0];
  let vis=item.getVisibility();
  if(vis) {
    toggleTraceAndFault();
    return 1;
    } else {
      return 0;
  }
}

function offShoreline() {
  let cnt=coast_scene.length;
  if(cnt == 0) {
    window.console.log("ERROR: shoreline is empty");
    return 0;
  }
  let item=coast_scene[0];
  let actor=item.actor;
  let vis = actor.getVisibility();
  if(vis) {
    toggleShoreline();
    return 1;
    } else {
      return 0;
  }
}

function toggleNorthByBtn() {
  var track_shore=offShoreline();
  var track_trace=offTraceAndFault();
  reset2North([0,1,0]);
  // bring shore/trace back if had to hide them earlier
  if(track_shore) {
      toggleShoreline();
  }
  if(track_trace) {
      toggleTraceAndFault();
  }
  renderWindow.render();
}

function buildOrientationMarker() {

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

  var track_shore=offShoreline();
  var track_trace=offTraceAndFault();

  let direction=[0,0,1];

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

  if (direction[2]) {
    activeCamera.setViewUp(majorAxis(viewUp, 0, 1));
  }

  renderer.resetCamera();
  orientationWidget.updateMarkerOrientation();

  // bring shore/trace back if had to hide them earlier
  if(track_shore) { toggleShoreline(); }
  if(track_trace) { toggleTraceAndFault(); }

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
   property.setColor(Rc,Rg,Rb);
}

function getColor(actor) {
   var prop = actor.getProperty();
   var color = prop.getColor();
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
   var color = prop.getColor();
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
  const outline = vtkOutlineFilter.newInstance();
  const bb=boundingBox.getBounds();
  outline.setInputData(boundingBox);

  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(outline.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.getProperty().set({ lineWidth: 10 , color: [1,0.2,0]});
  renderer.addActor(actor);
  const name='name';
  final_bounds_scene.push({name, outline,mapper, actor});

  renderer.resetCamera();
  renderWindow.render();
  window.console.log("added final bounding box");
}

function addBoundingBox(data,name) {

  const outline = vtkOutlineFilter.newInstance();
  outline.setInputData(data);

  const mapper = vtkMapper.newInstance();
  mapper.setInputConnection(outline.getOutputPort());

  const actor = vtkActor.newInstance();
  actor.setMapper(mapper);
  actor.setVisibility(0);
  actor.getProperty().set({ lineWidth: 10, color: [0.80,0.83,0.85] });
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
  const htmlBuffer = [
    '<style>.visible { font-weight: bold; } .click { cursor: pointer; min-width: 150px;}</style>',
    ];
  htmlBuffer.push(
    `<button id="Boundsbtn" type="button" title="show bounding boxes" onClick="toggleBounds()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Northbtn" type="button" title="reset view to North" onClick="toggleNorthByBtn()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Legendbtn" type="button" title="show Legend" onClick="toggleLegend()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Reprbtn" type="button" title="switch Repr" onClick="toggleRepresentation()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Tracebtn" type="button" title="toggle trace" onClick="toggleTraceAndFault()" style='display:none;'></button>`
    );
  htmlBuffer.push(
    `<button id="Shorebtn" type="button" title="toggle coastline" onClick="toggleShoreline()" style='display:none;'></button>`
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
    el.onclick = onVisClick;
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
  property.setColor(nr,ng,nb);
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


function loadTSContent(tsContent, name) {
  const tsReader = vtkTSReader.newInstance();
  let tsContentString=Decodeuint8arr(tsContent);
  tsReader.parseAsText(tsContentString);
  const nbOutputs = tsReader.getNumberOfOutputPorts();

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
  window.console.log("loadTSContent..",name);
  
  renderer.resetCamera();
  renderWindow.render();
  if(fileIdx == fileCount) {
    addFinalBoundingBox();
    if(toggled === undefined && GMT_cnt == 3) {
      toggled=true;
      toggleTraceAndFault(); 
      toggleShoreline();
    }
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
  faultList=[];
  actorList=[];

  retrieveSurfaceTraces(container);
  retrieveShoreline(container);

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

    function retrieveFileContent(fname, name) {
      window.console.log("retrieveFileContent, fname>>",fname);

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
    let path=options.filePATH;
    if(typeof op === 'string') {
        if(path) {
          retrieveFileContent(path+op, trim4Name(op));
          } else {
            retrieveFileContent(op, trim4Name(op));
        }
        } else {
          let cnt=op.length;
          for(var i=0; i<cnt; i++) {
            let f=op[i];
            if(path) {
              f=path+f;
            }
            if(options.name) {
              retrieveFileContent(f,options.name[i]);
              } else {
                retrieveFileContent(f,trim4Name(op[i]));
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
  fileCount=userParams.fileURL.length;
  if (myContainer) {
    myContainer.classList.add(style.fullScreen);
    rootBody.style.margin = '0';
    rootBody.style.padding = '0';
  }
  load(myContainer, userParams);
  window.console.log("done calling load()");
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
global.toggleNorthByBtn = toggleNorthByBtn;
global.toggleLegend = toggleLegend;
global.changeColor = changeColor;
global.changeOpacity = changeOpacity;
global.toggleRepresentation = toggleRepresentation;
global.toggleTraceAndFault = toggleTraceAndFault;
global.toggleShoreline = toggleShoreline;
global.scene = scene;
global.fullScreenRenderer = fullScreenRenderer;

