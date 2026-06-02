'use strict';

/**
 * Polyfills injectés par Metro AVANT tout module (polyfillModuleNames).
 * Couvre tous les globaux manquants dans les vieilles versions de Hermes/Expo Go
 * incompatibles avec React Native 0.79+ / new arch.
 */

// ── Utilitaire ────────────────────────────────────────────────────────────────
function safeDefine(name, factory) {
  if (typeof global[name] !== 'undefined') return;
  try {
    var val = factory();
    try {
      Object.defineProperty(global, name, {
        configurable: true, writable: true, enumerable: false, value: val,
      });
    } catch (_) {
      global[name] = val;
    }
  } catch (_) {}
}

// ── DOMException ──────────────────────────────────────────────────────────────
safeDefine('DOMException', function () {
  function DOMException(msg, name) {
    this.message = msg  || '';
    this.name    = name || 'DOMException';
    this.code    = 0;
    try { this.stack = new Error(msg).stack; } catch (_) {}
  }
  DOMException.prototype = Object.create(Error.prototype);
  DOMException.prototype.constructor = DOMException;
  return DOMException;
});

// ── Performance API (famille complète) ───────────────────────────────────────
safeDefine('PerformanceEntry', function () {
  function PerformanceEntry(name, type, start, dur) {
    this.name = name || ''; this.entryType = type || '';
    this.startTime = start || 0; this.duration = dur || 0;
  }
  PerformanceEntry.prototype.toJSON = function () {
    return { name:this.name, entryType:this.entryType, startTime:this.startTime, duration:this.duration };
  };
  return PerformanceEntry;
});

safeDefine('PerformanceMark', function () {
  function PerformanceMark(name, opts) {
    this.name = name || ''; this.entryType = 'mark';
    this.startTime = (opts && opts.startTime) || 0; this.duration = 0;
  }
  if (global.PerformanceEntry) PerformanceMark.prototype = Object.create(global.PerformanceEntry.prototype);
  return PerformanceMark;
});

safeDefine('PerformanceMeasure', function () {
  function PerformanceMeasure(name) {
    this.name = name || ''; this.entryType = 'measure'; this.startTime = 0; this.duration = 0;
  }
  if (global.PerformanceEntry) PerformanceMeasure.prototype = Object.create(global.PerformanceEntry.prototype);
  return PerformanceMeasure;
});

safeDefine('PerformanceObserverEntryList', function () {
  function PerformanceObserverEntryList(entries) { this._e = entries || []; }
  PerformanceObserverEntryList.prototype.getEntries = function () { return this._e; };
  PerformanceObserverEntryList.prototype.getEntriesByType = function (t) { return this._e.filter(function(e){return e.entryType===t;}); };
  PerformanceObserverEntryList.prototype.getEntriesByName = function (n) { return this._e.filter(function(e){return e.name===n;}); };
  return PerformanceObserverEntryList;
});

safeDefine('PerformanceObserver', function () {
  function PerformanceObserver(cb) { this._cb = cb; }
  PerformanceObserver.prototype.observe = function () {};
  PerformanceObserver.prototype.disconnect = function () {};
  PerformanceObserver.prototype.takeRecords = function () { return []; };
  PerformanceObserver.supportedEntryTypes = [];
  return PerformanceObserver;
});

['PerformanceEventTiming','PerformanceResourceTiming','PerformanceLongTaskTiming','TaskAttributionTiming'].forEach(function(name) {
  safeDefine(name, function () {
    function Cls() { this.name=''; this.entryType=''; this.startTime=0; this.duration=0; }
    if (global.PerformanceEntry) Cls.prototype = Object.create(global.PerformanceEntry.prototype);
    return Cls;
  });
});

// ── TextEncoder ───────────────────────────────────────────────────────────────
safeDefine('TextEncoder', function () {
  function TextEncoder() {}
  TextEncoder.prototype.encoding = 'utf-8';
  TextEncoder.prototype.encode = function (str) {
    str = String(str || '');
    var b = [], i = 0, c, u;
    while (i < str.length) {
      c = str.charCodeAt(i++);
      if (c < 0x80) { b.push(c); }
      else if (c < 0x800) { b.push(0xc0|(c>>6), 0x80|(c&0x3f)); }
      else if (c < 0xd800 || c > 0xdfff) { b.push(0xe0|(c>>12), 0x80|((c>>6)&0x3f), 0x80|(c&0x3f)); }
      else { u = 0x10000 + (((c&0x3ff)<<10) | (str.charCodeAt(i++)&0x3ff)); b.push(0xf0|(u>>18),0x80|((u>>12)&0x3f),0x80|((u>>6)&0x3f),0x80|(u&0x3f)); }
    }
    return new Uint8Array(b);
  };
  return TextEncoder;
});

