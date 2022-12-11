/**
 * Generic ajax call. To function properly, the following conditions need to be met:
 * - the server side __AjaxBus needs to be present
 * - there needs to be a global script include with the scriptIncludeName provided
 * - that script include needs to contain a method with the methodName provided
 * - the method is passed the options object, and needs to return a json object
 * - the __AjaxBus script include needs to handle the call of the method, and return
 *   the stringified json object
 * 
 * 
 * @param {string} scriptIncludeName - name of the global script include
 * @param {string} methodName - name of the method
 * @param {Object} options - contains all parameters for the method, this is a json object (single string, number, boolean, or an object or an array)
 * @param {Object} constructorOptions - contains all parameters for the constructor, this is a json object (single string, number, boolean, or an object or an array)
 * @returns {Promise}
 */
 function AjaxBus(scriptIncludeName, methodName, options, constructorOptions) {
	return new Promise(function (resolve, reject) {
		var AjaxBus = new GlideAjax('__AjaxBus');
		AjaxBus.addParam('sysparm_name', 'run');
		AjaxBus.addParam('script_include_name', scriptIncludeName);
		AjaxBus.addParam('method_name', methodName);
		AjaxBus.addParam('options', JSON.stringify(options));
		AjaxBus.addParam('constructor_options', JSON.stringify(constructorOptions));

		AjaxBus.getXMLAnswer(function(strResponse) {
			var response = JSON.parse(strResponse);
			if (!response.state){
				response.state = {
					hasError: true,
					message: 'Uncaught error - no response state available'
				}
			}
			if (response.state.hasError) {
				reject(response.data);
			} else {
				resolve(response.data);
			}
		});
	});
}
