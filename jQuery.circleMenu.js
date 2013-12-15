;(function($, window, document, undefined){
    var pluginName = 'circleMenu',
        defaults = {
            depth: 0,
            item_diameter: 30,
            circle_radius: 80,
            angle:{
                start: 0,
                end: 90
            },
            direction: null, // ~ the other way to set up the start+end angles
            speed: 500,
            delay: 1000,
            step_out: 20,
            step_in: -20,
            trigger: 'hover',
            transition_function: 'ease',
            item_selected_scale: 2,

            // event callbacks, which are trigger()ed as event name circleMenu-<event>
            // WARNING: these entries in the `options` passed by the user will be DELETED by the .init() call (see below)
            init: null,
            destroy: null,
            open: null,
            close: null,
            select: null
        };

    function vendorPrefixes(items, prop, value){
        var browserArr = ['-webkit-','-moz-','-o-','-ms-',''];
        for(var i = 0; i < browserArr.length; i++){
            items.css(browserArr[i] + prop, value);
        }
    }

    function CircleMenu(element, options){
        this._timeouts = [];
        this.element = $(element);
        this.options = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
        this.hook();
    }

    CircleMenu.prototype.init = function(){
        var self = this,
            directions = {
                'bottom-left':[180,90],
                'bottom':[135,45],
                'right':[-45,45],
                'left':[225,135],
                'top':[225,315],
                'bottom-half':[180,0],
                'right-half':[-90,90],
                'left-half':[270,90],
                'top-half':[180,360],
                'top-left':[270,180],
                'top-right':[270,360],
                'full':[-90,270-Math.floor(360/(self.element.children('li').length - 1))],
                'bottom-right':[0,90]
            },
            dir;

        self._state = 'closed';
        self.element.addClass(pluginName+'-closed');

        if(typeof self.options.direction === 'string'){
            dir = directions[self.options.direction.toLowerCase()];
            if(dir){
                self.options.angle.start = dir[0];
                self.options.angle.end = dir[1];
            }
        }

        self.menu_items = self.element.children('li:not(:first-child)');
        // preserve position
        self.menu_items.each(function() {
        	$item = $(this);
        	$item.data('plugin_' + pluginName + '-pos-x-orig', $item.position().left);
        	$item.data('plugin_' + pluginName + '-pos-y-orig', $item.position().top);
        });
        self.initCss();
        self.item_count = self.menu_items.length;
        self._step = (self.options.angle.end - self.options.angle.start) / (self.item_count-1);
        self.menu_items.each(function(index){
            var $item = $(this),
                angle = (self.options.angle.start + (self._step * index)) * (Math.PI/180),
                x = Math.round(self.options.circle_radius * Math.cos(angle)),
                y = Math.round(self.options.circle_radius * Math.sin(angle));

            $item.data('plugin_' + pluginName + '-pos-x', x);
            $item.data('plugin_' + pluginName + '-pos-y', y);
            $item.data('plugin_' + pluginName + '-index', index);
            $item.on('click', function(ev){
                self.select(index + 2);
                // stop bubbling up the click event; we cascade it up to the root circle menu ourselves (flagging each parent with 'cascaded=true')
                return false;
            });
        });

        // Initialize event hooks from options
        var hooksArr = ['open','close','init','select'];
        function register_callback(fn, evt, cb) {
            var cb = cb || function(){
                return fn.apply(self, arguments);
            };
            // unregister + register = make sure callback is only registered once for the event:
            self.element.off(pluginName + '-' + evt, cb);
            self.element.on(pluginName + '-' + evt, cb);
            return cb;
        }
        for(var i = 0; i < hooksArr.length; i++){
            var fn, evt = hooksArr[i];

            if(self.options[evt]){
                fn = self.options[evt];
                // use a closure to keep the proper function linked with each event:
                var cb = register_callback(fn, evt, self.options["__" + evt + "_cb"]);
                // and mark the callback as registered:
                self.options["__" + evt + "_cb"] = cb;
            }
        }

        self.submenus = self.menu_items.children('ul');
        self.submenus.each(function() {
            var $item = $(this);
            var $p = $item.parent();
            $item.circleMenu($.extend({},self.options, {
                depth: self.options.depth + 1,
                __parent: $p.parent(),
                __parent_index: $p.data('plugin_' + pluginName + '-index')
            }));
        });

        self.trigger('init');
    };
    CircleMenu.prototype.destroy = function(){
        var self = this;

        self.trigger('destroy');
    };
    CircleMenu.prototype.trigger = function(){
        var args = [],
            i, len;

        for(i = 0, len = arguments.length; i < len; i++){
            args.push(arguments[i]);
        }
        this.element.trigger(pluginName + '-' + args.shift(), args);
    };
    CircleMenu.prototype.hook = function(){
        var self = this;

        if(self.options.trigger === 'hover'){
            self.element.on('mouseenter',function(evt){
                self.open();
            }).on('mouseleave',function(evt){
                self.close();
            });
        }else if(self.options.trigger === 'click'){
            self.element.children('li:first-child').on('click', function(evt){
                evt.preventDefault();
                if(self._state === 'closed' || self._state === 'closing'){
                    self.open();
                }else{
                    self.close(true);
                }
                return false;
            });
        }else if(self.options.trigger === 'none'){
            // Do nothing
        }
    };
    CircleMenu.prototype.open = function(){
        var self = this,
            $self = this.element,
            start = 0,
            set;

        self.clearTimeouts();
        if(self._state === 'open') return self;
        $self.addClass(pluginName+'-open');
        $self.removeClass(pluginName+'-closed');
        if(self.options.step_out >= 0){
            set = self.menu_items;
        }else{
            set = $(self.menu_items.get().reverse());
        }
        set.each(function(index){
            var $item = $(this);

            self._timeouts.push(setTimeout(function(){
                $item.css({
                    left: ($item.data('plugin_' + pluginName + '-pos-x') - ($item.outerWidth() / 2)) + 'px',
                    top: ($item.data('plugin_' + pluginName + '-pos-y') - ($item.outerHeight() / 2)) + 'px'
                });
                vendorPrefixes($item, 'transform', 'scale(1)');
                $item.css('opacity','1');
            }, start + Math.abs(self.options.step_out) * index));
        });
        self._timeouts.push(setTimeout(function(){
            if(self._state === 'opening') self.trigger('open');
            self._state = 'open';
        }, start + Math.abs(self.options.step_out) * set.length));
        self._state = 'opening';
        return self;
    };
    CircleMenu.prototype.close = function(immediate){
        var self = this,
            $self = this.element,
            do_animation = function do_animation(){
            var start = 0,
                set;

            self.submenus.circleMenu('close');
            self.clearTimeouts();
            if(self._state === 'closed') return self;
            if(self.options.step_in >= 0){
                set = self.menu_items;
            }else{
                set = $(self.menu_items.get().reverse());
            }
            set.each(function(index){
                var $item = $(this);

                self._timeouts.push(setTimeout(function(){
                    $item.css({
                    	top: $item.data('plugin_' + pluginName + '-pos-y-orig'),
                    	left: $item.data('plugin_' + pluginName + '-pos-x-orig')
                    });
                    vendorPrefixes($item, 'transform', 'scale(.5)');
                    $item.css('opacity','0');
                }, start + Math.abs(self.options.step_in) * index));
            });
            self._timeouts.push(setTimeout(function(){
                if(self._state === 'closing') self.trigger('close');
                self._state = 'closed';
            },start + Math.abs(self.options.step_in) * set.length));
            $self.removeClass(pluginName + '-open');
            $self.addClass(pluginName + '-closed');
            self._state = 'closing';
            return self;
        };
        if(immediate){
            do_animation();
        }else{
            self._timeouts.push(setTimeout(do_animation, self.options.delay));
        }
        return this;
    };
    CircleMenu.prototype.select = function(index, cascaded){
        var self = this,
            selected, set_other, indexes, nodes, $p, v;

        if(self._state === 'open' || self._state === 'opening'){
            self.clearTimeouts();
            set_other = self.element.children('li:not(:nth-child('+index+'),:first-child)');
            selected = self.element.children('li:nth-child('+index+')');
            indexes = [];
            nodes = [];
            v = index - 2;
            $p = selected;
            do {
                indexes.push(v);
                nodes.push($p);
                $p = $p.parent().parent();
                v = $p.data('plugin_' + pluginName + '-index');
            } while ($p && v != null);
            self.trigger('select', {
                $elem: selected,
                indexes: indexes,
                nodes: nodes,
                cascaded: cascaded || false
            });
            vendorPrefixes(selected.add(set_other), 'transition', 'all 500ms ease-out');
            vendorPrefixes(selected, 'transform', 'scale(' + self.options.item_selected_scale + ')');
            vendorPrefixes(set_other, 'transform', 'scale(0)');
            selected.css('opacity', '0');
            set_other.css('opacity', '0');
            self.element.removeClass(pluginName + '-open');
            setTimeout(function(){
                self.initCss();
            }, 500);

            // bubble up: mark the parent menu as selected too!
            // We bubble up like this, instead of depending on the [click] event bubbling up itself, as we want to pass along the 'cascaded' flag:
            var $p = self.options.__parent;
            if ($p) {
                var cm = $.data($p[0], 'plugin_' + pluginName);
                cm.select(self.options.__parent_index + 2, true);
            }
        }
    };
    CircleMenu.prototype.clearTimeouts = function(){
        var timeout;

        while(timeout = this._timeouts.shift()){
            clearTimeout(timeout);
        }
    };
    CircleMenu.prototype.initCss = function(){
        var self = this,
            $items;

        self._state = 'closed';
        self.element.removeClass(pluginName+'-open');
        self.element.addClass(pluginName+'-closed');
        self.element.css({
            'list-style': 'none',
            'margin': 0,
            'padding': 0,
            'display': 'block',
            // spec both WIDTH and HEIGHT for the UL to make it identical in size to the LI's
            'width': self.options.item_diameter + 'px',
            'height': self.options.item_diameter + 'px',
            'text-align': 'center',
            'line-height': self.options.item_diameter + 'px'
        });
        $items = self.element.children('li');
        $items.attr('style', '');
        $items.css({
            'display': 'block',
            'width': self.options.item_diameter + 'px',
            'height': self.options.item_diameter + 'px',
            'text-align': 'center',
            'line-height': self.options.item_diameter + 'px',
            'position': 'absolute',
            'z-index': 1000 + self.options.depth - 1,
            'opacity': '0'
        });
        self.element.children('li:first-child').css({
            'z-index': 1000 + self.options.depth
        }); 
        // restore position
        $items.each(function() {
        	$item = $(this);
		    $item.css({
				top: $item.data('plugin_' + pluginName + '-pos-y-orig'),
				left: $item.data('plugin_' + pluginName + '-pos-x-orig')
			});
        });
        
        if (self.options.item_diameter) {
            vendorPrefixes($items, 'border-radius', self.options.item_diameter + 'px');
        }
        vendorPrefixes(self.menu_items, 'transform', 'scale(.5)');
        setTimeout(function(){
            vendorPrefixes($items, 'transition', 'all ' + self.options.speed + 'ms ' + self.options.transition_function);
        },0);
    };

    $.fn[pluginName] = function(options){
        return this.each(function(){
            var obj = $.data(this, 'plugin_' + pluginName),
                commands = {
                'init':function(){
                    obj.init();
                },
                'destroy':function(){
                    obj.destroy();
                },
                'open':function(){
                    obj.open();
                },
                'close':function(){
                    obj.close(true);
                },
                'refresh':function(){
                    obj.init(options);
                }
            };
            if(typeof options === 'string' && obj && commands[options]){
                commands[options]();
            }
            if(typeof options === 'object' && obj && commands[options.command]){
                commands[options.command](options);
            }
            if(!obj){
                $.data(this, 'plugin_' + pluginName, new CircleMenu(this, options));
            }
        });
    };
})(jQuery, window, document);
