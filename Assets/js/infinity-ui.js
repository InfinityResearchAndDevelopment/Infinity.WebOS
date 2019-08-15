/*
  News:
    Implemented Snapping/Restoring
    Implemented Maximize/Restore

  TODO:
    Implement Window Buttons [Done]
    Implement TaskBar,Minimize,Restore (Independent,scan frames); [Done]
    Implement TaskBar Focus Tracking [Done]
    Implement Open/Close Animation
    Implement window stacking
    Implement click to raise
    Implement Window Snapping [Done]
    Implement TaskBar Focus Tracking on Closed Windows [Done]
	Implement Inactive Window Shading
    Fix last zIndex on focus change
    Fix Cursor position on restore
    Fix double click maximize/restore [Done]
*/
var currentMousePos = {
  x: -1,
  y: -1
};

//Created bindEvents() to bind events to new frames

var frames = []
var timer

function randomString(length) {
    for(var c = ''; c.length < length;) c += Math.random().toString(36).substr(2, 1);
    return c;
}
//Initialize Events...
function bindEvents() {
  //unbind events
  $(".taskbar-menu-button").unbind();
  $(".taskbar .taskbar-tasks .taskbar-task-button").unbind();
  $(".frame-minimize-button").unbind();
  $(".titlebar .titlebar-title-left").unbind();
  $(".frame .content, .frame .titlebar-title-left").unbind();
  // $(".frame").unbind();
  $(".frame-maximize-button").unbind();
  $(".frame-restore-button").unbind();
  $(".frame-close-button").unbind();
  $('.workspace-snap-top').unbind();
  $('.workspace-snap-left').unbind();
  $('.workspace-snap-right').unbind();

  // Test menu button click.
  $(".taskbar-menu-button").click(_.once(function() {
    thismgk = randomString(16);
    createWindow(thismgk, '120px', '80px', '400px', '300px',function(){})
    // if (timer) clearTimeout(timer);
  }));
  // Minimize:Restore on Task Button Click
  $(".taskbar .taskbar-tasks .taskbar-task-button").click(function() {
    var magic=$(this).attr('magic')
    var frame = $('.frame[magic="' + magic + '"]')
    if (frame.attr('focus') == "true") {
      // if (frame.attr('min')=="true") {
      // showWindow(frame)
      // } else {
      // hideWindow(frame)
      // }
    } else {
      frame.css('opacity', "1");
      //ellipsizeTextBox("taskbar-task-text");
      setTimeout(function() {
        showWindow(magic)
      }, 125);
      setTimeout(function() {
        frame.css('transform', "scale(1)");
      }, 125);
      setTimeout(function() {
        focusWindow(magic);
      }, 150);
      // focusWindow(magic)
      $(".taskbar .taskbar-tasks .taskbar-task-button").removeClass("taskbar-task-button-focus")
      $(this).addClass("taskbar-task-button-focus")
    }
  });
  // Maximize/Restore on TitleBar DoubleClick
  $(".frame-minimize-button").click(function() {
    //console.log($(this).parent().parent().parent().attr('max'));
    var frame = $(this).parents('.frame')
    var magic = frame.attr('magic')
    hideWindow(magic);
    frame.css('opacity', "0");
    frame.css('transform', "scale(0)");
    var new_order=[]
    for (var i=0; i < frames.length; ++i){
      if (frames[i]!=magic) {
        new_order.push(frames[i])
      }
    }
    new_order.splice(0,0,magic)
    frames=new_order
    if ($('.frame[magic="' +frames[frames.length-1] + '"]').attr("min")!="true"){
      focusWindow(frames[frames.length-1]);
    }
  });
  $(".titlebar .titlebar-title-left").dblclick(function() {
    var frame = $(this).parents('.frame')
    var magic=frame.attr('magic')
    if (frame.attr('max') == 1) {
      restoreWindow(magic);
    } else {
      maximizeWindow(magic); //
      frame.attr("max", 1);
    }
  });
  $(".frame .content, .frame .titlebar-title-left").mousedown(function() {
    var magic=$(this).parents('.frame').attr('magic')
    focusWindow(magic);
  });
  // Draggable Frames
  // Un-snap/restore Frames
  $(".frame").draggable({
    snap: ".frame",
    snapMode: "outer",
    snapTolerance: 8,
    handle: ".titlebar",
    iframeFix: true,
    stack: ".frame",
    revert: false,
    revertDuration: 200,
    drag: function(event, ui) {
      if ($(ui.helper).attr("snap") == 1) {
        restoreWindow($(ui.helper).attr("magic"), 1);
        $(ui.helper).attr("snap", 0);
      } else {
        $(ui.helper).css({
          transition: 'none',
        })
      }
      $('.workspace-snap-ghost').css({
        top: $(ui.helper).offset().top,
        left: $(ui.helper).offset().left,
        width: $(ui.helper).width(),
        height: $(ui.helper).height(),
      });
      if ($('.workspace-snap-ghost').css('opacity') == 0) {
        $('.workspace-snap-ghost').css({
          transition: 'none',
        });
      }
    }
  });
  $(".frame-maximize-button").click(function() {
    // console.log($(this).parents('.frame'))
    //console.log($(this).parent().parent().parent().attr('max'));
    var frame = $(this).parents('.frame')
    var magic = frame.attr('magic')
    if (frame.attr('max') == 0) {
      focusWindow(magic)
      maximizeWindow(magic);
      frame.attr("max", 1);
      $(this).css('display', 'none');
      $(this).parent().children('.frame-restore-button').css('display', 'flex');
    }
  });
  $(".frame-restore-button").click(function() {
    var frame = $(this).parents('.frame')
    var magic = frame.attr('magic')
    if (frame.attr('max') == 1) {
      restoreWindow(magic);
      if (frame.attr("snap") == 1) {
        frame.attr("snap", 0);
      }
    }
  });
  $(".frame-close-button").click(function() {
    var frame = $(this).parents('.frame')
    var magic = frame.attr('magic')
    hideWindow(magic);
    setTimeout(function() {
      frame.parent().remove();
      updateTasks(magic, 0);
      var new_order=[]
      for (var i=0; i < frames.length; ++i){
        if (frames[i]!=magic) {
          new_order.push(frames[i])
        }
      }
      frames=new_order
      if ($('.frame[magic="' +frames[frames.length-1] + '"]').attr("min")!="true"){
        focusWindow(frames[frames.length-1]);
      }
    }, 80);
  });
  // Resizable Frames
  $(".frame").resizable({
    containment: ".workspace",
    ghost: false,
    handles: "n, e, s, w, se, ne, nw, sw",
  });
  // Frame Snapping
  $('.workspace-snap-top').droppable({
    tolerance: "pointer",
    drop: function(event, ui) {
      $('.workspace-snap-ghost-active').addClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').removeClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').css({
        opacity: '0',
      });
      var magic=ui.draggable.attr('magic')
      maximizeWindow(magic);
      ui.draggable.attr('snap', 1);
      ui.draggable.attr('max', 1);
    },
    over: function(event, ui) {
      $('.workspace-snap-ghost').addClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').removeClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').css({
        transition: 'all 10ms ease-in-out',
        left: '0px',
        top: '3.2em',
        width: '100%',
        height: 'auto',
        bottom: '0px',
        opacity: '100',
      });
    },
    out: snapDragOut,
  });
  $('.workspace-snap-left').droppable({
    tolerance: "pointer",
    drop: function(event, ui) {
      $('.workspace-snap-ghost-active').addClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').removeClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').css({
        opacity: '0',
      });
      ui.draggable.css({
        transition: 'all 10ms ease-in-out',
      });
      ui.draggable.attr('restore', JSON.stringify({
        'left': ui.draggable.offset().left,
        'top': ui.draggable.offset().top,
        'width': ui.draggable.width(),
        'height': ui.draggable.height()
      }));
      ui.draggable.css({
        left: '0px',
        top: '3.2em',
        width: '50%',
        height: 'auto',
        bottom: '0px',
      });
      ui.draggable.attr('snap', 1);
    },
    over: function(event, ui) {
      $('.workspace-snap-ghost').addClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').removeClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').css({
        transition: 'all 0.1s ease-in-out',
        left: '0px',
        top: '3.2em',
        width: '50%',
        height: 'auto',
        bottom: '0px',
        opacity: '100',
      });
    },
    out: snapDragOut,
  });
  $('.workspace-snap-right').droppable({
    tolerance: "pointer",
    drop: function(event, ui) {
      $('.workspace-snap-ghost-active').addClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').removeClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').css({
        opacity: '0',
      });
      ui.draggable.css({
        transition: 'all 0.1s ease-in-out',
      });
      ui.draggable.attr('restore', JSON.stringify({
        'left': ui.draggable.offset().left,
        'top': ui.draggable.offset().top,
        'width': ui.draggable.width(),
        'height': ui.draggable.height()
      }));
      ui.draggable.css({
        left: '50%',
        top: '3.2em',
        width: '50%',
        height: 'auto',
        bottom: '0px',
      });
      ui.draggable.attr('snap', 1);
    },
    over: function(event, ui) {
      $('.workspace-snap-ghost').addClass("workspace-snap-ghost-active");
      $('.workspace-snap-ghost').removeClass("workspace-snap-ghost");
      $('.workspace-snap-ghost-active').css({
        transition: 'all 10ms ease-in-out',
        left: '50%',
        top: '3.2em',
        width: '50%',
        height: 'auto',
        bottom: '0px',
        opacity: '100',
      });
    },
    out: snapDragOut,
  });
  // Resizable Frames
  $(".frame").resizable({
    containment: ".workspace",
    ghost: false,
    handles: "n, e, s, w, se, ne, nw, sw",
  });
};

