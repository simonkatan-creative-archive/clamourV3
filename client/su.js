
var CLMR_CMDS = {}
var CHAT_CMDS = {}
var cli_mode = "clmr";

var numPlayers;
var cliThread;
var isAllPlayers;
var isLockOn;
var isRandVoice_Num = false;
var isRandVoice_oo = false;
var isRandVoice_wds = false;
var pwtOptions = {};
var gpnOptions = {};

UI.registerHelper('isSu', function(){ return Meteor.user().profile.role == 'admin';});
UI.registerHelper('isSuLogin', function(){ return Session.get('isAdmin')});




Template.helloSu.events({

  'click #login':function(e){

    var un = $('#username').val();
    var pass = $('#password').val();

    Meteor.loginWithPassword(un, pass, function(err){

      if(err)console.log(err);

    });

    e.preventDefault();
  }

});

Template.su.created = function(){

  numPlayers = 1;
  isAllPlayers = false;
  isLockOn = false;

  Meteor.subscribe("UserData", Meteor.user()._id);
  Meteor.subscribe("AllPlayers", Meteor.user()._id);
  Meteor.subscribe("UserGroups", Meteor.user()._id);

  Session.set("currentMode", "none");
  Session.set("numbersVoice", voices[0]);
  Session.set("wordsVoice" , voices[0]);
  Session.set("currentWord", words[0]);
  Session.set("offTVoice", voices[0]);
  Session.set("onOffVoice", voices[0]);
  Session.set('currentSynth', synths[0]);
  Session.set('currentFilter', 'none');

}

Template.su_synth_ctrl.events({

  'click #killSynths':function(e){

    Meteor.call("killSynths", Meteor.user()._id);
    e.preventDefault();
  }, 

  'click #startPedal':function(e){

    Meteor.call("startPedal", Meteor.user()._id);
    e.preventDefault();

  }



});


Template.su_players.events({


  'click #resetPlayers':function(e){

    if(confirm("are you sure ?")){

      Meteor.call("resetPlayers", Meteor.user()._id);

    };

    e.preventDefault();
  }



});



Template.su_players.playerGroups = function(){
  return UserGroups.find({},{sort:{index: 1}}).fetch();
}

Template.su_players.population = function(){
  return this.members.length;
}




Template.su_playerTable.getSelected = function(p){if(p.activeThreads.indexOf(cliThread) > -1)return "selected"}
UI.registerHelper('checkCurrentMode', function(m){return (Session.get("currentMode") == m)});

Template.su_playerTable.selectedPlayers = function(){
  return UserData.find({},{sort: {isSelected: -1}}).fetch();
}

Template.su_players.currentMode = function(){return Session.get("currentMode")}
Template.su_players.currentFilter = function(){return Session.get("currentFilter")}

Template.su_players.onOffFilters = function(){return ["none", "noOn","hasOn", "noOff", "hasOff"]}
Template.su_players.voiceFilters = function(){

  var filters = ["none"];
  for(v in voices){
    filters.push(voices[v]);
    filters.push("not_" + voices[v]);
  }

  return filters;

}



/*-----------------------------------------------CLI ----------------------------------------*/


Template.su_cmd.created = function(){

  Meteor.defer(function(){
     $('#cmdText').val("clmr>");

  })
 
}


Template.su_cmd.events({


  'keydown #cmdText':function(e)
  {
    
    var str = $('#cmdText').val();    
    var cmds = str.split(cli_mode + ">");
    var cmd = cmds[cmds.length - 1];

    if(e.keyCode == 8)
    {
        return (cmd.length > 0);
    }else if(e.keyCode == 13){
        e.preventDefault();
    }else if(e.keyCode == 75 && e.metaKey){
      $('#cmdText').val(cli_mode + ">");
    }

    console.log(e)
  },

  'keyup #cmdText':function(e){
        
      var str = $('#cmdText').val();    
      var cmds = str.split(cli_mode + ">");
      var cmd = cmds[cmds.length - 1];

      if(cli_mode == "chat" && cmd.substring(0,1) != "_"){ //potentially refacctor at somepoint
        
        if(e.keyCode == 13){
          newCursor();
          msgStream.emit('message', { type: 'chatNewLine', value:  "", thread: cliThread});
        }else{
          msgStream.emit('message', { type: 'chatUpdate', value:  cmd, thread: cliThread});
        }
      }
      else if(e.keyCode == 13)
      {
     
        cmd.replace(/\r?\n|\r/,"");
        evaluateCommand(cmd, newCursor);
     
      }

  }



});

