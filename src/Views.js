var LikipeBackbone = (function(LikipeBackbone, window, _, Backbone) {
	
	Backbone.View.prototype.close = function() {
		this.trigger("close");
		
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
	var ViewZoneFactory = LikipeBackbone.ViewZoneFactory = function() {
		this.cid = _.uniqueId('viewZoneFactory');
		this.initialize.apply(this, arguments);
	};
	
	_.extend(ViewZoneFactory.prototype, Backbone.Events, {
		/**
		 * Constructor, receives the parameters sent to the real constructor.
		 */
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
		}
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
			'change': 'onChange'
		},
	
		initialize: function() {
			_.bindAll(this, "render", "addItem", "onChange", "getSelected");
			
			this.options  = _.extend({ text: 'text' }, this.options);
			this.setSelected(this.options.selected || undefined);
			
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
			
			if(this.selected && item.id == this.selected.id) {
				$(el).attr("selected", "selected");
			}
			
			this.$el.append(el);
		},
		onChange: function(e) {
			this.selected = this.model.get($(e.currentTarget).val());
			
			this.trigger("change");
		},
		getSelected: function() {
			return this.selected;
		},
		setSelected: function(model, trigger) {
			if( ! model instanceof Backbone.Model) {
				model = new Backbone.Model(model);
			}
			
			this.selected = model;
			this.removeSelected();
			this.$('option[value=' + model.id + ']').attr("selected", "selected");
			
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
		}
	};
	
	/**
	 * A Bootstrap Modal dialog.
	 * 
	 * Usage:
	 * <code>
	 * var wrapped_view = ...;
	 * 
	 * wrapped_view.performSave = function(modal) {
	 *     ...
	 *     // On success we do:
	 *     modal.hide(); // or modal.enable() if we've changed the contents and want to enable the controls again
	 * };
	 * 
	 * var modal = new BootstrapModal({
	 *     view: wrapped_view,
	 *     text: {
	 *         title: "My Modal",
	 *         save_button: "Save my modal!",
	 *         cancel_button: "Meh :("
	 *     }
	 * });
	 * 
	 * modal.bind("modal:save", wrapped_view.performSave);
	 * 
	 * modal.render();
	 * </code>
	 * 
	 * The text hash is optional.
	 * 
	 * Events:
	 *   modal:save   Triggered when the save (blue) button is clicked, the save
	 *                button also disable()s the modal, use enable() or showError()
	 *                to enable it again.
	 *                parameters: the modal view
	 *   modal:hidden Triggered when the modal has been successfully been hidden
	 *                which is triggered by either the cancel button, close button
	 *                or by clicking outside the modal
	 *   modal:shown  Triggered when the modal has ben successfully shown
	 */
	var BootstrapModal = LikipeBackbone.BootstrapModal = Backbone.View.extend({
		/* TODO: What to do with this? Is this really acceptable? Any better way of integrating generic templates? */
		template: _.template("<div class=\"modal hide\" style=\"display: none; \">\n\t<div class=\"modal-header\">\n\t\t<a href=\"javascript:void(0)\" class=\"close\">\u00d7<\/a>\n\t\t<h3><%-title%><\/h3>\n\t<\/div>\n\t<div class=\"alert alert-error hide\"><\/div>\n\t<div class=\"modal-body\"><\/div>\n\t<div class=\"modal-footer\">\n\t\t<a href=\"javascript:void(0)\" class=\"save btn btn-primary\"><%-save_button%><\/a>\n\t\t<a href=\"javascript:void(0)\" class=\"cancel btn btn-secondary\"><%-cancel_button%><\/a>\n\t<\/div>\n<\/div>"),
		events: {
			'click .save':   '_save',
			'click .cancel': '_hide',
			'click .close':  '_hide',
			'hide':          '_tryHide',
			'hidden':        '_hidden',
			'shown':         '_shown'
		},
		
		initialize: function(options) {
			_.bindAll(this, 'hide', 'showError', 'disable');
			
			if( ! options.view) {
				throw new Error("BootstrapModal: missing 'views' option.");
			}
			
			this.view = options.view;
			this.text = _.extend({
				title: "Bootstrap Modal",
				save_button: "Save",
				cancel_button: "Cancel"
			}, options.text || {});
			
			this.setElement(this.template(this.text));
			this.$error = this.$el.children().filter('.alert-error');
		},
		render: function() {
			this.$('.modal-body').html(this.view.render().el);
			
			/* TODO: Make this configurable */
			this.$el.modal({
				keyboard: true,
				backdrop: true
			});
			
			this.delegateEvents();
			
			this.$el.modal('show');
		},
		disable: function() {
			this.$('.save').attr('disabled', 'disabled');
			this.$('.cancel').attr('disabled', 'disabled');
		},
		enable: function() {
			this.$('.save').removeAttr('disabled');
			this.$('.cancel').removeAttr('disabled');
		},
		/**
		 * Hides the modal, call this from the wrapped view or something else when
		 * you want to close this modal.
		 */
		hide: function(e) {
			this.enable();
			this.$el.modal('hide');
			
			return false;
		},
		/**
		 * Displays an error and enables the modal again.
		 */
		showError: function(error) {
			this.enable();
			
			this.$error.html(error);
			this.$error.show();
		},
		_save: function() {
			this.disable();
			
			this.trigger("modal:save", this);
			
			return false;
		},
		_hide: function() {
			this.$el.modal('hide');
			
			return false;
		},
		/**
		 * Prevents the modal from hiding itself if we are disabled.
		 * 
		 * This is wanted if we for example have submitted a form
		 * using the save button, then we don't want to close the
		 * modal until after it has been submitted.
		 */
		_tryHide: function(e) {
			if(this.$('.save').attr('disabled')) {
				e.preventDefault();
			}
		},
		/**
		 * Removes the modal DOM when the modal is hidden.
		 */
		_hidden: function() {
			this.trigger("modal:hidden", this);
			
			this.close();
		},
		_shown: function() {
			/* Try to focus, so escape will work */
			this.$('input:text:visible:first', this).focus();
			
			this.trigger("modal:shown", this);
		}
	});
	
	return LikipeBackbone;
})(LikipeBackbone || {}, window, _, Backbone);