function snapDragOut(event, ui) {
  $('.workspace-snap-ghost-active').css({
    transition: 'all 10ms ease-in-out',
    top: ui.draggable.offset().top,
    left: ui.draggable.offset().left,
    width: ui.draggable.width(),
    height: ui.draggable.height(),
  });
  setTimeout(function() {
    $('.workspace-snap-ghost').css({
      opacity: '0',
    });
  }, 20);
  $('.workspace-snap-ghost-active').addClass("workspace-snap-ghost");
  $('.workspace-snap-ghost-active').removeClass("workspace-snap-ghost-active");
};

function createWindow(title, left, top, width, height, bootstrap) {
  var magic
  do {
    magic = randomString(16);
  } while (frames.includes(magic));
  var divhtml = `\
    <div magic="` + magic + `" style="width:` + width + `;height:` + height + `;left:` + left + `;top:` + top + `;transform:scale(0);opacity:0" class="frame" min="true" max="0" visible="false"> \
    	<div class="content"></div> \
    	<div class="unselectable titlebar"> \
    		<div class="titlebar-ico"></div> \
    		<div class="titlebar-title-left">` + title + `</div> \
    		<div class="titlebar-buttons"> \
    			<div class="titlebar-button frame-minimize-button"><i class="material-icons" style="font-size:1em;">remove</i></div> \
    			<div class="titlebar-button frame-maximize-button"><i class="material-icons" style="font-size:0.63em;">crop_din</i></div> \
    			<div class="titlebar-button frame-restore-button"><i class="material-icons" style="font-size:0.63em;">filter_none</i></div> \
    			<div class="titlebar-button frame-close-button"><i class="material-icons" style="font-size:1.1em;">close</i></div> \
    		</div> \
    	</div> \
    </div>`;
  var frame = document.createElement('div');
  frame.innerHTML = divhtml;
  var elem = $(frame);
  elem.addClass('frame-container');
  elem.css('width', '100%');
  elem.css('height', '100%');
  // elem.attr('visible',true)
  elem.find('.frame').hide()
  $(".workspace").append(elem);
  frames.push(magic)
  hideWindow(magic)
  elem.find('.frame').css({
    transition: 'opacity 125ms ease-in-out',
  });
  updateTasks(magic, 1);
  bootstrap(magic);
  bindEvents();
  elem.find('.frame').css('opacity', "1");
  setTimeout(function() {
    showWindow(magic)
  }, 125);
  setTimeout(function() {
    elem.find('.frame').css('transform', "scale(1)");
  }, 125);
  setTimeout(function() {
    focusWindow(magic);
  }, 150);
  console.log(frames)
  return magic
};