newCursor = function(){
  println(cli_mode + ">");
}

cmdReturn = function(error, result){

  if(error){
    println(error.reason);
  }else if(result){
    println(result)
  }

  newCursor();
}

println = function(str){
  $('#cmdText').val($('#cmdText').val() + "\n"+ str);   
}


evaluateCommand = function(cmd, callback){

  var result_str;
  var cmds, args;

  switch(cli_mode){
    case "clmr": cmds = CLMR_CMDS;break;
    case "chat": cmds = CHAT_CMDS;break;
  }

  args = cmd.split(" ");
  cmd = args[0];
  args = args.slice(1);

  if(typeof(cmds[cmd]) != 'undefined'){
    cmds[cmd](args, callback);
  }else{
    println("command not found")
    callback();
  }

}

CLMR_CMDS["_chat"] = function(args, callback){

    cli_mode = "chat";
    cliThread = generateTempId(10); //TODO: this will go soon ?

    var selector = parseFilters(args);
    if(selector){
      selector.thread = cliThread;

      Meteor.call("addThreadToPlayers", Meteor.user()._id, selector,
        function(e, r){
            //only make the call once the thread has been added
            if(!e){

              msgStream.emit('message', {type: 'screenChange', 'value' : 'chat', thread: cliThread});
              msgStream.emit('message', {type: 'chatClear', 'value':  "", thread: cliThread});
              println(r);

            }else{
              println(e.reason);
            }
            newCursor();
        }
      );
    }else{

      msgStream.emit('message', {type: 'screenChange', 'value' : 'chat', thread: cliThread});
      msgStream.emit('message', {type: 'chatClear', 'value':  "", thread: cliThread});
      callback();
    }

    

}

CLMR_CMDS["_group"] = function(args, callback){
    
    var name;
    if(args[0].substring(0,1) != "-"){
      name = args[0];
      args.splice(0,1);
    }

    if(args[0] == "-d"){

      var s_args = {};
      s_args.orig = args[1];
      s_args.numGps = parseInt(args[2]);
      Meteor.call("createSubGroups", Meteor.user()._id, s_args, cmdReturn);

    }else if(args[0] == "-r"){
      if(typeof(args[1]) == "undefined"){
        Meteor.call("removeGroups", Meteor.user()._id, cmdReturn);
      }else{
        Meteor.call("removeGroups", Meteor.user()._id, args[1], cmdReturn);
      }
    }else{

      var selector = parseFilters(args);
      if(typeof(name) != "undefined"){
        selector.group = name;
      }

      if(selector && selector.group){
        Meteor.call("createGroup", Meteor.user()._id, selector, cmdReturn);
      }else{
        callback();
      }
    }


}

CHAT_CMDS["_q"] = function(args, callback){
    cli_mode = "clmr";
    Meteor.call("killThread", Meteor.user()._id, cliThread);
    callback();
}

CHAT_CMDS["_c"] = function(args, callback){
    msgStream.emit('message', {type: 'chatClear', 'value':  "", thread: cliThread});
    callback();
}



function parseFilters(args){

  var selector = {};

  for(var i = 0; i < args.length; ){
    if(args[i] == "-f" || args[i] == "-n"){
      
      if(typeof(selector.filters) == "undefined")selector.filters = [];

      (function(){
        var filter = {};
        filter.not = args[i] == "-n";
        args.splice(i,1);

        switch(args[i]){

          case "words": //FIXME: this could be done more concisely
            filter.mode = "words";
          break;
          case "numbers":
            filter.mode = "numbers";
          break;
          case "onOff":
            filter.mode = "onOff";
          break;
          case "chat":
            filter.mode = "chat";
          break;
          case "hasOn":
            filter.mode = "hasOn";
          break;
          case "hasOff":
            filter.mode = "hasOff";
          break;

          default:
            if(!isNaN(args[i])){
              selector.numPlayers = parseInt(args[i]);
            }else if(voices.indexOf(args[i]) > -1){
              filter.mode = "voice";
              filter.voice = args[i];
            }else if(UserGroups.findOne({name: args[i]})){
              filter.mode = "group";
              filter.group = args[i];
            }

        }

        args.splice(i, 1);
        selector.filters.push(filter);

      })();

    }else if(args[i] == "-g"){
      
      args.splice(i,1);
      selector.group = args[i];

    }else if(UserGroups.findOne({name: args[i]})){

      if(typeof(selector.filters) == "undefined")selector.filters = [];
      var filter = {mode: "group", group: args[i]};
      selector.filters.push(filter);
      args.splice(i, 1);

    }else{
      i++;
    }
  }

  if(typeof(selector.filters) == "undefined")selector = false; //there are no selectors

  return selector;
}


