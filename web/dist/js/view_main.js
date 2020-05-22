/***

   view_main.c

***/

/***  track current state of name, fileUrl, color */
// [ { "name":name1, "url":file1, "color":color1 } ]
var track_config=[];

jQuery(document).ready(function() {


  frameHeight=window.innerHeight;
  frameWidth=window.innerWidth;

  $('#plotbtn').on('click', function() {
//     let str=make_init_args(2);
     let str=make_init_remote_args();
     $('#plotIfram').attr('src',"index.html?"+str);
  });

  $('#plotRefreshbtn').on('click', function() {
     let str=make_args();
     $('#plotIfram').attr('src',"");
     $('#plotIfram').attr('src',"index.html?"+str);
  });

  $('#plotAddbtn').on('click', function() {
     let str=make_add_args();
     window.console.log("calling with ..",str);
     $('#plotIfram').attr('src',"");
     $('#plotIfram').attr('src',"index.html?"+str);
  });

  $('#plotUIbtn').on('click', function() {
// propogate the click to ifram's page 
   window.console.log("making a click..top");
//   let p = $('[name=plotIfram]').contents();
let p=document.getElementById("plotIfram");
let pp=document.getElementById("plotIfram").contentDocument;
let ppp=document.getElementById("plotIfram").contentDocument.getElementById("UIbtn");
ppp.click();

/*
document.getElementById("plotIfram").contentDocument.getElementById("UIbtn").click();
*/
//   $('#plotIfram').contents().find('UIbtn').click();
     
  });

}) // end of MAIN

/*
https://s3-us-west-2.amazonaws.com/files.scec.org/s3fs-public/projects/cfm/CFM5/CFM52_preferred/native/WTRA-NCVS-PPTV-Pitas_Point_fault_east-CFM5.ts
*/

let remote_config=[{"name":"Indian_Hill", "url":" https://s3-us-west-2.amazonaws.com/files.scec.org/s3fs-public/projects/cfm/CFM5/CFM52_preferred/native/cfm_data/WTRA-USAV-INDH-Indian_Hill_fault-CFM5.ts","color":"red"} ];

let config=[{"name":"Indian_Hill", "url":"cfm_data/WTRA-USAV-INDH-Indian_Hill_fault-CFM5.ts","color":"red"}, {"name":"San_Jose", "url":"cfm_data/WTRA-USAV-SNJH-San_Jose_fault-CFM5.ts","color":"green"}, {"name":"Upland", "url":"cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts","color":"yellow"}, {"name":"Walnut_Creek", "url":"cfm_data/WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5.ts","color":"blue"} ];

function inTrackConfig(tname) {
   var sz=track_config.legth;
   for(var i=0; i<sz; i++) {
     var item=track_config[i];
     if(item['name']==tname)
        return 1;
   }
   return 0;
}
// create string:  name=[a,b,c]&localFile=[fa,fb,fc]&color=[c1,c2,c3]
function make_args() {
   var sz=track_config.length;
   var n=[];
   var f=[];
   var c=[];
   for(var i=0;i<sz; i++) {
      var item=track_config[i];
      n.push(item['name']);
      f.push(item['url']);
      c.push(item['color']);
   }
   var alist="ext=ts&name=["+n.toString()+"]&localFile=["+f.toString()+"]&color=["+c.toString()+"]";
   return alist;
}

function fill_all_args() {
   var sz=config.length;
   track_config=[];
   for(var i=0;i<sz; i++) {
      var item=config[i];
      track_config.push( {"name":item['name'],"url":item['url'],"color":item['color']});
   }
}

/**
okay, http://localhost/~mei/testV/index.html?fileURL=http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts&ext=ts
okay, http://localhost/~mei/testV/index.html?fileURL=http://localhost/~mei/testV/cfm_data/CFM_1571420943568_s.zip
okay, http://localhost/~mei/testV/index.html?fileURL=http://localhost/~mei/testV/cfm_data/CFM_1571460363892.zip

http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts
http://localhost/~mei/testV/cfm_data/PNRA-ELSZ-LGSD-Laguna_Salada_fault_east_branch_dipping_splay-CFM5.ts
http://localhost/~mei/testV/cfm_data/WTRA-USAV-INDH-Indian_Hill_fault-CFM5.ts
http://localhost/~mei/testV/cfm_data/WTRA-USAV-SNJH-San_Jose_fault-CFM5.ts
http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts
http://localhost/~mei/testV/cfm_data/WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5.ts

**/

function make_init_remote_args() {
  var nzip=new JSZip();
  var url;
  var dname;
  var promise = [];

url="http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);
url="http://localhost/~mei/testV/cfm_data/PNRA-ELSZ-LGSD-Laguna_Salada_fault_east_branch_dipping_splay-CFM5.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);
url="http://localhost/~mei/testV/cfm_data/WTRA-USAV-INDH-Indian_Hill_fault-CFM5.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);
url="http://localhost/~mei/testV/cfm_data/WTRA-USAV-SNJH-San_Jose_fault-CFM5.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);
url="http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);
url="http://localhost/~mei/testV/cfm_data/WTRA-USAV-WLNC-Walnut_Creek_fault-CFM5.ts";
  dname=url.substring(url.lastIndexOf('/')+1);
  promise = $.get(url);
  nzip.file(dname,promise);

  window.console.log("making outside.zip");
  nzip.generateAsync({type:"blob"}).then(function (content) {
    // see FileSaver.js
    window.console.log("waiting to zip..");
    saveAs(content, "outside.zip");
  })

//  var alist="fileURL=http://localhost/~mei/testV/cfm_data/WTRA-USAV-UPLD-Upland_fault_dipslip-CFM1.ts&ext=ts";
  var alist="fileURL=http://localhost/~mei/testV/cfm_data/outside.zip";
  return alist;
}

// just have one of all
function make_init_args(target) {
  var sz=config.length;
   var n=[];
   var f=[];
   var c=[];
   if(target < sz ) {
      var item=config[target];
      if(!inTrackConfig(item['name'])) {
        n.push(item['name']);
        f.push(item['url']);
        c.push(item['color']);
        track_config.push( {"name":item['name'],"url":item['url'],"color":item['color']});
        return make_args();
      }
   }
   return "";
}


function make_add_args() {
   fill_all_args();
   return make_args();
}