function frameSetIcon(magic,icon) {
  var taskicon = $('.taskbar-task-button[magic="' + magic + '"] .taskbar-task-icon')
  taskicon[0].innerHTML=icon;
}

function frameCreateLabel(magic,text,left,top,options) {
  var frame = $('.frame[magic="'+magic+'"]')
  var ctrl=document.createElement('div');
  var ctrlMagic=magic+randomString(16);
  ctrl.innerHTML='<span>'+text+'</span>';
  ctrl.setAttribute('id',"InfinityUI-Control-Label-"+ctrlMagic);
  ctrl.setAttribute('class',"InfinityUI-Control InfinityUI-Control-Label");
  ctrlStyle={
    "left":left.toString()+"em",
    "top": top.toString()+"em",
  };
  $(ctrl).css(ctrlStyle);
  frame.find('.content').append(ctrl);
}
function frameCreateInput(magic,placeholder,left,top,width,ctrlCallback,options) {
  var frame = $('.frame[magic="'+magic+'"]')
  var ctrl=document.createElement('div');
  var ctrlMagic=magic+randomString(16);
  // ctrl.innerHTML='<div contenteditable="true" placeholder="'+text+'"></div>​';
  ctrl.setAttribute('id',"InfinityUI-Control-Input-"+ctrlMagic);
  ctrl.setAttribute('contenteditable',true);
  ctrl.setAttribute('placeholder',placeholder);
  ctrl.setAttribute('class',"InfinityUI-Control InfinityUI-Control-Input");
  // ctrl.setAttribute('width',text.length);
  ctrlStyle={
    "left":left.toString()+"em",
    "top": top.toString()+"em",
  };
  $(ctrl).css(ctrlStyle);
  if (width!=-1){
    $(ctrl).css({"width": width.toString()+"em"});
  }
  $(ctrl).css(ctrlStyle);
  frame.find('.content').append(ctrl);
  $(ctrl).on('paste',function(e) {
      var $self = $(this);
      setTimeout(function() {$self.html($self.text());},0);
  }).on('keypress', function(e) {
         return e.which != 13;
  });
  $.each(ctrlCallback, function (key, data) {
    func=eval('('+data+')');
    $(ctrl).on(key,_.debounce(func));
  });
}
function frameCreateEdit(magic,text,left,top,width,height,options) {

}
function frameCreateButton(magic,text,left,top,width=-1,height=-1,ctrlCallback,options) {
  var frame = $('.frame[magic="'+magic+'"]')
  var ctrl=document.createElement('div');
  var ctrlMagic=magic+randomString(16);
  ctrl.innerHTML='<span>'+text+'</span>';
  ctrl.setAttribute('id',"InfinityUI-Control-Button-"+ctrlMagic);
  ctrl.setAttribute('class',"InfinityUI-Control InfinityUI-Control-Button");
  ctrlStyle={
    "left":left.toString()+"em",
    "top": top.toString()+"em",
  };
  $(ctrl).css(ctrlStyle);
  if (width!=-1){
    $(ctrl).css({"width": width.toString()+"em"});
  }
  if (height!=-1){
    $(ctrl).css({"height": height.toString()+"em"});
  }
  frame.find('.content').append(ctrl);
  $.each(ctrlCallback, function (key, data) {
    func=eval('('+data+')');
    $(ctrl).on(key,_.debounce(func));
  });
}
function frameCreateCheckbox(magic,text,left,top,width,height,options) {
}
function frameCreateRadioButton(magic,text,left,top,options) {
}
function frameCreateListbox(magic,text,left,top,options) {
}
function frameCreateCombobox(magic,entries,initial,left,top,options) {
}
function frameCreateContextMenu(magic,entries,left,top,options) {
}
function frameCreateGroupbox(magic,text,left,top,width,height,options) {
}
function frameCreateImage(magic,source,left,top,width,height,options) {
}
function frameCreateIcon(magic,name,left,top,width,height,options) {
}
function frameCreateTrayMenu(magic,entries) {
}
function frameCreateAppMenu(magic,entries) {
}
function frameCreateSlider(magic,initial,left,top,width,height,options) {
}
function frameCreateProgress(magic,initial,left,top,width,height,options) {
}
function frameCreateDatePick(magic,date,left,top,width,height,options) {
}
function frameCreateCalender(magic,date,left,top,width,height,options) {
}
function frameCreateTreeView(magic,left,top,width,height,options) {
}
function frameCreateListView(magic,left,top,width,height,options) {
}
function frameCreateTab(magic,options) {
}
function frameCreateStatusBar(magic,options) {
}
function frameCreateToolBar(magic,entries,options) {
}