/*---------------------------------------------------------words-------------------------------------------*/



Template.su_words.events({

  'click #init':function(e){
  
      var options = {};
      options = checkSendAllWords(options);
      msgStream.emit('message', {type: 'screenChange', 'value' : 'words'});
      msgStream.emit('message', {type: 'wordsReset', 'value': options});
      e.preventDefault();

  },

  'click #killSynthsWds':function(e){

      var options = {killSynths: $('#killSynthsWds').prop('checked')};
      options = checkSendAllWords(options);
      msgStream.emit('message', {type: 'wordsChange', 'value': options});
  },

  'click .voiceItem':function(e){

    if(isRandVoice_wds){
        isRandVoice_wds = false;
        $('#randVoices_wds').addClass('btn-default');
        $('#randVoices_wds').removeClass('btn-primary');
      }
    Session.set("wordsVoice", e.currentTarget.id);
    var options = {voice: e.currentTarget.id, isRandomVoice: false};
    options = checkSendAllWords(options);
    msgStream.emit('message', {type: 'wordsChange', 'value': options});

    e.preventDefault();
  },

  'click .wordItem':function(e){

    Session.set("currentWord", e.currentTarget.id);
    var options = {word: e.currentTarget.id};
    options = checkSendAllWords(options);
    msgStream.emit('message', {type: 'wordsChange', 'value': options});

    e.preventDefault();
  },

  'click #randVoices_wds': function(e){

    isRandVoice_wds = true;
    $('#randVoices_wds').removeClass('btn-default');
    $('#randVoices_wds').addClass('btn-primary');
    var options = {isRandomVoice: isRandVoice_wds};
    options = checkSendAllWords(options);
    msgStream.emit('message', {type: 'wordsChange', 'value': options});

    e.preventDefault();
},

'click #notRandVoices_wds': function(e){

    isRandVoice_Num = false;
    $('#randVoices_wds').addClass('btn-default');
    $('#randVoices_wds').removeClass('btn-primary');
    var options = {isRandomVoice: isRandVoice_wds};
    options = checkSendAllWords(options);
    msgStream.emit('message', {type: 'wordsChange', 'value': options});

    e.preventDefault();
},


'click .wordsInput, blur .wordsInput':function(e){

    var options = {};
    options[e.currentTarget.id] = $('#' + e.currentTarget.id).val();
    options = checkSendAllWords(options);
    msgStream.emit('message', {type: 'wordsChange', 'value': options});

}


});



Template.su_words.voice = function(){return Session.get("wordsVoice")}

Template.su_words.words = function(){return words}
Template.su_words.currentWord = function(){ return Session.get("currentWord")}


function checkSendAllWords(options){

  if($('#sendAllWds').prop('checked')){
      options = getWordsOptions();
  }

  return options;
  
}

function getWordsOptions(options){
  var options = {
    volume: $('#volume.wordsInput').val(),
    pan:  $('#pan.wordsInput').val() ,
    fadeTime: $('#fadeTime.wordsInput').val(),
    isRandomVoice: isRandVoice_wds,
    splay: $('#splay.wordsInput').val(),
    voice: Session.get('wordsVoice'),
    resetTime: $('#resetTime.wordsInput').val(),
    word: Session.get("currentWord"),
    killSynths: $('#killSynthsWds').prop('checked')
  }
  return options;
}


/*--------------------------------------------------------numbers-------------------------------------------*/


Template.su_numbers.currentVoice = function(){return Session.get("numbersVoice")}


