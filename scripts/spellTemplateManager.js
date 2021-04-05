class spellTemplateManager {
	static currentItem = undefined;
	static currentActor = undefined;
	static currentPlayer = undefined;
	static currentDurationRounds = undefined;
	static currentScene = undefined;

	static resetItemData(){
		spellTemplateManager.currentItem = undefined;
		spellTemplateManager.currentActor = undefined;
		spellTemplateManager.currentPlayer = undefined;
		spellTemplateManager.currentDurationRounds = undefined;
		spellTemplateManager.currentScene = undefined;
	}

	static getDuration(){
		let value = spellTemplateManager.currentItem.data.data.duration.value
		let units = spellTemplateManager.currentItem.data.data.duration.units
		switch(units) {
			case "day":
				spellTemplateManager.currentDurationRounds = value * 10 * 60 * 24;
				break;
			case "hour":
				spellTemplateManager.currentDurationRounds = value * 10 * 60;
				break;
			case "inst":
				spellTemplateManager.currentDurationRounds = 0 + game.settings.get("spellTemplateManager", "instantaneousSpellFade");
				break;
			case "minute":
			case "minutes":
				spellTemplateManager.currentDurationRounds = value * 10;
				break;
			case "round":
				spellTemplateManager.currentDurationRounds = value;
				break;
			case "spec":
			case "unti":
				spellTemplateManager.currentDurationRounds = -1;
				break;
			default:
				spellTemplateManager.currentDurationRounds = -1;
		}
		console.debug("Spell Template Manager | Spell duration in rounds is ", spellTemplateManager.currentDurationRounds);
	}

	static getData (dialog, html){
		console.log("Spell Template Manager | Collecting Item Data");
		spellTemplateManager.currentItem = undefined;
		spellTemplateManager.currentActor = undefined;
		spellTemplateManager.currentPlayer = undefined;
		spellTemplateManager.currentDurationRounds = undefined;
		spellTemplateManager.currentItem=dialog.item;
		spellTemplateManager.currentActor=dialog.item.options.actor;
		spellTemplateManager.currentScene=game.scenes.viewed._id;
		spellTemplateManager.currentPlayer=game.userId;
		if(spellTemplateManager.currentItem !== undefined) spellTemplateManager.getDuration();
	}

	static async deleteAllTemplates(){
		console.log("Spell Template Manager | Cleaning All Templates");
		let scene=game.scenes.viewed;
		let templates = scene.data.templates.filter(i => i.user === game.userId);
		let deletions = templates.map(i => i._id);
		let updated = await scene.deleteEmbeddedEntity("MeasuredTemplate",deletions);
	}

	static updateTemplate(scene,template,isConcentration,isSpecialSpell,index){
		let done = false;
		if(index < 10 && !done){
			if(scene.data.templates.filter(i => i._id === template._id).length > 0){
				console.log("Spell Template Manager | Appending data");
				let update;
				if(isConcentration){
					update = {_id: template._id, flags: {
						"spellTemplateManager":{
							concentration: isConcentration, 
							actor:spellTemplateManager.currentActor.data._id, 
							duration: spellTemplateManager.currentDurationRounds,
							special: (isSpecialSpell),
							scene: scene._id
						}
					},borderColor:("#"+game.settings.get('spellTemplateManager', 'concentrationTemplateColor'))};
				}else if(spellTemplateManager.currentDurationRounds>0){
					update = {_id: template._id, flags: {
						"spellTemplateManager":{
							concentration: isConcentration, 
							actor:spellTemplateManager.currentActor.data._id, 
							duration: spellTemplateManager.currentDurationRounds,
							special: (isSpecialSpell),
							scene: spellTemplateManager.currentScene
						}
					},borderColor:("#"+game.settings.get('spellTemplateManager', 'enduringTemplateColor'))};
				}else if(spellTemplateManager.currentDurationRounds<0){
					update = {_id: template._id, flags: {
						"spellTemplateManager":{
							concentration: isConcentration, 
							actor:spellTemplateManager.currentActor.data._id, 
							duration: spellTemplateManager.currentDurationRounds,
							special: (isSpecialSpell),
							scene: spellTemplateManager.currentScene
						}
					},borderColor:("#"+game.settings.get('spellTemplateManager', 'specialTemplateColor'))};
				}else{
					update = {_id: template._id, flags: {
						"spellTemplateManager":{
							concentration: isConcentration, 
							actor:spellTemplateManager.currentActor.data._id, 
							duration: spellTemplateManager.currentDurationRounds,
							special: (isSpecialSpell),
							scene: spellTemplateManager.currentScene
						}
					},borderColor:("#"+game.settings.get('spellTemplateManager', 'standardTemplateColor'))};
				}
				let updated = scene.updateEmbeddedEntity("MeasuredTemplate", update);
				spellTemplateManager.resetItemData();
				done = true;
			}else{
				console.debug("Spell Template Manager | Failed to update template.  Retrying. ", index);
				setTimeout(spellTemplateManager.updateTemplate(scene,template,isConcentration,isSpecialSpell,index+1), 1000);
			}
		}else{
			console.log("Spell Template Manager | Failed to update template.");
			done = true;
		}
		
	}


	static async evaluateTemplate(data,template){
		console.log("Spell Template Manager | Evaluating template");
		console.debug(spellTemplateManager.currentItem);
		if(spellTemplateManager.currentItem !== undefined){
			let isConcentration = spellTemplateManager.currentItem.data.data.components?spellTemplateManager.currentItem.data.data.components?.concentration:false;
			let isSpecial = (spellTemplateManager.currentItem.data.data.duration.units === "unti" || spellTemplateManager.currentItem.data.data.duration.units === "spec");
			if(isConcentration){
				console.log("New concentration spell.  Clearing actor's previous concentration templates.");
			}
			game.scenes.forEach(scene => {
				console.debug(scene.name);
				let templates = undefined;
				if(isConcentration){
					templates = scene.data.templates.filter(	
						function (i,scene){
							if(i.flags.spellTemplateManager !== undefined){
								return ((spellTemplateManager.currentActor.data._id === i.flags.spellTemplateManager.actor) && (i._id !== template._id && i.user === game.userId) && (i.flags.spellTemplateManager.concentration === true) && (game.settings.get("spellTemplateManager", "worldConcentration") || (scene.id == i.flags.spellTemplateManager.scene)));
							}else{
								return false;
							}					
						}
					);
				}
				console.debug("Final deletions: ",templates);
				if(templates !== undefined) {
					let deletions = templates.map(i => i._id);
					let updated = scene.deleteEmbeddedEntity("MeasuredTemplate",deletions);					
				}else{
					console.log("Spell Template Manager | Nothing to delete!");
				}				
			});
			setTimeout(spellTemplateManager.updateTemplate(game.scenes.viewed,template,isConcentration,isSpecial,0), 100);
		}else{
			console.log("Spell Template Manager | Could not find current feature data!  Failing!");
		}
	}

	static async cleanupTemplates(Combat){
		console.log("Spell Template Manager | Cleaning Templates: ", Combat.combatant.actor.id);
		let scene=Combat.scene;
		let prefilter = scene.data.templates.filter(i => i.flags.spellTemplateManager !== undefined);
		let templates = prefilter.filter(
			function(i){
				return (
					(i.flags.spellTemplateManager.actor === Combat.combatant.actor.id || i.flags.spellTemplateManager.actor === undefined) && 
					(i.flags.spellTemplateManager.duration <= 0 || i.flags.spellTemplateManager.duration === undefined) &&
					(!i.flags.spellTemplateManager.special || i.flags.spellTemplateManager.special === undefined)
				);
			}
		);
		let deletions = templates.map(i => i._id);
		let updated = scene.deleteEmbeddedEntity("MeasuredTemplate",deletions);
	}

	static async promptDelete(){
		return new Promise(confirm =>{
        		new Dialog({
				title: "Delete Template",
				content: "Are you sure you want to delete this template?",
				buttons: {
					yes: {
						label: "Yes",
						callback: () => {confirm("yes");}
					},
              				no: {
						label: "No",
						callback: () => {confirm("no");}
					},
				},
				default: "close",
				close: () => confirm('no')
			}).render(true);
		})
	}


	static async promptForAction(name){
		return new Promise(complete => {
			new Dialog({
				title: "Specify Units",
				content: "<p>Choose what "+name+" will do with this template.</strong></p>",
				buttons: {
					skip: {
						label: "Skip",
						callback: () => {complete({action:"skip",units:"none",value:0});}
					},
              				delete: {
						label: "Delete",
						callback: async function() {
							let confirmation = await spellTemplateManager.promptDelete();
							if(confirmation === "yes"){
								complete({action:"delete",units:"none",value:0});
							}else{
								complete({action:"skip",units:"none",value:0});
							}
						}
					},
					claim: {
						label: "Claim",
						callback: async function() {
							let unitValue = await spellTemplateManager.promptForUnits();
							complete({action:"claim",units:unitValue.units,value:unitValue.value});
						}
					}
				},
				default: "skip"
			}).render(true);
		})
		
	}

	static async promptForUnits(){
		return new Promise(complete =>{
        		new Dialog({
				title: "Claim for how long?",
				content: "<p>Choose the type of units for this template.</strong></p>",
				buttons: {
					rounds: {
						label: "Rounds",
						callback: async function() {
							let numRounds = await spellTemplateManager.promptForNumber(1,10,"rounds");
							complete({units:"rounds",value:numRounds});
						}
					},
					minutes: {
						label: "Minutes",
						callback: async function() {
							let numMins = await spellTemplateManager.promptForNumber(1,60,"minutes");
							complete({units:"minutes",value:numMins});
						}
					},
					hours: {
						label: "Hours",
						callback: async function() {
							let numHours = await spellTemplateManager.promptForNumber(1,24,"hours");
							complete({units:"hours",value:numHours});
						}
					},
					days: {
						label: "Days",
						callback: async function() {
							let numDays = await spellTemplateManager.promptForNumber(1,7,"days");
							complete({units:"days",value:numDays});
						}
					},
					special: {
						label: "Special",
						callback: () => {complete({units:"special",value:-1});}
					}
				},
				default: {units:"rounds",value:"1"}
			}).render(true);
		})
	}


	static async promptForNumber(min,max,units){

		return new Promise(complete =>{
			let numberButtons = {};
			for (let i = min; i < max+1 ; i++){
				numberButtons[i]={label:i,callback:() => complete(i)};
			}
        		new Dialog({
				title: "How many?",
				content: "<p>Choose a number of <strong>"+units+".</strong></p>",
				buttons: numberButtons,
				default: "1"
			}).render(true);
		})
	}


	static async ageTemplates(Combat){
		console.log("Spell Template Manger | Aging templates for ", Combat.combatant.actor.name);
		let controlling = Combat.scene.data.templates.filter(i => i.flags.spellTemplateManager !== undefined);
		let aging = controlling.filter(i => i.flags.spellTemplateManager.actor === Combat.combatant.actor.id);
		for(let i = 0; i < aging.length; i++){
			let update = {_id: aging[i]._id, flags: {"spellTemplateManager":{duration: aging[i].flags.spellTemplateManager.duration-1}}};
			let updated = await Combat.scene.updateEmbeddedEntity("MeasuredTemplate",update);
			let newTemplate = Combat.scene.getEmbeddedEntity("MeasuredTemplate", aging[i]._id);	
		}
	}

	static async manageUnmanaged(Combat,GM=false){
		console.log("Spell Template Manager | Looking for Unmanaged Templates");
		let scene=Combat.scene;
		let turnActor = Combat.combatant?.actor;
		if(!turnActor) return;
		let name = turnActor.name;
		
		let managing = scene.data.templates.filter(i => i.flags.spellTemplateManager === undefined && (GM || i.user === game.userId));
		for(let i = 0; i < managing.length; i++){
			let action = game.settings.get("spellTemplateManager","unmanagedTemplateAction");			
			let response = null;
			if(action === "prompt"){
				await canvas.animatePan({x : managing[i].x, y : managing[i].y, duration : 250});
				response = await spellTemplateManager.promptForAction(turnActor.name);
			}
			if(action === "delete" || (action==="prompt" && response?.action === "delete")){
				let deleted = scene.deleteEmbeddedEntity("MeasuredTemplate",managing[i]._id);
			}
			if(action === "claim"){
				await canvas.animatePan({x : managing[i].x, y : managing[i].y, duration : 250});
				response = await spellTemplateManager.promptForUnits();
			}
			if(action === "claim" || (action === "prompt" && response?.action === "claim")){
					let valueInRounds = 0;
					let spellIsSpecial = false;
					switch(response.units) {
						case "day":
							valueInRounds = response.value * 10 * 60 * 24;
							break;
						case "hours":
							valueInRounds = response.value * 10 * 60;
							break;
						case "minutes":
							valueInRounds = response.value * 10;
							break;
						case "rounds":
							valueInRounds = response.value;
							break;
						case "special":
							valueInRounds = -1;
							spellIsSpecial = true;
							break;
						default:
							valueInRounds = -1;
					}
					let update = {_id: managing[i]._id, flags: {
						"spellTemplateManager":{
							concentration: false, 
							actor: turnActor.id, 
							duration: valueInRounds,
							special: spellIsSpecial,
							scene: Combat.scene._id
						}
					},borderColor:("#"+game.settings.get('spellTemplateManager', (spellIsSpecial?'specialTemplateColor':'enduringTemplateColor')))};
					let updated = scene.updateEmbeddedEntity("MeasuredTemplate", update);	
			}
		}
	}

	static async updateCombat(Combat) {
		if (Combat.combatant) {
			await spellTemplateManager.ageTemplates(Combat);
			await spellTemplateManager.cleanupTemplates(Combat);
		}
	}

	static async preUpdateCombat(Combat, userID=''){
		if (Combat.combatant) {
			await spellTemplateManager.cleanupTemplates(Combat);
			await spellTemplateManager.manageUnmanaged(Combat, (userID ? true : false));
		}
	}

	static resetTemplateBorders(){
		game.scenes.forEach(i => {console.log(i);i.data.templates.forEach(j => {
			let update = {};
			if(j.flags.spellTemplateManager.concentration){
				update = {_id: j._id, borderColor:("#"+game.settings.get('spellTemplateManager', 'concentrationTemplateColor'))};
			}else if(j.flags.spellTemplateManager.duration > 0){
				update = {_id: j._id, borderColor:("#"+game.settings.get('spellTemplateManager', 'enduringTemplateColor'))};
			}else if(j.flags.spellTemplateManager.special){
				update = {_id: j._id, borderColor:("#"+game.settings.get('spellTemplateManager', 'specialTemplateColor'))};
			}else {
				update = {_id: j._id, borderColor:("#"+game.settings.get('spellTemplateManager', 'standardTemplateColor'))};
			}				
			let updated = i.updateEmbeddedEntity("MeasuredTemplate", update);

		})});
	}	

}

