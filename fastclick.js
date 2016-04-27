;(function () {
	'use strict';

	/**
	 * FastClick构造方法
	 * @constructor
	 * @param {object} layer   要绑定fastclick的DOM对象
	 * @param {object} options 配置参数
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		//	配置参数
		options = options || {};

		//	click事件是否被触发
		this.trackingClick = false;


		//	触发click事件的时间戳
		this.trackingClickStart = 0;


		//	当前事件触发在哪个DOM对象
		this.targetElement = null;


		//	touchstart的时候,记录下手指的横坐标
		this.touchStartX = 0;


		//	touchstart的时候,记录下手指的纵坐标
		this.touchStartY = 0;


		//	最后一次触发click事件的标记
		this.lastTouchIdentifier = 0;


		//	最大能触发touch类事件的边界距离屏幕边框的大小
		this.touchBoundary = options.touchBoundary || 10;


		//	用来监听的DOM对象
		this.layer = layer;

		//	延迟
		this.tapDelay = options.tapDelay || 200;

		//	tap可执行的最长时间(700ms)
		this.tapTimeout = options.tapTimeout || 700;

		//	相关浏览器不支持的情况下,就只能return了
		if (FastClick.notNeeded(layer)) {
			return;
		}

		/**
		 * 绑定上方法的上下文执行环境
		 * @param  {object} method    方法的指针
		 * @param  {object} context   上下文执行环境(this之类的)
		 * @return {function}         返回一个匿名函数
		 */
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}

		//	调用上面的bind方法,绑定相关事件
		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// 安卓浏览器
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		//	绑定些其他事件
		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// 	stopImmediatePropagation的一个hack
		// 	stopImmediatePropagation:阻止当前节点上的冒泡和其他事件的执行
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// 	如果该DOM对象上已经绑定了onclick,就绑定已经绑的这个onclick
		if (typeof layer.onclick === 'function') {
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}

	//	判断WP设备
	var deviceIsWindowsPhone = navigator.userAgent.indexOf("Windows Phone") >= 0;

	//	判断Android浏览器
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0 && !deviceIsWindowsPhone;

	//	判断ios浏览器
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent) && !deviceIsWindowsPhone;

	//	ios4浏览器(#select框的bug)
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);

	//	ios6.0 - ios7.x
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS [6-7]_\d/).test(navigator.userAgent);

	//	黑莓浏览器
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * 判断是否需要绑定click
	 * @param  {object} target DOM节点对象
	 * @return {boolean}       是否需要绑定
	 */
	FastClick.prototype.needsClick = function(target) {
		//	获取标签名
		switch (target.nodeName.toLowerCase()) {

		// 	绑定了disabled属性的button/select/textarea标签
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;

		//	input标签	
		case 'input':

			// 	ios浏览器的文件域和开启了disabled的input
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // ios8相关冒泡
		case 'video':
			return true;
		}

		//	返回DOM的class属性中是否含有"needsclick"来判断是否需要绑定click
		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * 是否绑定focus事件
	 * @param  {object} target DOM节点对象
	 * @return {boolean}       是否需要绑定
	 */
	FastClick.prototype.needsFocus = function(target) {
		//	获取标签名
		switch (target.nodeName.toLowerCase()) {

		//	textarea支持focus事件	
		case 'textarea':
			return true;

		//	判断是不是非安卓浏览器下的select框
		case 'select':
			return !deviceIsAndroid;

		//	input(button/checkbox/file/image/radio/submit)不需要绑定focus事件	
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// 	目标节点绑定了disabled和readOnly属性的input标签
			return !target.disabled && !target.readOnly;

		default:
			//	返回DOM的class属性中是否含有"needsfocus"来判断是否需要绑定focus
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * 传递click事件
	 * @param  {object} targetElement 目标DOM对象
	 * @param  {object} event         当前事件句柄
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// 	如果文档中当前获取焦点的DOM对象不是传入的,就移除该DOM对象焦点
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		//	多个事件对象中的第一个
		touch = event.changedTouches[0];

		// 	声明一个自定义事件并且进行分发
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	/**
	 * 根据浏览器运行的平台确定到底需要什么类型的事件
	 * @param  {[type]} targetElement [description]
	 * @return {[type]}               [description]
	 */
	FastClick.prototype.determineEventType = function(targetElement) {

		//	安卓浏览器下的select框需要绑定monsedown
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * focus事件
	 * @param  {object} targetElement 当前事件的DOM对象
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// 	ios下能支持setSelectionRange的一些表单域(data/datatime/month)
		// 	就执行他们的setSelectionRange方法,防止报TypeError
		if (deviceIsIOS && targetElement.setSelectionRange && 
			targetElement.type.indexOf('date') !== 0 && 
			targetElement.type !== 'time' && 
			targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * 检测在目标单元中是否含有可以滚动的子元素,如果有,就给个标识
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			//	循环判断
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * 根据event.target获取当前触发事件的DOM对象
	 * @param  {object} eventTarget 事件目标对象
	 * @return {object}             当前触发事件的DOM对象
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// 	如果是一段被包含的文本,就返回包含它的父元素
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * touchStart事件
	 * @param  {object} event 事件句柄
	 * @return {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// 	多点触控的情况
		if (event.targetTouches.length > 1) {
			return true;
		}

		//	获取目标对象
		targetElement = this.getTargetElementFromEventTarget(event.target);

		//	获取第一个点
		touch = event.targetTouches[0];

		//	ios浏览器
		if (deviceIsIOS) {

			// 	获取用户选中的文本
			selection = window.getSelection();

			//	选中的开始和结尾不重合
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// 	当前手指等于上次触发touchstart手指所在的位置,阻止默认事件
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				//	更新最后一次手指的标识
				this.lastTouchIdentifier = touch.identifier;

				//	再判断更新
				this.updateScrollParent(targetElement);
			}
		}

		//	更新一些成员属性
		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * 手指在屏幕上没有离开,并且位置发生了变化
	 * @param  {object} event 	事件句柄
	 * @return {boolean}        是否移动手指
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		//	横向移动或者纵向移动的距离在可移动范围之内
		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * 手指移动
	 * @param  {object} event 事件对象
	 * @return {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {

		//	手指不在屏幕
		if (!this.trackingClick) {
			return true;
		}

		// 	手指位置发生改变,取消click事件,防止触发
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * 找到一个label元素控制的另一个元素
	 * @param  {object} labelElement DOM对象
	 * @return {object}              找到的对象
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// 	标签中带有control属性
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// 	label标签中有for属性
		// 	返回document.getElement
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// 	label中的其他元素
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * 手指离开屏幕
	 * @param  {object} event 事件对象
	 * @return {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		//	手指不在屏幕
		if (!this.trackingClick) {
			return true;
		}

		// 	防止触发double-tap的事件
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		//	手指在屏幕上的时间大于设定触发tap事件的时间
		if ((event.timeStamp - this.trackingClickStart) > this.tapTimeout) {
			return true;
		}

		// 	重新修正相关成员属性
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// 	ios设备下修正targetElement的hack
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		//	获取模板节点对象的标签名
		targetTagName = targetElement.tagName.toLowerCase();

		//	label
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);

			//	有for属性,且当前运行浏览器不是安卓浏览器,就给相关DOM获得焦点
			if (forElement) {
				this.focus(targetElement);

				//	安卓浏览器下不修改当前触发事件的DOM对象
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} 

		//	支持focus事件的
		else if (this.needsFocus(targetElement)) {

			// 	当前时间减去手指刚碰到屏幕的时间大于100毫秒
			// 	ios中iframe的情况且标签名为input
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// 	非ios下的浏览器或者非select
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		//	非ios4的ios浏览器
		if (deviceIsIOS && !deviceIsIOS4) {

			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		//	当前元素不需要绑定click事件
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * touchCancel事件
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * 鼠标事件
	 * @param  {object} 	event 事件句柄
	 * @return {boolean}      
	 */
	FastClick.prototype.onMouse = function(event) {

		// 	targetElement不存在
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// 	没有阻止默认事件
		if (!event.cancelable) {
			return true;
		}

		// 	当前事件DOM对象不需要绑定click事件
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// 	阻止事件传递
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {
				event.propagationStopped = true;
			}

			// 	阻止事件冒泡和阻止默认事件
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		return true;
	};


	/**
	 * click事件
	 * @param  {object} event 事件句柄
	 * @return {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// 	当前已经触发了touchstart事件
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// 	当前是提交事件或者鼠标中箭按下
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		if (!permitted) {
			this.targetElement = null;
		}

		// 	允许执行click事件
		return permitted;
	};


	/**
	 * 销毁相关事件监听
	 */
	FastClick.prototype.destroy = function() {
		//	当前监听的DOM对象
		var layer = this.layer;

		//	安卓浏览器
		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * 不需要绑定的事件
	 * @param  {object} layer 当前监听的DOM对象
	 * @return {boolean}      是否不需要绑定
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;
		var firefoxVersion;

		// 不支持touchstart事件的浏览器
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// 	获取chrome浏览器的版本
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {

				//	获取meta(viewport)标签
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// 	viewport中设置了不允许缩放的,就不需要绑定
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome32以上版本并且width=device-width也不需要绑定
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// 	chrome的桌面浏览器
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {

			//	获取黑莓系统的版本
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// 	黑莓10.3及以上系统
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// 	不允许用户缩放不需要绑定
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width<=device-width不需要绑定
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// 	IE10,-ms-touch-action
		if (layer.style.msTouchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		// 	firefox浏览器
		firefoxVersion = +(/Firefox\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		//	firefox27+
		if (firefoxVersion >= 27) {

			//	不允许用户缩放和width<=device-width不需要绑定
			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && (metaViewport.content.indexOf('user-scalable=no') !== -1 || document.documentElement.scrollWidth <= window.outerWidth)) {
				return true;
			}
		}

		// 	IE10,-ms-touch-action		
		if (layer.style.touchAction === 'none' || layer.style.touchAction === 'manipulation') {
			return true;
		}

		return false;
	};


	/**
	 * [attach description]
	 * @param  {object} layer   用来监听的DOM对象
	 * @param  {object} options 配置参数
	 * @return {object}         fastClick实例
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
		//	AMD支持
		define(function() {
			return FastClick;
		});
	}

	//	commonJs
	else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	}

	// <script>引入
	else {
		window.FastClick = FastClick;
	}
}());