// ── MessageChannel / MessageEvent ─────────────────────────────────────────────
safeDefine('MessageChannel', function () {
  function Port() { this._listeners = []; this._other = null; }
  Port.prototype.postMessage = function (data) {
    var o = this._other, e = {data:data, type:'message', target:o};
    if (o) o._listeners.slice().forEach(function(fn){ try{fn(e);}catch(_){} });
  };
  Port.prototype.addEventListener = function (t, fn) { if (t==='message') this._listeners.push(fn); };
  Port.prototype.removeEventListener = function (t, fn) { this._listeners = this._listeners.filter(function(l){return l!==fn;}); };
  Port.prototype.start = function(){};
  Port.prototype.close = function(){};
  Port.prototype.onmessage = null;

  function MessageChannel() {
    this.port1 = new Port(); this.port2 = new Port();
    this.port1._other = this.port2; this.port2._other = this.port1;
  }
  return MessageChannel;
});

safeDefine('MessageEvent', function () {
  function MessageEvent(type, init) {
    this.type = type || 'message';
    this.data = (init && init.data) !== undefined ? init.data : null;
    this.origin = (init && init.origin) || '';
    this.lastEventId = '';
    this.source = null;
  }
  return MessageEvent;
});

// ── EventTarget (stub minimal) ────────────────────────────────────────────────
safeDefine('EventTarget', function () {
  function EventTarget() { this._handlers = {}; }
  EventTarget.prototype.addEventListener = function (type, fn) {
    (this._handlers[type] = this._handlers[type] || []).push(fn);
  };
  EventTarget.prototype.removeEventListener = function (type, fn) {
    if (this._handlers[type]) this._handlers[type] = this._handlers[type].filter(function(h){return h!==fn;});
  };
  EventTarget.prototype.dispatchEvent = function (evt) {
    var hs = this._handlers[evt && evt.type] || [];
    hs.slice().forEach(function(h){ try{h(evt);}catch(_){} });
    return true;
  };
  return EventTarget;
});

// ── CloseEvent / ErrorEvent ───────────────────────────────────────────────────
safeDefine('CloseEvent', function () {
  function CloseEvent(type, init) {
    this.type = type || 'close'; this.code = (init && init.code) || 0;
    this.reason = (init && init.reason) || ''; this.wasClean = (init && init.wasClean) || false;
  }
  return CloseEvent;
});

safeDefine('ErrorEvent', function () {
  function ErrorEvent(type, init) {
    this.type = type || 'error'; this.message = (init && init.message) || '';
    this.error = (init && init.error) || null;
  }
  return ErrorEvent;
});

// ── BroadcastChannel ──────────────────────────────────────────────────────────
safeDefine('BroadcastChannel', function () {
  var channels = {};
  function BroadcastChannel(name) {
    this.name = name; this._closed = false; this.onmessage = null;
    (channels[name] = channels[name] || []).push(this);
  }
  BroadcastChannel.prototype.postMessage = function (data) {
    if (this._closed) throw new Error('BroadcastChannel is closed');
    var self = this;
    (channels[this.name] || []).forEach(function(ch) {
      if (ch !== self && !ch._closed && typeof ch.onmessage === 'function')
        try { ch.onmessage({data:data, type:'message'}); } catch(_){}
    });
  };
  BroadcastChannel.prototype.close = function () {
    this._closed = true;
    channels[this.name] = (channels[this.name] || []).filter(function(c){return c!==this;}.bind(this));
  };
  BroadcastChannel.prototype.addEventListener = function(){};
  BroadcastChannel.prototype.removeEventListener = function(){};
  return BroadcastChannel;
});

// ── AbortController / AbortSignal (si absent) ─────────────────────────────────
safeDefine('AbortController', function () {
  function AbortSignal() { this.aborted = false; this._handlers = []; }
  AbortSignal.prototype.addEventListener = function(t, fn){ if(t==='abort') this._handlers.push(fn); };
  AbortSignal.prototype.removeEventListener = function(t, fn){ this._handlers=this._handlers.filter(function(h){return h!==fn;}); };

  function AbortController() { this.signal = new AbortSignal(); }
  AbortController.prototype.abort = function (reason) {
    if (this.signal.aborted) return;
    this.signal.aborted = true; this.signal.reason = reason;
    this.signal._handlers.slice().forEach(function(fn){ try{fn({type:'abort'});}catch(_){} });
  };
  return AbortController;
});