function registerSpellTemplateManagerSettings(){
	game.settings.register(
		"spellTemplateManager", "standardTemplateColor", {
			name: game.i18n.localize("spellTemplateManager.standardTemplateColor.name"),
			hint: game.i18n.localize("spellTemplateManager.standardTemplateColor.hint"),
			scope: "world",
			config: true,
			default: "000000",
			type: String,
			onChange: () => { spellTemplateManager.resetTemplateBorders();}
		}
	);
	game.settings.register(
		"spellTemplateManager", "concentrationTemplateColor", {
			name: game.i18n.localize("spellTemplateManager.concentrationTemplateColor.name"),
			hint: game.i18n.localize("spellTemplateManager.concentrationTemplateColor.hint"),
			scope: "world",
			config: true,
			default: "ffff00",
			type: String,
			onChange: () => { spellTemplateManager.resetTemplateBorders();}
		}
	);
	game.settings.register(
		"spellTemplateManager", "enduringTemplateColor", {
			name: game.i18n.localize("spellTemplateManager.enduringTemplateColor.name"),
			hint: game.i18n.localize("spellTemplateManager.enduringTemplateColor.hint"),
			scope: "world",
			config: true,
			default: "00ff00",
			type: String,
			onChange: () => { spellTemplateManager.resetTemplateBorders();}
		}
	);
	game.settings.register(
		"spellTemplateManager", "specialTemplateColor", {
			name: game.i18n.localize("spellTemplateManager.specialTemplateColor.name"),
			hint: game.i18n.localize("spellTemplateManager.specialTemplateColor.hint"),
			scope: "world",
			config: true,
			default: "ffffff",
			type: String,
			onChange: () => { spellTemplateManager.resetTemplateBorders();}
		}
	);
	game.settings.register(
		"spellTemplateManager", "unmanagedTemplateAction", {
  			name: game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.name"),
			hint: game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.hint"),
			scope: "client",
			config: true,
			type: String,
			choices: {
				"prompt": game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.prompt"),
				"skip": game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.skip"),
				"delete": game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.delete"),
				"claim": game.i18n.localize("spellTemplateManager.unmanagedTemplateAction.claim")
			},
			default: "prompt",
			onChange: value => console.log(value)
		}
	);
	game.settings.register(
		"spellTemplateManager", "instantaneousSpellFade", {
			name: game.i18n.localize("spellTemplateManager.instantaneousSpellFade.name"),
			hint: game.i18n.localize("spellTemplateManager.instantaneousSpellFade.hint"),
			scope: "world",
			config: true,
			type: Number,
			range: {
				min: 0,
				max: 10,
				step: 1
			},
			default: 0,
			onChange: value => console.log(value)
		}
	);
       game.settings.register(
		"spellTemplateManager","worldConcentration", {
                    name: game.i18n.localize("spellTemplateManager.worldConcentration.name"),
                    hint: game.i18n.localize("spellTemplateManager.worldConcentration.hint"),
                    type: Boolean,
                    default: true,
                    config: true,
                    scope: "world",
                    onChange: value => console.log(value)
                }
      );
}


