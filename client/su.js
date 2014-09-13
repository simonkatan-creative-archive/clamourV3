
var numPlayers;
var isAllPlayers;
var isLockOn;

var isRandVoice_Num = false;
var isRandVoice_oo = false;

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

  Session.set("currentMode", "none");
  Session.set("numbersVoice", voices[0]);
  Session.set("onOffVoice", voices[0]);

  Meteor.defer(function(){

    $('#chatText').val("");
    selectSomePlayers();

  });

}


Template.su_players.events({


  'click #resetPlayers':function(e){

    if(confirm("are you sure ?")){

      Meteor.call("resetPlayers", Meteor.user()._id);

    };

    e.preventDefault();
  },


  'change #allPlayers, click #reselect':function(e){

    if($('#allPlayers').prop('checked')){
      selectAllPlayers();
    }else{
      selectSomePlayers();
    }

  },

  'click .filterItem':function(e){

    Session.set("currentMode", e.currentTarget.id);
    e.preventDefault();
  }



});

Template.su_players.playerModes = function(){
  return ["numbers" , "chat", "onOff", "none"];
}

Template.su_players.selectedPlayers = function(){
  return UserData.find({},{sort: {isSelected: -1}}).fetch();
}

Template.su_players.currentMode = function(){return Session.get("currentMode")}

function selectAllPlayers(){


    Meteor.users.find({'profile.role': "player"}).forEach(function(e){
      UserData.update(e._id,{$set: {isSelected: true}});
    });

}

function selectSomePlayers(){

  var uids = [];
  var invert = $('#invert').prop('checked');

   UserData.find().forEach(function(e){UserData.update(e._id, {$set: {isSelected: false}})});

  var searchObj = {};

  if(Session.get("currentMode")!= "none"){

    if(!$('#invert').prop('checked')){
      searchObj.view = Session.get("currentMode");
    }else{
      searchObj.view = {$ne: Session.get("currentMode")}
    }
  }


  UserData.find(searchObj).forEach(function(e){
    uids.push(e._id);
  });

  shuffleArray(uids);

  var numPlayers = Math.min(uids.length , $('#numPlayers').val());


  for(var i = 0; i < numPlayers; i++){
    UserData.update(uids[i], {$set: {isSelected: true}});
  }

}

function shuffleArray(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};


/*--------------------------------------------------------chat-------------------------------------------*/

Template.su_chat.events({

   'click #chatClear':function(e){

    $('#chatText').val("");
    e.preventDefault();

  },


  'keyup #chatText':function(e){
    
      msgStream.emit('message', {type: 'updateChat', 'value':  $('#chatText').val()});
    
  },

  'click #chatInit':function(e){
    
    $('#chatText').val("");
  
    msgStream.emit('message', {type: 'screenChange', 'value' : 'chat'});
    msgStream.emit('message', {type: 'updateChat', 'value':  $('#chatText').val()});
    
  }

});

/*--------------------------------------------------------numbers-------------------------------------------*/

Template.su_numbers.voices = function(){
  return voices;
}

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

'click #splay':function(e){

  var options = {splay: $('#splay').val()};
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

'click .voiceItem':function(e){

  if(isRandVoice_Num){
        isRandVoice_Num = false;
        $('#randVoices_num').addClass('btn-default');
        $('#randVoices_num').removeClass('btn-primary');
    }
  Session.set("numbersVoice", e.currentTarget.id);
  var options = {voice: e.currentTarget.id, isRandVoice_Num: false};
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
    startIndex: $('#startIndex').val(),
    endIndex: $('#endIndex').val(),
    volume: $('#volume').val(),
    pan:  $('#pan').val() ,
    fadeTime: $('#fadeTime').val(),
    isRandVoice: isRandVoice_Num,
    splay: $('#splay').val(),
    voice: Session.get('numbersVoice')

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
  var options = {voice: e.currentTarget.id, isRandVoice_oo: isRandVoice_oo};

  e.preventDefault();
},

});

Template.su_onOff.voices = function(){
  return voices;
}

Template.su_onOff.currentVoice = function(){return Session.get("onOffVoice")}

function getOnOptions(){

    var onOptions = {};
    onOptions.isRandomVoice = isRandVoice_oo;
    onOptions.voice = Session.get('onOffVoice');
    onOptions.minFreq = $('#oo_minF').val();
    onOptions.maxFreq = $('#oo_maxF').val();
    onOptions.vVolume = $('#oo_Vvolume').val();
    onOptions.sVolume = $('#oo_Svolume').val();
    onOptions.pan = $('#oo_pan').val();
    onOptions.splay = $('#oo_splay').val();

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