Template.su_numbers.events({

'click #replay':function(e){

    var options = {};

    options = checkSendAll(options);

    msgStream.emit('message', {type: 'numbersReset', 'value': options});
    e.preventDefault();
  },

'click #numbersInit':function(e){
  
      var options = {};
      options = checkSendAll(options);
      msgStream.emit('message', {type: 'screenChange', 'value' : 'numbers'});
      msgStream.emit('message', {type: 'numbersReset', 'value': options});
      e.preventDefault();

  },

'click #lockOn':function(e){

  isLockOn = true;
  $('#lockOn').addClass('btn-primary');
  $('#lockOn').removeClass('btn-default');
  $('#lockOff').removeClass('btn-primary');
  $('#lockOff').addClass('btn-default');

  var options = {lockOn: isLockOn};
  options = checkSendAll(options);
  msgStream.emit('message', {type: 'numbersChange', 'value': options});
  e.preventDefault();
},

'click #lockOff':function(e){

  isLockOn = false;
  $('#lockOn').addClass('btn-default');
  $('#lockOn').removeClass('btn-primary');
  $('#lockOff').removeClass('btn-default');
  $('#lockOff').addClass('btn-primary');
  
  var options = {lockOn: isLockOn};
  options = checkSendAll(options);
  msgStream.emit('message', {type: 'numbersChange', 'value': options});
  e.preventDefault();
},

'click #randVoices_num': function(e){

    isRandVoice_Num = true;
    $('#randVoices_num').removeClass('btn-default');
    $('#randVoices_num').addClass('btn-primary');
    var options = {isRandomVoice: isRandVoice_Num};
    options = checkSendAll(options);
    msgStream.emit('message', {type: 'numbersChange', 'value': options});

    e.preventDefault();
},

'click #notRandVoices_num': function(e){

    isRandVoice_Num = false;
    $('#randVoices_num').addClass('btn-default');
    $('#randVoices_num').removeClass('btn-primary');
    var options = {isRandomVoice: isRandVoice_Num};
    options = checkSendAll(options);
    msgStream.emit('message', {type: 'numbersChange', 'value': options});

    e.preventDefault();
},

'click .voiceItem':function(e){

  if(isRandVoice_Num){
      isRandVoice_Num = false;
      $('#randVoices_num').addClass('btn-default');
      $('#randVoices_num').removeClass('btn-primary');
    }
  Session.set("numbersVoice", e.currentTarget.id);
  var options = {voice: e.currentTarget.id, isRandomVoice: false};
  options = checkSendAll(options);
  msgStream.emit('message', {type: 'numbersChange', 'value': options});

  e.preventDefault();
},

'click .numbersInput, blur .numbersInput':function(e){

    var options = {};
    options[e.currentTarget.id] = $('#' + e.currentTarget.id).val();
    options = checkSendAll(options);
    msgStream.emit('message', {type: 'numbersChange', 'value': options});


}


});


function checkSendAll(options){

  if($('#sendAll').prop('checked')){
      options = getNumbersOptions();
  }

  return options;
}

function getNumbersOptions(){

  var options = {

    lockOn: isLockOn, 
    startIndex: $('#startIndex.numbersInput').val(),
    endIndex: $('#endIndex.numbersInput').val(),
    volume: $('#volume.numbersInput').val(),
    pan:  $('#pan.numbersInput').val() ,
    fadeTime: $('#fadeTime.numbersInput').val(),
    isRandomVoice: isRandVoice_Num,
    splay: $('#splay.numbersInput').val(),
    voice: Session.get('numbersVoice'),
    resetPause: $('#resetPause.numbersInput').val()

  };

  return options
}


/*---------------------------------------------------- on off -------------------------------------------*/

Template.su_onOff.events({

  'click #onOffInit':function(e){

      msgStream.emit('message', {type: 'screenChange', 'value' : 'onOff'});
      e.preventDefault();
  },

  'click #addOn':function(e){

    var onOptions = getOnOptions();
    msgStream.emit('message', {type: 'addOn', 'value' : onOptions});
    e.preventDefault();
  },

  'click #addOff':function(e){

    var offOptions = getOffOptions();
    msgStream.emit('message', {type: 'addOff', 'value' : offOptions});
    e.preventDefault();
  },

  'click #randVoices_oo': function(e){

    isRandVoice_oo = true;
    $('#randVoices_oo').removeClass('btn-default');
    $('#randVoices_oo').addClass('btn-primary');
    var options = {isRandomVoice: isRandVoice_oo};
    options = checkSendAll(options);
    msgStream.emit('message', {type: 'numbersChange', 'value': options});

    e.preventDefault();
  },

  'click .voiceItem':function(e){

    if(isRandVoice_oo){
        isRandVoice_oo = false;
        $('#randVoices_oo').addClass('btn-default');
        $('#randVoices_oo').removeClass('btn-primary');
    }

    Session.set("onOffVoice", e.currentTarget.id);

    e.preventDefault();
  },

  'click .synthItem':function(e){

    Session.set('currentSynth', e.currentTarget.id);
    e.preventDefault();

  }

});


