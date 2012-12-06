(function(window, _, Backbone, undefined) {
	
	var root = this;
	
	/**
	 * Init our namespace.
	 */
	root.LikipeBackbone = root.LikipeBackbone ? root.LikipeBackbone : {};
	
	/*************************************
	 *                                   *
	 *             Utilities             *
	 *                                   *
	 *************************************/
	
	/**
	 * Returns true if the parameter can be interpreted as a number.
	 */
	var isNumeric = LikipeBackbone.isNumeric = function(n) {
		return ! isNaN(parseFloat(n)) && isFinite(n);
	};
	/**
	 * Parses a MySQL DATETIME formatted string (YYYY-MM-DD HH:ii:ss) into a
	 * javascript Date object. If the formatting fails it returns a new Date
	 * object.
	 * 
	 * TODO: Error handling
	 * TODO: Return false or throw exception on failure?
	 */
	var parseDateTime = LikipeBackbone.parseDateTime = function(datetime) {
		var t = datetime.split(/[- :]/);
	
		if(t.length != 6) {
			return new Date();
		}
	
		return new Date(t[0], t[1] - 1, t[2], t[3], t[4], t[5]);
	};
	/**
	 * Returns a new Date instance which contains the difference between the
	 * two suppied MySQL DATETIME formatted strings (YYYY-MM-DD HH:ii:ss).
	 * 
	 * return.getTime() = date2.getTime() - date1.getTime()
	 * 
	 * TODO: Error handling, currently just lets the dates default to
	 *       new Date if the parsing fails or if the parameters are falsy
	 */
	var dateDiff = LikipeBackbone.dateDiff = function(date1, date2) {
		var start = date1 ? parseDateTime(date1).getTime() : (new Date).getTime();
		var end   = date2 ? parseDateTime(date2).getTime() : (new Date).getTime();
	
		return new Date((end - start) | 0);
	};
	
	/*************************************
	 *                                   *
	 *              Models               *
	 *                                   *
	 *************************************/
	
	/**
	 * Collection which puts a list of key-value pairs on the query string
	 * for fetch actions. The Filterable name comes from the fact that query
	 * strings are commonly used by the server to filter the response.
	 * 
	 * The property filters decides what to filter.
	 */
	var FilterableCollection = LikipeBackbone.FilterableCollection = Backbone.Collection.extend({
		fetch: function(options) {
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
		},
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
		
			this.fetch(options);
		},
		unstream: function() {
			window.clearTimeout(this._streamUpdate);
			delete this._streamUpdate;
		},
		isStreaming: function() {
			return ! _.isUndefined(this._streamUpdate);
		},
	};
	
	
	/*************************************
	 *                                   *
	 *               Views               *
	 *                                   *
	 *************************************/
	
	Backbone.View.prototype.close = function() {
		this.remove();
		this.unbind();
		
		if(this.onClose) {
			this.onClose();
		}
	};
	
	Backbone.View.prototype.assign = function(view, selector) {
		view.setElement(this.$(selector)).render();
	};
	
	var ViewContainer = LikipeBackbone.ViewContainer = Backbone.View.extend({
		render: function() {
			if(this.view) {
				this.$el.html(this.view.render().el);
			}
			else {
				this.$el.html("");
			}
			
			return this;
		},
		setView: function(view) {
			if(this.view) {
				this.view.close();
			}
			
			this.view = view;
			
			/* TODO: What to do with the return value? should we really call this.render() here? */
			this.render();
		},
		onClose: function() {
			if(this.view) {
				this.view.close();
			}
		}
	});
	
	/**
	 * Factory for maintaining views and their associated models in a ViewZoneManager.
	 * 
	 * createZone() creates and returns the view to be rendered (can also contain all
	 * related logic which is needed to initialize the view), render() will be called
	 * in the view after it has been added to the ViewContainer.
	 * 
	 * closeZone() should clean up all the view-related data, the view does not have
	 * to be closed, that happens automatically.
	 */
	var ViewZoneFactory = LikipeBackbone.ViewZoneFactory = function(options) {
		_.extend(this, options);
		
		this.cid = _.uniqueId('viewZoneFactory');
		this.initialize.apply(this, arguments);
	};
	
	_.extend(ViewZoneFactory.prototype, Backbone.Events, {
		initialize: function() {},
		/**
		 * Returns the Backbone.View instance to be located in the zone
		 * this ViewZoneFactory gets tied to.
		 */
		createZone: function() {},
		/**
		 * Cleans up the Backbone.View and associated events and models
		 * for the view created in createZone. Do not call close on the
		 * generated view returned by createZone(), that is handled automatically.
		 */
		closeZone: function() {}
	});
	
	ViewZoneFactory.extend = Backbone.Model.extend;
	
	var ViewZoneManager = LikipeBackbone.ViewZoneManager = Backbone.View.extend({
		initialize: function() {
			_.bindAll(this, "onClose", "render", "setZoneContents", "getCurrentZones", "clearZoneContents");
		
			this.zones      = this.options.zones;
			this.containers = {};
			this.factories  = {};
		
			_.each(this.zones, _.bind(function(v, k) {
				this.containers[k] = new ViewContainer({
					el: this.$(v)
				});
			}, this));
		},
		onClose: function() {
			_.each(this.factories, function(factory) {
				factory.closeZone();
				factory.trigger("closed");
			});
		
			_.each(this.containers, function(container) {
				container.close();
			});
		},
		render: function() {
			_.each(this.containers, function(container) {
				container.render();
			});
		},
		setZoneGroup: function(group) {
			_.each(group, _.bind(function(zone, zone_name) {
				this.setZoneContents(zone_name, zone);
			}, this));
		},
		setZoneContents: function(zone_name, contents) {
			if(contents == null) {
				return this.clearZoneContents(zone_name);
			}
		
			if( ! contents instanceof ViewZoneFactory) {
				throw new Error("Invalid contents ViewZoneManager#setZoneContents, expecting a ViewZoneFactory.");
			}
		
			if( ! _.has(this.zones, zone_name)) {
				throw new Error("Invalid zone name " + zone_name + ".");
			}
		
			if(_.has(this.factories, zone_name)) {
				if(this.factories[zone_name].cid == contents.cid) {
					/* We already have this zone utilizing this factory */
					return;
				}
			
				/* Destroy existing zone contents */
				this.factories[zone_name].closeZone();
				this.factories[zone_name].trigger("closed");
			}
		
			this.factories[zone_name] = contents;
			this.containers[zone_name].setView(contents.createZone());
			this.factories[zone_name].trigger("created");
		},
		getCurrentZones: function() {
			var zones = {};
		
			_.each(this.factories, function(v, k) {
				zones[k] = v;
			});
		
			return zones;
		},
		clearZoneContents: function(zone_name) {
			if(_.has(this.factories, zone_name)) {
				this.factories[zone_name].closeZone();
				this.factories[zone_name].trigger("closed");
				delete this.factories[zone_name];
			
				this.containers[zone_name].setView(null);
			}
		},
	});
	
	
	var DropdownItemView = Backbone.View.extend({
		tagName: 'option',
	
		initialize: function() {
			_.bindAll(this, "render");
		
			this.options = _.extend({ text: 'text' }, this.options);
		
			this.model.bind("change", this.render);
		},
		onClose: function() {
			this.model.unbind("change", this.render);
		},
		render: function() {
			this.$el.attr('value', this.model.get('id'));
		
			if(_.isFunction(this.options.text)) {
				this.$el.html(this.options.text.call(this.model));
			}
			else {
				this.$el.html(this.model.get(this.options.text));
			}
		
			return this;
		}
	});
	
	/**
	 * Renders a single-item <select> from a Backbone.Collection.
	 * 
	 * Options:
	 *  * model: the collection to use as a data source, updates to this are reflected in the view
	 *  * text:  the model key, or a function, which returns the text to show in the option.html()
	 * 
	 * This view triggers a "change" event on itself when the user clicks an item, use
	 * getSelectedId() to retrieve the selected item id.
	 */
	var DropdownView = LikipeBackbone.DropdownView = Backbone.View.extend({
		tagName: 'select',
		events: {
			'change': 'loadSelected',
		},
	
		initialize: function() {
			_.bindAll(this, "render", "addItem", "loadSelected", "getSelectedId");
		
			this.selected = null;
			this.options  = _.extend({ text: 'text' }, this.options);
		
			this.model.bind('change reset', this.render);
			this.model.bind('add', this.addItem);
		},
		onClose: function() {
			this.model.unbind('change reset', this.render);
			this.model.unbind('add', this.addItem);
		},
		render: function() {
			this.$el.html("");
			this.$el.append($('<option></option>').val('0').html(""));
			
			var addItem = this.addItem;
			
			this.model.each(function(item) {
				addItem(item);
			});
			
			return this;
		},
		addItem: function(item) {
			/* TODO: Find a good way to clean these up when they are deleted */
			var el = (new DropdownItemView({
				model: item,
				text:  this.options.text
			})).render().el;
		
			if(item.id == this.selected) {
				$(el).attr("selected", "selected");
			}
		
			this.$el.append(el);
		},
		loadSelected: function(e) {
			this.selected = $(e.currentTarget).val();
			
			this.trigger("change");
		},
		getSelectedId: function() {
			return this.selected;
		},
		setSelected: function(id, trigger) {
			this.selected = id;
			this.removeSelected();
			this.$('option[value=' + id + ']').attr("selected", "selected");
			
			if(trigger) {
				this.trigger('change');
			}
		},
		removeSelected: function() {
			this.$('option').removeAttr("selected");
		}
	});
	
	/**
	 * This mixin will enable a view to periodically re-render() itself.
	 */
	var PeriodicRenderViewMixin = LikipeBackbone.PeriodicRenderViewMixin = {
		startPeriodicRender: function(interval) {
			if( ! this._periodicRender) {
				this._periodicRender = window.setInterval(_.bind(this.render, this), interval || 1000);
			}
		},
		stopPeriodicRender: function() {
			window.clearTimeout(this._periodicRender);
		
			delete this._periodicRender;
		},
	};
	
})(window, _, Backbone);