Hooks.once("init", () => {
    registerSpellTemplateManagerSettings();
});

Hooks.on("renderAbilityUseDialog",(dialog, html) => {
	console.log("Spell Template Manager | Ability Use Dialog Capture");
	document.getElementsByClassName("dialog-button")[0].addEventListener("click",
		async () => {
			
			
			let isSpell = false;
			let isFeature = false;
			let isAvailable = false;
			let isAtWill = false
	
			console.log("Spell Template Manager | Evaluating Dialog");
			
			for(let i = 0; i < document.querySelectorAll("form#ability-use-form")[0].children.length; i++){
				if("Consume Available Usage?" == document.querySelectorAll("form#ability-use-form")[0].children[i].innerText){
					isFeature=true;
					if(document.querySelectorAll("form#ability-use-form")[0].children[1].innerText.indexOf("This feat has") > -1){
						console.debug("Spell Template Manager | Feature Detected");
						isAvailable = (document.querySelectorAll("form#ability-use-form")[0].children[1].innerText.indexOf(" 0 of") === -1 ||
						   document.querySelectorAll("form#ability-use-form")[0].children[i].children[0].children[0].checked == false);	
					}
				}			
				if("Consume Spell Slot?" == document.querySelectorAll("form#ability-use-form")[0].children[i]?.children[0]?.innerText){
					isSpell=true;
					console.debug("Spell Template Manager | Spell Cast Detected");
					let spellLevelSelect = document.querySelectorAll("form#ability-use-form")[0][0].selectedIndex;
					let spellLevelText = document.querySelectorAll("form#ability-use-form")[0][0][spellLevelSelect]?.innerText ?? 0;
					let isConsuming = document.querySelectorAll("form#ability-use-form")[0].children[i].children[0].children[0].checked;
					isAvailable = (spellLevelText.indexOf("0") === -1 || !isConsuming);
				}	
				if("Consume Recharge?" == document.querySelectorAll("form#ability-use-form")[0].children[i].innerText){
					isFeature=true;
					if(document.querySelectorAll("form#ability-use-form")[0].children[1].innerText.indexOf("This feat ") > -1){
						console.debug("Spell Template Manager | Recharge Feat Detected");
						isAvailable = (document.querySelectorAll("form#ability-use-form")[0].children[1].innerText.indexOf("depleted") === -1 ||
						   document.querySelectorAll("form#ability-use-form")[0].children[i].children[0].children[0].checked == false);	
					}
				}
			}
			if(!isSpell && !isFeature){
				isAtWill = true;
				console.debug("At-will Ability Detected");
			}
			if( ((isSpell || isFeature) && isAvailable) ||
			    (isAtWill)
			){
				await spellTemplateManager.getData(dialog,html);
			}else{
				console.debug("Spell Template Manager | Unknown Form: ",document.querySelectorAll("form#ability-use-form")[0].children);
			}
		}
	);
});	

Hooks.on("createMeasuredTemplate",spellTemplateManager.evaluateTemplate);

Hooks.on("preUpdateCombat",(Combat,Round,Diff,User) => {
	if((User == game.user._id) && game.user.isGM){
		console.debug("Spell Template Manager | Initiating PUC as GM!");
		spellTemplateManager.preUpdateCombat(Combat,User);
	}else if(User == game.user._id  && !game.user.isGM){
		console.debug("Spell Template Manager | Initiating PUC as PC!");
		spellTemplateManager.preUpdateCombat(Combat);
	}
});

Hooks.on("updateCombat", (Combat,Round,Diff,User) => {
	if(game.user.isGM){
		console.debug("Spell Template Manager | Initiating UC as GM!");
		spellTemplateManager.updateCombat(Combat);
	}
});
