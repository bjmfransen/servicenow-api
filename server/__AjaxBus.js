var __AjaxBus = Class.create();
__AjaxBus.prototype = Object.extendsObject(AbstractAjaxProcessor, {
    run: function(){
		var scriptIncludeName = ''+this.getParameter('script_include_name');
		var methodName = ''+this.getParameter('method_name');
		var options = JSON.parse(''+this.getParameter('options'));
		var constructorOptions = JSON.parse(''+this.getParameter('constructor_options'));
		var response = {
			state: {
				hasError: false
			},
			data: {}
		};

		// move this to a property
		var whiteList = gs.getProperty('allowed.client.server.calls', '__DataAPI.getRecordList,__DataAPI.getRecord');
		var isAllowed = whiteList.split(',').indexOf(scriptIncludeName+'.'+methodName) > -1;

		if (isAllowed){
			var si = new global[scriptIncludeName](constructorOptions);
			response.data = si[methodName](options);
		} else {
			response.state.hasError = true;
			response.state.message = scriptIncludeName+'.'+methodName+' is not whitelisted.';
		}

		return JSON.stringify(response);
	}
});