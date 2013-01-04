var LikipeBackbone = (function(LikipeBackbone, window, _, Backbone) {

	
	/**
	 * Populates the model with data for a specific model id from the server.
	 */
	Backbone.Model.prototype.fetchWithId = function(id, options) {
		options = options ? _.clone(options) : {};
		
		if(typeof this.url == "function") {
			var data = _.clone(this);
			data.id = id;
			
			options.url = this.url.call(data);
		}
		else {
			options.url = this.url + '/' + encodeURIComponent(id);
		}
		
		return Backbone.Model.prototype.fetch.call(this, options);
	};
	
	/**
	 * Collection which puts a list of key-value pairs on the query string
	 * for fetch actions. The Filterable name comes from the fact that query
	 * strings are commonly used by the server to filter the response.
	 * 
	 * The property filters decides what to filter.
	 */
	var FilterableCollection = LikipeBackbone.FilterableCollection = Backbone.Collection.extend({
		constructor: function()
		{
			this.filters = this.filters || {};
			
			Backbone.Collection.apply(this, arguments);
		},
		fetch: function(options)
		{
			if(this.filters) {
				options = options ? _.clone(options) : {};
				
				options.data = options.data || {};
				
				_.each(this.filters, function(v, k) {
					options.data[k] = _.isFunction(v) ? v.call(this) : v;
				});
			}
			
			return Backbone.Collection.prototype.fetch.call(this, options);
		}
	});
	
	/**
	 * Model representing a singular resource with a specific URI (ie. no id in the URI)
	 * which only responds to GET, PUT and DELETE, where PUT is responsible for both
	 * creating and updating (ie. if it exists, do an update).
	 */
	var SingularModel = LikipeBackbone.SingularModel = Backbone.Model.extend({
		save: function(attributes, options) {
			/*
			 * This prevents a save() from issuing a POST on a singular resource
			 * as isNew() == true equals a POST request to model.url
			 * (or model.urlRoot + "/" + model.id) while a false will make it
			 * issue a PUT request
			 */
			var tmpIsNew = this.isNew;
			this.isNew   = function() {
				return false;
			};
			
			Backbone.Model.prototype.save.call(this, attributes, options);
			
			this.isNew = tmpIsNew;
		},
		destroy: function(options) {
			options = options ? _.clone(options) : {};
			
			var _this = this,
			    old   = options.success;
			
			options.success = function() {
				if(old) {
					old.apply(this, arguments);
				}
				/*
				 * A singular resource still exists here, but it should be empty to reflect
				 * the fact that it does not really exist anymore, as we usually keep a reference
				 * directly to the model instead of having it in a collection.
				 */
				_this.clear();
			};
			
			Backbone.Model.prototype.destroy.call(this, options);
		}
	});
	
	/**
	 * This mixin will make the model/collection periodically fetch() with
	 * the options.interval value passed to stream(options).
	 * 
	 * options hash is passed on to fetch() for every call.
	 * 
	 * NOTE: stream() will create an interval timer which causes
	 *       window to have a reference to the model until unstream()
	 *       is called
	 * 
	 * Usage:
	 * <code>
	 * var model = new Backbone.Model();
	 * _.extend(model, LikipeBackbone.StreamModelMixin);
	 * 
	 * model.stream({
	 *     success: function() {
	 *         console.log("Whee!");
	 *     },
	 *     interval: 5000 // Fetch every 5 seconds
	 * });
	 * 
	 * ...
	 * 
	 * model.unstream();
	 * </code>
	 * 
	 */
	var StreamModelMixin = LikipeBackbone.StreamModelMixin = {
		stream: function(options) {
			this.unstream();
			
			this._streamUpdate = window.setInterval(_.bind(this.fetch, this, options), options.interval || 1000);
			
			if( ! options.noInitialFetch) {
				this.fetch(options);
			}
		},
		unstream: function() {
			window.clearTimeout(this._streamUpdate);
			delete this._streamUpdate;
		},
		isStreaming: function() {
			return ! _.isUndefined(this._streamUpdate);
		}
	};
	
	return LikipeBackbone;
})(LikipeBackbone || {}, window, _, Backbone);