function hideWindow(magic) {
  frame = $('.frame[magic="' + magic + '"]')
  // console.log(frame)
  frame.css({
    transition: 'all 200ms ease-in-out',
  });
  frame.attr('visible', false)
  frame.attr('min', true)
  setTimeout(function() {
    frame.hide()
  }, 125);
}

function showWindow(magic) {
  var frame = $('.frame[magic="' + magic + '"]')
  frame.show()
  frame.css({
    transition: 'all 200ms ease-in-out',
  });
  frame.attr('visible', true)
  frame.attr('min', false)
  var w = parseInt(frame.css('width'))
  var h = parseInt(frame.css('height'))
}

function restoreWindow(magic, unsnap = 0) {
  var frame = $('.frame[magic="' + magic + '"]')
  console.log(magic);
  var restore = JSON.parse(frame.attr('restore'));
  if (restore.top < parseInt($('.taskbar').css('top')) + parseInt($('.taskbar').css('height'))) {
    frame.css({
      top: parseInt($('.taskbar').css('top')) + parseInt($('.taskbar').css('height')) + 2,
      left: restore.left,
      width: restore.width,
      height: restore.height,
    })
  } else {
    frame.css({
      top: restore.top,
      left: restore.left,
      width: restore.width,
      height: restore.height,
    })
  }
  frame.css({
    transition: 'all 200ms ease-in-out',
  });
  // setTimeout(function(){
  // frame.css({
  // transition:'none',
  // })
  // }, 20);
  frame.removeAttr('restore');
  frame.attr("max", 0);
  frame.find('.frame-restore-button').css('display', 'none');
  frame.find('.frame-maximize-button').css('display', 'flex');
};