UI.registerHelper('voices' , function(){
  return voices;
});

Template.su_onOff.currentSynth = function(){
  return Session.get('currentSynth');
}

Template.su_onOff.isSynth = function(s){
  return (Session.get('currentSynth') == s);
}

Template.su_onOff.synths = function(){
  return synths;
}

Template.su_onOff.currentVoice = function(){return Session.get("onOffVoice")}

Template.su_pwtCtrls.created = function(){

  Meteor.defer(function(){
    

    if(typeof pwtOptions.minFreq !== 'undefined')$('#oo_minF').val(pwtOptions.minFreq);
    if(typeof pwtOptions.fRng !== 'undefined')$('#oo_fRng').val(pwtOptions.fRng);
    if(typeof pwtOptions.noiseFreq !== 'undefined')$('#oo_noiseFreq').val(pwtOptions.noiseFreq);
    if(typeof pwtOptions.nFreqV !== 'undefined')$('#oo_nFreqV').val(pwtOptions.nFreqV);

  });
}

Template.su_pwtCtrls.destroyed = function(){
    pwtOptions.minFreq = $('#oo_minF').val();
    pwtOptions.fRng = $('#oo_fRng').val();
    pwtOptions.noiseFreq = $('#oo_noiseFreq').val();
    pwtOptions.nFreqV = $('#oo_nFreqV').val();
}

Template.su_gpnCtrls.created = function(){

  Meteor.defer(function(){
    

    if(typeof gpnOptions.trigRate !== 'undefined')$('#oo_trigRate').val(gpnOptions.trigRate);
    if(typeof gpnOptions.envDur !== 'undefined')$('#oo_envDur').val(gpnOptions.envDur);
    if(typeof gpnOptions.endPosR !== 'undefined')$('#oo_endPosR').val(gpnOptions.endPosR);
    if(typeof gpnOptions.variance !== 'undefined')$('#oo_variance').val(gpnOptions.variance);

  });
}

Template.su_gpnCtrls.destroyed = function(){
      gpnOptions.trigRate = $('#oo_trigRate').val();
      gpnOptions.envDur = $('#oo_envDur').val();
      gpnOptions.endPosR = $('#oo_endPosR').val();
      gpnOptions.variance = $('#oo_variance').val();

}



function getOnOptions(){

    var onOptions = {};
    onOptions.synth = Session.get('currentSynth');
    onOptions.isRandomVoice = isRandVoice_oo;
    onOptions.voice = Session.get('onOffVoice');
    onOptions.pan = $('#oo_pan').val();
    onOptions.splay = $('#oo_splay').val();
    onOptions.vVolume = $('#oo_Vvolume').val();
    onOptions.sVolume = $('#oo_Svolume').val();

    if(onOptions.synth == 'playWithTone'){
      onOptions.minFreq = $('#oo_minF').val();
      onOptions.fRng = $('#oo_fRng').val();
      onOptions.noiseFreq = $('#oo_noiseFreq').val();
      onOptions.nFreqV = $('#oo_nFreqV').val();
    }else if(onOptions.synth == 'granPulseNoise'){
      onOptions.trigRate = $('#oo_trigRate').val();
      onOptions.envDur = $('#oo_envDur').val();
      onOptions.endPosR = $('#oo_endPosR').val();
      onOptions.variance = $('#oo_variance').val();
    }


    return onOptions;

}

function getOffOptions(){

  var offOptions = {};
  offOptions.isRandomVoice = isRandVoice_oo;
  offOptions.voice = Session.get('onOffVoice');
  offOptions.volume = $('#oo_Vvolume').val();
  offOptions.pan = $('#oo_pan').val();
  offOptions.splay = $('#oo_slay').val();

  return offOptions;

}

/*--------------------------------------------------------offTransition -------------------------------------*/
Template.su_offTransition.currentVoice = function(){return Session.get("offTVoice")}

Template.su_offTransition.events({

  'click #offTInit':function(e){

    var options = {
      voice: Session.get("offTVoice"),
      vol: $('#ot_volume').val(),
      pan: $('#ot_pan').val(),
      splay: $('#ot_splay').val()
    }

    msgStream.emit('message', {type: 'offTransition', 'value': options});
    e.preventDefault();
  },

  'click .voiceItem':function(e){

    Session.set("offTVoice", e.currentTarget.id);
    e.preventDefault();

  }

});