function maximizeWindow(magic) {
  var frame = $('.frame[magic="' + magic + '"]')
  frame.css({
    transition: 'all 200ms ease-in-out',
  });
  frame.attr('restore', JSON.stringify({
    'left': frame.offset().left,
    'top': frame.offset().top,
    'width': frame.width(),
    'height': frame.height()
  }));
  frame.css({
    left: '0px',
    top: '3.29em',
    width: '100%',
    height: '100%',
    bottom: '0px',
  });
  frame.find('.frame-restore-button').css('display', 'flex');
  frame.find('.frame-maximize-button').css('display', 'none');
};

function ellipsizeTextBox(id) {
  var el = document.getElementById(id);
  var wordArray = el.innerHTML.split(' ');
  while (el.scrollHeight > el.offsetHeight) {
    wordArray.pop();
    el.innerHTML = wordArray.join(' ') + '...';
  }
}

function updateTasks(magic, mode) {
  // if (clear!=0){
  // $(".taskbar-tasks").empty();
  var frame = $('.frame[magic="' + magic + '"]')
  var taskbtn = $('.taskbar-task-button[magic="' + magic + '"]')

  //Remove Task
  if (mode == 0) {
    taskbtn.css('opacity', 0)
    setTimeout(function() {
      taskbtn.remove()
    }, 125);
  } else {
    // $(".workspace .frame").each(function(index) {
    var innerhtml = `\
			<i class="taskbar-task-icon material-icons" style="">all_inclusive</i>\
			<div id="taskbar-task-text" class="taskbar-task-text">` + frame.find('.titlebar-title-left')[0].innerHTML + `</div>\
		`;
    var dom = document.createElement('div');
    dom.innerHTML = innerhtml;
    dom.setAttribute('magic', magic)
    dom.classList.add("taskbar-task-button");
    var elem = $(dom);
    elem.css({
      transition: 'all 200ms ease-in-out',
      opacity: '0'
    });
    $(".taskbar-tasks").append(elem);
    setTimeout(function() {
      elem.css({
        opacity: '1'
      });
    }, 1);
    // });
  }
}

function map(x, in_min, in_max, out_min, out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function focusWindow(magic) {
  if (magic==undefined && !frames.length) {return false};
  var new_order=[]
  for (var i=0; i < frames.length; ++i){
    if (frames[i]!=magic) {
      new_order.push(frames[i])
    }
  }
  new_order.push(magic)
  frames=new_order
  var z=0
  for (var i=0; i < frames.length; ++i){
    $('.frame[magic="'+frames[i]+'"]').css('zIndex',z)
    z+=1
  }
  for (var i=0; i < frames.length; ++i){
    if (frames[i]!=magic) {
      $('.frame[magic="'+frames[i]+'"]').attr('focus',false)
    }
  }

  var frame = $('.frame[magic="'+magic+'"]')
  var taskbtn = $('.taskbar-task-button[magic="'+magic+'"]')
  frame.attr('focus',true)
  $(".taskbar .taskbar-tasks .taskbar-task-button").removeClass("taskbar-task-button-focus")
  taskbtn.addClass("taskbar-task-button-focus")
  if (frame.attr('min') == "true") {
    showWindow(magic)
  }
}

jQuery(function($) {
  $(document).mousemove(function(event) {
    currentMousePos.x = event.pageX;
    currentMousePos.y = event.pageY;
  });
});


// window.addEventListener('load', function() {
//   bindEvents();
//   // createWindow(Math.random().toString(36).replace(/[^a-z0-9]+/g, '').substr(0, 16), '40px', '80px', '400px', '300px')
//   // createWindow(Math.random().toString(36).replace(/[^a-z0-9]+/g, '').substr(0, 16), '80px', '120px', '400px', '300px')
//   // createWindow(Math.random().toString(36).replace(/[^a-z0-9]+/g, '').substr(0, 16), '120px', '160px', '400px', '300px')
//   // createWindow(Math.random().toString(36).replace(/[^a-z0-9]+/g, '').substr(0, 16), '160px', '200px', '400px', '300px')
// });
