var Module = typeof GameModule !== "undefined" ? GameModule : {};
var moduleOverrides = {};
var key;
for (key in Module) {
    if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key]
    }
}
Module["arguments"] = [];
Module["thisProgram"] = "./this.program";
Module["quit"] = function(status, toThrow) {
    throw toThrow
}
;
Module["preRun"] = [];
Module["postRun"] = [];
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === "object";
ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
var scriptDirectory = "";
function locateFile(path) {
    if (Module["locateFile"]) {
        return Module["locateFile"](path, scriptDirectory)
    } else {
        return scriptDirectory + path
    }
}
if (ENVIRONMENT_IS_NODE) {
    scriptDirectory = __dirname + "/";
    var nodeFS;
    var nodePath;
    Module["read"] = function shell_read(filename, binary) {
        var ret;
        if (!nodeFS)
            nodeFS = require("fs");
        if (!nodePath)
            nodePath = require("path");
        filename = nodePath["normalize"](filename);
        ret = nodeFS["readFileSync"](filename);
        return binary ? ret : ret.toString()
    }
    ;
    Module["readBinary"] = function readBinary(filename) {
        var ret = Module["read"](filename, true);
        if (!ret.buffer) {
            ret = new Uint8Array(ret)
        }
        assert(ret.buffer);
        return ret
    }
    ;
    if (process["argv"].length > 1) {
        Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
    }
    Module["arguments"] = process["argv"].slice(2);
    if (typeof module !== "undefined") {
        module["exports"] = Module
    }
    process["on"]("uncaughtException", function(ex) {
        if (!(ex instanceof ExitStatus)) {
            throw ex
        }
    });
    process["on"]("unhandledRejection", abort);
    Module["quit"] = function(status) {
        process["exit"](status)
    }
    ;
    Module["inspect"] = function() {
        return "[Emscripten Module object]"
    }
} else if (ENVIRONMENT_IS_SHELL) {
    if (typeof read != "undefined") {
        Module["read"] = function shell_read(f) {
            return read(f)
        }
    }
    Module["readBinary"] = function readBinary(f) {
        var data;
        if (typeof readbuffer === "function") {
            return new Uint8Array(readbuffer(f))
        }
        data = read(f, "binary");
        assert(typeof data === "object");
        return data
    }
    ;
    if (typeof scriptArgs != "undefined") {
        Module["arguments"] = scriptArgs
    } else if (typeof arguments != "undefined") {
        Module["arguments"] = arguments
    }
    if (typeof quit === "function") {
        Module["quit"] = function(status) {
            quit(status)
        }
    }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
    } else {
        scriptDirectory = ""
    }
    Module["read"] = function shell_read(url) {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.send(null);
        return xhr.responseText
    }
    ;
    if (ENVIRONMENT_IS_WORKER) {
        Module["readBinary"] = function readBinary(url) {
            var xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response)
        }
    }
    Module["readAsync"] = function readAsync(url, onload, onerror) {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function xhr_onload() {
            if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                onload(xhr.response);
                return
            }
            onerror()
        }
        ;
        xhr.onerror = onerror;
        xhr.send(null)
    }
    ;
    Module["setWindowTitle"] = function(title) {
        document.title = title
    }
} else {}
var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
for (key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key]
    }
}
moduleOverrides = undefined;
function dynamicAlloc(size) {
    var ret = HEAP32[DYNAMICTOP_PTR >> 2];
    var end = ret + size + 15 & -16;
    if (end <= _emscripten_get_heap_size()) {
        HEAP32[DYNAMICTOP_PTR >> 2] = end
    } else {
        var success = _emscripten_resize_heap(end);
        if (!success)
            return 0
    }
    return ret
}
function getNativeTypeSize(type) {
    switch (type) {
    case "i1":
    case "i8":
        return 1;
    case "i16":
        return 2;
    case "i32":
        return 4;
    case "i64":
        return 8;
    case "float":
        return 4;
    case "double":
        return 8;
    default:
        {
            if (type[type.length - 1] === "*") {
                return 4
            } else if (type[0] === "i") {
                var bits = parseInt(type.substr(1));
                assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
                return bits / 8
            } else {
                return 0
            }
        }
    }
}
function warnOnce(text) {
    if (!warnOnce.shown)
        warnOnce.shown = {};
    if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text)
    }
}
var asm2wasmImports = {
    "f64-rem": function(x, y) {
        return x % y
    },
    "debugger": function() {
        debugger
    }
};
var functionPointers = new Array(0);
function makeBigInt(low, high, unsigned) {
    return unsigned ? +(low >>> 0) + +(high >>> 0) * 4294967296 : +(low >>> 0) + +(high | 0) * 4294967296
}
function dynCall(sig, ptr, args) {
    if (args && args.length) {
        return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
    } else {
        return Module["dynCall_" + sig].call(null, ptr)
    }
}
var tempRet0 = 0;
var setTempRet0 = function(value) {
    tempRet0 = value
};
var Runtime = {};
if (typeof WebAssembly !== "object") {
    err("no native wasm support detected")
}
var wasmMemory;
var wasmTable;
var ABORT = false;
var EXITSTATUS = 0;
function assert(condition, text) {
    if (!condition) {
        abort("Assertion failed: " + text)
    }
}
function getCFunc(ident) {
    var func = Module["_" + ident];
    assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
    return func
}
function ccall(ident, returnType, argTypes, args, opts) {
    var toC = {
        "string": function(str) {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
                var len = (str.length << 2) + 1;
                ret = stackAlloc(len);
                stringToUTF8(str, ret, len)
            }
            return ret
        },
        "array": function(arr) {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
        }
    };
    function convertReturnValue(ret) {
        if (returnType === "string")
            return UTF8ToString(ret);
        if (returnType === "boolean")
            return Boolean(ret);
        return ret
    }
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
        for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0)
                    stack = stackSave();
                cArgs[i] = converter(args[i])
            } else {
                cArgs[i] = args[i]
            }
        }
    }
    var ret = func.apply(null, cArgs);
    ret = convertReturnValue(ret);
    if (stack !== 0)
        stackRestore(stack);
    return ret
}
function cwrap(ident, returnType, argTypes, opts) {
    argTypes = argTypes || [];
    var numericArgs = argTypes.every(function(type) {
        return type === "number"
    });
    var numericRet = returnType !== "string";
    if (numericRet && numericArgs && !opts) {
        return getCFunc(ident)
    }
    return function() {
        return ccall(ident, returnType, argTypes, arguments, opts)
    }
}
function setValue(ptr, value, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*")
        type = "i32";
    switch (type) {
    case "i1":
        HEAP8[ptr >> 0] = value;
        break;
    case "i8":
        HEAP8[ptr >> 0] = value;
        break;
    case "i16":
        HEAP16[ptr >> 1] = value;
        break;
    case "i32":
        HEAP32[ptr >> 2] = value;
        break;
    case "i64":
        tempI64 = [value >>> 0, (tempDouble = value,
        +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[ptr >> 2] = tempI64[0],
        HEAP32[ptr + 4 >> 2] = tempI64[1];
        break;
    case "float":
        HEAPF32[ptr >> 2] = value;
        break;
    case "double":
        HEAPF64[ptr >> 3] = value;
        break;
    default:
        abort("invalid type for setValue: " + type)
    }
}
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_DYNAMIC = 2;
var ALLOC_NONE = 3;
function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === "number") {
        zeroinit = true;
        size = slab
    } else {
        zeroinit = false;
        size = slab.length
    }
    var singleType = typeof types === "string" ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
        ret = ptr
    } else {
        ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length))
    }
    if (zeroinit) {
        var stop;
        ptr = ret;
        assert((ret & 3) == 0);
        stop = ret + (size & ~3);
        for (; ptr < stop; ptr += 4) {
            HEAP32[ptr >> 2] = 0
        }
        stop = ret + size;
        while (ptr < stop) {
            HEAP8[ptr++ >> 0] = 0
        }
        return ret
    }
    if (singleType === "i8") {
        if (slab.subarray || slab.slice) {
            HEAPU8.set(slab, ret)
        } else {
            HEAPU8.set(new Uint8Array(slab), ret)
        }
        return ret
    }
    var i = 0, type, typeSize, previousType;
    while (i < size) {
        var curr = slab[i];
        type = singleType || types[i];
        if (type === 0) {
            i++;
            continue
        }
        if (type == "i64")
            type = "i32";
        setValue(ret + i, curr, type);
        if (previousType !== type) {
            typeSize = getNativeTypeSize(type);
            previousType = type
        }
        i += typeSize
    }
    return ret
}
function getMemory(size) {
    if (!runtimeInitialized)
        return dynamicAlloc(size);
    return _malloc(size)
}
function Pointer_stringify(ptr, length) {
    abort("this function has been removed - you should use UTF8ToString(ptr, maxBytesToRead) instead!")
}
var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
    var endIdx = idx + maxBytesToRead;
    var endPtr = idx;
    while (u8Array[endPtr] && !(endPtr >= endIdx))
        ++endPtr;
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
    } else {
        var str = "";
        while (idx < endPtr) {
            var u0 = u8Array[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue
            }
            var u1 = u8Array[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue
            }
            var u2 = u8Array[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0)
            } else {
                var ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
        }
    }
    return str
}
function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0))
        return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx)
                break;
            outU8Array[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx)
                break;
            outU8Array[outIdx++] = 192 | u >> 6;
            outU8Array[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx)
                break;
            outU8Array[outIdx++] = 224 | u >> 12;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx)
                break;
            outU8Array[outIdx++] = 240 | u >> 18;
            outU8Array[outIdx++] = 128 | u >> 12 & 63;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
        }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}
function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343)
            u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127)
            ++len;
        else if (u <= 2047)
            len += 2;
        else if (u <= 65535)
            len += 3;
        else
            len += 4
    }
    return len
}
var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
function allocateUTF8(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = _malloc(size);
    if (ret)
        stringToUTF8Array(str, HEAP8, ret, size);
    return ret
}
function allocateUTF8OnStack(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8Array(str, HEAP8, ret, size);
    return ret
}
function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer)
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i)
    }
    if (!dontAddNull)
        HEAP8[buffer >> 0] = 0
}
function demangle(func) {
    return func
}
function demangleAll(text) {
    var regex = /__Z[\w\d_]+/g;
    return text.replace(regex, function(x) {
        var y = demangle(x);
        return x === y ? x : y + " [" + x + "]"
    })
}
function jsStackTrace() {
    var err = new Error;
    if (!err.stack) {
        try {
            throw new Error(0)
        } catch (e) {
            err = e
        }
        if (!err.stack) {
            return "(no stack trace available)"
        }
    }
    return err.stack.toString()
}
function stackTrace() {
    var js = jsStackTrace();
    if (Module["extraStackTrace"])
        js += "\n" + Module["extraStackTrace"]();
    return demangleAll(js)
}
var WASM_PAGE_SIZE = 65536;
function alignUp(x, multiple) {
    if (x % multiple > 0) {
        x += multiple - x % multiple
    }
    return x
}
var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
function updateGlobalBuffer(buf) {
    Module["buffer"] = buffer = buf
}
function updateGlobalBufferViews() {
    Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
    Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
    Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
    Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
    Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
    Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
    Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
}
var DYNAMIC_BASE = 100009696
  , DYNAMICTOP_PTR = 95815136;
var TOTAL_STACK = 4194304;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 134217728;
if (TOTAL_MEMORY < TOTAL_STACK)
    err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
if (Module["buffer"]) {
    buffer = Module["buffer"]
} else {
    if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
        wasmMemory = new WebAssembly.Memory({
            "initial": TOTAL_MEMORY / WASM_PAGE_SIZE
        });
        buffer = wasmMemory.buffer
    } else {
        buffer = new ArrayBuffer(TOTAL_MEMORY)
    }
    Module["buffer"] = buffer
}
updateGlobalBufferViews();
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
            callback();
            continue
        }
        var func = callback.func;
        if (typeof func === "number") {
            if (callback.arg === undefined) {
                Module["dynCall_v"](func)
            } else {
                Module["dynCall_vi"](func, callback.arg)
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg)
        }
    }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
    if (Module["preRun"]) {
        if (typeof Module["preRun"] == "function")
            Module["preRun"] = [Module["preRun"]];
        while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}
function ensureInitRuntime() {
    if (runtimeInitialized)
        return;
    runtimeInitialized = true;
    if (!Module["noFSInit"] && !FS.init.initialized)
        FS.init();
    TTY.init();
    SOCKFS.root = FS.mount(SOCKFS, {}, null);
    callRuntimeCallbacks(__ATINIT__)
}
function preMain() {
    FS.ignorePermissions = false;
    callRuntimeCallbacks(__ATMAIN__)
}
function exitRuntime() {
    runtimeExited = true
}
function postRun() {
    if (Module["postRun"]) {
        if (typeof Module["postRun"] == "function")
            Module["postRun"] = [Module["postRun"]];
        while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}
function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}
function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb)
}
function addOnExit(cb) {}
function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
function unSign(value, bits, ignore) {
    if (value >= 0) {
        return value
    }
    return bits <= 32 ? 2 * Math.abs(1 << bits - 1) + value : Math.pow(2, bits) + value
}
function reSign(value, bits, ignore) {
    if (value <= 0) {
        return value
    }
    var half = bits <= 32 ? Math.abs(1 << bits - 1) : Math.pow(2, bits - 1);
    if (value >= half && (bits <= 32 || value > half)) {
        value = -2 * half + value
    }
    return value
}
var Math_abs = Math.abs;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_min = Math.min;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function getUniqueRunDependency(id) {
    return id
}
function addRunDependency(id) {
    runDependencies++;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
}
function removeRunDependency(id) {
    runDependencies--;
    if (Module["monitorRunDependencies"]) {
        Module["monitorRunDependencies"](runDependencies)
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
    return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
}
var wasmBinaryFile = "index.wasm";
if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile)
}
function getBinary() {
    try {
        if (Module["wasmBinary"]) {
            return new Uint8Array(Module["wasmBinary"])
        }
        if (Module["readBinary"]) {
            return Module["readBinary"](wasmBinaryFile)
        } else {
            throw "both async and sync fetching of the wasm failed"
        }
    } catch (err) {
        abort(err)
    }
}
function getBinaryPromise() {
    if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
        return fetch(wasmBinaryFile, {
            credentials: "same-origin",
            mode: "cors",
            headers: {
                "Content-Type": "application/wasm"
            }
        }).then(function(response) {
            if (!response["ok"]) {
                throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
            }
            return response["arrayBuffer"]()
        }).catch(function() {
            return getBinary()
        })
    }
    return new Promise(function(resolve, reject) {
        resolve(getBinary())
    }
    )
}
function createWasm(env) {
    var info = {
        "env": env,
        "global": {
            "NaN": NaN,
            Infinity: Infinity
        },
        "global.Math": Math,
        "asm2wasm": asm2wasmImports
    };
    function receiveInstance(instance, module) {
        var exports = instance.exports;
        Module["asm"] = exports;
        removeRunDependency("wasm-instantiate")
    }
    addRunDependency("wasm-instantiate");
    if (Module["instantiateWasm"]) {
        try {
            return Module["instantiateWasm"](info, receiveInstance)
        } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
        }
    }
    function receiveInstantiatedSource(output) {
        receiveInstance(output["instance"])
    }
   
    
    return {}
}
Module["asm"] = function(global, env, providedBuffer) {
    env["memory"] = wasmMemory;
    env["table"] = wasmTable = new WebAssembly.Table({
        "initial": 1138,
        "maximum": 1138,
        "element": "anyfunc"
    });
    env["__memory_base"] = 1024;
    env["__table_base"] = 0;
    var exports = createWasm(env);
    return exports
}
;
var ASM_CONSTS = [function() {
    JS_OnGameplayStarted()
}
, function($0) {
    var str = UTF8ToString($0) + "\n\n" + "Abort/Retry/Ignore/AlwaysIgnore? [ariA] :";
    var reply = window.prompt(str, "i");
    if (reply === null) {
        reply = "i"
    }
    return allocate(intArrayFromString(reply), "i8", ALLOC_NORMAL)
}
, function() {
    if (typeof AudioContext !== "undefined") {
        return 1
    } else if (typeof webkitAudioContext !== "undefined") {
        return 1
    }
    return 0
}
, function() {
    if (typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia !== "undefined") {
        return 1
    } else if (typeof navigator.webkitGetUserMedia !== "undefined") {
        return 1
    }
    return 0
}
, function($0) {
    if (typeof SDL2 === "undefined") {
        SDL2 = {}
    }
    if (!$0) {
        SDL2.audio = {}
    } else {
        SDL2.capture = {}
    }
    if (!SDL2.audioContext) {
        if (typeof AudioContext !== "undefined") {
            SDL2.audioContext = new AudioContext
        } else if (typeof webkitAudioContext !== "undefined") {
            SDL2.audioContext = new webkitAudioContext
        }
    }
    return SDL2.audioContext === undefined ? -1 : 0
}
, function() {
    return SDL2.audioContext.sampleRate
}
, function($0, $1, $2, $3) {
    var have_microphone = function(stream) {
        if (SDL2.capture.silenceTimer !== undefined) {
            clearTimeout(SDL2.capture.silenceTimer);
            SDL2.capture.silenceTimer = undefined
        }
        SDL2.capture.mediaStreamNode = SDL2.audioContext.createMediaStreamSource(stream);
        SDL2.capture.scriptProcessorNode = SDL2.audioContext.createScriptProcessor($1, $0, 1);
        SDL2.capture.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {
            if (SDL2 === undefined || SDL2.capture === undefined) {
                return
            }
            audioProcessingEvent.outputBuffer.getChannelData(0).fill(0);
            SDL2.capture.currentCaptureBuffer = audioProcessingEvent.inputBuffer;
            Runtime.dynCall("vi", $2, [$3])
        }
        ;
        SDL2.capture.mediaStreamNode.connect(SDL2.capture.scriptProcessorNode);
        SDL2.capture.scriptProcessorNode.connect(SDL2.audioContext.destination);
        SDL2.capture.stream = stream
    };
    var no_microphone = function(error) {};
    SDL2.capture.silenceBuffer = SDL2.audioContext.createBuffer($0, $1, SDL2.audioContext.sampleRate);
    SDL2.capture.silenceBuffer.getChannelData(0).fill(0);
    var silence_callback = function() {
        SDL2.capture.currentCaptureBuffer = SDL2.capture.silenceBuffer;
        Runtime.dynCall("vi", $2, [$3])
    };
    SDL2.capture.silenceTimer = setTimeout(silence_callback, $1 / SDL2.audioContext.sampleRate * 1e3);
    if (navigator.mediaDevices !== undefined && navigator.mediaDevices.getUserMedia !== undefined) {
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        }).then(have_microphone).catch(no_microphone)
    } else if (navigator.webkitGetUserMedia !== undefined) {
        navigator.webkitGetUserMedia({
            audio: true,
            video: false
        }, have_microphone, no_microphone)
    }
}
, function($0, $1, $2, $3) {
    SDL2.audio.scriptProcessorNode = SDL2.audioContext["createScriptProcessor"]($1, 0, $0);
    SDL2.audio.scriptProcessorNode["onaudioprocess"] = function(e) {
        if (SDL2 === undefined || SDL2.audio === undefined) {
            return
        }
        SDL2.audio.currentOutputBuffer = e["outputBuffer"];
        Runtime.dynCall("vi", $2, [$3])
    }
    ;
    SDL2.audio.scriptProcessorNode["connect"](SDL2.audioContext["destination"])
}
, function($0) {
    if ($0) {
        if (SDL2.capture.silenceTimer !== undefined) {
            clearTimeout(SDL2.capture.silenceTimer)
        }
        if (SDL2.capture.stream !== undefined) {
            var tracks = SDL2.capture.stream.getAudioTracks();
            for (var i = 0; i < tracks.length; i++) {
                SDL2.capture.stream.removeTrack(tracks[i])
            }
            SDL2.capture.stream = undefined
        }
        if (SDL2.capture.scriptProcessorNode !== undefined) {
            SDL2.capture.scriptProcessorNode.onaudioprocess = function(audioProcessingEvent) {}
            ;
            SDL2.capture.scriptProcessorNode.disconnect();
            SDL2.capture.scriptProcessorNode = undefined
        }
        if (SDL2.capture.mediaStreamNode !== undefined) {
            SDL2.capture.mediaStreamNode.disconnect();
            SDL2.capture.mediaStreamNode = undefined
        }
        if (SDL2.capture.silenceBuffer !== undefined) {
            SDL2.capture.silenceBuffer = undefined
        }
        SDL2.capture = undefined
    } else {
        if (SDL2.audio.scriptProcessorNode != undefined) {
            SDL2.audio.scriptProcessorNode.disconnect();
            SDL2.audio.scriptProcessorNode = undefined
        }
        SDL2.audio = undefined
    }
    if (SDL2.audioContext !== undefined && SDL2.audio === undefined && SDL2.capture === undefined) {
        SDL2.audioContext.close();
        SDL2.audioContext = undefined
    }
}
, function($0, $1) {
    var numChannels = SDL2.capture.currentCaptureBuffer.numberOfChannels;
    for (var c = 0; c < numChannels; ++c) {
        var channelData = SDL2.capture.currentCaptureBuffer.getChannelData(c);
        if (channelData.length != $1) {
            throw "Web Audio capture buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!"
        }
        if (numChannels == 1) {
            for (var j = 0; j < $1; ++j) {
                setValue($0 + j * 4, channelData[j], "float")
            }
        } else {
            for (var j = 0; j < $1; ++j) {
                setValue($0 + (j * numChannels + c) * 4, channelData[j], "float")
            }
        }
    }
}
, function($0, $1) {
    var numChannels = SDL2.audio.currentOutputBuffer["numberOfChannels"];
    for (var c = 0; c < numChannels; ++c) {
        var channelData = SDL2.audio.currentOutputBuffer["getChannelData"](c);
        if (channelData.length != $1) {
            throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + $1 + " samples!"
        }
        for (var j = 0; j < $1; ++j) {
            channelData[j] = HEAPF32[$0 + (j * numChannels + c << 2) >> 2]
        }
    }
}
, function() {
    return screen.width
}
, function() {
    return screen.height
}
, function($0) {
    if (typeof Module["setWindowTitle"] !== "undefined") {
        Module["setWindowTitle"](UTF8ToString($0))
    }
    return 0
}
, function($0) {
    if (Module["canvas"]) {
        Module["canvas"].style["cursor"] = UTF8ToString($0)
    }
    return 0
}
, function() {
    if (Module["canvas"]) {
        Module["canvas"].style["cursor"] = "none"
    }
}
];
function _emscripten_asm_const_i(code) {
    return ASM_CONSTS[code]()
}
function _emscripten_asm_const_iiiii(code, a0, a1, a2, a3) {
    return ASM_CONSTS[code](a0, a1, a2, a3)
}
function _emscripten_asm_const_ii(code, a0) {
    return ASM_CONSTS[code](a0)
}
function _emscripten_asm_const_iii(code, a0, a1) {
    return ASM_CONSTS[code](a0, a1)
}
__ATINIT__.push({
    func: function() {
        ___emscripten_environ_constructor()
    }
});
function _emscripten_set_main_loop_timing(mode, value) {
    Browser.mainLoop.timingMode = mode;
    Browser.mainLoop.timingValue = value;
    if (!Browser.mainLoop.func) {
        return 1
    }
    if (mode == 0) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
            var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
            setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
        }
        ;
        Browser.mainLoop.method = "timeout"
    } else if (mode == 1) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
            Browser.requestAnimationFrame(Browser.mainLoop.runner)
        }
        ;
        Browser.mainLoop.method = "rAF"
    } else if (mode == 2) {
        if (typeof setImmediate === "undefined") {
            var setImmediates = [];
            var emscriptenMainLoopMessageId = "setimmediate";
            var Browser_setImmediate_messageHandler = function(event) {
                if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                    event.stopPropagation();
                    setImmediates.shift()()
                }
            };
            addEventListener("message", Browser_setImmediate_messageHandler, true);
            setImmediate = function Browser_emulated_setImmediate(func) {
                setImmediates.push(func);
                if (ENVIRONMENT_IS_WORKER) {
                    if (Module["setImmediates"] === undefined)
                        Module["setImmediates"] = [];
                    Module["setImmediates"].push(func);
                    postMessage({
                        target: emscriptenMainLoopMessageId
                    })
                } else
                    postMessage(emscriptenMainLoopMessageId, "*")
            }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
            setImmediate(Browser.mainLoop.runner)
        }
        ;
        Browser.mainLoop.method = "immediate"
    }
    return 0
}
function _emscripten_get_now() {
    abort()
}
function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
    Module["noExitRuntime"] = true;
    assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
    Browser.mainLoop.func = func;
    Browser.mainLoop.arg = arg;
    var browserIterationFunc;
    if (typeof arg !== "undefined") {
        browserIterationFunc = function() {
            Module["dynCall_vi"](func, arg)
        }
    } else {
        browserIterationFunc = function() {
            Module["dynCall_v"](func)
        }
    }
    var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
    Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT)
            return;
        if (Browser.mainLoop.queue.length > 0) {
            var start = Date.now();
            var blocker = Browser.mainLoop.queue.shift();
            blocker.func(blocker.arg);
            if (Browser.mainLoop.remainingBlockers) {
                var remaining = Browser.mainLoop.remainingBlockers;
                var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
                if (blocker.counted) {
                    Browser.mainLoop.remainingBlockers = next
                } else {
                    next = next + .5;
                    Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
                }
            }
            console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
            Browser.mainLoop.updateStatus();
            if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
                return;
            setTimeout(Browser.mainLoop.runner, 0);
            return
        }
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
            return;
        Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
        if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
            Browser.mainLoop.scheduler();
            return
        } else if (Browser.mainLoop.timingMode == 0) {
            Browser.mainLoop.tickStartTime = _emscripten_get_now()
        }
        if (Browser.mainLoop.method === "timeout" && Module.ctx) {
            err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
            Browser.mainLoop.method = ""
        }
        Browser.mainLoop.runIter(browserIterationFunc);
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop)
            return;
        if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData)
            SDL.audio.queueNewAudioData();
        Browser.mainLoop.scheduler()
    }
    ;
    if (!noSetTiming) {
        if (fps && fps > 0)
            _emscripten_set_main_loop_timing(0, 1e3 / fps);
        else
            _emscripten_set_main_loop_timing(1, 1);
        Browser.mainLoop.scheduler()
    }
    if (simulateInfiniteLoop) {
        throw "SimulateInfiniteLoop"
    }
}
var Browser = {
    mainLoop: {
        scheduler: null,
        method: "",
        currentlyRunningMainloop: 0,
        func: null,
        arg: 0,
        timingMode: 0,
        timingValue: 0,
        currentFrameNumber: 0,
        queue: [],
        pause: function() {
            Browser.mainLoop.scheduler = null;
            Browser.mainLoop.currentlyRunningMainloop++
        },
        resume: function() {
            Browser.mainLoop.currentlyRunningMainloop++;
            var timingMode = Browser.mainLoop.timingMode;
            var timingValue = Browser.mainLoop.timingValue;
            var func = Browser.mainLoop.func;
            Browser.mainLoop.func = null;
            _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
            _emscripten_set_main_loop_timing(timingMode, timingValue);
            Browser.mainLoop.scheduler()
        },
        updateStatus: function() {
            if (Module["setStatus"]) {
                var message = Module["statusMessage"] || "Please wait...";
                var remaining = Browser.mainLoop.remainingBlockers;
                var expected = Browser.mainLoop.expectedBlockers;
                if (remaining) {
                    if (remaining < expected) {
                        Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
                    } else {
                        Module["setStatus"](message)
                    }
                } else {
                    Module["setStatus"]("")
                }
            }
        },
        runIter: function(func) {
            if (ABORT)
                return;
            if (Module["preMainLoop"]) {
                var preRet = Module["preMainLoop"]();
                if (preRet === false) {
                    return
                }
            }
            try {
                func()
            } catch (e) {
                if (e instanceof ExitStatus) {
                    return
                } else {
                    if (e && typeof e === "object" && e.stack)
                        err("exception thrown: " + [e, e.stack]);
                    throw e
                }
            }
            if (Module["postMainLoop"])
                Module["postMainLoop"]()
        }
    },
    isFullscreen: false,
    pointerLock: false,
    moduleContextCreatedCallbacks: [],
    workers: [],
    init: function() {
        if (!Module["preloadPlugins"])
            Module["preloadPlugins"] = [];
        if (Browser.initted)
            return;
        Browser.initted = true;
        try {
            new Blob;
            Browser.hasBlobConstructor = true
        } catch (e) {
            Browser.hasBlobConstructor = false;
            console.log("warning: no blob constructor, cannot create blobs with mimetypes")
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
        Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
        if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
            console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
            Module.noImageDecoding = true
        }
        var imagePlugin = {};
        imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
            return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
        }
        ;
        imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
            var b = null;
            if (Browser.hasBlobConstructor) {
                try {
                    b = new Blob([byteArray],{
                        type: Browser.getMimetype(name)
                    });
                    if (b.size !== byteArray.length) {
                        b = new Blob([new Uint8Array(byteArray).buffer],{
                            type: Browser.getMimetype(name)
                        })
                    }
                } catch (e) {
                    warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
                }
            }
            if (!b) {
                var bb = new Browser.BlobBuilder;
                bb.append(new Uint8Array(byteArray).buffer);
                b = bb.getBlob()
            }
            var url = Browser.URLObject.createObjectURL(b);
            var img = new Image;
            img.onload = function img_onload() {
                assert(img.complete, "Image " + name + " could not be decoded");
                var canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);
                Module["preloadedImages"][name] = canvas;
                Browser.URLObject.revokeObjectURL(url);
                if (onload)
                    onload(byteArray)
            }
            ;
            img.onerror = function img_onerror(event) {
                console.log("Image " + url + " could not be decoded");
                if (onerror)
                    onerror()
            }
            ;
            img.src = url
        }
        ;
        Module["preloadPlugins"].push(imagePlugin);
        var audioPlugin = {};
        audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
            return !Module.noAudioDecoding && name.substr(-4)in {
                ".ogg": 1,
                ".wav": 1,
                ".mp3": 1
            }
        }
        ;
        audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
            var done = false;
            function finish(audio) {
                if (done)
                    return;
                done = true;
                Module["preloadedAudios"][name] = audio;
                if (onload)
                    onload(byteArray)
            }
            function fail() {
                if (done)
                    return;
                done = true;
                Module["preloadedAudios"][name] = new Audio;
                if (onerror)
                    onerror()
            }
            if (Browser.hasBlobConstructor) {
                try {
                    var b = new Blob([byteArray],{
                        type: Browser.getMimetype(name)
                    })
                } catch (e) {
                    return fail()
                }
                var url = Browser.URLObject.createObjectURL(b);
                var audio = new Audio;
                audio.addEventListener("canplaythrough", function() {
                    finish(audio)
                }, false);
                audio.onerror = function audio_onerror(event) {
                    if (done)
                        return;
                    console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
                    function encode64(data) {
                        var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                        var PAD = "=";
                        var ret = "";
                        var leftchar = 0;
                        var leftbits = 0;
                        for (var i = 0; i < data.length; i++) {
                            leftchar = leftchar << 8 | data[i];
                            leftbits += 8;
                            while (leftbits >= 6) {
                                var curr = leftchar >> leftbits - 6 & 63;
                                leftbits -= 6;
                                ret += BASE[curr]
                            }
                        }
                        if (leftbits == 2) {
                            ret += BASE[(leftchar & 3) << 4];
                            ret += PAD + PAD
                        } else if (leftbits == 4) {
                            ret += BASE[(leftchar & 15) << 2];
                            ret += PAD
                        }
                        return ret
                    }
                    audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
                    finish(audio)
                }
                ;
                audio.src = url;
                Browser.safeSetTimeout(function() {
                    finish(audio)
                }, 1e4)
            } else {
                return fail()
            }
        }
        ;
        Module["preloadPlugins"].push(audioPlugin);
        function pointerLockChange() {
            Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
        }
        var canvas = Module["canvas"];
        if (canvas) {
            canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function() {}
            ;
            canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function() {}
            ;
            canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
            document.addEventListener("pointerlockchange", pointerLockChange, false);
            document.addEventListener("mozpointerlockchange", pointerLockChange, false);
            document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
            document.addEventListener("mspointerlockchange", pointerLockChange, false);
            if (Module["elementPointerLock"]) {
                canvas.addEventListener("click", function(ev) {
                    if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
                        Module["canvas"].requestPointerLock();
                        ev.preventDefault()
                    }
                }, false)
            }
        }
    },
    createContext: function(canvas, useWebGL, setInModule, webGLContextAttributes) {
        if (useWebGL && Module.ctx && canvas == Module.canvas)
            return Module.ctx;
        var ctx;
        var contextHandle;
        if (useWebGL) {
            var contextAttributes = {
                antialias: false,
                alpha: false,
                majorVersion: 1
            };
            if (webGLContextAttributes) {
                for (var attribute in webGLContextAttributes) {
                    contextAttributes[attribute] = webGLContextAttributes[attribute]
                }
            }
            if (typeof GL !== "undefined") {
                contextHandle = GL.createContext(canvas, contextAttributes);
                if (contextHandle) {
                    ctx = GL.getContext(contextHandle).GLctx
                }
            }
        } else {
            ctx = canvas.getContext("2d")
        }
        if (!ctx)
            return null;
        if (setInModule) {
            if (!useWebGL)
                assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
            Module.ctx = ctx;
            if (useWebGL)
                GL.makeContextCurrent(contextHandle);
            Module.useWebGL = useWebGL;
            Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
                callback()
            });
            Browser.init()
        }
        return ctx
    },
    destroyContext: function(canvas, useWebGL, setInModule) {},
    fullscreenHandlersInstalled: false,
    lockPointer: undefined,
    resizeCanvas: undefined,
    requestFullscreen: function(lockPointer, resizeCanvas, vrDevice) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        Browser.vrDevice = vrDevice;
        if (typeof Browser.lockPointer === "undefined")
            Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === "undefined")
            Browser.resizeCanvas = false;
        if (typeof Browser.vrDevice === "undefined")
            Browser.vrDevice = null;
        var canvas = Module["canvas"];
        function fullscreenChange() {
            Browser.isFullscreen = false;
            var canvasContainer = canvas.parentNode;
            if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
                canvas.exitFullscreen = Browser.exitFullscreen;
                if (Browser.lockPointer)
                    canvas.requestPointerLock();
                Browser.isFullscreen = true;
                if (Browser.resizeCanvas) {
                    Browser.setFullscreenCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas)
                }
            } else {
                canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
                canvasContainer.parentNode.removeChild(canvasContainer);
                if (Browser.resizeCanvas) {
                    Browser.setWindowedCanvasSize()
                } else {
                    Browser.updateCanvasDimensions(canvas)
                }
            }
            if (Module["onFullScreen"])
                Module["onFullScreen"](Browser.isFullscreen);
            if (Module["onFullscreen"])
                Module["onFullscreen"](Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
            Browser.fullscreenHandlersInstalled = true;
            document.addEventListener("fullscreenchange", fullscreenChange, false);
            document.addEventListener("mozfullscreenchange", fullscreenChange, false);
            document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
            document.addEventListener("MSFullscreenChange", fullscreenChange, false)
        }
        var canvasContainer = document.createElement("div");
        canvas.parentNode.insertBefore(canvasContainer, canvas);
        canvasContainer.appendChild(canvas);
        canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function() {
            canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"])
        }
        : null) || (canvasContainer["webkitRequestFullScreen"] ? function() {
            canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
        }
        : null);
        if (vrDevice) {
            canvasContainer.requestFullscreen({
                vrDisplay: vrDevice
            })
        } else {
            canvasContainer.requestFullscreen()
        }
    },
    requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
        err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
        Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
        }
        ;
        return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
    },
    exitFullscreen: function() {
        if (!Browser.isFullscreen) {
            return false
        }
        var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function() {}
        ;
        CFS.apply(document, []);
        return true
    },
    nextRAF: 0,
    fakeRequestAnimationFrame: function(func) {
        var now = Date.now();
        if (Browser.nextRAF === 0) {
            Browser.nextRAF = now + 1e3 / 60
        } else {
            while (now + 2 >= Browser.nextRAF) {
                Browser.nextRAF += 1e3 / 60
            }
        }
        var delay = Math.max(Browser.nextRAF - now, 0);
        setTimeout(func, delay)
    },
    requestAnimationFrame: function requestAnimationFrame(func) {
        if (typeof window === "undefined") {
            Browser.fakeRequestAnimationFrame(func)
        } else {
            if (!window.requestAnimationFrame) {
                window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
            }
            window.requestAnimationFrame(func)
        }
    },
    safeCallback: function(func) {
        return function() {
            if (!ABORT)
                return func.apply(null, arguments)
        }
    },
    allowAsyncCallbacks: true,
    queuedAsyncCallbacks: [],
    pauseAsyncCallbacks: function() {
        Browser.allowAsyncCallbacks = false
    },
    resumeAsyncCallbacks: function() {
        Browser.allowAsyncCallbacks = true;
        if (Browser.queuedAsyncCallbacks.length > 0) {
            var callbacks = Browser.queuedAsyncCallbacks;
            Browser.queuedAsyncCallbacks = [];
            callbacks.forEach(function(func) {
                func()
            })
        }
    },
    safeRequestAnimationFrame: function(func) {
        return Browser.requestAnimationFrame(function() {
            if (ABORT)
                return;
            if (Browser.allowAsyncCallbacks) {
                func()
            } else {
                Browser.queuedAsyncCallbacks.push(func)
            }
        })
    },
    safeSetTimeout: function(func, timeout) {
        Module["noExitRuntime"] = true;
        return setTimeout(function() {
            if (ABORT)
                return;
            if (Browser.allowAsyncCallbacks) {
                func()
            } else {
                Browser.queuedAsyncCallbacks.push(func)
            }
        }, timeout)
    },
    safeSetInterval: function(func, timeout) {
        Module["noExitRuntime"] = true;
        return setInterval(function() {
            if (ABORT)
                return;
            if (Browser.allowAsyncCallbacks) {
                func()
            }
        }, timeout)
    },
    getMimetype: function(name) {
        return {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "bmp": "image/bmp",
            "ogg": "audio/ogg",
            "wav": "audio/wav",
            "mp3": "audio/mpeg"
        }[name.substr(name.lastIndexOf(".") + 1)]
    },
    getUserMedia: function(func) {
        if (!window.getUserMedia) {
            window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
        }
        window.getUserMedia(func)
    },
    getMovementX: function(event) {
        return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
    },
    getMovementY: function(event) {
        return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
    },
    getMouseWheelDelta: function(event) {
        var delta = 0;
        switch (event.type) {
        case "DOMMouseScroll":
            delta = event.detail / 3;
            break;
        case "mousewheel":
            delta = event.wheelDelta / 120;
            break;
        case "wheel":
            delta = event.deltaY;
            switch (event.deltaMode) {
            case 0:
                delta /= 100;
                break;
            case 1:
                delta /= 3;
                break;
            case 2:
                delta *= 80;
                break;
            default:
                throw "unrecognized mouse wheel delta mode: " + event.deltaMode
            }
            break;
        default:
            throw "unrecognized mouse wheel event: " + event.type
        }
        return delta
    },
    mouseX: 0,
    mouseY: 0,
    mouseMovementX: 0,
    mouseMovementY: 0,
    touches: {},
    lastTouches: {},
    calculateMouseEvent: function(event) {
        if (Browser.pointerLock) {
            if (event.type != "mousemove" && "mozMovementX"in event) {
                Browser.mouseMovementX = Browser.mouseMovementY = 0
            } else {
                Browser.mouseMovementX = Browser.getMovementX(event);
                Browser.mouseMovementY = Browser.getMovementY(event)
            }
            if (typeof SDL != "undefined") {
                Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
                Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
            } else {
                Browser.mouseX += Browser.mouseMovementX;
                Browser.mouseY += Browser.mouseMovementY
            }
        } else {
            var rect = Module["canvas"].getBoundingClientRect();
            var cw = Module["canvas"].width;
            var ch = Module["canvas"].height;
            var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
            var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
            if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
                var touch = event.touch;
                if (touch === undefined) {
                    return
                }
                var adjustedX = touch.pageX - (scrollX + rect.left);
                var adjustedY = touch.pageY - (scrollY + rect.top);
                adjustedX = adjustedX * (cw / rect.width);
                adjustedY = adjustedY * (ch / rect.height);
                var coords = {
                    x: adjustedX,
                    y: adjustedY
                };
                if (event.type === "touchstart") {
                    Browser.lastTouches[touch.identifier] = coords;
                    Browser.touches[touch.identifier] = coords
                } else if (event.type === "touchend" || event.type === "touchmove") {
                    var last = Browser.touches[touch.identifier];
                    if (!last)
                        last = coords;
                    Browser.lastTouches[touch.identifier] = last;
                    Browser.touches[touch.identifier] = coords
                }
                return
            }
            var x = event.pageX - (scrollX + rect.left);
            var y = event.pageY - (scrollY + rect.top);
            x = x * (cw / rect.width);
            y = y * (ch / rect.height);
            Browser.mouseMovementX = x - Browser.mouseX;
            Browser.mouseMovementY = y - Browser.mouseY;
            Browser.mouseX = x;
            Browser.mouseY = y
        }
    },
    asyncLoad: function(url, onload, onerror, noRunDep) {
        var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
        Module["readAsync"](url, function(arrayBuffer) {
            assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
            onload(new Uint8Array(arrayBuffer));
            if (dep)
                removeRunDependency(dep)
        }, function(event) {
            if (onerror) {
                onerror()
            } else {
                throw 'Loading data file "' + url + '" failed.'
            }
        });
        if (dep)
            addRunDependency(dep)
    },
    resizeListeners: [],
    updateResizeListeners: function() {
        var canvas = Module["canvas"];
        Browser.resizeListeners.forEach(function(listener) {
            listener(canvas.width, canvas.height)
        })
    },
    setCanvasSize: function(width, height, noUpdates) {
        var canvas = Module["canvas"];
        Browser.updateCanvasDimensions(canvas, width, height);
        if (!noUpdates)
            Browser.updateResizeListeners()
    },
    windowedWidth: 0,
    windowedHeight: 0,
    setFullscreenCanvasSize: function() {
        if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags | 8388608;
            HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners()
    },
    setWindowedCanvasSize: function() {
        if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags & ~8388608;
            HEAP32[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module["canvas"]);
        Browser.updateResizeListeners()
    },
    updateCanvasDimensions: function(canvas, wNative, hNative) {
        if (wNative && hNative) {
            canvas.widthNative = wNative;
            canvas.heightNative = hNative
        } else {
            wNative = canvas.widthNative;
            hNative = canvas.heightNative
        }
        var w = wNative;
        var h = hNative;
        if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
            if (w / h < Module["forcedAspectRatio"]) {
                w = Math.round(h * Module["forcedAspectRatio"])
            } else {
                h = Math.round(w / Module["forcedAspectRatio"])
            }
        }
        if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
            var factor = Math.min(screen.width / w, screen.height / h);
            w = Math.round(w * factor);
            h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
            if (canvas.width != w)
                canvas.width = w;
            if (canvas.height != h)
                canvas.height = h;
            if (typeof canvas.style != "undefined") {
                canvas.style.removeProperty("width");
                canvas.style.removeProperty("height")
            }
        } else {
            if (canvas.width != wNative)
                canvas.width = wNative;
            if (canvas.height != hNative)
                canvas.height = hNative;
            if (typeof canvas.style != "undefined") {
                if (w != wNative || h != hNative) {
                    canvas.style.setProperty("width", w + "px", "important");
                    canvas.style.setProperty("height", h + "px", "important")
                } else {
                    canvas.style.removeProperty("width");
                    canvas.style.removeProperty("height")
                }
            }
        }
    },
    wgetRequests: {},
    nextWgetRequestHandle: 0,
    getNextWgetRequestHandle: function() {
        var handle = Browser.nextWgetRequestHandle;
        Browser.nextWgetRequestHandle++;
        return handle
    }
};
function ___setErrNo(value) {
    if (Module["___errno_location"])
        HEAP32[Module["___errno_location"]() >> 2] = value;
    return value
}
var PATH = {
    splitPath: function(filename) {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
        return splitPathRe.exec(filename).slice(1)
    },
    normalizeArray: function(parts, allowAboveRoot) {
        var up = 0;
        for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
                parts.splice(i, 1)
            } else if (last === "..") {
                parts.splice(i, 1);
                up++
            } else if (up) {
                parts.splice(i, 1);
                up--
            }
        }
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..")
            }
        }
        return parts
    },
    normalize: function(path) {
        var isAbsolute = path.charAt(0) === "/"
          , trailingSlash = path.substr(-1) === "/";
        path = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p
        }), !isAbsolute).join("/");
        if (!path && !isAbsolute) {
            path = "."
        }
        if (path && trailingSlash) {
            path += "/"
        }
        return (isAbsolute ? "/" : "") + path
    },
    dirname: function(path) {
        var result = PATH.splitPath(path)
          , root = result[0]
          , dir = result[1];
        if (!root && !dir) {
            return "."
        }
        if (dir) {
            dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
    },
    basename: function(path) {
        if (path === "/")
            return "/";
        var lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1)
            return path;
        return path.substr(lastSlash + 1)
    },
    extname: function(path) {
        return PATH.splitPath(path)[3]
    },
    join: function() {
        var paths = Array.prototype.slice.call(arguments, 0);
        return PATH.normalize(paths.join("/"))
    },
    join2: function(l, r) {
        return PATH.normalize(l + "/" + r)
    },
    resolve: function() {
        var resolvedPath = ""
          , resolvedAbsolute = false;
        for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
                throw new TypeError("Arguments to path.resolve must be strings")
            } else if (!path) {
                return ""
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/"
        }
        resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
            return !!p
        }), !resolvedAbsolute).join("/");
        return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
    },
    relative: function(from, to) {
        from = PATH.resolve(from).substr(1);
        to = PATH.resolve(to).substr(1);
        function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
                if (arr[start] !== "")
                    break
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
                if (arr[end] !== "")
                    break
            }
            if (start > end)
                return [];
            return arr.slice(start, end - start + 1)
        }
        var fromParts = trim(from.split("/"));
        var toParts = trim(to.split("/"));
        var length = Math.min(fromParts.length, toParts.length);
        var samePartsLength = length;
        for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
                samePartsLength = i;
                break
            }
        }
        var outputParts = [];
        for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..")
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength));
        return outputParts.join("/")
    }
};
var TTY = {
    ttys: [],
    init: function() {},
    shutdown: function() {},
    register: function(dev, ops) {
        TTY.ttys[dev] = {
            input: [],
            output: [],
            ops: ops
        };
        FS.registerDevice(dev, TTY.stream_ops)
    },
    stream_ops: {
        open: function(stream) {
            var tty = TTY.ttys[stream.node.rdev];
            if (!tty) {
                throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            stream.tty = tty;
            stream.seekable = false
        },
        close: function(stream) {
            stream.tty.ops.flush(stream.tty)
        },
        flush: function(stream) {
            stream.tty.ops.flush(stream.tty)
        },
        read: function(stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.get_char) {
                throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
                var result;
                try {
                    result = stream.tty.ops.get_char(stream.tty)
                } catch (e) {
                    throw new FS.ErrnoError(ERRNO_CODES.EIO)
                }
                if (result === undefined && bytesRead === 0) {
                    throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                }
                if (result === null || result === undefined)
                    break;
                bytesRead++;
                buffer[offset + i] = result
            }
            if (bytesRead) {
                stream.node.timestamp = Date.now()
            }
            return bytesRead
        },
        write: function(stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.put_char) {
                throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            try {
                for (var i = 0; i < length; i++) {
                    stream.tty.ops.put_char(stream.tty, buffer[offset + i])
                }
            } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO)
            }
            if (length) {
                stream.node.timestamp = Date.now()
            }
            return i
        }
    },
    default_tty_ops: {
        get_char: function(tty) {
            if (!tty.input.length) {
                var result = null;
                if (ENVIRONMENT_IS_NODE) {
                    var BUFSIZE = 256;
                    var buf = new Buffer(BUFSIZE);
                    var bytesRead = 0;
                    var isPosixPlatform = process.platform != "win32";
                    var fd = process.stdin.fd;
                    if (isPosixPlatform) {
                        var usingDevice = false;
                        try {
                            fd = fs.openSync("/dev/stdin", "r");
                            usingDevice = true
                        } catch (e) {}
                    }
                    try {
                        bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null)
                    } catch (e) {
                        if (e.toString().indexOf("EOF") != -1)
                            bytesRead = 0;
                        else
                            throw e
                    }
                    if (usingDevice) {
                        fs.closeSync(fd)
                    }
                    if (bytesRead > 0) {
                        result = buf.slice(0, bytesRead).toString("utf-8")
                    } else {
                        result = null
                    }
                } else if (typeof window != "undefined" && typeof window.prompt == "function") {
                    result = window.prompt("Input: ");
                    if (result !== null) {
                        result += "\n"
                    }
                } else if (typeof readline == "function") {
                    result = readline();
                    if (result !== null) {
                        result += "\n"
                    }
                }
                if (!result) {
                    return null
                }
                tty.input = intArrayFromString(result, true)
            }
            return tty.input.shift()
        },
        put_char: function(tty, val) {
            if (val === null || val === 10) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        flush: function(tty) {
            if (tty.output && tty.output.length > 0) {
                out(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        }
    },
    default_tty1_ops: {
        put_char: function(tty, val) {
            if (val === null || val === 10) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            } else {
                if (val != 0)
                    tty.output.push(val)
            }
        },
        flush: function(tty) {
            if (tty.output && tty.output.length > 0) {
                err(UTF8ArrayToString(tty.output, 0));
                tty.output = []
            }
        }
    }
};
var MEMFS = {
    ops_table: null,
    mount: function(mount) {
        return MEMFS.createNode(null, "/", 16384 | 511, 0)
    },
    createNode: function(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        }
        if (!MEMFS.ops_table) {
            MEMFS.ops_table = {
                dir: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        lookup: MEMFS.node_ops.lookup,
                        mknod: MEMFS.node_ops.mknod,
                        rename: MEMFS.node_ops.rename,
                        unlink: MEMFS.node_ops.unlink,
                        rmdir: MEMFS.node_ops.rmdir,
                        readdir: MEMFS.node_ops.readdir,
                        symlink: MEMFS.node_ops.symlink
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek
                    }
                },
                file: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr
                    },
                    stream: {
                        llseek: MEMFS.stream_ops.llseek,
                        read: MEMFS.stream_ops.read,
                        write: MEMFS.stream_ops.write,
                        allocate: MEMFS.stream_ops.allocate,
                        mmap: MEMFS.stream_ops.mmap,
                        msync: MEMFS.stream_ops.msync
                    }
                },
                link: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr,
                        readlink: MEMFS.node_ops.readlink
                    },
                    stream: {}
                },
                chrdev: {
                    node: {
                        getattr: MEMFS.node_ops.getattr,
                        setattr: MEMFS.node_ops.setattr
                    },
                    stream: FS.chrdev_stream_ops
                }
            }
        }
        var node = FS.createNode(parent, name, mode, dev);
        if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {}
        } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null
        } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream
        } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream
        }
        node.timestamp = Date.now();
        if (parent) {
            parent.contents[name] = node
        }
        return node
    },
    getFileDataAsRegularArray: function(node) {
        if (node.contents && node.contents.subarray) {
            var arr = [];
            for (var i = 0; i < node.usedBytes; ++i)
                arr.push(node.contents[i]);
            return arr
        }
        return node.contents
    },
    getFileDataAsTypedArray: function(node) {
        if (!node.contents)
            return new Uint8Array;
        if (node.contents.subarray)
            return node.contents.subarray(0, node.usedBytes);
        return new Uint8Array(node.contents)
    },
    expandFileStorage: function(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0;
        if (prevCapacity >= newCapacity)
            return;
        var CAPACITY_DOUBLING_MAX = 1024 * 1024;
        newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
        if (prevCapacity != 0)
            newCapacity = Math.max(newCapacity, 256);
        var oldContents = node.contents;
        node.contents = new Uint8Array(newCapacity);
        if (node.usedBytes > 0)
            node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
        return
    },
    resizeFileStorage: function(node, newSize) {
        if (node.usedBytes == newSize)
            return;
        if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
            return
        }
        if (!node.contents || node.contents.subarray) {
            var oldContents = node.contents;
            node.contents = new Uint8Array(new ArrayBuffer(newSize));
            if (oldContents) {
                node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
            }
            node.usedBytes = newSize;
            return
        }
        if (!node.contents)
            node.contents = [];
        if (node.contents.length > newSize)
            node.contents.length = newSize;
        else
            while (node.contents.length < newSize)
                node.contents.push(0);
        node.usedBytes = newSize
    },
    node_ops: {
        getattr: function(node) {
            var attr = {};
            attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
            attr.ino = node.id;
            attr.mode = node.mode;
            attr.nlink = 1;
            attr.uid = 0;
            attr.gid = 0;
            attr.rdev = node.rdev;
            if (FS.isDir(node.mode)) {
                attr.size = 4096
            } else if (FS.isFile(node.mode)) {
                attr.size = node.usedBytes
            } else if (FS.isLink(node.mode)) {
                attr.size = node.link.length
            } else {
                attr.size = 0
            }
            attr.atime = new Date(node.timestamp);
            attr.mtime = new Date(node.timestamp);
            attr.ctime = new Date(node.timestamp);
            attr.blksize = 4096;
            attr.blocks = Math.ceil(attr.size / attr.blksize);
            return attr
        },
        setattr: function(node, attr) {
            if (attr.mode !== undefined) {
                node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
                node.timestamp = attr.timestamp
            }
            if (attr.size !== undefined) {
                MEMFS.resizeFileStorage(node, attr.size)
            }
        },
        lookup: function(parent, name) {
            throw FS.genericErrors[ERRNO_CODES.ENOENT]
        },
        mknod: function(parent, name, mode, dev) {
            return MEMFS.createNode(parent, name, mode, dev)
        },
        rename: function(old_node, new_dir, new_name) {
            if (FS.isDir(old_node.mode)) {
                var new_node;
                try {
                    new_node = FS.lookupNode(new_dir, new_name)
                } catch (e) {}
                if (new_node) {
                    for (var i in new_node.contents) {
                        throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
                    }
                }
            }
            delete old_node.parent.contents[old_node.name];
            old_node.name = new_name;
            new_dir.contents[new_name] = old_node;
            old_node.parent = new_dir
        },
        unlink: function(parent, name) {
            delete parent.contents[name]
        },
        rmdir: function(parent, name) {
            var node = FS.lookupNode(parent, name);
            for (var i in node.contents) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
            }
            delete parent.contents[name]
        },
        readdir: function(node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
                if (!node.contents.hasOwnProperty(key)) {
                    continue
                }
                entries.push(key)
            }
            return entries
        },
        symlink: function(parent, newname, oldpath) {
            var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
            node.link = oldpath;
            return node
        },
        readlink: function(node) {
            if (!FS.isLink(node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return node.link
        }
    },
    stream_ops: {
        read: function(stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= stream.node.usedBytes)
                return 0;
            var size = Math.min(stream.node.usedBytes - position, length);
            if (size > 8 && contents.subarray) {
                buffer.set(contents.subarray(position, position + size), offset)
            } else {
                for (var i = 0; i < size; i++)
                    buffer[offset + i] = contents[position + i]
            }
            return size
        },
        write: function(stream, buffer, offset, length, position, canOwn) {
            canOwn = false;
            if (!length)
                return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                if (canOwn) {
                    node.contents = buffer.subarray(offset, offset + length);
                    node.usedBytes = length;
                    return length
                } else if (node.usedBytes === 0 && position === 0) {
                    node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
                    node.usedBytes = length;
                    return length
                } else if (position + length <= node.usedBytes) {
                    node.contents.set(buffer.subarray(offset, offset + length), position);
                    return length
                }
            }
            MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray)
                node.contents.set(buffer.subarray(offset, offset + length), position);
            else {
                for (var i = 0; i < length; i++) {
                    node.contents[position + i] = buffer[offset + i]
                }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
        },
        llseek: function(stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                if (FS.isFile(stream.node.mode)) {
                    position += stream.node.usedBytes
                }
            }
            if (position < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
        },
        allocate: function(stream, offset, length) {
            MEMFS.expandFileStorage(stream.node, offset + length);
            stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
        },
        mmap: function(stream, buffer, offset, length, position, prot, flags) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            var ptr;
            var allocated;
            var contents = stream.node.contents;
            if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
                allocated = false;
                ptr = contents.byteOffset
            } else {
                if (position > 0 || position + length < stream.node.usedBytes) {
                    if (contents.subarray) {
                        contents = contents.subarray(position, position + length)
                    } else {
                        contents = Array.prototype.slice.call(contents, position, position + length)
                    }
                }
                allocated = true;
                ptr = _malloc(length);
                if (!ptr) {
                    throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
                }
                buffer.set(contents, ptr)
            }
            return {
                ptr: ptr,
                allocated: allocated
            }
        },
        msync: function(stream, buffer, offset, length, mmapFlags) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            if (mmapFlags & 2) {
                return 0
            }
            var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
            return 0
        }
    }
};
var IDBFS = {
    dbs: {},
    indexedDB: function() {
        if (typeof indexedDB !== "undefined")
            return indexedDB;
        var ret = null;
        if (typeof window === "object")
            ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
        assert(ret, "IDBFS used, but indexedDB not supported");
        return ret
    },
    DB_VERSION: 21,
    DB_STORE_NAME: "FILE_DATA",
    mount: function(mount) {
        return MEMFS.mount.apply(null, arguments)
    },
    syncfs: function(mount, populate, callback) {
        IDBFS.getLocalSet(mount, function(err, local) {
            if (err)
                return callback(err);
            IDBFS.getRemoteSet(mount, function(err, remote) {
                if (err)
                    return callback(err);
                var src = populate ? remote : local;
                var dst = populate ? local : remote;
                IDBFS.reconcile(src, dst, callback)
            })
        })
    },
    getDB: function(name, callback) {
        var db = IDBFS.dbs[name];
        if (db) {
            return callback(null, db)
        }
        var req;
        try {
            req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
        } catch (e) {
            return callback(e)
        }
        if (!req) {
            return callback("Unable to connect to IndexedDB")
        }
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            var transaction = e.target.transaction;
            var fileStore;
            if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
            } else {
                fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
            }
            if (!fileStore.indexNames.contains("timestamp")) {
                fileStore.createIndex("timestamp", "timestamp", {
                    unique: false
                })
            }
        }
        ;
        req.onsuccess = function() {
            db = req.result;
            IDBFS.dbs[name] = db;
            callback(null, db)
        }
        ;
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault()
        }
    },
    getLocalSet: function(mount, callback) {
        var entries = {};
        function isRealDir(p) {
            return p !== "." && p !== ".."
        }
        function toAbsolute(root) {
            return function(p) {
                return PATH.join2(root, p)
            }
        }
        var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
        while (check.length) {
            var path = check.pop();
            var stat;
            try {
                stat = FS.stat(path)
            } catch (e) {
                return callback(e)
            }
            if (FS.isDir(stat.mode)) {
                check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
            }
            entries[path] = {
                timestamp: stat.mtime
            }
        }
        return callback(null, {
            type: "local",
            entries: entries
        })
    },
    getRemoteSet: function(mount, callback) {
        var entries = {};
        IDBFS.getDB(mount.mountpoint, function(err, db) {
            if (err)
                return callback(err);
            try {
                var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
                transaction.onerror = function(e) {
                    callback(this.error);
                    e.preventDefault()
                }
                ;
                var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                var index = store.index("timestamp");
                index.openKeyCursor().onsuccess = function(event) {
                    var cursor = event.target.result;
                    if (!cursor) {
                        return callback(null, {
                            type: "remote",
                            db: db,
                            entries: entries
                        })
                    }
                    entries[cursor.primaryKey] = {
                        timestamp: cursor.key
                    };
                    cursor.continue()
                }
            } catch (e) {
                return callback(e)
            }
        })
    },
    loadLocalEntry: function(path, callback) {
        var stat, node;
        try {
            var lookup = FS.lookupPath(path);
            node = lookup.node;
            stat = FS.stat(path)
        } catch (e) {
            return callback(e)
        }
        if (FS.isDir(stat.mode)) {
            return callback(null, {
                timestamp: stat.mtime,
                mode: stat.mode
            })
        } else if (FS.isFile(stat.mode)) {
            node.contents = MEMFS.getFileDataAsTypedArray(node);
            return callback(null, {
                timestamp: stat.mtime,
                mode: stat.mode,
                contents: node.contents
            })
        } else {
            return callback(new Error("node type not supported"))
        }
    },
    storeLocalEntry: function(path, entry, callback) {
        try {
            if (FS.isDir(entry.mode)) {
                FS.mkdir(path, entry.mode)
            } else if (FS.isFile(entry.mode)) {
                FS.writeFile(path, entry.contents, {
                    canOwn: true
                })
            } else {
                return callback(new Error("node type not supported"))
            }
            FS.chmod(path, entry.mode);
            FS.utime(path, entry.timestamp, entry.timestamp)
        } catch (e) {
            return callback(e)
        }
        callback(null)
    },
    removeLocalEntry: function(path, callback) {
        try {
            var lookup = FS.lookupPath(path);
            var stat = FS.stat(path);
            if (FS.isDir(stat.mode)) {
                FS.rmdir(path)
            } else if (FS.isFile(stat.mode)) {
                FS.unlink(path)
            }
        } catch (e) {
            return callback(e)
        }
        callback(null)
    },
    loadRemoteEntry: function(store, path, callback) {
        var req = store.get(path);
        req.onsuccess = function(event) {
            callback(null, event.target.result)
        }
        ;
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault()
        }
    },
    storeRemoteEntry: function(store, path, entry, callback) {
        var req = store.put(entry, path);
        req.onsuccess = function() {
            callback(null)
        }
        ;
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault()
        }
    },
    removeRemoteEntry: function(store, path, callback) {
        var req = store.delete(path);
        req.onsuccess = function() {
            callback(null)
        }
        ;
        req.onerror = function(e) {
            callback(this.error);
            e.preventDefault()
        }
    },
    reconcile: function(src, dst, callback) {
        var total = 0;
        var create = [];
        Object.keys(src.entries).forEach(function(key) {
            var e = src.entries[key];
            var e2 = dst.entries[key];
            if (!e2 || e.timestamp > e2.timestamp) {
                create.push(key);
                total++
            }
        });
        var remove = [];
        Object.keys(dst.entries).forEach(function(key) {
            var e = dst.entries[key];
            var e2 = src.entries[key];
            if (!e2) {
                remove.push(key);
                total++
            }
        });
        if (!total) {
            return callback(null)
        }
        var errored = false;
        var completed = 0;
        var db = src.type === "remote" ? src.db : dst.db;
        var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
        var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
        function done(err) {
            if (err) {
                if (!done.errored) {
                    done.errored = true;
                    return callback(err)
                }
                return
            }
            if (++completed >= total) {
                return callback(null)
            }
        }
        transaction.onerror = function(e) {
            done(this.error);
            e.preventDefault()
        }
        ;
        create.sort().forEach(function(path) {
            if (dst.type === "local") {
                IDBFS.loadRemoteEntry(store, path, function(err, entry) {
                    if (err)
                        return done(err);
                    IDBFS.storeLocalEntry(path, entry, done)
                })
            } else {
                IDBFS.loadLocalEntry(path, function(err, entry) {
                    if (err)
                        return done(err);
                    IDBFS.storeRemoteEntry(store, path, entry, done)
                })
            }
        });
        remove.sort().reverse().forEach(function(path) {
            if (dst.type === "local") {
                IDBFS.removeLocalEntry(path, done)
            } else {
                IDBFS.removeRemoteEntry(store, path, done)
            }
        })
    }
};
var NODEFS = {
    isWindows: false,
    staticInit: function() {
        NODEFS.isWindows = !!process.platform.match(/^win/);
        var flags = process["binding"]("constants");
        if (flags["fs"]) {
            flags = flags["fs"]
        }
        NODEFS.flagsForNodeMap = {
            1024: flags["O_APPEND"],
            64: flags["O_CREAT"],
            128: flags["O_EXCL"],
            0: flags["O_RDONLY"],
            2: flags["O_RDWR"],
            4096: flags["O_SYNC"],
            512: flags["O_TRUNC"],
            1: flags["O_WRONLY"]
        }
    },
    bufferFrom: function(arrayBuffer) {
        return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
    },
    mount: function(mount) {
        assert(ENVIRONMENT_IS_NODE);
        return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
    },
    createNode: function(parent, name, mode, dev) {
        if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
        var node = FS.createNode(parent, name, mode);
        node.node_ops = NODEFS.node_ops;
        node.stream_ops = NODEFS.stream_ops;
        return node
    },
    getMode: function(path) {
        var stat;
        try {
            stat = fs.lstatSync(path);
            if (NODEFS.isWindows) {
                stat.mode = stat.mode | (stat.mode & 292) >> 2
            }
        } catch (e) {
            if (!e.code)
                throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code])
        }
        return stat.mode
    },
    realPath: function(node) {
        var parts = [];
        while (node.parent !== node) {
            parts.push(node.name);
            node = node.parent
        }
        parts.push(node.mount.opts.root);
        parts.reverse();
        return PATH.join.apply(null, parts)
    },
    flagsForNode: function(flags) {
        flags &= ~2097152;
        flags &= ~2048;
        flags &= ~32768;
        flags &= ~524288;
        var newFlags = 0;
        for (var k in NODEFS.flagsForNodeMap) {
            if (flags & k) {
                newFlags |= NODEFS.flagsForNodeMap[k];
                flags ^= k
            }
        }
        if (!flags) {
            return newFlags
        } else {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
        }
    },
    node_ops: {
        getattr: function(node) {
            var path = NODEFS.realPath(node);
            var stat;
            try {
                stat = fs.lstatSync(path)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            if (NODEFS.isWindows && !stat.blksize) {
                stat.blksize = 4096
            }
            if (NODEFS.isWindows && !stat.blocks) {
                stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
            }
            return {
                dev: stat.dev,
                ino: stat.ino,
                mode: stat.mode,
                nlink: stat.nlink,
                uid: stat.uid,
                gid: stat.gid,
                rdev: stat.rdev,
                size: stat.size,
                atime: stat.atime,
                mtime: stat.mtime,
                ctime: stat.ctime,
                blksize: stat.blksize,
                blocks: stat.blocks
            }
        },
        setattr: function(node, attr) {
            var path = NODEFS.realPath(node);
            try {
                if (attr.mode !== undefined) {
                    fs.chmodSync(path, attr.mode);
                    node.mode = attr.mode
                }
                if (attr.timestamp !== undefined) {
                    var date = new Date(attr.timestamp);
                    fs.utimesSync(path, date, date)
                }
                if (attr.size !== undefined) {
                    fs.truncateSync(path, attr.size)
                }
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        lookup: function(parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            var mode = NODEFS.getMode(path);
            return NODEFS.createNode(parent, name, mode)
        },
        mknod: function(parent, name, mode, dev) {
            var node = NODEFS.createNode(parent, name, mode, dev);
            var path = NODEFS.realPath(node);
            try {
                if (FS.isDir(node.mode)) {
                    fs.mkdirSync(path, node.mode)
                } else {
                    fs.writeFileSync(path, "", {
                        mode: node.mode
                    })
                }
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            return node
        },
        rename: function(oldNode, newDir, newName) {
            var oldPath = NODEFS.realPath(oldNode);
            var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
            try {
                fs.renameSync(oldPath, newPath)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        unlink: function(parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
                fs.unlinkSync(path)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        rmdir: function(parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
                fs.rmdirSync(path)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        readdir: function(node) {
            var path = NODEFS.realPath(node);
            try {
                return fs.readdirSync(path)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        symlink: function(parent, newName, oldPath) {
            var newPath = PATH.join2(NODEFS.realPath(parent), newName);
            try {
                fs.symlinkSync(oldPath, newPath)
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        readlink: function(node) {
            var path = NODEFS.realPath(node);
            try {
                path = fs.readlinkSync(path);
                path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
                return path
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        }
    },
    stream_ops: {
        open: function(stream) {
            var path = NODEFS.realPath(stream.node);
            try {
                if (FS.isFile(stream.node.mode)) {
                    stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
                }
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        close: function(stream) {
            try {
                if (FS.isFile(stream.node.mode) && stream.nfd) {
                    fs.closeSync(stream.nfd)
                }
            } catch (e) {
                if (!e.code)
                    throw e;
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        read: function(stream, buffer, offset, length, position) {
            if (length === 0)
                return 0;
            try {
                return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        write: function(stream, buffer, offset, length, position) {
            try {
                return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
        },
        llseek: function(stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                if (FS.isFile(stream.node.mode)) {
                    try {
                        var stat = fs.fstatSync(stream.nfd);
                        position += stat.size
                    } catch (e) {
                        throw new FS.ErrnoError(ERRNO_CODES[e.code])
                    }
                }
            }
            if (position < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
        }
    }
};
var WORKERFS = {
    DIR_MODE: 16895,
    FILE_MODE: 33279,
    reader: null,
    mount: function(mount) {
        assert(ENVIRONMENT_IS_WORKER);
        if (!WORKERFS.reader)
            WORKERFS.reader = new FileReaderSync;
        var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
        var createdParents = {};
        function ensureParent(path) {
            var parts = path.split("/");
            var parent = root;
            for (var i = 0; i < parts.length - 1; i++) {
                var curr = parts.slice(0, i + 1).join("/");
                if (!createdParents[curr]) {
                    createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
                }
                parent = createdParents[curr]
            }
            return parent
        }
        function base(path) {
            var parts = path.split("/");
            return parts[parts.length - 1]
        }
        Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
            WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
        });
        (mount.opts["blobs"] || []).forEach(function(obj) {
            WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
        });
        (mount.opts["packages"] || []).forEach(function(pack) {
            pack["metadata"].files.forEach(function(file) {
                var name = file.filename.substr(1);
                WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
            })
        });
        return root
    },
    createNode: function(parent, name, mode, dev, contents, mtime) {
        var node = FS.createNode(parent, name, mode);
        node.mode = mode;
        node.node_ops = WORKERFS.node_ops;
        node.stream_ops = WORKERFS.stream_ops;
        node.timestamp = (mtime || new Date).getTime();
        assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
        if (mode === WORKERFS.FILE_MODE) {
            node.size = contents.size;
            node.contents = contents
        } else {
            node.size = 4096;
            node.contents = {}
        }
        if (parent) {
            parent.contents[name] = node
        }
        return node
    },
    node_ops: {
        getattr: function(node) {
            return {
                dev: 1,
                ino: undefined,
                mode: node.mode,
                nlink: 1,
                uid: 0,
                gid: 0,
                rdev: undefined,
                size: node.size,
                atime: new Date(node.timestamp),
                mtime: new Date(node.timestamp),
                ctime: new Date(node.timestamp),
                blksize: 4096,
                blocks: Math.ceil(node.size / 4096)
            }
        },
        setattr: function(node, attr) {
            if (attr.mode !== undefined) {
                node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
                node.timestamp = attr.timestamp
            }
        },
        lookup: function(parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
        },
        mknod: function(parent, name, mode, dev) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        },
        rename: function(oldNode, newDir, newName) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        },
        unlink: function(parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        },
        rmdir: function(parent, name) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        },
        readdir: function(node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
                if (!node.contents.hasOwnProperty(key)) {
                    continue
                }
                entries.push(key)
            }
            return entries
        },
        symlink: function(parent, newName, oldPath) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        },
        readlink: function(node) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
        }
    },
    stream_ops: {
        read: function(stream, buffer, offset, length, position) {
            if (position >= stream.node.size)
                return 0;
            var chunk = stream.node.contents.slice(position, position + length);
            var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
            buffer.set(new Uint8Array(ab), offset);
            return chunk.size
        },
        write: function(stream, buffer, offset, length, position) {
            throw new FS.ErrnoError(ERRNO_CODES.EIO)
        },
        llseek: function(stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
                position += stream.position
            } else if (whence === 2) {
                if (FS.isFile(stream.node.mode)) {
                    position += stream.node.size
                }
            }
            if (position < 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
        }
    }
};
var FS = {
    root: null,
    mounts: [],
    devices: {},
    streams: [],
    nextInode: 1,
    nameTable: null,
    currentPath: "/",
    initialized: false,
    ignorePermissions: true,
    trackingDelegate: {},
    tracking: {
        openFlags: {
            READ: 1,
            WRITE: 2
        }
    },
    ErrnoError: null,
    genericErrors: {},
    filesystems: null,
    syncFSRequests: 0,
    handleFSError: function(e) {
        if (!(e instanceof FS.ErrnoError))
            throw e + " : " + stackTrace();
        return ___setErrNo(e.errno)
    },
    lookupPath: function(path, opts) {
        path = PATH.resolve(FS.cwd(), path);
        opts = opts || {};
        if (!path)
            return {
                path: "",
                node: null
            };
        var defaults = {
            follow_mount: true,
            recurse_count: 0
        };
        for (var key in defaults) {
            if (opts[key] === undefined) {
                opts[key] = defaults[key]
            }
        }
        if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(40)
        }
        var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
            return !!p
        }), false);
        var current = FS.root;
        var current_path = "/";
        for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
                break
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
                if (!islast || islast && opts.follow_mount) {
                    current = current.mounted.root
                }
            }
            if (!islast || opts.follow) {
                var count = 0;
                while (FS.isLink(current.mode)) {
                    var link = FS.readlink(current_path);
                    current_path = PATH.resolve(PATH.dirname(current_path), link);
                    var lookup = FS.lookupPath(current_path, {
                        recurse_count: opts.recurse_count
                    });
                    current = lookup.node;
                    if (count++ > 40) {
                        throw new FS.ErrnoError(40)
                    }
                }
            }
        }
        return {
            path: current_path,
            node: current
        }
    },
    getPath: function(node) {
        var path;
        while (true) {
            if (FS.isRoot(node)) {
                var mount = node.mount.mountpoint;
                if (!path)
                    return mount;
                return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent
        }
    },
    hashName: function(parentid, name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0
        }
        return (parentid + hash >>> 0) % FS.nameTable.length
    },
    hashAddNode: function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        node.name_next = FS.nameTable[hash];
        FS.nameTable[hash] = node
    },
    hashRemoveNode: function(node) {
        var hash = FS.hashName(node.parent.id, node.name);
        if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next
        } else {
            var current = FS.nameTable[hash];
            while (current) {
                if (current.name_next === node) {
                    current.name_next = node.name_next;
                    break
                }
                current = current.name_next
            }
        }
    },
    lookupNode: function(parent, name) {
        var err = FS.mayLookup(parent);
        if (err) {
            throw new FS.ErrnoError(err,parent)
        }
        var hash = FS.hashName(parent.id, name);
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
                return node
            }
        }
        return FS.lookup(parent, name)
    },
    createNode: function(parent, name, mode, rdev) {
        if (!FS.FSNode) {
            FS.FSNode = function(parent, name, mode, rdev) {
                if (!parent) {
                    parent = this
                }
                this.parent = parent;
                this.mount = parent.mount;
                this.mounted = null;
                this.id = FS.nextInode++;
                this.name = name;
                this.mode = mode;
                this.node_ops = {};
                this.stream_ops = {};
                this.rdev = rdev
            }
            ;
            FS.FSNode.prototype = {};
            var readMode = 292 | 73;
            var writeMode = 146;
            Object.defineProperties(FS.FSNode.prototype, {
                read: {
                    get: function() {
                        return (this.mode & readMode) === readMode
                    },
                    set: function(val) {
                        val ? this.mode |= readMode : this.mode &= ~readMode
                    }
                },
                write: {
                    get: function() {
                        return (this.mode & writeMode) === writeMode
                    },
                    set: function(val) {
                        val ? this.mode |= writeMode : this.mode &= ~writeMode
                    }
                },
                isFolder: {
                    get: function() {
                        return FS.isDir(this.mode)
                    }
                },
                isDevice: {
                    get: function() {
                        return FS.isChrdev(this.mode)
                    }
                }
            })
        }
        var node = new FS.FSNode(parent,name,mode,rdev);
        FS.hashAddNode(node);
        return node
    },
    destroyNode: function(node) {
        FS.hashRemoveNode(node)
    },
    isRoot: function(node) {
        return node === node.parent
    },
    isMountpoint: function(node) {
        return !!node.mounted
    },
    isFile: function(mode) {
        return (mode & 61440) === 32768
    },
    isDir: function(mode) {
        return (mode & 61440) === 16384
    },
    isLink: function(mode) {
        return (mode & 61440) === 40960
    },
    isChrdev: function(mode) {
        return (mode & 61440) === 8192
    },
    isBlkdev: function(mode) {
        return (mode & 61440) === 24576
    },
    isFIFO: function(mode) {
        return (mode & 61440) === 4096
    },
    isSocket: function(mode) {
        return (mode & 49152) === 49152
    },
    flagModes: {
        "r": 0,
        "rs": 1052672,
        "r+": 2,
        "w": 577,
        "wx": 705,
        "xw": 705,
        "w+": 578,
        "wx+": 706,
        "xw+": 706,
        "a": 1089,
        "ax": 1217,
        "xa": 1217,
        "a+": 1090,
        "ax+": 1218,
        "xa+": 1218
    },
    modeStringToFlags: function(str) {
        var flags = FS.flagModes[str];
        if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str)
        }
        return flags
    },
    flagsToPermissionString: function(flag) {
        var perms = ["r", "w", "rw"][flag & 3];
        if (flag & 512) {
            perms += "w"
        }
        return perms
    },
    nodePermissions: function(node, perms) {
        if (FS.ignorePermissions) {
            return 0
        }
        if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
            return 13
        } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
            return 13
        } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
            return 13
        }
        return 0
    },
    mayLookup: function(dir) {
        var err = FS.nodePermissions(dir, "x");
        if (err)
            return err;
        if (!dir.node_ops.lookup)
            return 13;
        return 0
    },
    mayCreate: function(dir, name) {
        try {
            var node = FS.lookupNode(dir, name);
            return 17
        } catch (e) {}
        return FS.nodePermissions(dir, "wx")
    },
    mayDelete: function(dir, name, isdir) {
        var node;
        try {
            node = FS.lookupNode(dir, name)
        } catch (e) {
            return e.errno
        }
        var err = FS.nodePermissions(dir, "wx");
        if (err) {
            return err
        }
        if (isdir) {
            if (!FS.isDir(node.mode)) {
                return 20
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                return 16
            }
        } else {
            if (FS.isDir(node.mode)) {
                return 21
            }
        }
        return 0
    },
    mayOpen: function(node, flags) {
        if (!node) {
            return 2
        }
        if (FS.isLink(node.mode)) {
            return 40
        } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                return 21
            }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
    },
    MAX_OPEN_FDS: 4096,
    nextfd: function(fd_start, fd_end) {
        fd_start = fd_start || 0;
        fd_end = fd_end || FS.MAX_OPEN_FDS;
        for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
                return fd
            }
        }
        throw new FS.ErrnoError(24)
    },
    getStream: function(fd) {
        return FS.streams[fd]
    },
    createStream: function(stream, fd_start, fd_end) {
        if (!FS.FSStream) {
            FS.FSStream = function() {}
            ;
            FS.FSStream.prototype = {};
            Object.defineProperties(FS.FSStream.prototype, {
                object: {
                    get: function() {
                        return this.node
                    },
                    set: function(val) {
                        this.node = val
                    }
                },
                isRead: {
                    get: function() {
                        return (this.flags & 2097155) !== 1
                    }
                },
                isWrite: {
                    get: function() {
                        return (this.flags & 2097155) !== 0
                    }
                },
                isAppend: {
                    get: function() {
                        return this.flags & 1024
                    }
                }
            })
        }
        var newStream = new FS.FSStream;
        for (var p in stream) {
            newStream[p] = stream[p]
        }
        stream = newStream;
        var fd = FS.nextfd(fd_start, fd_end);
        stream.fd = fd;
        FS.streams[fd] = stream;
        return stream
    },
    closeStream: function(fd) {
        FS.streams[fd] = null
    },
    chrdev_stream_ops: {
        open: function(stream) {
            var device = FS.getDevice(stream.node.rdev);
            stream.stream_ops = device.stream_ops;
            if (stream.stream_ops.open) {
                stream.stream_ops.open(stream)
            }
        },
        llseek: function() {
            throw new FS.ErrnoError(29)
        }
    },
    major: function(dev) {
        return dev >> 8
    },
    minor: function(dev) {
        return dev & 255
    },
    makedev: function(ma, mi) {
        return ma << 8 | mi
    },
    registerDevice: function(dev, ops) {
        FS.devices[dev] = {
            stream_ops: ops
        }
    },
    getDevice: function(dev) {
        return FS.devices[dev]
    },
    getMounts: function(mount) {
        var mounts = [];
        var check = [mount];
        while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts)
        }
        return mounts
    },
    syncfs: function(populate, callback) {
        if (typeof populate === "function") {
            callback = populate;
            populate = false
        }
        FS.syncFSRequests++;
        if (FS.syncFSRequests > 1) {
            console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
        }
        var mounts = FS.getMounts(FS.root.mount);
        var completed = 0;
        function doCallback(err) {
            FS.syncFSRequests--;
            return callback(err)
        }
        function done(err) {
            if (err) {
                if (!done.errored) {
                    done.errored = true;
                    return doCallback(err)
                }
                return
            }
            if (++completed >= mounts.length) {
                doCallback(null)
            }
        }
        mounts.forEach(function(mount) {
            if (!mount.type.syncfs) {
                return done(null)
            }
            mount.type.syncfs(mount, populate, done)
        })
    },
    mount: function(type, opts, mountpoint) {
        var root = mountpoint === "/";
        var pseudo = !mountpoint;
        var node;
        if (root && FS.root) {
            throw new FS.ErrnoError(16)
        } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, {
                follow_mount: false
            });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
                throw new FS.ErrnoError(16)
            }
            if (!FS.isDir(node.mode)) {
                throw new FS.ErrnoError(20)
            }
        }
        var mount = {
            type: type,
            opts: opts,
            mountpoint: mountpoint,
            mounts: []
        };
        var mountRoot = type.mount(mount);
        mountRoot.mount = mount;
        mount.root = mountRoot;
        if (root) {
            FS.root = mountRoot
        } else if (node) {
            node.mounted = mount;
            if (node.mount) {
                node.mount.mounts.push(mount)
            }
        }
        return mountRoot
    },
    unmount: function(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
        });
        if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(22)
        }
        var node = lookup.node;
        var mount = node.mounted;
        var mounts = FS.getMounts(mount);
        Object.keys(FS.nameTable).forEach(function(hash) {
            var current = FS.nameTable[hash];
            while (current) {
                var next = current.name_next;
                if (mounts.indexOf(current.mount) !== -1) {
                    FS.destroyNode(current)
                }
                current = next
            }
        });
        node.mounted = null;
        var idx = node.mount.mounts.indexOf(mount);
        node.mount.mounts.splice(idx, 1)
    },
    lookup: function(parent, name) {
        return parent.node_ops.lookup(parent, name)
    },
    mknod: function(path, mode, dev) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(22)
        }
        var err = FS.mayCreate(parent, name);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(1)
        }
        return parent.node_ops.mknod(parent, name, mode, dev)
    },
    create: function(path, mode) {
        mode = mode !== undefined ? mode : 438;
        mode &= 4095;
        mode |= 32768;
        return FS.mknod(path, mode, 0)
    },
    mkdir: function(path, mode) {
        mode = mode !== undefined ? mode : 511;
        mode &= 511 | 512;
        mode |= 16384;
        return FS.mknod(path, mode, 0)
    },
    mkdirTree: function(path, mode) {
        var dirs = path.split("/");
        var d = "";
        for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i])
                continue;
            d += "/" + dirs[i];
            try {
                FS.mkdir(d, mode)
            } catch (e) {
                if (e.errno != 17)
                    throw e
            }
        }
    },
    mkdev: function(path, mode, dev) {
        if (typeof dev === "undefined") {
            dev = mode;
            mode = 438
        }
        mode |= 8192;
        return FS.mknod(path, mode, dev)
    },
    symlink: function(oldpath, newpath) {
        if (!PATH.resolve(oldpath)) {
            throw new FS.ErrnoError(2)
        }
        var lookup = FS.lookupPath(newpath, {
            parent: true
        });
        var parent = lookup.node;
        if (!parent) {
            throw new FS.ErrnoError(2)
        }
        var newname = PATH.basename(newpath);
        var err = FS.mayCreate(parent, newname);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(1)
        }
        return parent.node_ops.symlink(parent, newname, oldpath)
    },
    rename: function(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path);
        var new_dirname = PATH.dirname(new_path);
        var old_name = PATH.basename(old_path);
        var new_name = PATH.basename(new_path);
        var lookup, old_dir, new_dir;
        try {
            lookup = FS.lookupPath(old_path, {
                parent: true
            });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, {
                parent: true
            });
            new_dir = lookup.node
        } catch (e) {
            throw new FS.ErrnoError(16)
        }
        if (!old_dir || !new_dir)
            throw new FS.ErrnoError(2);
        if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(18)
        }
        var old_node = FS.lookupNode(old_dir, old_name);
        var relative = PATH.relative(old_path, new_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(22)
        }
        relative = PATH.relative(new_path, old_dirname);
        if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(39)
        }
        var new_node;
        try {
            new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        if (old_node === new_node) {
            return
        }
        var isdir = FS.isDir(old_node.mode);
        var err = FS.mayDelete(old_dir, old_name, isdir);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(1)
        }
        if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(16)
        }
        if (new_dir !== old_dir) {
            err = FS.nodePermissions(old_dir, "w");
            if (err) {
                throw new FS.ErrnoError(err)
            }
        }
        try {
            if (FS.trackingDelegate["willMovePath"]) {
                FS.trackingDelegate["willMovePath"](old_path, new_path)
            }
        } catch (e) {
            console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
        }
        FS.hashRemoveNode(old_node);
        try {
            old_dir.node_ops.rename(old_node, new_dir, new_name)
        } catch (e) {
            throw e
        } finally {
            FS.hashAddNode(old_node)
        }
        try {
            if (FS.trackingDelegate["onMovePath"])
                FS.trackingDelegate["onMovePath"](old_path, new_path)
        } catch (e) {
            console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
        }
    },
    rmdir: function(path) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, true);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(1)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
        }
        try {
            if (FS.trackingDelegate["willDeletePath"]) {
                FS.trackingDelegate["willDeletePath"](path)
            }
        } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
        }
        parent.node_ops.rmdir(parent, name);
        FS.destroyNode(node);
        try {
            if (FS.trackingDelegate["onDeletePath"])
                FS.trackingDelegate["onDeletePath"](path)
        } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
        }
    },
    readdir: function(path) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        var node = lookup.node;
        if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(20)
        }
        return node.node_ops.readdir(node)
    },
    unlink: function(path) {
        var lookup = FS.lookupPath(path, {
            parent: true
        });
        var parent = lookup.node;
        var name = PATH.basename(path);
        var node = FS.lookupNode(parent, name);
        var err = FS.mayDelete(parent, name, false);
        if (err) {
            throw new FS.ErrnoError(err)
        }
        if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(1)
        }
        if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
        }
        try {
            if (FS.trackingDelegate["willDeletePath"]) {
                FS.trackingDelegate["willDeletePath"](path)
            }
        } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
        }
        parent.node_ops.unlink(parent, name);
        FS.destroyNode(node);
        try {
            if (FS.trackingDelegate["onDeletePath"])
                FS.trackingDelegate["onDeletePath"](path)
        } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
        }
    },
    readlink: function(path) {
        var lookup = FS.lookupPath(path);
        var link = lookup.node;
        if (!link) {
            throw new FS.ErrnoError(2)
        }
        if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(22)
        }
        return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
    },
    stat: function(path, dontFollow) {
        var lookup = FS.lookupPath(path, {
            follow: !dontFollow
        });
        var node = lookup.node;
        if (!node) {
            throw new FS.ErrnoError(2)
        }
        if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(1)
        }
        return node.node_ops.getattr(node)
    },
    lstat: function(path) {
        return FS.stat(path, true)
    },
    chmod: function(path, mode, dontFollow) {
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                follow: !dontFollow
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
        }
        node.node_ops.setattr(node, {
            mode: mode & 4095 | node.mode & ~4095,
            timestamp: Date.now()
        })
    },
    lchmod: function(path, mode) {
        FS.chmod(path, mode, true)
    },
    fchmod: function(fd, mode) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(9)
        }
        FS.chmod(stream.node, mode)
    },
    chown: function(path, uid, gid, dontFollow) {
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                follow: !dontFollow
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
        }
        node.node_ops.setattr(node, {
            timestamp: Date.now()
        })
    },
    lchown: function(path, uid, gid) {
        FS.chown(path, uid, gid, true)
    },
    fchown: function(fd, uid, gid) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(9)
        }
        FS.chown(stream.node, uid, gid)
    },
    truncate: function(path, len) {
        if (len < 0) {
            throw new FS.ErrnoError(22)
        }
        var node;
        if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
                follow: true
            });
            node = lookup.node
        } else {
            node = path
        }
        if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
        }
        if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(21)
        }
        if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(22)
        }
        var err = FS.nodePermissions(node, "w");
        if (err) {
            throw new FS.ErrnoError(err)
        }
        node.node_ops.setattr(node, {
            size: len,
            timestamp: Date.now()
        })
    },
    ftruncate: function(fd, len) {
        var stream = FS.getStream(fd);
        if (!stream) {
            throw new FS.ErrnoError(9)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(22)
        }
        FS.truncate(stream.node, len)
    },
    utime: function(path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        var node = lookup.node;
        node.node_ops.setattr(node, {
            timestamp: Math.max(atime, mtime)
        })
    },
    open: function(path, flags, mode, fd_start, fd_end) {
        if (path === "") {
            throw new FS.ErrnoError(2)
        }
        flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
        mode = typeof mode === "undefined" ? 438 : mode;
        if (flags & 64) {
            mode = mode & 4095 | 32768
        } else {
            mode = 0
        }
        var node;
        if (typeof path === "object") {
            node = path
        } else {
            path = PATH.normalize(path);
            try {
                var lookup = FS.lookupPath(path, {
                    follow: !(flags & 131072)
                });
                node = lookup.node
            } catch (e) {}
        }
        var created = false;
        if (flags & 64) {
            if (node) {
                if (flags & 128) {
                    throw new FS.ErrnoError(17)
                }
            } else {
                node = FS.mknod(path, mode, 0);
                created = true
            }
        }
        if (!node) {
            throw new FS.ErrnoError(2)
        }
        if (FS.isChrdev(node.mode)) {
            flags &= ~512
        }
        if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(20)
        }
        if (!created) {
            var err = FS.mayOpen(node, flags);
            if (err) {
                throw new FS.ErrnoError(err)
            }
        }
        if (flags & 512) {
            FS.truncate(node, 0)
        }
        flags &= ~(128 | 512);
        var stream = FS.createStream({
            node: node,
            path: FS.getPath(node),
            flags: flags,
            seekable: true,
            position: 0,
            stream_ops: node.stream_ops,
            ungotten: [],
            error: false
        }, fd_start, fd_end);
        if (stream.stream_ops.open) {
            stream.stream_ops.open(stream)
        }
        if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles)
                FS.readFiles = {};
            if (!(path in FS.readFiles)) {
                FS.readFiles[path] = 1;
                console.log("FS.trackingDelegate error on read file: " + path)
            }
        }
        try {
            if (FS.trackingDelegate["onOpenFile"]) {
                var trackingFlags = 0;
                if ((flags & 2097155) !== 1) {
                    trackingFlags |= FS.tracking.openFlags.READ
                }
                if ((flags & 2097155) !== 0) {
                    trackingFlags |= FS.tracking.openFlags.WRITE
                }
                FS.trackingDelegate["onOpenFile"](path, trackingFlags)
            }
        } catch (e) {
            console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
        }
        return stream
    },
    close: function(stream) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
        }
        if (stream.getdents)
            stream.getdents = null;
        try {
            if (stream.stream_ops.close) {
                stream.stream_ops.close(stream)
            }
        } catch (e) {
            throw e
        } finally {
            FS.closeStream(stream.fd)
        }
        stream.fd = null
    },
    isClosed: function(stream) {
        return stream.fd === null
    },
    llseek: function(stream, offset, whence) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(29)
        }
        if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(22)
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence);
        stream.ungotten = [];
        return stream.position
    },
    read: function(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
        }
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(9)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
        }
        if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(22)
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
        if (!seeking)
            stream.position += bytesRead;
        return bytesRead
    },
    write: function(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
        }
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
        }
        if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
        }
        if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(22)
        }
        if (stream.flags & 1024) {
            FS.llseek(stream, 0, 2)
        }
        var seeking = typeof position !== "undefined";
        if (!seeking) {
            position = stream.position
        } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
        if (!seeking)
            stream.position += bytesWritten;
        try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"])
                FS.trackingDelegate["onWriteToFile"](stream.path)
        } catch (e) {
            console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
        }
        return bytesWritten
    },
    allocate: function(stream, offset, length) {
        if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
        }
        if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(22)
        }
        if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(19)
        }
        if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(95)
        }
        stream.stream_ops.allocate(stream, offset, length)
    },
    mmap: function(stream, buffer, offset, length, position, prot, flags) {
        if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(13)
        }
        if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(19)
        }
        return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
    },
    msync: function(stream, buffer, offset, length, mmapFlags) {
        if (!stream || !stream.stream_ops.msync) {
            return 0
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
    },
    munmap: function(stream) {
        return 0
    },
    ioctl: function(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(25)
        }
        return stream.stream_ops.ioctl(stream, cmd, arg)
    },
    readFile: function(path, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "r";
        opts.encoding = opts.encoding || "binary";
        if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"')
        }
        var ret;
        var stream = FS.open(path, opts.flags);
        var stat = FS.stat(path);
        var length = stat.size;
        var buf = new Uint8Array(length);
        FS.read(stream, buf, 0, length, 0);
        if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0)
        } else if (opts.encoding === "binary") {
            ret = buf
        }
        FS.close(stream);
        return ret
    },
    writeFile: function(path, data, opts) {
        opts = opts || {};
        opts.flags = opts.flags || "w";
        var stream = FS.open(path, opts.flags, opts.mode);
        if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
        } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
        } else {
            throw new Error("Unsupported data type")
        }
        FS.close(stream)
    },
    cwd: function() {
        return FS.currentPath
    },
    chdir: function(path) {
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        if (lookup.node === null) {
            throw new FS.ErrnoError(2)
        }
        if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(20)
        }
        var err = FS.nodePermissions(lookup.node, "x");
        if (err) {
            throw new FS.ErrnoError(err)
        }
        FS.currentPath = lookup.path
    },
    createDefaultDirectories: function() {
        FS.mkdir("/tmp");
        FS.mkdir("/home");
        FS.mkdir("/home/web_user")
    },
    createDefaultDevices: function() {
        FS.mkdir("/dev");
        FS.registerDevice(FS.makedev(1, 3), {
            read: function() {
                return 0
            },
            write: function(stream, buffer, offset, length, pos) {
                return length
            }
        });
        FS.mkdev("/dev/null", FS.makedev(1, 3));
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
        FS.mkdev("/dev/tty", FS.makedev(5, 0));
        FS.mkdev("/dev/tty1", FS.makedev(6, 0));
        var random_device;
        if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            random_device = function() {
                crypto.getRandomValues(randomBuffer);
                return randomBuffer[0]
            }
        } else if (ENVIRONMENT_IS_NODE) {
            try {
                var crypto_module = require("crypto");
                random_device = function() {
                    return crypto_module["randomBytes"](1)[0]
                }
            } catch (e) {}
        } else {}
        if (!random_device) {
            random_device = function() {
                abort("random_device")
            }
        }
        FS.createDevice("/dev", "random", random_device);
        FS.createDevice("/dev", "urandom", random_device);
        FS.mkdir("/dev/shm");
        FS.mkdir("/dev/shm/tmp")
    },
    createSpecialDirectories: function() {
        FS.mkdir("/proc");
        FS.mkdir("/proc/self");
        FS.mkdir("/proc/self/fd");
        FS.mount({
            mount: function() {
                var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
                node.node_ops = {
                    lookup: function(parent, name) {
                        var fd = +name;
                        var stream = FS.getStream(fd);
                        if (!stream)
                            throw new FS.ErrnoError(9);
                        var ret = {
                            parent: null,
                            mount: {
                                mountpoint: "fake"
                            },
                            node_ops: {
                                readlink: function() {
                                    return stream.path
                                }
                            }
                        };
                        ret.parent = ret;
                        return ret
                    }
                };
                return node
            }
        }, {}, "/proc/self/fd")
    },
    createStandardStreams: function() {
        if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"])
        } else {
            FS.symlink("/dev/tty", "/dev/stdin")
        }
        if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"])
        } else {
            FS.symlink("/dev/tty", "/dev/stdout")
        }
        if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"])
        } else {
            FS.symlink("/dev/tty1", "/dev/stderr")
        }
        var stdin = FS.open("/dev/stdin", "r");
        var stdout = FS.open("/dev/stdout", "w");
        var stderr = FS.open("/dev/stderr", "w")
    },
    ensureErrnoError: function() {
        if (FS.ErrnoError)
            return;
        FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function(errno) {
                this.errno = errno
            }
            ;
            this.setErrno(errno);
            this.message = "FS error";
            if (this.stack)
                Object.defineProperty(this, "stack", {
                    value: (new Error).stack,
                    writable: true
                })
        }
        ;
        FS.ErrnoError.prototype = new Error;
        FS.ErrnoError.prototype.constructor = FS.ErrnoError;
        [2].forEach(function(code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>"
        })
    },
    staticInit: function() {
        FS.ensureErrnoError();
        FS.nameTable = new Array(4096);
        FS.mount(MEMFS, {}, "/");
        FS.createDefaultDirectories();
        FS.createDefaultDevices();
        FS.createSpecialDirectories();
        FS.filesystems = {
            "MEMFS": MEMFS,
            "IDBFS": IDBFS,
            "NODEFS": NODEFS,
            "WORKERFS": WORKERFS
        }
    },
    init: function(input, output, error) {
        FS.init.initialized = true;
        FS.ensureErrnoError();
        Module["stdin"] = input || Module["stdin"];
        Module["stdout"] = output || Module["stdout"];
        Module["stderr"] = error || Module["stderr"];
        FS.createStandardStreams()
    },
    quit: function() {
        FS.init.initialized = false;
        var fflush = Module["_fflush"];
        if (fflush)
            fflush(0);
        for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
                continue
            }
            FS.close(stream)
        }
    },
    getMode: function(canRead, canWrite) {
        var mode = 0;
        if (canRead)
            mode |= 292 | 73;
        if (canWrite)
            mode |= 146;
        return mode
    },
    joinPath: function(parts, forceRelative) {
        var path = PATH.join.apply(null, parts);
        if (forceRelative && path[0] == "/")
            path = path.substr(1);
        return path
    },
    absolutePath: function(relative, base) {
        return PATH.resolve(base, relative)
    },
    standardizePath: function(path) {
        return PATH.normalize(path)
    },
    findObject: function(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink);
        if (ret.exists) {
            return ret.object
        } else {
            ___setErrNo(ret.error);
            return null
        }
    },
    analyzePath: function(path, dontResolveLastLink) {
        try {
            var lookup = FS.lookupPath(path, {
                follow: !dontResolveLastLink
            });
            path = lookup.path
        } catch (e) {}
        var ret = {
            isRoot: false,
            exists: false,
            error: 0,
            name: null,
            path: null,
            object: null,
            parentExists: false,
            parentPath: null,
            parentObject: null
        };
        try {
            var lookup = FS.lookupPath(path, {
                parent: true
            });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, {
                follow: !dontResolveLastLink
            });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/"
        } catch (e) {
            ret.error = e.errno
        }
        return ret
    },
    createFolder: function(parent, name, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.mkdir(path, mode)
    },
    createPath: function(parent, path, canRead, canWrite) {
        parent = typeof parent === "string" ? parent : FS.getPath(parent);
        var parts = path.split("/").reverse();
        while (parts.length) {
            var part = parts.pop();
            if (!part)
                continue;
            var current = PATH.join2(parent, part);
            try {
                FS.mkdir(current)
            } catch (e) {}
            parent = current
        }
        return current
    },
    createFile: function(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(canRead, canWrite);
        return FS.create(path, mode)
    },
    createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
        var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
        var mode = FS.getMode(canRead, canWrite);
        var node = FS.create(path, mode);
        if (data) {
            if (typeof data === "string") {
                var arr = new Array(data.length);
                for (var i = 0, len = data.length; i < len; ++i)
                    arr[i] = data.charCodeAt(i);
                data = arr
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, "w");
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode)
        }
        return node
    },
    createDevice: function(parent, name, input, output) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        var mode = FS.getMode(!!input, !!output);
        if (!FS.createDevice.major)
            FS.createDevice.major = 64;
        var dev = FS.makedev(FS.createDevice.major++, 0);
        FS.registerDevice(dev, {
            open: function(stream) {
                stream.seekable = false
            },
            close: function(stream) {
                if (output && output.buffer && output.buffer.length) {
                    output(10)
                }
            },
            read: function(stream, buffer, offset, length, pos) {
                var bytesRead = 0;
                for (var i = 0; i < length; i++) {
                    var result;
                    try {
                        result = input()
                    } catch (e) {
                        throw new FS.ErrnoError(5)
                    }
                    if (result === undefined && bytesRead === 0) {
                        throw new FS.ErrnoError(11)
                    }
                    if (result === null || result === undefined)
                        break;
                    bytesRead++;
                    buffer[offset + i] = result
                }
                if (bytesRead) {
                    stream.node.timestamp = Date.now()
                }
                return bytesRead
            },
            write: function(stream, buffer, offset, length, pos) {
                for (var i = 0; i < length; i++) {
                    try {
                        output(buffer[offset + i])
                    } catch (e) {
                        throw new FS.ErrnoError(5)
                    }
                }
                if (length) {
                    stream.node.timestamp = Date.now()
                }
                return i
            }
        });
        return FS.mkdev(path, mode, dev)
    },
    createLink: function(parent, name, target, canRead, canWrite) {
        var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
        return FS.symlink(target, path)
    },
    forceLoadFile: function(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents)
            return true;
        var success = true;
        if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
        } else if (Module["read"]) {
            try {
                obj.contents = intArrayFromString(Module["read"](obj.url), true);
                obj.usedBytes = obj.contents.length
            } catch (e) {
                success = false
            }
        } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.")
        }
        if (!success)
            ___setErrNo(5);
        return success
    },
    createLazyFile: function(parent, name, url, canRead, canWrite) {
        function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []
        }
        LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
                return undefined
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset]
        }
        ;
        LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter
        }
        ;
        LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest;
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing)
                chunkSize = datalength;
            var doXHR = function(from, to) {
                if (from > to)
                    throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                if (to > datalength - 1)
                    throw new Error("only " + datalength + " bytes available! programmer error!");
                var xhr = new XMLHttpRequest;
                xhr.open("GET", url, false);
                if (datalength !== chunkSize)
                    xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                if (typeof Uint8Array != "undefined")
                    xhr.responseType = "arraybuffer";
                if (xhr.overrideMimeType) {
                    xhr.overrideMimeType("text/plain; charset=x-user-defined")
                }
                xhr.send(null);
                if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304))
                    throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                if (xhr.response !== undefined) {
                    return new Uint8Array(xhr.response || [])
                } else {
                    return intArrayFromString(xhr.responseText || "", true)
                }
            };
            var lazyArray = this;
            lazyArray.setDataGetter(function(chunkNum) {
                var start = chunkNum * chunkSize;
                var end = (chunkNum + 1) * chunkSize - 1;
                end = Math.min(end, datalength - 1);
                if (typeof lazyArray.chunks[chunkNum] === "undefined") {
                    lazyArray.chunks[chunkNum] = doXHR(start, end)
                }
                if (typeof lazyArray.chunks[chunkNum] === "undefined")
                    throw new Error("doXHR failed!");
                return lazyArray.chunks[chunkNum]
            });
            if (usesGzip || !datalength) {
                chunkSize = datalength = 1;
                datalength = this.getter(0).length;
                chunkSize = datalength;
                console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true
        }
        ;
        if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER)
                throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array;
            Object.defineProperties(lazyArray, {
                length: {
                    get: function() {
                        if (!this.lengthKnown) {
                            this.cacheLength()
                        }
                        return this._length
                    }
                },
                chunkSize: {
                    get: function() {
                        if (!this.lengthKnown) {
                            this.cacheLength()
                        }
                        return this._chunkSize
                    }
                }
            });
            var properties = {
                isDevice: false,
                contents: lazyArray
            }
        } else {
            var properties = {
                isDevice: false,
                url: url
            }
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite);
        if (properties.contents) {
            node.contents = properties.contents
        } else if (properties.url) {
            node.contents = null;
            node.url = properties.url
        }
        Object.defineProperties(node, {
            usedBytes: {
                get: function() {
                    return this.contents.length
                }
            }
        });
        var stream_ops = {};
        var keys = Object.keys(node.stream_ops);
        keys.forEach(function(key) {
            var fn = node.stream_ops[key];
            stream_ops[key] = function forceLoadLazyFile() {
                if (!FS.forceLoadFile(node)) {
                    throw new FS.ErrnoError(5)
                }
                return fn.apply(null, arguments)
            }
        });
        stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
            if (!FS.forceLoadFile(node)) {
                throw new FS.ErrnoError(5)
            }
            var contents = stream.node.contents;
            if (position >= contents.length)
                return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents[position + i]
                }
            } else {
                for (var i = 0; i < size; i++) {
                    buffer[offset + i] = contents.get(position + i)
                }
            }
            return size
        }
        ;
        node.stream_ops = stream_ops;
        return node
    },
    createPreloadedFile: function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
        Browser.init();
        var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
        var dep = getUniqueRunDependency("cp " + fullname);
        function processData(byteArray) {
            function finish(byteArray) {
                if (preFinish)
                    preFinish();
                if (!dontCreateFile) {
                    FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
                }
                if (onload)
                    onload();
                removeRunDependency(dep)
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function(plugin) {
                if (handled)
                    return;
                if (plugin["canHandle"](fullname)) {
                    plugin["handle"](byteArray, fullname, finish, function() {
                        if (onerror)
                            onerror();
                        removeRunDependency(dep)
                    });
                    handled = true
                }
            });
            if (!handled)
                finish(byteArray)
        }
        addRunDependency(dep);
        if (typeof url == "string") {
            Browser.asyncLoad(url, function(byteArray) {
                processData(byteArray)
            }, onerror)
        } else {
            processData(url)
        }
    },
    indexedDB: function() {
        return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
    },
    DB_NAME: function() {
        return "EM_FS_" + window.location.pathname
    },
    DB_VERSION: 20,
    DB_STORE_NAME: "FILE_DATA",
    saveFilesToDB: function(paths, onload, onerror) {
        onload = onload || function() {}
        ;
        onerror = onerror || function() {}
        ;
        var indexedDB = FS.indexedDB();
        try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
        } catch (e) {
            return onerror(e)
        }
        openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            console.log("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME)
        }
        ;
        openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0
              , fail = 0
              , total = paths.length;
            function finish() {
                if (fail == 0)
                    onload();
                else
                    onerror()
            }
            paths.forEach(function(path) {
                var putRequest = files.put(FS.analyzePath(path).object.contents, path);
                putRequest.onsuccess = function putRequest_onsuccess() {
                    ok++;
                    if (ok + fail == total)
                        finish()
                }
                ;
                putRequest.onerror = function putRequest_onerror() {
                    fail++;
                    if (ok + fail == total)
                        finish()
                }
            });
            transaction.onerror = onerror
        }
        ;
        openRequest.onerror = onerror
    },
    loadFilesFromDB: function(paths, onload, onerror) {
        onload = onload || function() {}
        ;
        onerror = onerror || function() {}
        ;
        var indexedDB = FS.indexedDB();
        try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
        } catch (e) {
            return onerror(e)
        }
        openRequest.onupgradeneeded = onerror;
        openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
                var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
            } catch (e) {
                onerror(e);
                return
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0
              , fail = 0
              , total = paths.length;
            function finish() {
                if (fail == 0)
                    onload();
                else
                    onerror()
            }
            paths.forEach(function(path) {
                var getRequest = files.get(path);
                getRequest.onsuccess = function getRequest_onsuccess() {
                    if (FS.analyzePath(path).exists) {
                        FS.unlink(path)
                    }
                    FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                    ok++;
                    if (ok + fail == total)
                        finish()
                }
                ;
                getRequest.onerror = function getRequest_onerror() {
                    fail++;
                    if (ok + fail == total)
                        finish()
                }
            });
            transaction.onerror = onerror
        }
        ;
        openRequest.onerror = onerror
    }
};
var SYS = {
    exited: false,
    style: null,
    loading: null,
    timeBase: null,
    fakeTime: 0,
    initialized: false,
    css: '@font-face {\tfont-family: "Open Sans";\tfont-weight: normal;\tfont-style: normal;}.btn {\tdisplay: inline-block;\tmargin-bottom: 0;\tfont-weight: 400;\ttext-align: center;\tvertical-align: middle;\tcursor: pointer;\tbackground-image: none;\tborder: 1px solid transparent;\twhite-space: nowrap;\tpadding: 6px 12px;\tfont-size: 14px;\tline-height: 1.428571429;\tborder-radius: 4px;}.btn-success {\tcolor: #fff;\tbackground-color: #5cb85c;\tborder-color: #4cae4c;}.btn-success:hover {\tbackground-color: #47a447;\tborder-color: #398439;}#eula-frame {\tdisplay: none;\tposition: absolute;\ttop: 0;\tleft: 0;\tbottom: 0;\tright: 0;\toverflow-y: auto;}#eula-frame-inner {\tmax-width: 940px;\tmargin: 0 auto;\tpadding: 5em 0;\tbackground: rgba(0, 0, 0, 0.9);\tcolor: #eee;\tfont-size: 1.2em;}#eula-frame p {\tfont-family: "Helvetica Neue", Helvetica, Arial, sans-serif;}#eula {\tcolor: #ccc;\theight: 25em;\tmargin: 3em 0;\toverflow-y: scroll;\twhite-space: pre-wrap;}#dialog {\tdisplay: none;\tposition: absolute;\ttop: 50%;\tleft: 50%;\tmargin-top: -5em;\tmargin-left: -12em;\twidth: 24em;\tbackground: #2a2a2a;}#dialog .title {\tmargin: 0;\tpadding: 0.2em 0.5em;\tbackground: #333;\tcolor: #fff;\tfont-family: "Open Sans";\tfont-weight: bold;\ttext-transform: uppercase;}#dialog .description {\tmargin: 0;\tpadding: 0.5em;\tcolor: #fff;\tfont-family: "Helvetica Neue", Helvetica, Arial, sans-serif;}#loading {\tdisplay: none;\tposition: absolute;\ttop: 0;\tleft: 0;\tbottom: 0;\tright: 0;\tz-index: 1;}#loading-progress {\tposition: absolute;\ttop: 50%;\tleft: 50%;\tmargin-top: -1em;\tmargin-left: -12em;\tpadding: 0.4em;\twidth: 24em;\tbackground: rgba(0, 0, 0, 0.7);}#loading-progress .description {\ttext-align: center;\tcolor: #fff;\tfont-family: "Open Sans";\ttext-shadow: 1px 1px 2px #000;\ttext-transform: uppercase;}#loading-progress .bar-wrapper {\tbackground: #222;\tborder-radius: 2px;}#loading-progress .bar {\twidth: 0;\tbackground: #2dbb30;\tbox-shadow: inset 0 -1px 0 rgba(0, 0, 0, .15);}',
    LoadingDescription: function(desc) {
        var progress = document.getElementById("loading-progress");
        var description = progress.querySelector(".description");
        if (!desc) {
            SYS.loading.style.display = "none";
            SYS.LoadingProgress(0)
        } else {
            SYS.loading.style.display = "block"
        }
        description.innerHTML = desc
    },
    LoadingProgress: function(frac) {
        var progress = document.getElementById("loading-progress");
        var bar = progress.querySelector(".bar");
        bar.style.width = frac * 100 + "%"
    }
};
var SYSC = {
    Print: function(str) {
        str = allocate(intArrayFromString(str + "\n"), "i8", ALLOC_STACK);
        _Com_Printf(str)
    },
    Error: function(level, err) {
        if (level === "fatal") {
            level = 0
        } else if (level === "drop") {
            level = 1
        } else if (level === "serverdisconnect") {
            level = 2
        } else if (level === "disconnect") {
            level = 3
        } else {
            level = 0
        }
        err = allocate(intArrayFromString(err + "\n"), "i8", ALLOC_STACK);
        _Com_Error(level, err)
    }
};
function _Sys_Cwd() {
    var cwd = allocate(intArrayFromString(FS.cwd()), "i8", ALLOC_STACK);
    return cwd
}
function _Sys_Dirname(path) {
    path = UTF8ToString(path);
    path = PATH.dirname(path);
    var dirname = allocate(intArrayFromString(path), "i8", ALLOC_STACK);
    return dirname
}
function _Sys_ErrorDialog(error) {
    error = UTF8ToString(error);
    var handler = Module["exitHandler"];
    if (handler) {
        SYS.exited = true;
        handler(error);
        return
    }
    var title = SYS.dialog.querySelector(".title");
    title.className = "title error";
    title.innerHTML = "Error";
    var description = SYS.dialog.querySelector(".description");
    description.innerHTML = error;
    SYS.dialog.style.display = "block"
}
function _Sys_FreeFileList(list) {
    if (!list) {
        return
    }
    var ptr;
    for (var i = 0; ptr = HEAP32[list + i * 4 >> 2]; i++) {
        _free(ptr)
    }
    _free(list)
}
function _Sys_ListFiles(directory, ext, filter, numfiles, dironly) {
    directory = UTF8ToString(directory);
    ext = UTF8ToString(ext);
    if (ext === "/") {
        ext = null;
        dironly = true
    }
    var contents;
    try {
        contents = FS.readdir(directory)
    } catch (e) {
        HEAP32[numfiles >> 2] = 0;
        return null
    }
    var matches = [];
    for (var i = 0; i < contents.length; i++) {
        var name = contents[i];
        var stat = FS.stat(PATH.join(directory, name));
        if (dironly && !FS.isDir(stat.mode)) {
            continue
        }
        if (!ext || name.lastIndexOf(ext) === name.length - ext.length) {
            matches.push(name)
        }
    }
    HEAP32[numfiles >> 2] = matches.length;
    if (!matches.length) {
        return null
    }
    var list = _malloc((matches.length + 1) * 4);
    var i;
    for (i = 0; i < matches.length; i++) {
        var filename = _malloc(matches[i].length + 1);
        stringToUTF8(matches[i], filename, matches[i].length + 1);
        HEAP32[list + i * 4 >> 2] = filename
    }
    HEAP32[list + i * 4 >> 2] = 0;
    return list
}
function _Sys_Milliseconds() {
    return Math.floor(Date.now() - SYS.timeBase) | 0
}
function _Sys_Mkdir(directory) {
    directory = UTF8ToString(directory);
    try {
        FS.mkdir(directory, 511)
    } catch (e) {
        if (!(e instanceof FS.ErrnoError)) {
            SYSC.Error("drop", e.message)
        }
        return e.errno === ERRNO_CODES.EEXIST
    }
    return true
}
function _Sys_PlatformExit() {}
function _Sys_PlatformInit() {
    SYS.timeBase = Date.now();
    if (SYS.initialized)
        return;
    var style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.innerHTML = SYS.css;
    SYS.style = document.getElementsByTagName("head")[0].appendChild(style);
    var dialog = document.createElement("div");
    dialog.id = "dialog";
    dialog.innerHTML = '<h4 class="title"></h4>' + '<p class="description"></p>';
    SYS.dialog = Module["viewport"].appendChild(dialog);
    var loading = document.createElement("div");
    loading.id = "loading";
    loading.innerHTML = '<div id="loading-progress">' + '\t<div class="description"></div>' + '\t<div class="bar-wrapper"><div class="bar">&nbsp;</div></div>' + "</div>";
    SYS.loading = Module["viewport"].appendChild(loading)
}
var ENV = {};
function ___buildEnvironment(environ) {
    var MAX_ENV_VALUES = 64;
    var TOTAL_ENV_SIZE = 1024;
    var poolPtr;
    var envPtr;
    if (!___buildEnvironment.called) {
        ___buildEnvironment.called = true;
        ENV["USER"] = ENV["LOGNAME"] = "web_user";
        ENV["PATH"] = "/";
        ENV["PWD"] = "/";
        ENV["HOME"] = "/home/web_user";
        ENV["LANG"] = "C.UTF-8";
        ENV["_"] = Module["thisProgram"];
        poolPtr = getMemory(TOTAL_ENV_SIZE);
        envPtr = getMemory(MAX_ENV_VALUES * 4);
        HEAP32[envPtr >> 2] = poolPtr;
        HEAP32[environ >> 2] = envPtr
    } else {
        envPtr = HEAP32[environ >> 2];
        poolPtr = HEAP32[envPtr >> 2]
    }
    var strings = [];
    var totalSize = 0;
    for (var key in ENV) {
        if (typeof ENV[key] === "string") {
            var line = key + "=" + ENV[key];
            strings.push(line);
            totalSize += line.length
        }
    }
    if (totalSize > TOTAL_ENV_SIZE) {
        throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
    }
    var ptrSize = 4;
    for (var i = 0; i < strings.length; i++) {
        var line = strings[i];
        writeAsciiToMemory(line, poolPtr);
        HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
        poolPtr += line.length + 1
    }
    HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
}
function ___lock() {}
var ERRNO_CODES = {
    EPERM: 1,
    ENOENT: 2,
    ESRCH: 3,
    EINTR: 4,
    EIO: 5,
    ENXIO: 6,
    E2BIG: 7,
    ENOEXEC: 8,
    EBADF: 9,
    ECHILD: 10,
    EAGAIN: 11,
    EWOULDBLOCK: 11,
    ENOMEM: 12,
    EACCES: 13,
    EFAULT: 14,
    ENOTBLK: 15,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENODEV: 19,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    ENFILE: 23,
    EMFILE: 24,
    ENOTTY: 25,
    ETXTBSY: 26,
    EFBIG: 27,
    ENOSPC: 28,
    ESPIPE: 29,
    EROFS: 30,
    EMLINK: 31,
    EPIPE: 32,
    EDOM: 33,
    ERANGE: 34,
    ENOMSG: 42,
    EIDRM: 43,
    ECHRNG: 44,
    EL2NSYNC: 45,
    EL3HLT: 46,
    EL3RST: 47,
    ELNRNG: 48,
    EUNATCH: 49,
    ENOCSI: 50,
    EL2HLT: 51,
    EDEADLK: 35,
    ENOLCK: 37,
    EBADE: 52,
    EBADR: 53,
    EXFULL: 54,
    ENOANO: 55,
    EBADRQC: 56,
    EBADSLT: 57,
    EDEADLOCK: 35,
    EBFONT: 59,
    ENOSTR: 60,
    ENODATA: 61,
    ETIME: 62,
    ENOSR: 63,
    ENONET: 64,
    ENOPKG: 65,
    EREMOTE: 66,
    ENOLINK: 67,
    EADV: 68,
    ESRMNT: 69,
    ECOMM: 70,
    EPROTO: 71,
    EMULTIHOP: 72,
    EDOTDOT: 73,
    EBADMSG: 74,
    ENOTUNIQ: 76,
    EBADFD: 77,
    EREMCHG: 78,
    ELIBACC: 79,
    ELIBBAD: 80,
    ELIBSCN: 81,
    ELIBMAX: 82,
    ELIBEXEC: 83,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENAMETOOLONG: 36,
    ELOOP: 40,
    EOPNOTSUPP: 95,
    EPFNOSUPPORT: 96,
    ECONNRESET: 104,
    ENOBUFS: 105,
    EAFNOSUPPORT: 97,
    EPROTOTYPE: 91,
    ENOTSOCK: 88,
    ENOPROTOOPT: 92,
    ESHUTDOWN: 108,
    ECONNREFUSED: 111,
    EADDRINUSE: 98,
    ECONNABORTED: 103,
    ENETUNREACH: 101,
    ENETDOWN: 100,
    ETIMEDOUT: 110,
    EHOSTDOWN: 112,
    EHOSTUNREACH: 113,
    EINPROGRESS: 115,
    EALREADY: 114,
    EDESTADDRREQ: 89,
    EMSGSIZE: 90,
    EPROTONOSUPPORT: 93,
    ESOCKTNOSUPPORT: 94,
    EADDRNOTAVAIL: 99,
    ENETRESET: 102,
    EISCONN: 106,
    ENOTCONN: 107,
    ETOOMANYREFS: 109,
    EUSERS: 87,
    EDQUOT: 122,
    ESTALE: 116,
    ENOTSUP: 95,
    ENOMEDIUM: 123,
    EILSEQ: 84,
    EOVERFLOW: 75,
    ECANCELED: 125,
    ENOTRECOVERABLE: 131,
    EOWNERDEAD: 130,
    ESTRPIPE: 86
};
var SYSCALLS = {
    DEFAULT_POLLMASK: 5,
    mappings: {},
    umask: 511,
    calculateAt: function(dirfd, path) {
        if (path[0] !== "/") {
            var dir;
            if (dirfd === -100) {
                dir = FS.cwd()
            } else {
                var dirstream = FS.getStream(dirfd);
                if (!dirstream)
                    throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                dir = dirstream.path
            }
            path = PATH.join2(dir, path)
        }
        return path
    },
    doStat: function(func, path, buf) {
        try {
            var stat = func(path)
        } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
                return -ERRNO_CODES.ENOTDIR
            }
            throw e
        }
        HEAP32[buf >> 2] = stat.dev;
        HEAP32[buf + 4 >> 2] = 0;
        HEAP32[buf + 8 >> 2] = stat.ino;
        HEAP32[buf + 12 >> 2] = stat.mode;
        HEAP32[buf + 16 >> 2] = stat.nlink;
        HEAP32[buf + 20 >> 2] = stat.uid;
        HEAP32[buf + 24 >> 2] = stat.gid;
        HEAP32[buf + 28 >> 2] = stat.rdev;
        HEAP32[buf + 32 >> 2] = 0;
        HEAP32[buf + 36 >> 2] = stat.size;
        HEAP32[buf + 40 >> 2] = 4096;
        HEAP32[buf + 44 >> 2] = stat.blocks;
        HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
        HEAP32[buf + 52 >> 2] = 0;
        HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
        HEAP32[buf + 60 >> 2] = 0;
        HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
        HEAP32[buf + 68 >> 2] = 0;
        HEAP32[buf + 72 >> 2] = stat.ino;
        return 0
    },
    doMsync: function(addr, stream, len, flags) {
        var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
        FS.msync(stream, buffer, 0, len, flags)
    },
    doMkdir: function(path, mode) {
        path = PATH.normalize(path);
        if (path[path.length - 1] === "/")
            path = path.substr(0, path.length - 1);
        FS.mkdir(path, mode, 0);
        return 0
    },
    doMknod: function(path, mode, dev) {
        switch (mode & 61440) {
        case 32768:
        case 8192:
        case 24576:
        case 4096:
        case 49152:
            break;
        default:
            return -ERRNO_CODES.EINVAL
        }
        FS.mknod(path, mode, dev);
        return 0
    },
    doReadlink: function(path, buf, bufsize) {
        if (bufsize <= 0)
            return -ERRNO_CODES.EINVAL;
        var ret = FS.readlink(path);
        var len = Math.min(bufsize, lengthBytesUTF8(ret));
        var endChar = HEAP8[buf + len];
        stringToUTF8(ret, buf, bufsize + 1);
        HEAP8[buf + len] = endChar;
        return len
    },
    doAccess: function(path, amode) {
        if (amode & ~7) {
            return -ERRNO_CODES.EINVAL
        }
        var node;
        var lookup = FS.lookupPath(path, {
            follow: true
        });
        node = lookup.node;
        var perms = "";
        if (amode & 4)
            perms += "r";
        if (amode & 2)
            perms += "w";
        if (amode & 1)
            perms += "x";
        if (perms && FS.nodePermissions(node, perms)) {
            return -ERRNO_CODES.EACCES
        }
        return 0
    },
    doDup: function(path, flags, suggestFD) {
        var suggest = FS.getStream(suggestFD);
        if (suggest)
            FS.close(suggest);
        return FS.open(path, flags, 0, suggestFD, suggestFD).fd
    },
    doReadv: function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
                return -1;
            ret += curr;
            if (curr < len)
                break
        }
        return ret
    },
    doWritev: function(stream, iov, iovcnt, offset) {
        var ret = 0;
        for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0)
                return -1;
            ret += curr
        }
        return ret
    },
    varargs: 0,
    get: function(varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret
    },
    getStr: function() {
        var ret = UTF8ToString(SYSCALLS.get());
        return ret
    },
    getStreamFromFD: function() {
        var stream = FS.getStream(SYSCALLS.get());
        if (!stream)
            throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return stream
    },
    getSocketFromFD: function() {
        var socket = SOCKFS.getSocket(SYSCALLS.get());
        if (!socket)
            throw new FS.ErrnoError(ERRNO_CODES.EBADF);
        return socket
    },
    getSocketAddress: function(allowNull) {
        var addrp = SYSCALLS.get()
          , addrlen = SYSCALLS.get();
        if (allowNull && addrp === 0)
            return null;
        var info = __read_sockaddr(addrp, addrlen);
        if (info.errno)
            throw new FS.ErrnoError(info.errno);
        info.addr = DNS.lookup_addr(info.addr) || info.addr;
        return info
    },
    get64: function() {
        var low = SYSCALLS.get()
          , high = SYSCALLS.get();
        return low
    },
    getZero: function() {
        SYSCALLS.get()
    }
};
function ___syscall10(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var path = SYSCALLS.getStr();
        FS.unlink(path);
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
var SOCKFS = {
    mount: function(mount) {
        Module["websocket"] = Module["websocket"] && "object" === typeof Module["websocket"] ? Module["websocket"] : {};
        Module["websocket"]._callbacks = {};
        Module["websocket"]["on"] = function(event, callback) {
            if ("function" === typeof callback) {
                this._callbacks[event] = callback
            }
            return this
        }
        ;
        Module["websocket"].emit = function(event, param) {
            if ("function" === typeof this._callbacks[event]) {
                this._callbacks[event].call(this, param)
            }
        }
        ;
        return FS.createNode(null, "/", 16384 | 511, 0)
    },
    createSocket: function(family, type, protocol) {
        var streaming = type == 1;
        if (protocol) {
            assert(streaming == (protocol == 6))
        }
        var sock = {
            family: family,
            type: type,
            protocol: protocol,
            server: null,
            error: null,
            peers: {},
            pending: [],
            recv_queue: [],
            sock_ops: SOCKFS.websocket_sock_ops
        };
        var name = SOCKFS.nextname();
        var node = FS.createNode(SOCKFS.root, name, 49152, 0);
        node.sock = sock;
        var stream = FS.createStream({
            path: name,
            node: node,
            flags: FS.modeStringToFlags("r+"),
            seekable: false,
            stream_ops: SOCKFS.stream_ops
        });
        sock.stream = stream;
        return sock
    },
    getSocket: function(fd) {
        var stream = FS.getStream(fd);
        if (!stream || !FS.isSocket(stream.node.mode)) {
            return null
        }
        return stream.node.sock
    },
    stream_ops: {
        poll: function(stream) {
            var sock = stream.node.sock;
            return sock.sock_ops.poll(sock)
        },
        ioctl: function(stream, request, varargs) {
            var sock = stream.node.sock;
            return sock.sock_ops.ioctl(sock, request, varargs)
        },
        read: function(stream, buffer, offset, length, position) {
            var sock = stream.node.sock;
            var msg = sock.sock_ops.recvmsg(sock, length);
            if (!msg) {
                return 0
            }
            buffer.set(msg.buffer, offset);
            return msg.buffer.length
        },
        write: function(stream, buffer, offset, length, position) {
            var sock = stream.node.sock;
            return sock.sock_ops.sendmsg(sock, buffer, offset, length)
        },
        close: function(stream) {
            var sock = stream.node.sock;
            sock.sock_ops.close(sock)
        }
    },
    nextname: function() {
        if (!SOCKFS.nextname.current) {
            SOCKFS.nextname.current = 0
        }
        return "socket[" + SOCKFS.nextname.current++ + "]"
    },
    websocket_sock_ops: {
        createPeer: function(sock, addr, port) {
            var ws;
            if (typeof addr === "object") {
                ws = addr;
                addr = null;
                port = null
            }
            if (ws) {
                if (ws._socket) {
                    addr = ws._socket.remoteAddress;
                    port = ws._socket.remotePort
                } else {
                    var result = /ws[s]?:\/\/([^:]+):(\d+)/.exec(ws.url);
                    if (!result) {
                        throw new Error("WebSocket URL must be in the format ws(s)://address:port")
                    }
                    addr = result[1];
                    port = parseInt(result[2], 10)
                }
            } else {
                try {
                    var runtimeConfig = Module["websocket"] && "object" === typeof Module["websocket"];
                    var url = "ws:#".replace("#", "//");
                    if (runtimeConfig) {
                        if ("string" === typeof Module["websocket"]["url"]) {
                            url = Module["websocket"]["url"]
                        }
                    }
                    if (url === "ws://" || url === "wss://") {
                        var parts = addr.split("/");
                        url = url + parts[0] + ":" + port + "/" + parts.slice(1).join("/")
                    }
                    var subProtocols = "binary";
                    if (runtimeConfig) {
                        if ("string" === typeof Module["websocket"]["subprotocol"]) {
                            subProtocols = Module["websocket"]["subprotocol"]
                        }
                    }
                    subProtocols = subProtocols.replace(/^ +| +$/g, "").split(/ *, */);
                    var opts = ENVIRONMENT_IS_NODE ? {
                        "protocol": subProtocols.toString()
                    } : subProtocols;
                    if (runtimeConfig && null === Module["websocket"]["subprotocol"]) {
                        subProtocols = "null";
                        opts = undefined
                    }
                    var WebSocketConstructor;
                    if (ENVIRONMENT_IS_NODE) {
                        WebSocketConstructor = require("ws")
                    } else if (ENVIRONMENT_IS_WEB) {
                        WebSocketConstructor = window["WebSocket"]
                    } else {
                        WebSocketConstructor = WebSocket
                    }
                    ws = new WebSocketConstructor(url,opts);
                    ws.binaryType = "arraybuffer"
                } catch (e) {
                    throw new FS.ErrnoError(ERRNO_CODES.EHOSTUNREACH)
                }
            }
            var peer = {
                addr: addr,
                port: port,
                socket: ws,
                dgram_send_queue: []
            };
            SOCKFS.websocket_sock_ops.addPeer(sock, peer);
            SOCKFS.websocket_sock_ops.handlePeerEvents(sock, peer);
            if (sock.type === 2 && typeof sock.sport !== "undefined") {
                peer.dgram_send_queue.push(new Uint8Array([255, 255, 255, 255, "p".charCodeAt(0), "o".charCodeAt(0), "r".charCodeAt(0), "t".charCodeAt(0), (sock.sport & 65280) >> 8, sock.sport & 255]))
            }
            return peer
        },
        getPeer: function(sock, addr, port) {
            return sock.peers[addr + ":" + port]
        },
        addPeer: function(sock, peer) {
            sock.peers[peer.addr + ":" + peer.port] = peer
        },
        removePeer: function(sock, peer) {
            delete sock.peers[peer.addr + ":" + peer.port]
        },
        handlePeerEvents: function(sock, peer) {
            var first = true;
            var handleOpen = function() {
                Module["websocket"].emit("open", sock.stream.fd);
                try {
                    var queued = peer.dgram_send_queue.shift();
                    while (queued) {
                        peer.socket.send(queued);
                        queued = peer.dgram_send_queue.shift()
                    }
                } catch (e) {
                    peer.socket.close()
                }
            };
            function handleMessage(data) {
                assert(typeof data !== "string" && data.byteLength !== undefined);
                if (data.byteLength == 0) {
                    return
                }
                data = new Uint8Array(data);
                var wasfirst = first;
                first = false;
                if (wasfirst && data.length === 10 && data[0] === 255 && data[1] === 255 && data[2] === 255 && data[3] === 255 && data[4] === "p".charCodeAt(0) && data[5] === "o".charCodeAt(0) && data[6] === "r".charCodeAt(0) && data[7] === "t".charCodeAt(0)) {
                    var newport = data[8] << 8 | data[9];
                    SOCKFS.websocket_sock_ops.removePeer(sock, peer);
                    peer.port = newport;
                    SOCKFS.websocket_sock_ops.addPeer(sock, peer);
                    return
                }
                sock.recv_queue.push({
                    addr: peer.addr,
                    port: peer.port,
                    data: data
                });
                Module["websocket"].emit("message", sock.stream.fd)
            }
            if (ENVIRONMENT_IS_NODE) {
                peer.socket.on("open", handleOpen);
                peer.socket.on("message", function(data, flags) {
                    if (!flags.binary) {
                        return
                    }
                    handleMessage(new Uint8Array(data).buffer)
                });
                peer.socket.on("close", function() {
                    Module["websocket"].emit("close", sock.stream.fd)
                });
                peer.socket.on("error", function(error) {
                    sock.error = ERRNO_CODES.ECONNREFUSED;
                    Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
                })
            } else {
                peer.socket.onopen = handleOpen;
                peer.socket.onclose = function() {
                    Module["websocket"].emit("close", sock.stream.fd)
                }
                ;
                peer.socket.onmessage = function peer_socket_onmessage(event) {
                    handleMessage(event.data)
                }
                ;
                peer.socket.onerror = function(error) {
                    sock.error = ERRNO_CODES.ECONNREFUSED;
                    Module["websocket"].emit("error", [sock.stream.fd, sock.error, "ECONNREFUSED: Connection refused"])
                }
            }
        },
        poll: function(sock) {
            if (sock.type === 1 && sock.server) {
                return sock.pending.length ? 64 | 1 : 0
            }
            var mask = 0;
            var dest = sock.type === 1 ? SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport) : null;
            if (sock.recv_queue.length || !dest || dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
                mask |= 64 | 1
            }
            if (!dest || dest && dest.socket.readyState === dest.socket.OPEN) {
                mask |= 4
            }
            if (dest && dest.socket.readyState === dest.socket.CLOSING || dest && dest.socket.readyState === dest.socket.CLOSED) {
                mask |= 16
            }
            return mask
        },
        ioctl: function(sock, request, arg) {
            switch (request) {
            case 21531:
                var bytes = 0;
                if (sock.recv_queue.length) {
                    bytes = sock.recv_queue[0].data.length
                }
                HEAP32[arg >> 2] = bytes;
                return 0;
            default:
                return ERRNO_CODES.EINVAL
            }
        },
        close: function(sock) {
            if (sock.server) {
                try {
                    sock.server.close()
                } catch (e) {}
                sock.server = null
            }
            var peers = Object.keys(sock.peers);
            for (var i = 0; i < peers.length; i++) {
                var peer = sock.peers[peers[i]];
                try {
                    peer.socket.close()
                } catch (e) {}
                SOCKFS.websocket_sock_ops.removePeer(sock, peer)
            }
            return 0
        },
        bind: function(sock, addr, port) {
            if (typeof sock.saddr !== "undefined" || typeof sock.sport !== "undefined") {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            sock.saddr = addr;
            sock.sport = port;
            if (sock.type === 2) {
                if (sock.server) {
                    sock.server.close();
                    sock.server = null
                }
                try {
                    sock.sock_ops.listen(sock, 0)
                } catch (e) {
                    if (!(e instanceof FS.ErrnoError))
                        throw e;
                    if (e.errno !== ERRNO_CODES.EOPNOTSUPP)
                        throw e
                }
            }
        },
        connect: function(sock, addr, port) {
            if (sock.server) {
                throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
            }
            if (typeof sock.daddr !== "undefined" && typeof sock.dport !== "undefined") {
                var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
                if (dest) {
                    if (dest.socket.readyState === dest.socket.CONNECTING) {
                        throw new FS.ErrnoError(ERRNO_CODES.EALREADY)
                    } else {
                        throw new FS.ErrnoError(ERRNO_CODES.EISCONN)
                    }
                }
            }
            var peer = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port);
            sock.daddr = peer.addr;
            sock.dport = peer.port;
            throw new FS.ErrnoError(ERRNO_CODES.EINPROGRESS)
        },
        listen: function(sock, backlog) {
            if (!ENVIRONMENT_IS_NODE) {
                throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)
            }
            if (sock.server) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            var WebSocketServer = require("ws").Server;
            var host = sock.saddr;
            sock.server = new WebSocketServer({
                host: host,
                port: sock.sport
            });
            Module["websocket"].emit("listen", sock.stream.fd);
            sock.server.on("connection", function(ws) {
                if (sock.type === 1) {
                    var newsock = SOCKFS.createSocket(sock.family, sock.type, sock.protocol);
                    var peer = SOCKFS.websocket_sock_ops.createPeer(newsock, ws);
                    newsock.daddr = peer.addr;
                    newsock.dport = peer.port;
                    sock.pending.push(newsock);
                    Module["websocket"].emit("connection", newsock.stream.fd)
                } else {
                    SOCKFS.websocket_sock_ops.createPeer(sock, ws);
                    Module["websocket"].emit("connection", sock.stream.fd)
                }
            });
            sock.server.on("closed", function() {
                Module["websocket"].emit("close", sock.stream.fd);
                sock.server = null
            });
            sock.server.on("error", function(error) {
                sock.error = ERRNO_CODES.EHOSTUNREACH;
                Module["websocket"].emit("error", [sock.stream.fd, sock.error, "EHOSTUNREACH: Host is unreachable"])
            })
        },
        accept: function(listensock) {
            if (!listensock.server) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            var newsock = listensock.pending.shift();
            newsock.stream.flags = listensock.stream.flags;
            return newsock
        },
        getname: function(sock, peer) {
            var addr, port;
            if (peer) {
                if (sock.daddr === undefined || sock.dport === undefined) {
                    throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
                }
                addr = sock.daddr;
                port = sock.dport
            } else {
                addr = sock.saddr || 0;
                port = sock.sport || 0
            }
            return {
                addr: addr,
                port: port
            }
        },
        sendmsg: function(sock, buffer, offset, length, addr, port) {
            if (sock.type === 2) {
                if (addr === undefined || port === undefined) {
                    addr = sock.daddr;
                    port = sock.dport
                }
                if (addr === undefined || port === undefined) {
                    throw new FS.ErrnoError(ERRNO_CODES.EDESTADDRREQ)
                }
            } else {
                addr = sock.daddr;
                port = sock.dport
            }
            var dest = SOCKFS.websocket_sock_ops.getPeer(sock, addr, port);
            if (sock.type === 1) {
                if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                    throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
                } else if (dest.socket.readyState === dest.socket.CONNECTING) {
                    throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                }
            }
            if (ArrayBuffer.isView(buffer)) {
                offset += buffer.byteOffset;
                buffer = buffer.buffer
            }
            var data;
            data = buffer.slice(offset, offset + length);
            if (sock.type === 2) {
                if (!dest || dest.socket.readyState !== dest.socket.OPEN) {
                    if (!dest || dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                        dest = SOCKFS.websocket_sock_ops.createPeer(sock, addr, port)
                    }
                    dest.dgram_send_queue.push(data);
                    return length
                }
            }
            try {
                dest.socket.send(data);
                return length
            } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
        },
        recvmsg: function(sock, length) {
            if (sock.type === 1 && sock.server) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
            }
            var queued = sock.recv_queue.shift();
            if (!queued) {
                if (sock.type === 1) {
                    var dest = SOCKFS.websocket_sock_ops.getPeer(sock, sock.daddr, sock.dport);
                    if (!dest) {
                        throw new FS.ErrnoError(ERRNO_CODES.ENOTCONN)
                    } else if (dest.socket.readyState === dest.socket.CLOSING || dest.socket.readyState === dest.socket.CLOSED) {
                        return null
                    } else {
                        throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                    }
                } else {
                    throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                }
            }
            var queuedLength = queued.data.byteLength || queued.data.length;
            var queuedOffset = queued.data.byteOffset || 0;
            var queuedBuffer = queued.data.buffer || queued.data;
            var bytesRead = Math.min(length, queuedLength);
            var res = {
                buffer: new Uint8Array(queuedBuffer,queuedOffset,bytesRead),
                addr: queued.addr,
                port: queued.port
            };
            if (sock.type === 1 && bytesRead < queuedLength) {
                var bytesRemaining = queuedLength - bytesRead;
                queued.data = new Uint8Array(queuedBuffer,queuedOffset + bytesRead,bytesRemaining);
                sock.recv_queue.unshift(queued)
            }
            return res
        }
    }
};
function __inet_pton4_raw(str) {
    var b = str.split(".");
    for (var i = 0; i < 4; i++) {
        var tmp = Number(b[i]);
        if (isNaN(tmp))
            return null;
        b[i] = tmp
    }
    return (b[0] | b[1] << 8 | b[2] << 16 | b[3] << 24) >>> 0
}
function __inet_pton6_raw(str) {
    var words;
    var w, offset, z;
    var valid6regx = /^((?=.*::)(?!.*::.+::)(::)?([\dA-F]{1,4}:(:|\b)|){5}|([\dA-F]{1,4}:){6})((([\dA-F]{1,4}((?!\3)::|:\b|$))|(?!\2\3)){2}|(((2[0-4]|1\d|[1-9])?\d|25[0-5])\.?\b){4})$/i;
    var parts = [];
    if (!valid6regx.test(str)) {
        return null
    }
    if (str === "::") {
        return [0, 0, 0, 0, 0, 0, 0, 0]
    }
    if (str.indexOf("::") === 0) {
        str = str.replace("::", "Z:")
    } else {
        str = str.replace("::", ":Z:")
    }
    if (str.indexOf(".") > 0) {
        str = str.replace(new RegExp("[.]","g"), ":");
        words = str.split(":");
        words[words.length - 4] = parseInt(words[words.length - 4]) + parseInt(words[words.length - 3]) * 256;
        words[words.length - 3] = parseInt(words[words.length - 2]) + parseInt(words[words.length - 1]) * 256;
        words = words.slice(0, words.length - 2)
    } else {
        words = str.split(":")
    }
    offset = 0;
    z = 0;
    for (w = 0; w < words.length; w++) {
        if (typeof words[w] === "string") {
            if (words[w] === "Z") {
                for (z = 0; z < 8 - words.length + 1; z++) {
                    parts[w + z] = 0
                }
                offset = z - 1
            } else {
                parts[w + offset] = _htons(parseInt(words[w], 16))
            }
        } else {
            parts[w + offset] = words[w]
        }
    }
    return [parts[1] << 16 | parts[0], parts[3] << 16 | parts[2], parts[5] << 16 | parts[4], parts[7] << 16 | parts[6]]
}
var DNS = {
    address_map: {
        id: 1,
        addrs: {},
        names: {}
    },
    lookup_name: function(name) {
        var res = __inet_pton4_raw(name);
        if (res !== null) {
            return name
        }
        res = __inet_pton6_raw(name);
        if (res !== null) {
            return name
        }
        var addr;
        if (DNS.address_map.addrs[name]) {
            addr = DNS.address_map.addrs[name]
        } else {
            var id = DNS.address_map.id++;
            assert(id < 65535, "exceeded max address mappings of 65535");
            addr = "172.29." + (id & 255) + "." + (id & 65280);
            DNS.address_map.names[addr] = name;
            DNS.address_map.addrs[name] = addr
        }
        return addr
    },
    lookup_addr: function(addr) {
        if (DNS.address_map.names[addr]) {
            return DNS.address_map.names[addr]
        }
        return null
    }
};
function __inet_ntop4_raw(addr) {
    return (addr & 255) + "." + (addr >> 8 & 255) + "." + (addr >> 16 & 255) + "." + (addr >> 24 & 255)
}
function __inet_ntop6_raw(ints) {
    var str = "";
    var word = 0;
    var longest = 0;
    var lastzero = 0;
    var zstart = 0;
    var len = 0;
    var i = 0;
    var parts = [ints[0] & 65535, ints[0] >> 16, ints[1] & 65535, ints[1] >> 16, ints[2] & 65535, ints[2] >> 16, ints[3] & 65535, ints[3] >> 16];
    var hasipv4 = true;
    var v4part = "";
    for (i = 0; i < 5; i++) {
        if (parts[i] !== 0) {
            hasipv4 = false;
            break
        }
    }
    if (hasipv4) {
        v4part = __inet_ntop4_raw(parts[6] | parts[7] << 16);
        if (parts[5] === -1) {
            str = "::ffff:";
            str += v4part;
            return str
        }
        if (parts[5] === 0) {
            str = "::";
            if (v4part === "0.0.0.0")
                v4part = "";
            if (v4part === "0.0.0.1")
                v4part = "1";
            str += v4part;
            return str
        }
    }
    for (word = 0; word < 8; word++) {
        if (parts[word] === 0) {
            if (word - lastzero > 1) {
                len = 0
            }
            lastzero = word;
            len++
        }
        if (len > longest) {
            longest = len;
            zstart = word - longest + 1
        }
    }
    for (word = 0; word < 8; word++) {
        if (longest > 1) {
            if (parts[word] === 0 && word >= zstart && word < zstart + longest) {
                if (word === zstart) {
                    str += ":";
                    if (zstart === 0)
                        str += ":"
                }
                continue
            }
        }
        str += Number(_ntohs(parts[word] & 65535)).toString(16);
        str += word < 7 ? ":" : ""
    }
    return str
}
function __read_sockaddr(sa, salen) {
    var family = HEAP16[sa >> 1];
    var port = _ntohs(HEAP16[sa + 2 >> 1]);
    var addr;
    switch (family) {
    case 2:
        if (salen !== 16) {
            return {
                errno: 22
            }
        }
        addr = HEAP32[sa + 4 >> 2];
        addr = __inet_ntop4_raw(addr);
        break;
    case 10:
        if (salen !== 28) {
            return {
                errno: 22
            }
        }
        addr = [HEAP32[sa + 8 >> 2], HEAP32[sa + 12 >> 2], HEAP32[sa + 16 >> 2], HEAP32[sa + 20 >> 2]];
        addr = __inet_ntop6_raw(addr);
        break;
    default:
        return {
            errno: 97
        }
    }
    return {
        family: family,
        addr: addr,
        port: port
    }
}
function __write_sockaddr(sa, family, addr, port) {
    switch (family) {
    case 2:
        addr = __inet_pton4_raw(addr);
        HEAP16[sa >> 1] = family;
        HEAP32[sa + 4 >> 2] = addr;
        HEAP16[sa + 2 >> 1] = _htons(port);
        break;
    case 10:
        addr = __inet_pton6_raw(addr);
        HEAP32[sa >> 2] = family;
        HEAP32[sa + 8 >> 2] = addr[0];
        HEAP32[sa + 12 >> 2] = addr[1];
        HEAP32[sa + 16 >> 2] = addr[2];
        HEAP32[sa + 20 >> 2] = addr[3];
        HEAP16[sa + 2 >> 1] = _htons(port);
        HEAP32[sa + 4 >> 2] = 0;
        HEAP32[sa + 24 >> 2] = 0;
        break;
    default:
        return {
            errno: 97
        }
    }
    return {}
}
function ___syscall102(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var call = SYSCALLS.get()
          , socketvararg = SYSCALLS.get();
        SYSCALLS.varargs = socketvararg;
        switch (call) {
        case 1:
            {
                var domain = SYSCALLS.get()
                  , type = SYSCALLS.get()
                  , protocol = SYSCALLS.get();
                var sock = SOCKFS.createSocket(domain, type, protocol);
                return sock.stream.fd
            }
        case 2:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , info = SYSCALLS.getSocketAddress();
                sock.sock_ops.bind(sock, info.addr, info.port);
                return 0
            }
        case 3:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , info = SYSCALLS.getSocketAddress();
                sock.sock_ops.connect(sock, info.addr, info.port);
                return 0
            }
        case 4:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , backlog = SYSCALLS.get();
                sock.sock_ops.listen(sock, backlog);
                return 0
            }
        case 5:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , addr = SYSCALLS.get()
                  , addrlen = SYSCALLS.get();
                var newsock = sock.sock_ops.accept(sock);
                if (addr) {
                    var res = __write_sockaddr(addr, newsock.family, DNS.lookup_name(newsock.daddr), newsock.dport)
                }
                return newsock.stream.fd
            }
        case 6:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , addr = SYSCALLS.get()
                  , addrlen = SYSCALLS.get();
                var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.saddr || "0.0.0.0"), sock.sport);
                return 0
            }
        case 7:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , addr = SYSCALLS.get()
                  , addrlen = SYSCALLS.get();
                if (!sock.daddr) {
                    return -ERRNO_CODES.ENOTCONN
                }
                var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(sock.daddr), sock.dport);
                return 0
            }
        case 11:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , message = SYSCALLS.get()
                  , length = SYSCALLS.get()
                  , flags = SYSCALLS.get()
                  , dest = SYSCALLS.getSocketAddress(true);
                if (!dest) {
                    return FS.write(sock.stream, HEAP8, message, length)
                } else {
                    return sock.sock_ops.sendmsg(sock, HEAP8, message, length, dest.addr, dest.port)
                }
            }
        case 12:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , buf = SYSCALLS.get()
                  , len = SYSCALLS.get()
                  , flags = SYSCALLS.get()
                  , addr = SYSCALLS.get()
                  , addrlen = SYSCALLS.get();
                var msg = sock.sock_ops.recvmsg(sock, len);
                if (!msg)
                    return 0;
                if (addr) {
                    var res = __write_sockaddr(addr, sock.family, DNS.lookup_name(msg.addr), msg.port)
                }
                HEAPU8.set(msg.buffer, buf);
                return msg.buffer.byteLength
            }
        case 14:
            {
                return -ERRNO_CODES.ENOPROTOOPT
            }
        case 15:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , level = SYSCALLS.get()
                  , optname = SYSCALLS.get()
                  , optval = SYSCALLS.get()
                  , optlen = SYSCALLS.get();
                if (level === 1) {
                    if (optname === 4) {
                        HEAP32[optval >> 2] = sock.error;
                        HEAP32[optlen >> 2] = 4;
                        sock.error = null;
                        return 0
                    }
                }
                return -ERRNO_CODES.ENOPROTOOPT
            }
        case 16:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , message = SYSCALLS.get()
                  , flags = SYSCALLS.get();
                var iov = HEAP32[message + 8 >> 2];
                var num = HEAP32[message + 12 >> 2];
                var addr, port;
                var name = HEAP32[message >> 2];
                var namelen = HEAP32[message + 4 >> 2];
                if (name) {
                    var info = __read_sockaddr(name, namelen);
                    if (info.errno)
                        return -info.errno;
                    port = info.port;
                    addr = DNS.lookup_addr(info.addr) || info.addr
                }
                var total = 0;
                for (var i = 0; i < num; i++) {
                    total += HEAP32[iov + (8 * i + 4) >> 2]
                }
                var view = new Uint8Array(total);
                var offset = 0;
                for (var i = 0; i < num; i++) {
                    var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
                    var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
                    for (var j = 0; j < iovlen; j++) {
                        view[offset++] = HEAP8[iovbase + j >> 0]
                    }
                }
                return sock.sock_ops.sendmsg(sock, view, 0, total, addr, port)
            }
        case 17:
            {
                var sock = SYSCALLS.getSocketFromFD()
                  , message = SYSCALLS.get()
                  , flags = SYSCALLS.get();
                var iov = HEAP32[message + 8 >> 2];
                var num = HEAP32[message + 12 >> 2];
                var total = 0;
                for (var i = 0; i < num; i++) {
                    total += HEAP32[iov + (8 * i + 4) >> 2]
                }
                var msg = sock.sock_ops.recvmsg(sock, total);
                if (!msg)
                    return 0;
                var name = HEAP32[message >> 2];
                if (name) {
                    var res = __write_sockaddr(name, sock.family, DNS.lookup_name(msg.addr), msg.port)
                }
                var bytesRead = 0;
                var bytesRemaining = msg.buffer.byteLength;
                for (var i = 0; bytesRemaining > 0 && i < num; i++) {
                    var iovbase = HEAP32[iov + (8 * i + 0) >> 2];
                    var iovlen = HEAP32[iov + (8 * i + 4) >> 2];
                    if (!iovlen) {
                        continue
                    }
                    var length = Math.min(iovlen, bytesRemaining);
                    var buf = msg.buffer.subarray(bytesRead, bytesRead + length);
                    HEAPU8.set(buf, iovbase + bytesRead);
                    bytesRead += length;
                    bytesRemaining -= length
                }
                return bytesRead
            }
        default:
            abort("unsupported socketcall syscall " + call)
        }
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall140(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD()
          , offset_high = SYSCALLS.get()
          , offset_low = SYSCALLS.get()
          , result = SYSCALLS.get()
          , whence = SYSCALLS.get();
        var offset = offset_low;
        FS.llseek(stream, offset, whence);
        HEAP32[result >> 2] = stream.position;
        if (stream.getdents && offset === 0 && whence === 0)
            stream.getdents = null;
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall142(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var nfds = SYSCALLS.get()
          , readfds = SYSCALLS.get()
          , writefds = SYSCALLS.get()
          , exceptfds = SYSCALLS.get()
          , timeout = SYSCALLS.get();
        var total = 0;
        var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0
          , srcReadHigh = readfds ? HEAP32[readfds + 4 >> 2] : 0;
        var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0
          , srcWriteHigh = writefds ? HEAP32[writefds + 4 >> 2] : 0;
        var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0
          , srcExceptHigh = exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0;
        var dstReadLow = 0
          , dstReadHigh = 0;
        var dstWriteLow = 0
          , dstWriteHigh = 0;
        var dstExceptLow = 0
          , dstExceptHigh = 0;
        var allLow = (readfds ? HEAP32[readfds >> 2] : 0) | (writefds ? HEAP32[writefds >> 2] : 0) | (exceptfds ? HEAP32[exceptfds >> 2] : 0);
        var allHigh = (readfds ? HEAP32[readfds + 4 >> 2] : 0) | (writefds ? HEAP32[writefds + 4 >> 2] : 0) | (exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0);
        var check = function(fd, low, high, val) {
            return fd < 32 ? low & val : high & val
        };
        for (var fd = 0; fd < nfds; fd++) {
            var mask = 1 << fd % 32;
            if (!check(fd, allLow, allHigh, mask)) {
                continue
            }
            var stream = FS.getStream(fd);
            if (!stream)
                throw new FS.ErrnoError(ERRNO_CODES.EBADF);
            var flags = SYSCALLS.DEFAULT_POLLMASK;
            if (stream.stream_ops.poll) {
                flags = stream.stream_ops.poll(stream)
            }
            if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
                fd < 32 ? dstReadLow = dstReadLow | mask : dstReadHigh = dstReadHigh | mask;
                total++
            }
            if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
                fd < 32 ? dstWriteLow = dstWriteLow | mask : dstWriteHigh = dstWriteHigh | mask;
                total++
            }
            if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
                fd < 32 ? dstExceptLow = dstExceptLow | mask : dstExceptHigh = dstExceptHigh | mask;
                total++
            }
        }
        if (readfds) {
            HEAP32[readfds >> 2] = dstReadLow;
            HEAP32[readfds + 4 >> 2] = dstReadHigh
        }
        if (writefds) {
            HEAP32[writefds >> 2] = dstWriteLow;
            HEAP32[writefds + 4 >> 2] = dstWriteHigh
        }
        if (exceptfds) {
            HEAP32[exceptfds >> 2] = dstExceptLow;
            HEAP32[exceptfds + 4 >> 2] = dstExceptHigh
        }
        return total
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall145(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD()
          , iov = SYSCALLS.get()
          , iovcnt = SYSCALLS.get();
        return SYSCALLS.doReadv(stream, iov, iovcnt)
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall146(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD()
          , iov = SYSCALLS.get()
          , iovcnt = SYSCALLS.get();
        return SYSCALLS.doWritev(stream, iov, iovcnt)
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall221(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD()
          , cmd = SYSCALLS.get();
        switch (cmd) {
        case 0:
            {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                    return -ERRNO_CODES.EINVAL
                }
                var newStream;
                newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd
            }
        case 1:
        case 2:
            return 0;
        case 3:
            return stream.flags;
        case 4:
            {
                var arg = SYSCALLS.get();
                stream.flags |= arg;
                return 0
            }
        case 12:
            {
                var arg = SYSCALLS.get();
                var offset = 0;
                HEAP16[arg + offset >> 1] = 2;
                return 0
            }
        case 13:
        case 14:
            return 0;
        case 16:
        case 8:
            return -ERRNO_CODES.EINVAL;
        case 9:
            ___setErrNo(ERRNO_CODES.EINVAL);
            return -1;
        default:
            {
                return -ERRNO_CODES.EINVAL
            }
        }
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall40(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var path = SYSCALLS.getStr();
        FS.rmdir(path);
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall5(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var pathname = SYSCALLS.getStr()
          , flags = SYSCALLS.get()
          , mode = SYSCALLS.get();
        var stream = FS.open(pathname, flags, mode);
        return stream.fd
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall54(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD()
          , op = SYSCALLS.get();
        switch (op) {
        case 21509:
        case 21505:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                return 0
            }
        case 21510:
        case 21511:
        case 21512:
        case 21506:
        case 21507:
        case 21508:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                return 0
            }
        case 21519:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                var argp = SYSCALLS.get();
                HEAP32[argp >> 2] = 0;
                return 0
            }
        case 21520:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                return -ERRNO_CODES.EINVAL
            }
        case 21531:
            {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp)
            }
        case 21523:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                return 0
            }
        case 21524:
            {
                if (!stream.tty)
                    return -ERRNO_CODES.ENOTTY;
                return 0
            }
        default:
            abort("bad ioctl syscall " + op)
        }
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___syscall6(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
        var stream = SYSCALLS.getStreamFromFD();
        FS.close(stream);
        return 0
    } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError))
            abort(e);
        return -e.errno
    }
}
function ___unlock() {}
var AL = {
    QUEUE_INTERVAL: 25,
    QUEUE_LOOKAHEAD: .1,
    DEVICE_NAME: "Emscripten OpenAL",
    CAPTURE_DEVICE_NAME: "Emscripten OpenAL capture",
    ALC_EXTENSIONS: {
        ALC_SOFT_pause_device: true,
        ALC_SOFT_HRTF: true
    },
    AL_EXTENSIONS: {
        AL_EXT_float32: true,
        AL_SOFT_loop_points: true,
        AL_SOFT_source_length: true,
        AL_EXT_source_distance_model: true,
        AL_SOFT_source_spatialize: true
    },
    _alcErr: 0,
    alcErr: 0,
    deviceRefCounts: {},
    alcStringCache: {},
    paused: false,
    stringCache: {},
    contexts: {},
    currentCtx: null,
    buffers: {
        0: {
            id: 0,
            refCount: 0,
            audioBuf: null,
            frequency: 0,
            bytesPerSample: 2,
            channels: 1,
            length: 0
        }
    },
    paramArray: [],
    _nextId: 1,
    newId: function() {
        return AL.freeIds.length > 0 ? AL.freeIds.pop() : AL._nextId++
    },
    freeIds: [],
    scheduleContextAudio: function(ctx) {
        if (Browser.mainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
            return
        }
        for (var i in ctx.sources) {
            AL.scheduleSourceAudio(ctx.sources[i])
        }
    },
    scheduleSourceAudio: function(src, lookahead) {
        if (Browser.mainLoop.timingMode === 1 && document["visibilityState"] != "visible") {
            return
        }
        if (src.state !== 4114) {
            return
        }
        var currentTime = AL.updateSourceTime(src);
        var startTime = src.bufStartTime;
        var startOffset = src.bufOffset;
        var bufCursor = src.bufsProcessed;
        for (var i = 0; i < src.audioQueue.length; i++) {
            var audioSrc = src.audioQueue[i];
            startTime = audioSrc._startTime + audioSrc._duration;
            startOffset = 0;
            bufCursor += audioSrc._skipCount + 1
        }
        if (!lookahead) {
            lookahead = AL.QUEUE_LOOKAHEAD
        }
        var lookaheadTime = currentTime + lookahead;
        var skipCount = 0;
        while (startTime < lookaheadTime) {
            if (bufCursor >= src.bufQueue.length) {
                if (src.looping) {
                    bufCursor %= src.bufQueue.length
                } else {
                    break
                }
            }
            var buf = src.bufQueue[bufCursor % src.bufQueue.length];
            if (buf.length === 0) {
                skipCount++;
                if (skipCount === src.bufQueue.length) {
                    break
                }
            } else {
                var audioSrc = src.context.audioCtx.createBufferSource();
                audioSrc.buffer = buf.audioBuf;
                audioSrc.playbackRate.value = src.playbackRate;
                if (buf.audioBuf._loopStart || buf.audioBuf._loopEnd) {
                    audioSrc.loopStart = buf.audioBuf._loopStart;
                    audioSrc.loopEnd = buf.audioBuf._loopEnd
                }
                var duration = 0;
                if (src.type === 4136 && src.looping) {
                    duration = Number.POSITIVE_INFINITY;
                    audioSrc.loop = true;
                    if (buf.audioBuf._loopStart) {
                        audioSrc.loopStart = buf.audioBuf._loopStart
                    }
                    if (buf.audioBuf._loopEnd) {
                        audioSrc.loopEnd = buf.audioBuf._loopEnd
                    }
                } else {
                    duration = (buf.audioBuf.duration - startOffset) / src.playbackRate
                }
                audioSrc._startOffset = startOffset;
                audioSrc._duration = duration;
                audioSrc._skipCount = skipCount;
                skipCount = 0;
                audioSrc.connect(src.gain);
                if (typeof audioSrc.start !== "undefined") {
                    startTime = Math.max(startTime, src.context.audioCtx.currentTime);
                    audioSrc.start(startTime, startOffset)
                } else if (typeof audioSrc.noteOn !== "undefined") {
                    startTime = Math.max(startTime, src.context.audioCtx.currentTime);
                    audioSrc.noteOn(startTime)
                }
                audioSrc._startTime = startTime;
                src.audioQueue.push(audioSrc);
                startTime += duration
            }
            startOffset = 0;
            bufCursor++
        }
    },
    updateSourceTime: function(src) {
        var currentTime = src.context.audioCtx.currentTime;
        if (src.state !== 4114) {
            return currentTime
        }
        if (!isFinite(src.bufStartTime)) {
            src.bufStartTime = currentTime - src.bufOffset / src.playbackRate;
            src.bufOffset = 0
        }
        var nextStartTime = 0;
        while (src.audioQueue.length) {
            var audioSrc = src.audioQueue[0];
            src.bufsProcessed += audioSrc._skipCount;
            nextStartTime = audioSrc._startTime + audioSrc._duration;
            if (currentTime < nextStartTime) {
                break
            }
            src.audioQueue.shift();
            src.bufStartTime = nextStartTime;
            src.bufOffset = 0;
            src.bufsProcessed++
        }
        if (src.bufsProcessed >= src.bufQueue.length && !src.looping) {
            AL.setSourceState(src, 4116)
        } else if (src.type === 4136 && src.looping) {
            var buf = src.bufQueue[0];
            if (buf.length === 0) {
                src.bufOffset = 0
            } else {
                var delta = (currentTime - src.bufStartTime) * src.playbackRate;
                var loopStart = buf.audioBuf._loopStart || 0;
                var loopEnd = buf.audioBuf._loopEnd || buf.audioBuf.duration;
                if (loopEnd <= loopStart) {
                    loopEnd = buf.audioBuf.duration
                }
                if (delta < loopEnd) {
                    src.bufOffset = delta
                } else {
                    src.bufOffset = loopStart + (delta - loopStart) % (loopEnd - loopStart)
                }
            }
        } else if (src.audioQueue[0]) {
            src.bufOffset = (currentTime - src.audioQueue[0]._startTime) * src.playbackRate
        } else {
            if (src.type !== 4136 && src.looping) {
                var srcDuration = AL.sourceDuration(src) / src.playbackRate;
                if (srcDuration > 0) {
                    src.bufStartTime += Math.floor((currentTime - src.bufStartTime) / srcDuration) * srcDuration
                }
            }
            for (var i = 0; i < src.bufQueue.length; i++) {
                if (src.bufsProcessed >= src.bufQueue.length) {
                    if (src.looping) {
                        src.bufsProcessed %= src.bufQueue.length
                    } else {
                        AL.setSourceState(src, 4116);
                        break
                    }
                }
                var buf = src.bufQueue[src.bufsProcessed];
                if (buf.length > 0) {
                    nextStartTime = src.bufStartTime + buf.audioBuf.duration / src.playbackRate;
                    if (currentTime < nextStartTime) {
                        src.bufOffset = (currentTime - src.bufStartTime) * src.playbackRate;
                        break
                    }
                    src.bufStartTime = nextStartTime
                }
                src.bufOffset = 0;
                src.bufsProcessed++
            }
        }
        return currentTime
    },
    cancelPendingSourceAudio: function(src) {
        AL.updateSourceTime(src);
        for (var i = 1; i < src.audioQueue.length; i++) {
            var audioSrc = src.audioQueue[i];
            audioSrc.stop()
        }
        if (src.audioQueue.length > 1) {
            src.audioQueue.length = 1
        }
    },
    stopSourceAudio: function(src) {
        for (var i = 0; i < src.audioQueue.length; i++) {
            src.audioQueue[i].stop()
        }
        src.audioQueue.length = 0
    },
    setSourceState: function(src, state) {
        if (state === 4114) {
            if (src.state === 4114 || src.state == 4116) {
                src.bufsProcessed = 0;
                src.bufOffset = 0
            } else {}
            AL.stopSourceAudio(src);
            src.state = 4114;
            src.bufStartTime = Number.NEGATIVE_INFINITY;
            AL.scheduleSourceAudio(src)
        } else if (state === 4115) {
            if (src.state === 4114) {
                AL.updateSourceTime(src);
                AL.stopSourceAudio(src);
                src.state = 4115
            }
        } else if (state === 4116) {
            if (src.state !== 4113) {
                src.state = 4116;
                src.bufsProcessed = src.bufQueue.length;
                src.bufStartTime = Number.NEGATIVE_INFINITY;
                src.bufOffset = 0;
                AL.stopSourceAudio(src)
            }
        } else if (state === 4113) {
            if (src.state !== 4113) {
                src.state = 4113;
                src.bufsProcessed = 0;
                src.bufStartTime = Number.NEGATIVE_INFINITY;
                src.bufOffset = 0;
                AL.stopSourceAudio(src)
            }
        }
    },
    initSourcePanner: function(src) {
        if (src.type === 4144) {
            return
        }
        var templateBuf = AL.buffers[0];
        for (var i = 0; i < src.bufQueue.length; i++) {
            if (src.bufQueue[i].id !== 0) {
                templateBuf = src.bufQueue[i];
                break
            }
        }
        if (src.spatialize === 1 || src.spatialize === 2 && templateBuf.channels === 1) {
            if (src.panner) {
                return
            }
            src.panner = src.context.audioCtx.createPanner();
            AL.updateSourceGlobal(src);
            AL.updateSourceSpace(src);
            src.panner.connect(src.context.gain);
            src.gain.disconnect();
            src.gain.connect(src.panner)
        } else {
            if (!src.panner) {
                return
            }
            src.panner.disconnect();
            src.gain.disconnect();
            src.gain.connect(src.context.gain);
            src.panner = null
        }
    },
    updateContextGlobal: function(ctx) {
        for (var i in ctx.sources) {
            AL.updateSourceGlobal(ctx.sources[i])
        }
    },
    updateSourceGlobal: function(src) {
        var panner = src.panner;
        if (!panner) {
            return
        }
        panner.refDistance = src.refDistance;
        panner.maxDistance = src.maxDistance;
        panner.rolloffFactor = src.rolloffFactor;
        panner.panningModel = src.context.hrtf ? "HRTF" : "equalpower";
        var distanceModel = src.context.sourceDistanceModel ? src.distanceModel : src.context.distanceModel;
        switch (distanceModel) {
        case 0:
            panner.distanceModel = "inverse";
            panner.refDistance = 3.40282e38;
            break;
        case 53249:
        case 53250:
            panner.distanceModel = "inverse";
            break;
        case 53251:
        case 53252:
            panner.distanceModel = "linear";
            break;
        case 53253:
        case 53254:
            panner.distanceModel = "exponential";
            break
        }
    },
    updateListenerSpace: function(ctx) {
        var listener = ctx.audioCtx.listener;
        if (listener.positionX) {
            listener.positionX.value = ctx.listener.position[0];
            listener.positionY.value = ctx.listener.position[1];
            listener.positionZ.value = ctx.listener.position[2]
        } else {
            listener.setPosition(ctx.listener.position[0], ctx.listener.position[1], ctx.listener.position[2])
        }
        if (listener.forwardX) {
            listener.forwardX.value = ctx.listener.direction[0];
            listener.forwardY.value = ctx.listener.direction[1];
            listener.forwardZ.value = ctx.listener.direction[2];
            listener.upX.value = ctx.listener.up[0];
            listener.upY.value = ctx.listener.up[1];
            listener.upZ.value = ctx.listener.up[2]
        } else {
            listener.setOrientation(ctx.listener.direction[0], ctx.listener.direction[1], ctx.listener.direction[2], ctx.listener.up[0], ctx.listener.up[1], ctx.listener.up[2])
        }
        for (var i in ctx.sources) {
            AL.updateSourceSpace(ctx.sources[i])
        }
    },
    updateSourceSpace: function(src) {
        if (!src.panner) {
            return
        }
        var panner = src.panner;
        var posX = src.position[0];
        var posY = src.position[1];
        var posZ = src.position[2];
        var dirX = src.direction[0];
        var dirY = src.direction[1];
        var dirZ = src.direction[2];
        var listener = src.context.listener;
        var lPosX = listener.position[0];
        var lPosY = listener.position[1];
        var lPosZ = listener.position[2];
        if (src.relative) {
            var lBackX = -listener.direction[0];
            var lBackY = -listener.direction[1];
            var lBackZ = -listener.direction[2];
            var lUpX = listener.up[0];
            var lUpY = listener.up[1];
            var lUpZ = listener.up[2];
            var inverseMagnitude = function(x, y, z) {
                var length = Math.sqrt(x * x + y * y + z * z);
                if (length < Number.EPSILON) {
                    return 0
                }
                return 1 / length
            };
            var invMag = inverseMagnitude(lBackX, lBackY, lBackZ);
            lBackX *= invMag;
            lBackY *= invMag;
            lBackZ *= invMag;
            invMag = inverseMagnitude(lUpX, lUpY, lUpZ);
            lUpX *= invMag;
            lUpY *= invMag;
            lUpZ *= invMag;
            var lRightX = lUpY * lBackZ - lUpZ * lBackY;
            var lRightY = lUpZ * lBackX - lUpX * lBackZ;
            var lRightZ = lUpX * lBackY - lUpY * lBackX;
            invMag = inverseMagnitude(lRightX, lRightY, lRightZ);
            lRightX *= invMag;
            lRightY *= invMag;
            lRightZ *= invMag;
            lUpX = lBackY * lRightZ - lBackZ * lRightY;
            lUpY = lBackZ * lRightX - lBackX * lRightZ;
            lUpZ = lBackX * lRightY - lBackY * lRightX;
            var oldX = dirX;
            var oldY = dirY;
            var oldZ = dirZ;
            dirX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
            dirY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
            dirZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
            oldX = posX;
            oldY = posY;
            oldZ = posZ;
            posX = oldX * lRightX + oldY * lUpX + oldZ * lBackX;
            posY = oldX * lRightY + oldY * lUpY + oldZ * lBackY;
            posZ = oldX * lRightZ + oldY * lUpZ + oldZ * lBackZ;
            posX += lPosX;
            posY += lPosY;
            posZ += lPosZ
        }
        {
            panner.setPosition(posX, posY, posZ)
        }
        {
            panner.setOrientation(dirX, dirY, dirZ)
        }
    },
    updateSourceRate: function(src) {
        if (src.state === 4114) {
            AL.cancelPendingSourceAudio(src);
            var audioSrc = src.audioQueue[0];
            if (!audioSrc) {
                return
            }
            var duration;
            if (src.type === 4136 && src.looping) {
                duration = Number.POSITIVE_INFINITY
            } else {
                duration = (audioSrc.buffer.duration - audioSrc._startOffset) / src.playbackRate
            }
            audioSrc._duration = duration;
            audioSrc.playbackRate.value = src.playbackRate;
            AL.scheduleSourceAudio(src)
        }
    },
    sourceDuration: function(src) {
        var length = 0;
        for (var i = 0; i < src.bufQueue.length; i++) {
            var audioBuf = src.bufQueue[i].audioBuf;
            length += audioBuf ? audioBuf.duration : 0
        }
        return length
    },
    sourceTell: function(src) {
        AL.updateSourceTime(src);
        var offset = 0;
        for (var i = 0; i < src.bufsProcessed; i++) {
            offset += src.bufQueue[i].audioBuf.duration
        }
        offset += src.bufOffset;
        return offset
    },
    sourceSeek: function(src, offset) {
        var playing = src.state == 4114;
        if (playing) {
            AL.setSourceState(src, 4113)
        }
        if (src.bufQueue[src.bufsProcessed].audioBuf !== null) {
            src.bufsProcessed = 0;
            while (offset > src.bufQueue[src.bufsProcessed].audioBuf.duration) {
                offset -= src.bufQueue[src.bufsProcessed].audiobuf.duration;
                src.bufsProcessed++
            }
            src.bufOffset = offset
        }
        if (playing) {
            AL.setSourceState(src, 4114)
        }
    },
    getGlobalParam: function(funcname, param) {
        if (!AL.currentCtx) {
            return null
        }
        switch (param) {
        case 49152:
            return AL.currentCtx.dopplerFactor;
        case 49155:
            return AL.currentCtx.speedOfSound;
        case 53248:
            return AL.currentCtx.distanceModel;
        default:
            AL.currentCtx.err = 40962;
            return null
        }
    },
    setGlobalParam: function(funcname, param, value) {
        if (!AL.currentCtx) {
            return
        }
        switch (param) {
        case 49152:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.currentCtx.dopplerFactor = value;
            AL.updateListenerSpace(AL.currentCtx);
            break;
        case 49155:
            if (!Number.isFinite(value) || value <= 0) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.currentCtx.speedOfSound = value;
            AL.updateListenerSpace(AL.currentCtx);
            break;
        case 53248:
            switch (value) {
            case 0:
            case 53249:
            case 53250:
            case 53251:
            case 53252:
            case 53253:
            case 53254:
                AL.currentCtx.distanceModel = value;
                AL.updateContextGlobal(AL.currentCtx);
                break;
            default:
                AL.currentCtx.err = 40963;
                return
            }
            break;
        default:
            AL.currentCtx.err = 40962;
            return
        }
    },
    getListenerParam: function(funcname, param) {
        if (!AL.currentCtx) {
            return null
        }
        switch (param) {
        case 4100:
            return AL.currentCtx.listener.position;
        case 4102:
            return AL.currentCtx.listener.velocity;
        case 4111:
            return AL.currentCtx.listener.direction.concat(AL.currentCtx.listener.up);
        case 4106:
            return AL.currentCtx.gain.gain.value;
        default:
            AL.currentCtx.err = 40962;
            return null
        }
    },
    setListenerParam: function(funcname, param, value) {
        if (!AL.currentCtx) {
            return
        }
        if (value === null) {
            AL.currentCtx.err = 40962;
            return
        }
        var listener = AL.currentCtx.listener;
        switch (param) {
        case 4100:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
                AL.currentCtx.err = 40963;
                return
            }
            listener.position[0] = value[0];
            listener.position[1] = value[1];
            listener.position[2] = value[2];
            AL.updateListenerSpace(AL.currentCtx);
            break;
        case 4102:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
                AL.currentCtx.err = 40963;
                return
            }
            listener.velocity[0] = value[0];
            listener.velocity[1] = value[1];
            listener.velocity[2] = value[2];
            AL.updateListenerSpace(AL.currentCtx);
            break;
        case 4106:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.currentCtx.gain.gain.value = value;
            break;
        case 4111:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2]) || !Number.isFinite(value[3]) || !Number.isFinite(value[4]) || !Number.isFinite(value[5])) {
                AL.currentCtx.err = 40963;
                return
            }
            listener.direction[0] = value[0];
            listener.direction[1] = value[1];
            listener.direction[2] = value[2];
            listener.up[0] = value[3];
            listener.up[1] = value[4];
            listener.up[2] = value[5];
            AL.updateListenerSpace(AL.currentCtx);
            break;
        default:
            AL.currentCtx.err = 40962;
            return
        }
    },
    getBufferParam: function(funcname, bufferId, param) {
        if (!AL.currentCtx) {
            return
        }
        var buf = AL.buffers[bufferId];
        if (!buf || bufferId === 0) {
            AL.currentCtx.err = 40961;
            return
        }
        switch (param) {
        case 8193:
            return buf.frequency;
        case 8194:
            return buf.bytesPerSample * 8;
        case 8195:
            return buf.channels;
        case 8196:
            return buf.length * buf.bytesPerSample * buf.channels;
        case 8213:
            if (buf.length === 0) {
                return [0, 0]
            } else {
                return [(buf.audioBuf._loopStart || 0) * buf.frequency, (buf.audioBuf._loopEnd || buf.length) * buf.frequency]
            }
        default:
            AL.currentCtx.err = 40962;
            return null
        }
    },
    setBufferParam: function(funcname, bufferId, param, value) {
        if (!AL.currentCtx) {
            return
        }
        var buf = AL.buffers[bufferId];
        if (!buf || bufferId === 0) {
            AL.currentCtx.err = 40961;
            return
        }
        if (value === null) {
            AL.currentCtx.err = 40962;
            return
        }
        switch (param) {
        case 8196:
            if (value !== 0) {
                AL.currentCtx.err = 40963;
                return
            }
            break;
        case 8213:
            if (value[0] < 0 || value[0] > buf.length || value[1] < 0 || value[1] > buf.Length || value[0] >= value[1]) {
                AL.currentCtx.err = 40963;
                return
            }
            if (buf.refCount > 0) {
                AL.currentCtx.err = 40964;
                return
            }
            if (buf.audioBuf) {
                buf.audioBuf._loopStart = value[0] / buf.frequency;
                buf.audioBuf._loopEnd = value[1] / buf.frequency
            }
            break;
        default:
            AL.currentCtx.err = 40962;
            return
        }
    },
    getSourceParam: function(funcname, sourceId, param) {
        if (!AL.currentCtx) {
            return null
        }
        var src = AL.currentCtx.sources[sourceId];
        if (!src) {
            AL.currentCtx.err = 40961;
            return null
        }
        switch (param) {
        case 514:
            return src.relative;
        case 4097:
            return src.coneInnerAngle;
        case 4098:
            return src.coneOuterAngle;
        case 4099:
            return src.pitch;
        case 4100:
            return src.position;
        case 4101:
            return src.direction;
        case 4102:
            return src.velocity;
        case 4103:
            return src.looping;
        case 4105:
            if (src.type === 4136) {
                return src.bufQueue[0].id
            } else {
                return 0
            }
        case 4106:
            return src.gain.gain.value;
        case 4109:
            return src.minGain;
        case 4110:
            return src.maxGain;
        case 4112:
            return src.state;
        case 4117:
            if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
                return 0
            } else {
                return src.bufQueue.length
            }
        case 4118:
            if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0 || src.looping) {
                return 0
            } else {
                return src.bufsProcessed
            }
        case 4128:
            return src.refDistance;
        case 4129:
            return src.rolloffFactor;
        case 4130:
            return src.coneOuterGain;
        case 4131:
            return src.maxDistance;
        case 4132:
            return AL.sourceTell(src);
        case 4133:
            var offset = AL.sourceTell(src);
            if (offset > 0) {
                offset *= src.bufQueue[0].frequency
            }
            return offset;
        case 4134:
            var offset = AL.sourceTell(src);
            if (offset > 0) {
                offset *= src.bufQueue[0].frequency * src.bufQueue[0].bytesPerSample
            }
            return offset;
        case 4135:
            return src.type;
        case 4628:
            return src.spatialize;
        case 8201:
            var length = 0;
            var bytesPerFrame = 0;
            for (var i = 0; i < src.bufQueue.length; i++) {
                length += src.bufQueue[i].length;
                if (src.bufQueue[i].id !== 0) {
                    bytesPerFrame = src.bufQueue[i].bytesPerSample * src.bufQueue[i].channels
                }
            }
            return length * bytesPerFrame;
        case 8202:
            var length = 0;
            for (var i = 0; i < src.bufQueue.length; i++) {
                length += src.bufQueue[i].length
            }
            return length;
        case 8203:
            return AL.sourceDuration(src);
        case 53248:
            return src.distanceModel;
        default:
            AL.currentCtx.err = 40962;
            return null
        }
    },
    setSourceParam: function(funcname, sourceId, param, value) {
        if (!AL.currentCtx) {
            return
        }
        var src = AL.currentCtx.sources[sourceId];
        if (!src) {
            AL.currentCtx.err = 40961;
            return
        }
        if (value === null) {
            AL.currentCtx.err = 40962;
            return
        }
        switch (param) {
        case 514:
            if (value === 1) {
                src.relative = true;
                AL.updateSourceSpace(src)
            } else if (value === 0) {
                src.relative = false;
                AL.updateSourceSpace(src)
            } else {
                AL.currentCtx.err = 40963;
                return
            }
            break;
        case 4097:
            if (!Number.isFinite(value)) {
                AL.currentCtx.err = 40963;
                return
            }
            src.coneInnerAngle = value;
            if (src.panner) {
                src.panner.coneInnerAngle = value % 360
            }
            break;
        case 4098:
            if (!Number.isFinite(value)) {
                AL.currentCtx.err = 40963;
                return
            }
            src.coneOuterAngle = value;
            if (src.panner) {
                src.panner.coneOuterAngle = value % 360
            }
            break;
        case 4099:
            if (!Number.isFinite(value) || value <= 0) {
                AL.currentCtx.err = 40963;
                return
            }
            if (src.pitch === value) {
                break
            }
            src.pitch = value;
            AL.updateSourceRate(src);
            break;
        case 4100:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
                AL.currentCtx.err = 40963;
                return
            }
            src.position[0] = value[0];
            src.position[1] = value[1];
            src.position[2] = value[2];
            AL.updateSourceSpace(src);
            break;
        case 4101:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
                AL.currentCtx.err = 40963;
                return
            }
            src.direction[0] = value[0];
            src.direction[1] = value[1];
            src.direction[2] = value[2];
            AL.updateSourceSpace(src);
            break;
        case 4102:
            if (!Number.isFinite(value[0]) || !Number.isFinite(value[1]) || !Number.isFinite(value[2])) {
                AL.currentCtx.err = 40963;
                return
            }
            src.velocity[0] = value[0];
            src.velocity[1] = value[1];
            src.velocity[2] = value[2];
            AL.updateSourceSpace(src);
            break;
        case 4103:
            if (value === 1) {
                src.looping = true;
                AL.updateSourceTime(src);
                if (src.type === 4136 && src.audioQueue.length > 0) {
                    var audioSrc = src.audioQueue[0];
                    audioSrc.loop = true;
                    audioSrc._duration = Number.POSITIVE_INFINITY
                }
            } else if (value === 0) {
                src.looping = false;
                var currentTime = AL.updateSourceTime(src);
                if (src.type === 4136 && src.audioQueue.length > 0) {
                    var audioSrc = src.audioQueue[0];
                    audioSrc.loop = false;
                    audioSrc._duration = src.bufQueue[0].audioBuf.duration / src.playbackRate;
                    audioSrc._startTime = currentTime - src.bufOffset / src.playbackRate
                }
            } else {
                AL.currentCtx.err = 40963;
                return
            }
            break;
        case 4105:
            if (src.state === 4114 || src.state === 4115) {
                AL.currentCtx.err = 40964;
                return
            }
            if (value === 0) {
                for (var i in src.bufQueue) {
                    src.bufQueue[i].refCount--
                }
                src.bufQueue.length = 1;
                src.bufQueue[0] = AL.buffers[0];
                src.bufsProcessed = 0;
                src.type = 4144
            } else {
                var buf = AL.buffers[value];
                if (!buf) {
                    AL.currentCtx.err = 40963;
                    return
                }
                for (var i in src.bufQueue) {
                    src.bufQueue[i].refCount--
                }
                src.bufQueue.length = 0;
                buf.refCount++;
                src.bufQueue = [buf];
                src.bufsProcessed = 0;
                src.type = 4136
            }
            AL.initSourcePanner(src);
            AL.scheduleSourceAudio(src);
            break;
        case 4106:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            src.gain.gain.value = value;
            break;
        case 4109:
            if (!Number.isFinite(value) || value < 0 || value > Math.min(src.maxGain, 1)) {
                AL.currentCtx.err = 40963;
                return
            }
            src.minGain = value;
            break;
        case 4110:
            if (!Number.isFinite(value) || value < Math.max(0, src.minGain) || value > 1) {
                AL.currentCtx.err = 40963;
                return
            }
            src.maxGain = value;
            break;
        case 4128:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            src.refDistance = value;
            if (src.panner) {
                src.panner.refDistance = value
            }
            break;
        case 4129:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            src.rolloffFactor = value;
            if (src.panner) {
                src.panner.rolloffFactor = value
            }
            break;
        case 4130:
            if (!Number.isFinite(value) || value < 0 || value > 1) {
                AL.currentCtx.err = 40963;
                return
            }
            src.coneOuterGain = value;
            if (src.panner) {
                src.panner.coneOuterGain = value
            }
            break;
        case 4131:
            if (!Number.isFinite(value) || value < 0) {
                AL.currentCtx.err = 40963;
                return
            }
            src.maxDistance = value;
            if (src.panner) {
                src.panner.maxDistance = value
            }
            break;
        case 4132:
            if (value < 0 || value > AL.sourceDuration(src)) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.sourceSeek(src, value);
            break;
        case 4133:
            var srcLen = AL.sourceDuration(src);
            if (srcLen > 0) {
                var frequency;
                for (var bufId in src.bufQueue) {
                    if (bufId !== 0) {
                        frequency = src.bufQueue[bufId].frequency;
                        break
                    }
                }
                value /= frequency
            }
            if (value < 0 || value > srcLen) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.sourceSeek(src, value);
            break;
        case 4134:
            var srcLen = AL.sourceDuration(src);
            if (srcLen > 0) {
                var bytesPerSec;
                for (var bufId in src.bufQueue) {
                    if (bufId !== 0) {
                        var buf = src.bufQueue[bufId];
                        bytesPerSec = buf.frequency * buf.bytesPerSample * buf.channels;
                        break
                    }
                }
                value /= bytesPerSec
            }
            if (value < 0 || value > srcLen) {
                AL.currentCtx.err = 40963;
                return
            }
            AL.sourceSeek(src, value);
            break;
        case 4628:
            if (value !== 0 && value !== 1 && value !== 2) {
                AL.currentCtx.err = 40963;
                return
            }
            src.spatialize = value;
            AL.initSourcePanner(src);
            break;
        case 8201:
        case 8202:
        case 8203:
            AL.currentCtx.err = 40964;
            break;
        case 53248:
            switch (value) {
            case 0:
            case 53249:
            case 53250:
            case 53251:
            case 53252:
            case 53253:
            case 53254:
                src.distanceModel = value;
                if (AL.currentCtx.sourceDistanceModel) {
                    AL.updateContextGlobal(AL.currentCtx)
                }
                break;
            default:
                AL.currentCtx.err = 40963;
                return
            }
            break;
        default:
            AL.currentCtx.err = 40962;
            return
        }
    },
    captures: {},
    sharedCaptureAudioCtx: null,
    requireValidCaptureDevice: function(deviceId, funcname) {
        if (deviceId === 0) {
            AL.alcErr = 40961;
            return null
        }
        var c = AL.captures[deviceId];
        if (!c) {
            AL.alcErr = 40961;
            return null
        }
        var err = c.mediaStreamError;
        if (err) {
            AL.alcErr = 40961;
            return null
        }
        return c
    }
};
function _alBufferData(bufferId, format, pData, size, freq) {
    if (!AL.currentCtx) {
        return
    }
    var buf = AL.buffers[bufferId];
    if (!buf) {
        AL.currentCtx.err = 40963;
        return
    }
    if (freq <= 0) {
        AL.currentCtx.err = 40963;
        return
    }
    var audioBuf = null;
    try {
        switch (format) {
        case 4352:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size, freq);
                var channel0 = audioBuf.getChannelData(0);
                for (var i = 0; i < size; ++i) {
                    channel0[i] = HEAPU8[pData++] * .0078125 - 1
                }
            }
            buf.bytesPerSample = 1;
            buf.channels = 1;
            buf.length = size;
            break;
        case 4353:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 1, freq);
                var channel0 = audioBuf.getChannelData(0);
                pData >>= 1;
                for (var i = 0; i < size >> 1; ++i) {
                    channel0[i] = HEAP16[pData++] * 30517578125e-15
                }
            }
            buf.bytesPerSample = 2;
            buf.channels = 1;
            buf.length = size >> 1;
            break;
        case 4354:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 1, freq);
                var channel0 = audioBuf.getChannelData(0);
                var channel1 = audioBuf.getChannelData(1);
                for (var i = 0; i < size >> 1; ++i) {
                    channel0[i] = HEAPU8[pData++] * .0078125 - 1;
                    channel1[i] = HEAPU8[pData++] * .0078125 - 1
                }
            }
            buf.bytesPerSample = 1;
            buf.channels = 2;
            buf.length = size >> 1;
            break;
        case 4355:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 2, freq);
                var channel0 = audioBuf.getChannelData(0);
                var channel1 = audioBuf.getChannelData(1);
                pData >>= 1;
                for (var i = 0; i < size >> 2; ++i) {
                    channel0[i] = HEAP16[pData++] * 30517578125e-15;
                    channel1[i] = HEAP16[pData++] * 30517578125e-15
                }
            }
            buf.bytesPerSample = 2;
            buf.channels = 2;
            buf.length = size >> 2;
            break;
        case 65552:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(1, size >> 2, freq);
                var channel0 = audioBuf.getChannelData(0);
                pData >>= 2;
                for (var i = 0; i < size >> 2; ++i) {
                    channel0[i] = HEAPF32[pData++]
                }
            }
            buf.bytesPerSample = 4;
            buf.channels = 1;
            buf.length = size >> 2;
            break;
        case 65553:
            if (size > 0) {
                audioBuf = AL.currentCtx.audioCtx.createBuffer(2, size >> 3, freq);
                var channel0 = audioBuf.getChannelData(0);
                var channel1 = audioBuf.getChannelData(1);
                pData >>= 2;
                for (var i = 0; i < size >> 3; ++i) {
                    channel0[i] = HEAPF32[pData++];
                    channel1[i] = HEAPF32[pData++]
                }
            }
            buf.bytesPerSample = 4;
            buf.channels = 2;
            buf.length = size >> 3;
            break;
        default:
            AL.currentCtx.err = 40963;
            return
        }
        buf.frequency = freq;
        buf.audioBuf = audioBuf
    } catch (e) {
        AL.currentCtx.err = 40963;
        return
    }
}
function _alDeleteBuffers(count, pBufferIds) {
    if (!AL.currentCtx) {
        return
    }
    for (var i = 0; i < count; ++i) {
        var bufId = HEAP32[pBufferIds + i * 4 >> 2];
        if (bufId === 0) {
            continue
        }
        if (!AL.buffers[bufId]) {
            AL.currentCtx.err = 40961;
            return
        }
        if (AL.buffers[bufId].refCount) {
            AL.currentCtx.err = 40964;
            return
        }
    }
    for (var i = 0; i < count; ++i) {
        var bufId = HEAP32[pBufferIds + i * 4 >> 2];
        if (bufId === 0) {
            continue
        }
        AL.deviceRefCounts[AL.buffers[bufId].deviceId]--;
        delete AL.buffers[bufId];
        AL.freeIds.push(bufId)
    }
}
function _alSourcei(sourceId, param, value) {
    switch (param) {
    case 514:
    case 4097:
    case 4098:
    case 4103:
    case 4105:
    case 4128:
    case 4129:
    case 4131:
    case 4132:
    case 4133:
    case 4134:
    case 4628:
    case 8201:
    case 8202:
    case 53248:
        AL.setSourceParam("alSourcei", sourceId, param, value);
        break;
    default:
        AL.setSourceParam("alSourcei", sourceId, param, null);
        break
    }
}
function _alDeleteSources(count, pSourceIds) {
    if (!AL.currentCtx) {
        return
    }
    for (var i = 0; i < count; ++i) {
        var srcId = HEAP32[pSourceIds + i * 4 >> 2];
        if (!AL.currentCtx.sources[srcId]) {
            AL.currentCtx.err = 40961;
            return
        }
    }
    for (var i = 0; i < count; ++i) {
        var srcId = HEAP32[pSourceIds + i * 4 >> 2];
        AL.setSourceState(AL.currentCtx.sources[srcId], 4116);
        _alSourcei(srcId, 4105, 0);
        delete AL.currentCtx.sources[srcId];
        AL.freeIds.push(srcId)
    }
}
function _alDistanceModel(model) {
    AL.setGlobalParam("alDistanceModel", 53248, model)
}
function _alGenBuffers(count, pBufferIds) {
    if (!AL.currentCtx) {
        return
    }
    for (var i = 0; i < count; ++i) {
        var buf = {
            deviceId: AL.currentCtx.deviceId,
            id: AL.newId(),
            refCount: 0,
            audioBuf: null,
            frequency: 0,
            bytesPerSample: 2,
            channels: 1,
            length: 0
        };
        AL.deviceRefCounts[buf.deviceId]++;
        AL.buffers[buf.id] = buf;
        HEAP32[pBufferIds + i * 4 >> 2] = buf.id
    }
}
function _alGenSources(count, pSourceIds) {
    if (!AL.currentCtx) {
        return
    }
    for (var i = 0; i < count; ++i) {
        var gain = AL.currentCtx.audioCtx.createGain();
        gain.connect(AL.currentCtx.gain);
        var src = {
            context: AL.currentCtx,
            id: AL.newId(),
            type: 4144,
            state: 4113,
            bufQueue: [AL.buffers[0]],
            audioQueue: [],
            looping: false,
            pitch: 1,
            dopplerShift: 1,
            gain: gain,
            minGain: 0,
            maxGain: 1,
            panner: null,
            bufsProcessed: 0,
            bufStartTime: Number.NEGATIVE_INFINITY,
            bufOffset: 0,
            relative: false,
            refDistance: 1,
            maxDistance: 3.40282e38,
            rolloffFactor: 1,
            position: [0, 0, 0],
            velocity: [0, 0, 0],
            direction: [0, 0, 0],
            coneOuterGain: 0,
            coneInnerAngle: 360,
            coneOuterAngle: 360,
            distanceModel: 53250,
            spatialize: 2,
            get playbackRate() {
                return this.pitch * this.dopplerShift
            }
        };
        AL.currentCtx.sources[src.id] = src;
        HEAP32[pSourceIds + i * 4 >> 2] = src.id
    }
}
function _alGetError() {
    if (!AL.currentCtx) {
        return 40964
    } else {
        var err = AL.currentCtx.err;
        AL.currentCtx.err = 0;
        return err
    }
}
function _alGetSourcef(sourceId, param, pValue) {
    var val = AL.getSourceParam("alGetSourcef", sourceId, param);
    if (val === null) {
        return
    }
    if (!pValue) {
        AL.currentCtx.err = 40963;
        return
    }
    switch (param) {
    case 4097:
    case 4098:
    case 4099:
    case 4106:
    case 4109:
    case 4110:
    case 4128:
    case 4129:
    case 4130:
    case 4131:
    case 4132:
    case 4133:
    case 4134:
    case 8203:
        HEAPF32[pValue >> 2] = val;
        break;
    default:
        AL.currentCtx.err = 40962;
        return
    }
}
function _alGetSourcei(sourceId, param, pValue) {
    var val = AL.getSourceParam("alGetSourcei", sourceId, param);
    if (val === null) {
        return
    }
    if (!pValue) {
        AL.currentCtx.err = 40963;
        return
    }
    switch (param) {
    case 514:
    case 4097:
    case 4098:
    case 4103:
    case 4105:
    case 4112:
    case 4117:
    case 4118:
    case 4128:
    case 4129:
    case 4131:
    case 4132:
    case 4133:
    case 4134:
    case 4135:
    case 4628:
    case 8201:
    case 8202:
    case 53248:
        HEAP32[pValue >> 2] = val;
        break;
    default:
        AL.currentCtx.err = 40962;
        return
    }
}
function _alListenerfv(param, pValues) {
    if (!AL.currentCtx) {
        return
    }
    if (!pValues) {
        AL.currentCtx.err = 40963;
        return
    }
    switch (param) {
    case 4100:
    case 4102:
        AL.paramArray[0] = HEAPF32[pValues >> 2];
        AL.paramArray[1] = HEAPF32[pValues + 4 >> 2];
        AL.paramArray[2] = HEAPF32[pValues + 8 >> 2];
        AL.setListenerParam("alListenerfv", param, AL.paramArray);
        break;
    case 4111:
        AL.paramArray[0] = HEAPF32[pValues >> 2];
        AL.paramArray[1] = HEAPF32[pValues + 4 >> 2];
        AL.paramArray[2] = HEAPF32[pValues + 8 >> 2];
        AL.paramArray[3] = HEAPF32[pValues + 12 >> 2];
        AL.paramArray[4] = HEAPF32[pValues + 16 >> 2];
        AL.paramArray[5] = HEAPF32[pValues + 20 >> 2];
        AL.setListenerParam("alListenerfv", param, AL.paramArray);
        break;
    default:
        AL.setListenerParam("alListenerfv", param, null);
        break
    }
}
function _alSource3f(sourceId, param, value0, value1, value2) {
    switch (param) {
    case 4100:
    case 4101:
    case 4102:
        AL.paramArray[0] = value0;
        AL.paramArray[1] = value1;
        AL.paramArray[2] = value2;
        AL.setSourceParam("alSource3f", sourceId, param, AL.paramArray);
        break;
    default:
        AL.setSourceParam("alSource3f", sourceId, param, null);
        break
    }
}
function _alSourcePlay(sourceId) {
    if (!AL.currentCtx) {
        return
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
        AL.currentCtx.err = 40961;
        return
    }
    AL.setSourceState(src, 4114)
}
function _alSourceQueueBuffers(sourceId, count, pBufferIds) {
    if (!AL.currentCtx) {
        return
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
        AL.currentCtx.err = 40961;
        return
    }
    if (src.type === 4136) {
        AL.currentCtx.err = 40964;
        return
    }
    if (count === 0) {
        return
    }
    var templateBuf = AL.buffers[0];
    for (var i = 0; i < src.bufQueue.length; i++) {
        if (src.bufQueue[i].id !== 0) {
            templateBuf = src.bufQueue[i];
            break
        }
    }
    for (var i = 0; i < count; ++i) {
        var bufId = HEAP32[pBufferIds + i * 4 >> 2];
        var buf = AL.buffers[bufId];
        if (!buf) {
            AL.currentCtx.err = 40961;
            return
        }
        if (templateBuf.id !== 0 && (buf.frequency !== templateBuf.frequency || buf.bytesPerSample !== templateBuf.bytesPerSample || buf.channels !== templateBuf.channels)) {
            AL.currentCtx.err = 40964
        }
    }
    if (src.bufQueue.length === 1 && src.bufQueue[0].id === 0) {
        src.bufQueue.length = 0
    }
    src.type = 4137;
    for (var i = 0; i < count; ++i) {
        var bufId = HEAP32[pBufferIds + i * 4 >> 2];
        var buf = AL.buffers[bufId];
        buf.refCount++;
        src.bufQueue.push(buf)
    }
    if (src.looping) {
        AL.cancelPendingSourceAudio(src)
    }
    AL.initSourcePanner(src);
    AL.scheduleSourceAudio(src)
}
function _alSourceStop(sourceId) {
    if (!AL.currentCtx) {
        return
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
        AL.currentCtx.err = 40961;
        return
    }
    AL.setSourceState(src, 4116)
}
function _alSourceUnqueueBuffers(sourceId, count, pBufferIds) {
    if (!AL.currentCtx) {
        return
    }
    var src = AL.currentCtx.sources[sourceId];
    if (!src) {
        AL.currentCtx.err = 40961;
        return
    }
    if (count > (src.bufQueue.length === 1 && src.bufQueue[0].id === 0 ? 0 : src.bufsProcessed)) {
        AL.currentCtx.err = 40963;
        return
    }
    if (count === 0) {
        return
    }
    for (var i = 0; i < count; i++) {
        var buf = src.bufQueue.shift();
        buf.refCount--;
        HEAP32[pBufferIds + i * 4 >> 2] = buf.id;
        src.bufsProcessed--
    }
    if (src.bufQueue.length === 0) {
        src.bufQueue.push(AL.buffers[0])
    }
    AL.initSourcePanner(src);
    AL.scheduleSourceAudio(src)
}
function _alSourcef(sourceId, param, value) {
    switch (param) {
    case 4097:
    case 4098:
    case 4099:
    case 4106:
    case 4109:
    case 4110:
    case 4128:
    case 4129:
    case 4130:
    case 4131:
    case 4132:
    case 4133:
    case 4134:
    case 8203:
        AL.setSourceParam("alSourcef", sourceId, param, value);
        break;
    default:
        AL.setSourceParam("alSourcef", sourceId, param, null);
        break
    }
}
function _alSourcefv(sourceId, param, pValues) {
    if (!AL.currentCtx) {
        return
    }
    if (!pValues) {
        AL.currentCtx.err = 40963;
        return
    }
    switch (param) {
    case 4097:
    case 4098:
    case 4099:
    case 4106:
    case 4109:
    case 4110:
    case 4128:
    case 4129:
    case 4130:
    case 4131:
    case 4132:
    case 4133:
    case 4134:
    case 8203:
        var val = HEAPF32[pValues >> 2];
        AL.setSourceParam("alSourcefv", sourceId, param, val);
        break;
    case 4100:
    case 4101:
    case 4102:
        AL.paramArray[0] = HEAPF32[pValues >> 2];
        AL.paramArray[1] = HEAPF32[pValues + 4 >> 2];
        AL.paramArray[2] = HEAPF32[pValues + 8 >> 2];
        AL.setSourceParam("alSourcefv", sourceId, param, AL.paramArray);
        break;
    default:
        AL.setSourceParam("alSourcefv", sourceId, param, null);
        break
    }
}
function _alcCloseDevice(deviceId) {
    if (!(deviceId in AL.deviceRefCounts) || AL.deviceRefCounts[deviceId] > 0) {
        return 0
    }
    delete AL.deviceRefCounts[deviceId];
    AL.freeIds.push(deviceId);
    return 1
}
function _alcCreateContext(deviceId, pAttrList) {
    if (!(deviceId in AL.deviceRefCounts)) {
        AL.alcErr = 40961;
        return 0
    }
    var options = null;
    var attrs = [];
    var hrtf = null;
    pAttrList >>= 2;
    if (pAttrList) {
        var attr = 0;
        var val = 0;
        while (true) {
            attr = HEAP32[pAttrList++];
            attrs.push(attr);
            if (attr === 0) {
                break
            }
            val = HEAP32[pAttrList++];
            attrs.push(val);
            switch (attr) {
            case 4103:
                if (!options) {
                    options = {}
                }
                options.sampleRate = val;
                break;
            case 4112:
            case 4113:
                break;
            case 6546:
                switch (val) {
                case 0:
                    hrtf = false;
                    break;
                case 1:
                    hrtf = true;
                    break;
                case 2:
                    break;
                default:
                    AL.alcErr = 40964;
                    return 0
                }
                break;
            case 6550:
                if (val !== 0) {
                    AL.alcErr = 40964;
                    return 0
                }
                break;
            default:
                AL.alcErr = 40964;
                return 0
            }
        }
    }
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    var ac = null;
    try {
        if (options) {
            ac = new AudioContext(options)
        } else {
            ac = new AudioContext
        }
    } catch (e) {
        if (e.name === "NotSupportedError") {
            AL.alcErr = 40964
        } else {
            AL.alcErr = 40961
        }
        return 0
    }
    if (typeof ac.createGain === "undefined") {
        ac.createGain = ac.createGainNode
    }
    var gain = ac.createGain();
    gain.connect(ac.destination);
    var ctx = {
        deviceId: deviceId,
        id: AL.newId(),
        attrs: attrs,
        audioCtx: ac,
        listener: {
            position: [0, 0, 0],
            velocity: [0, 0, 0],
            direction: [0, 0, 0],
            up: [0, 0, 0]
        },
        sources: [],
        interval: setInterval(function() {
            AL.scheduleContextAudio(ctx)
        }, AL.QUEUE_INTERVAL),
        gain: gain,
        distanceModel: 53250,
        speedOfSound: 343.3,
        dopplerFactor: 1,
        sourceDistanceModel: false,
        hrtf: hrtf || false,
        _err: 0,
        get err() {
            return this._err
        },
        set err(val) {
            if (this._err === 0 || val === 0) {
                this._err = val
            }
        }
    };
    AL.deviceRefCounts[deviceId]++;
    AL.contexts[ctx.id] = ctx;
    if (hrtf !== null) {
        for (var ctxId in AL.contexts) {
            var c = AL.contexts[ctxId];
            if (c.deviceId === deviceId) {
                c.hrtf = hrtf;
                AL.updateContextGlobal(c)
            }
        }
    }
    return ctx.id
}
function _alcDestroyContext(contextId) {
    var ctx = AL.contexts[contextId];
    if (AL.currentCtx === ctx) {
        AL.alcErr = 40962;
        return
    }
    if (AL.contexts[contextId].interval) {
        clearInterval(AL.contexts[contextId].interval)
    }
    AL.deviceRefCounts[ctx.deviceId]--;
    delete AL.contexts[contextId];
    AL.freeIds.push(contextId)
}
function _alcMakeContextCurrent(contextId) {
    if (contextId === 0) {
        AL.currentCtx = null;
        return 0
    } else {
        AL.currentCtx = AL.contexts[contextId];
        return 1
    }
}
function _alcOpenDevice(pDeviceName) {
    if (pDeviceName) {
        var name = UTF8ToString(pDeviceName);
        if (name !== AL.DEVICE_NAME) {
            return 0
        }
    }
    if (typeof AudioContext !== "undefined" || typeof webkitAudioContext !== "undefined") {
        var deviceId = AL.newId();
        AL.deviceRefCounts[deviceId] = 0;
        return deviceId
    } else {
        return 0
    }
}
var ___tm_current = 95815232;
var ___tm_timezone = (stringToUTF8("GMT", 95815280, 4),
95815280);
function _tzset() {
    if (_tzset.called)
        return;
    _tzset.called = true;
    HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;
    var winter = new Date(2e3,0,1);
    var summer = new Date(2e3,6,1);
    HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());
    function extractZone(date) {
        var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
        return match ? match[1] : "GMT"
    }
    var winterName = extractZone(winter);
    var summerName = extractZone(summer);
    var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
    var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
    if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
        HEAP32[__get_tzname() >> 2] = winterNamePtr;
        HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr
    } else {
        HEAP32[__get_tzname() >> 2] = summerNamePtr;
        HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr
    }
}
function _localtime_r(time, tmPtr) {
    _tzset();
    var date = new Date(HEAP32[time >> 2] * 1e3);
    HEAP32[tmPtr >> 2] = date.getSeconds();
    HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
    HEAP32[tmPtr + 8 >> 2] = date.getHours();
    HEAP32[tmPtr + 12 >> 2] = date.getDate();
    HEAP32[tmPtr + 16 >> 2] = date.getMonth();
    HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
    HEAP32[tmPtr + 24 >> 2] = date.getDay();
    var start = new Date(date.getFullYear(),0,1);
    var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
    HEAP32[tmPtr + 28 >> 2] = yday;
    HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
    var summerOffset = new Date(2e3,6,1).getTimezoneOffset();
    var winterOffset = start.getTimezoneOffset();
    var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
    HEAP32[tmPtr + 32 >> 2] = dst;
    var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
    HEAP32[tmPtr + 40 >> 2] = zonePtr;
    return tmPtr
}
function _asctime_r(tmPtr, buf) {
    var date = {
        tm_sec: HEAP32[tmPtr >> 2],
        tm_min: HEAP32[tmPtr + 4 >> 2],
        tm_hour: HEAP32[tmPtr + 8 >> 2],
        tm_mday: HEAP32[tmPtr + 12 >> 2],
        tm_mon: HEAP32[tmPtr + 16 >> 2],
        tm_year: HEAP32[tmPtr + 20 >> 2],
        tm_wday: HEAP32[tmPtr + 24 >> 2]
    };
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var s = days[date.tm_wday] + " " + months[date.tm_mon] + (date.tm_mday < 10 ? "  " : " ") + date.tm_mday + (date.tm_hour < 10 ? " 0" : " ") + date.tm_hour + (date.tm_min < 10 ? ":0" : ":") + date.tm_min + (date.tm_sec < 10 ? ":0" : ":") + date.tm_sec + " " + (1900 + date.tm_year) + "\n";
    stringToUTF8(s, buf, 26);
    return buf
}
function _ctime_r(time, buf) {
    var stack = stackSave();
    var rv = _asctime_r(_localtime_r(time, stackAlloc(44)), buf);
    stackRestore(stack);
    return rv
}
function _ctime(timer) {
    return _ctime_r(timer, ___tm_current)
}
var EGL = {
    errorCode: 12288,
    defaultDisplayInitialized: false,
    currentContext: 0,
    currentReadSurface: 0,
    currentDrawSurface: 0,
    contextAttributes: {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false
    },
    stringCache: {},
    setErrorCode: function(code) {
        EGL.errorCode = code
    },
    chooseConfig: function(display, attribList, config, config_size, numConfigs) {
        if (display != 62e3) {
            EGL.setErrorCode(12296);
            return 0
        }
        if (attribList) {
            for (; ; ) {
                var param = HEAP32[attribList >> 2];
                if (param == 12321) {
                    var alphaSize = HEAP32[attribList + 4 >> 2];
                    EGL.contextAttributes.alpha = alphaSize > 0
                } else if (param == 12325) {
                    var depthSize = HEAP32[attribList + 4 >> 2];
                    EGL.contextAttributes.depth = depthSize > 0
                } else if (param == 12326) {
                    var stencilSize = HEAP32[attribList + 4 >> 2];
                    EGL.contextAttributes.stencil = stencilSize > 0
                } else if (param == 12337) {
                    var samples = HEAP32[attribList + 4 >> 2];
                    EGL.contextAttributes.antialias = samples > 0
                } else if (param == 12338) {
                    var samples = HEAP32[attribList + 4 >> 2];
                    EGL.contextAttributes.antialias = samples == 1
                } else if (param == 12344) {
                    break
                }
                attribList += 8
            }
        }
        if ((!config || !config_size) && !numConfigs) {
            EGL.setErrorCode(12300);
            return 0
        }
        if (numConfigs) {
            HEAP32[numConfigs >> 2] = 1
        }
        if (config && config_size > 0) {
            HEAP32[config >> 2] = 62002
        }
        EGL.setErrorCode(12288);
        return 1
    }
};
function _eglBindAPI(api) {
    if (api == 12448) {
        EGL.setErrorCode(12288);
        return 1
    } else {
        EGL.setErrorCode(12300);
        return 0
    }
}
function _eglChooseConfig(display, attrib_list, configs, config_size, numConfigs) {
    return EGL.chooseConfig(display, attrib_list, configs, config_size, numConfigs)
}
var GL = {
    counter: 1,
    lastError: 0,
    buffers: [],
    mappedBuffers: {},
    programs: [],
    framebuffers: [],
    renderbuffers: [],
    textures: [],
    uniforms: [],
    shaders: [],
    vaos: [],
    contexts: {},
    currentContext: null,
    offscreenCanvases: {},
    timerQueriesEXT: [],
    programInfos: {},
    stringCache: {},
    unpackAlignment: 4,
    init: function() {
        GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
        for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
            GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1)
        }
    },
    recordError: function recordError(errorCode) {
        if (!GL.lastError) {
            GL.lastError = errorCode
        }
    },
    getNewId: function(table) {
        var ret = GL.counter++;
        for (var i = table.length; i < ret; i++) {
            table[i] = null
        }
        return ret
    },
    MINI_TEMP_BUFFER_SIZE: 256,
    miniTempBuffer: null,
    miniTempBufferViews: [0],
    getSource: function(shader, count, string, length) {
        var source = "";
        for (var i = 0; i < count; ++i) {
            var len = length ? HEAP32[length + i * 4 >> 2] : -1;
            source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len)
        }
        return source
    },
    createContext: function(canvas, webGLContextAttributes) {
        var ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
        return ctx && GL.registerContext(ctx, webGLContextAttributes)
    },
    registerContext: function(ctx, webGLContextAttributes) {
        var handle = _malloc(8);
        var context = {
            handle: handle,
            attributes: webGLContextAttributes,
            version: webGLContextAttributes.majorVersion,
            GLctx: ctx
        };
        if (ctx.canvas)
            ctx.canvas.GLctxObject = context;
        GL.contexts[handle] = context;
        if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
            GL.initExtensions(context)
        }
        return handle
    },
    makeContextCurrent: function(contextHandle) {
        GL.currentContext = GL.contexts[contextHandle];
        Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
        return !(contextHandle && !GLctx)
    },
    getContext: function(contextHandle) {
        return GL.contexts[contextHandle]
    },
    deleteContext: function(contextHandle) {
        if (GL.currentContext === GL.contexts[contextHandle])
            GL.currentContext = null;
        if (typeof JSEvents === "object")
            JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas)
            GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
        _free(GL.contexts[contextHandle]);
        GL.contexts[contextHandle] = null
    },
    initExtensions: function(context) {
        if (!context)
            context = GL.currentContext;
        if (context.initExtensionsDone)
            return;
        context.initExtensionsDone = true;
        var GLctx = context.GLctx;
        if (context.version < 2) {
            var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
            if (instancedArraysExt) {
                GLctx["vertexAttribDivisor"] = function(index, divisor) {
                    instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor)
                }
                ;
                GLctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
                    instancedArraysExt["drawArraysInstancedANGLE"](mode, first, count, primcount)
                }
                ;
                GLctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
                    instancedArraysExt["drawElementsInstancedANGLE"](mode, count, type, indices, primcount)
                }
            }
            var vaoExt = GLctx.getExtension("OES_vertex_array_object");
            if (vaoExt) {
                GLctx["createVertexArray"] = function() {
                    return vaoExt["createVertexArrayOES"]()
                }
                ;
                GLctx["deleteVertexArray"] = function(vao) {
                    vaoExt["deleteVertexArrayOES"](vao)
                }
                ;
                GLctx["bindVertexArray"] = function(vao) {
                    vaoExt["bindVertexArrayOES"](vao)
                }
                ;
                GLctx["isVertexArray"] = function(vao) {
                    return vaoExt["isVertexArrayOES"](vao)
                }
            }
            var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
            if (drawBuffersExt) {
                GLctx["drawBuffers"] = function(n, bufs) {
                    drawBuffersExt["drawBuffersWEBGL"](n, bufs)
                }
            }
        }
        GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
        var automaticallyEnabledExtensions = ["OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2"];
        var exts = GLctx.getSupportedExtensions();
        if (exts && exts.length > 0) {
            GLctx.getSupportedExtensions().forEach(function(ext) {
                if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
                    GLctx.getExtension(ext)
                }
            })
        }
    },
    populateUniformTable: function(program) {
        var p = GL.programs[program];
        var ptable = GL.programInfos[program] = {
            uniforms: {},
            maxUniformLength: 0,
            maxAttributeLength: -1,
            maxUniformBlockNameLength: -1
        };
        var utable = ptable.uniforms;
        var numUniforms = GLctx.getProgramParameter(p, 35718);
        for (var i = 0; i < numUniforms; ++i) {
            var u = GLctx.getActiveUniform(p, i);
            var name = u.name;
            ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
            if (name.slice(-1) == "]") {
                name = name.slice(0, name.lastIndexOf("["))
            }
            var loc = GLctx.getUniformLocation(p, name);
            if (loc) {
                var id = GL.getNewId(GL.uniforms);
                utable[name] = [u.size, id];
                GL.uniforms[id] = loc;
                for (var j = 1; j < u.size; ++j) {
                    var n = name + "[" + j + "]";
                    loc = GLctx.getUniformLocation(p, n);
                    id = GL.getNewId(GL.uniforms);
                    GL.uniforms[id] = loc
                }
            }
        }
    }
};
function _eglCreateContext(display, config, hmm, contextAttribs) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    var glesContextVersion = 1;
    for (; ; ) {
        var param = HEAP32[contextAttribs >> 2];
        if (param == 12440) {
            glesContextVersion = HEAP32[contextAttribs + 4 >> 2]
        } else if (param == 12344) {
            break
        } else {
            EGL.setErrorCode(12292);
            return 0
        }
        contextAttribs += 8
    }
    if (glesContextVersion != 2) {
        EGL.setErrorCode(12293);
        return 0
    }
    EGL.contextAttributes.majorVersion = glesContextVersion - 1;
    EGL.contextAttributes.minorVersion = 0;
    EGL.context = GL.createContext(Module["canvas"], EGL.contextAttributes);
    if (EGL.context != 0) {
        EGL.setErrorCode(12288);
        GL.makeContextCurrent(EGL.context);
        Module.useWebGL = true;
        Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
            callback()
        });
        GL.makeContextCurrent(null);
        return 62004
    } else {
        EGL.setErrorCode(12297);
        return 0
    }
}
function _eglCreateWindowSurface(display, config, win, attrib_list) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (config != 62002) {
        EGL.setErrorCode(12293);
        return 0
    }
    EGL.setErrorCode(12288);
    return 62006
}
function _eglDestroyContext(display, context) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (context != 62004) {
        EGL.setErrorCode(12294);
        return 0
    }
    EGL.setErrorCode(12288);
    return 1
}
function _eglDestroySurface(display, surface) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (surface != 62006) {
        EGL.setErrorCode(12301);
        return 1
    }
    if (EGL.currentReadSurface == surface) {
        EGL.currentReadSurface = 0
    }
    if (EGL.currentDrawSurface == surface) {
        EGL.currentDrawSurface = 0
    }
    EGL.setErrorCode(12288);
    return 1
}
function _eglGetConfigAttrib(display, config, attribute, value) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (config != 62002) {
        EGL.setErrorCode(12293);
        return 0
    }
    if (!value) {
        EGL.setErrorCode(12300);
        return 0
    }
    EGL.setErrorCode(12288);
    switch (attribute) {
    case 12320:
        HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 32 : 24;
        return 1;
    case 12321:
        HEAP32[value >> 2] = EGL.contextAttributes.alpha ? 8 : 0;
        return 1;
    case 12322:
        HEAP32[value >> 2] = 8;
        return 1;
    case 12323:
        HEAP32[value >> 2] = 8;
        return 1;
    case 12324:
        HEAP32[value >> 2] = 8;
        return 1;
    case 12325:
        HEAP32[value >> 2] = EGL.contextAttributes.depth ? 24 : 0;
        return 1;
    case 12326:
        HEAP32[value >> 2] = EGL.contextAttributes.stencil ? 8 : 0;
        return 1;
    case 12327:
        HEAP32[value >> 2] = 12344;
        return 1;
    case 12328:
        HEAP32[value >> 2] = 62002;
        return 1;
    case 12329:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12330:
        HEAP32[value >> 2] = 4096;
        return 1;
    case 12331:
        HEAP32[value >> 2] = 16777216;
        return 1;
    case 12332:
        HEAP32[value >> 2] = 4096;
        return 1;
    case 12333:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12334:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12335:
        HEAP32[value >> 2] = 12344;
        return 1;
    case 12337:
        HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 4 : 0;
        return 1;
    case 12338:
        HEAP32[value >> 2] = EGL.contextAttributes.antialias ? 1 : 0;
        return 1;
    case 12339:
        HEAP32[value >> 2] = 4;
        return 1;
    case 12340:
        HEAP32[value >> 2] = 12344;
        return 1;
    case 12341:
    case 12342:
    case 12343:
        HEAP32[value >> 2] = -1;
        return 1;
    case 12345:
    case 12346:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12347:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12348:
        HEAP32[value >> 2] = 1;
        return 1;
    case 12349:
    case 12350:
        HEAP32[value >> 2] = 0;
        return 1;
    case 12351:
        HEAP32[value >> 2] = 12430;
        return 1;
    case 12352:
        HEAP32[value >> 2] = 4;
        return 1;
    case 12354:
        HEAP32[value >> 2] = 0;
        return 1;
    default:
        EGL.setErrorCode(12292);
        return 0
    }
}
function _eglGetDisplay(nativeDisplayType) {
    EGL.setErrorCode(12288);
    return 62e3
}
function _eglGetError() {
    return EGL.errorCode
}
function _eglGetProcAddress(name_) {
    return _emscripten_GetProcAddress(name_)
}
function _eglInitialize(display, majorVersion, minorVersion) {
    if (display == 62e3) {
        if (majorVersion) {
            HEAP32[majorVersion >> 2] = 1
        }
        if (minorVersion) {
            HEAP32[minorVersion >> 2] = 4
        }
        EGL.defaultDisplayInitialized = true;
        EGL.setErrorCode(12288);
        return 1
    } else {
        EGL.setErrorCode(12296);
        return 0
    }
}
function _eglMakeCurrent(display, draw, read, context) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (context != 0 && context != 62004) {
        EGL.setErrorCode(12294);
        return 0
    }
    if (read != 0 && read != 62006 || draw != 0 && draw != 62006) {
        EGL.setErrorCode(12301);
        return 0
    }
    GL.makeContextCurrent(context ? EGL.context : null);
    EGL.currentContext = context;
    EGL.currentDrawSurface = draw;
    EGL.currentReadSurface = read;
    EGL.setErrorCode(12288);
    return 1
}
function _eglQueryString(display, name) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    EGL.setErrorCode(12288);
    if (EGL.stringCache[name])
        return EGL.stringCache[name];
    var ret;
    switch (name) {
    case 12371:
        ret = allocate(intArrayFromString("Emscripten"), "i8", ALLOC_NORMAL);
        break;
    case 12372:
        ret = allocate(intArrayFromString("1.4 Emscripten EGL"), "i8", ALLOC_NORMAL);
        break;
    case 12373:
        ret = allocate(intArrayFromString(""), "i8", ALLOC_NORMAL);
        break;
    case 12429:
        ret = allocate(intArrayFromString("OpenGL_ES"), "i8", ALLOC_NORMAL);
        break;
    default:
        EGL.setErrorCode(12300);
        return 0
    }
    EGL.stringCache[name] = ret;
    return ret
}
function _eglSwapBuffers() {
    if (!EGL.defaultDisplayInitialized) {
        EGL.setErrorCode(12289)
    } else if (!Module.ctx) {
        EGL.setErrorCode(12290)
    } else if (Module.ctx.isContextLost()) {
        EGL.setErrorCode(12302)
    } else {
        EGL.setErrorCode(12288);
        return 1
    }
    return 0
}
function _eglSwapInterval(display, interval) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    if (interval == 0)
        _emscripten_set_main_loop_timing(0, 0);
    else
        _emscripten_set_main_loop_timing(1, interval);
    EGL.setErrorCode(12288);
    return 1
}
function _eglTerminate(display) {
    if (display != 62e3) {
        EGL.setErrorCode(12296);
        return 0
    }
    EGL.currentContext = 0;
    EGL.currentReadSurface = 0;
    EGL.currentDrawSurface = 0;
    EGL.defaultDisplayInitialized = false;
    EGL.setErrorCode(12288);
    return 1
}
function _eglWaitClient() {
    EGL.setErrorCode(12288);
    return 1
}
function _eglWaitGL() {
    return _eglWaitClient.apply(null, arguments)
}
function _eglWaitNative(nativeEngineId) {
    EGL.setErrorCode(12288);
    return 1
}
function _emscripten_cancel_main_loop() {
    Browser.mainLoop.pause();
    Browser.mainLoop.func = null
}
var JSEvents = {
    keyEvent: 0,
    mouseEvent: 0,
    wheelEvent: 0,
    uiEvent: 0,
    focusEvent: 0,
    deviceOrientationEvent: 0,
    deviceMotionEvent: 0,
    fullscreenChangeEvent: 0,
    pointerlockChangeEvent: 0,
    visibilityChangeEvent: 0,
    touchEvent: 0,
    previousFullscreenElement: null,
    previousScreenX: null,
    previousScreenY: null,
    removeEventListenersRegistered: false,
    removeAllEventListeners: function() {
        for (var i = JSEvents.eventHandlers.length - 1; i >= 0; --i) {
            JSEvents._removeHandler(i)
        }
        JSEvents.eventHandlers = [];
        JSEvents.deferredCalls = []
    },
    registerRemoveEventListeners: function() {
        if (!JSEvents.removeEventListenersRegistered) {
            __ATEXIT__.push(JSEvents.removeAllEventListeners);
            JSEvents.removeEventListenersRegistered = true
        }
    },
    deferredCalls: [],
    deferCall: function(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
            if (arrA.length != arrB.length)
                return false;
            for (var i in arrA) {
                if (arrA[i] != arrB[i])
                    return false
            }
            return true
        }
        for (var i in JSEvents.deferredCalls) {
            var call = JSEvents.deferredCalls[i];
            if (call.targetFunction == targetFunction && arraysHaveEqualContent(call.argsList, argsList)) {
                return
            }
        }
        JSEvents.deferredCalls.push({
            targetFunction: targetFunction,
            precedence: precedence,
            argsList: argsList
        });
        JSEvents.deferredCalls.sort(function(x, y) {
            return x.precedence < y.precedence
        })
    },
    removeDeferredCalls: function(targetFunction) {
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
                JSEvents.deferredCalls.splice(i, 1);
                --i
            }
        }
    },
    canPerformEventHandlerRequests: function() {
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls
    },
    runDeferredCalls: function() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
            return
        }
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
            var call = JSEvents.deferredCalls[i];
            JSEvents.deferredCalls.splice(i, 1);
            --i;
            call.targetFunction.apply(this, call.argsList)
        }
    },
    inEventHandler: 0,
    currentEventHandler: null,
    eventHandlers: [],
    isInternetExplorer: function() {
        return navigator.userAgent.indexOf("MSIE") !== -1 || navigator.appVersion.indexOf("Trident/") > 0
    },
    removeAllHandlersOnTarget: function(target, eventTypeString) {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (JSEvents.eventHandlers[i].target == target && (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)) {
                JSEvents._removeHandler(i--)
            }
        }
    },
    _removeHandler: function(i) {
        var h = JSEvents.eventHandlers[i];
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture);
        JSEvents.eventHandlers.splice(i, 1)
    },
    registerOrRemoveHandler: function(eventHandler) {
        var jsEventHandler = function jsEventHandler(event) {
            ++JSEvents.inEventHandler;
            JSEvents.currentEventHandler = eventHandler;
            JSEvents.runDeferredCalls();
            eventHandler.handlerFunc(event);
            JSEvents.runDeferredCalls();
            --JSEvents.inEventHandler
        };
        if (eventHandler.callbackfunc) {
            eventHandler.eventListenerFunc = jsEventHandler;
            eventHandler.target.addEventListener(eventHandler.eventTypeString, jsEventHandler, eventHandler.useCapture);
            JSEvents.eventHandlers.push(eventHandler);
            JSEvents.registerRemoveEventListeners()
        } else {
            for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
                if (JSEvents.eventHandlers[i].target == eventHandler.target && JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString) {
                    JSEvents._removeHandler(i--)
                }
            }
        }
    },
    getBoundingClientRectOrZeros: function(target) {
        return target.getBoundingClientRect ? target.getBoundingClientRect() : {
            left: 0,
            top: 0
        }
    },
    pageScrollPos: function() {
        if (window.pageXOffset > 0 || window.pageYOffset > 0) {
            return [window.pageXOffset, window.pageYOffset]
        }
        if (typeof document.documentElement.scrollLeft !== "undefined" || typeof document.documentElement.scrollTop !== "undefined") {
            return [document.documentElement.scrollLeft, document.documentElement.scrollTop]
        }
        return [document.body.scrollLeft | 0, document.body.scrollTop | 0]
    },
    getNodeNameForTarget: function(target) {
        if (!target)
            return "";
        if (target == window)
            return "#window";
        if (target == screen)
            return "#screen";
        return target && target.nodeName ? target.nodeName : ""
    },
    tick: function() {
        if (window["performance"] && window["performance"]["now"])
            return window["performance"]["now"]();
        else
            return Date.now()
    },
    fullscreenEnabled: function() {
        return document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled
    }
};
var __currentFullscreenStrategy = {};
var __specialEventTargets = [0, typeof document !== "undefined" ? document : 0, typeof window !== "undefined" ? window : 0];
function __findEventTarget(target) {
    try {
        if (!target)
            return window;
        if (typeof target === "number")
            target = __specialEventTargets[target] || UTF8ToString(target);
        if (target === "#window")
            return window;
        else if (target === "#document")
            return document;
        else if (target === "#screen")
            return screen;
        else if (target === "#canvas")
            return Module["canvas"];
        return typeof target === "string" ? document.getElementById(target) : target
    } catch (e) {
        return null
    }
}
function __findCanvasEventTarget(target) {
    if (typeof target === "number")
        target = UTF8ToString(target);
    if (!target || target === "#canvas") {
        if (typeof GL !== "undefined" && GL.offscreenCanvases["canvas"])
            return GL.offscreenCanvases["canvas"];
        return Module["canvas"]
    }
    if (typeof GL !== "undefined" && GL.offscreenCanvases[target])
        return GL.offscreenCanvases[target];
    return __findEventTarget(target)
}
function _emscripten_get_canvas_element_size(target, width, height) {
    var canvas = __findCanvasEventTarget(target);
    if (!canvas)
        return -4;
    HEAP32[width >> 2] = canvas.width;
    HEAP32[height >> 2] = canvas.height
}
function __get_canvas_element_size(target) {
    var stackTop = stackSave();
    var w = stackAlloc(8);
    var h = w + 4;
    var targetInt = stackAlloc(target.id.length + 1);
    stringToUTF8(target.id, targetInt, target.id.length + 1);
    var ret = _emscripten_get_canvas_element_size(targetInt, w, h);
    var size = [HEAP32[w >> 2], HEAP32[h >> 2]];
    stackRestore(stackTop);
    return size
}
function _emscripten_set_canvas_element_size(target, width, height) {
    var canvas = __findCanvasEventTarget(target);
    if (!canvas)
        return -4;
    canvas.width = width;
    canvas.height = height;
    return 0
}
function __set_canvas_element_size(target, width, height) {
    if (!target.controlTransferredOffscreen) {
        target.width = width;
        target.height = height
    } else {
        var stackTop = stackSave();
        var targetInt = stackAlloc(target.id.length + 1);
        stringToUTF8(target.id, targetInt, target.id.length + 1);
        _emscripten_set_canvas_element_size(targetInt, width, height);
        stackRestore(stackTop)
    }
}
function __registerRestoreOldStyle(canvas) {
    var canvasSize = __get_canvas_element_size(canvas);
    var oldWidth = canvasSize[0];
    var oldHeight = canvasSize[1];
    var oldCssWidth = canvas.style.width;
    var oldCssHeight = canvas.style.height;
    var oldBackgroundColor = canvas.style.backgroundColor;
    var oldDocumentBackgroundColor = document.body.style.backgroundColor;
    var oldPaddingLeft = canvas.style.paddingLeft;
    var oldPaddingRight = canvas.style.paddingRight;
    var oldPaddingTop = canvas.style.paddingTop;
    var oldPaddingBottom = canvas.style.paddingBottom;
    var oldMarginLeft = canvas.style.marginLeft;
    var oldMarginRight = canvas.style.marginRight;
    var oldMarginTop = canvas.style.marginTop;
    var oldMarginBottom = canvas.style.marginBottom;
    var oldDocumentBodyMargin = document.body.style.margin;
    var oldDocumentOverflow = document.documentElement.style.overflow;
    var oldDocumentScroll = document.body.scroll;
    var oldImageRendering = canvas.style.imageRendering;
    function restoreOldStyle() {
        var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        if (!fullscreenElement) {
            document.removeEventListener("fullscreenchange", restoreOldStyle);
            document.removeEventListener("mozfullscreenchange", restoreOldStyle);
            document.removeEventListener("webkitfullscreenchange", restoreOldStyle);
            document.removeEventListener("MSFullscreenChange", restoreOldStyle);
            __set_canvas_element_size(canvas, oldWidth, oldHeight);
            canvas.style.width = oldCssWidth;
            canvas.style.height = oldCssHeight;
            canvas.style.backgroundColor = oldBackgroundColor;
            if (!oldDocumentBackgroundColor)
                document.body.style.backgroundColor = "white";
            document.body.style.backgroundColor = oldDocumentBackgroundColor;
            canvas.style.paddingLeft = oldPaddingLeft;
            canvas.style.paddingRight = oldPaddingRight;
            canvas.style.paddingTop = oldPaddingTop;
            canvas.style.paddingBottom = oldPaddingBottom;
            canvas.style.marginLeft = oldMarginLeft;
            canvas.style.marginRight = oldMarginRight;
            canvas.style.marginTop = oldMarginTop;
            canvas.style.marginBottom = oldMarginBottom;
            document.body.style.margin = oldDocumentBodyMargin;
            document.documentElement.style.overflow = oldDocumentOverflow;
            document.body.scroll = oldDocumentScroll;
            canvas.style.imageRendering = oldImageRendering;
            if (canvas.GLctxObject)
                canvas.GLctxObject.GLctx.viewport(0, 0, oldWidth, oldHeight);
            if (__currentFullscreenStrategy.canvasResizedCallback) {
                dynCall_iiii(__currentFullscreenStrategy.canvasResizedCallback, 37, 0, __currentFullscreenStrategy.canvasResizedCallbackUserData)
            }
        }
    }
    document.addEventListener("fullscreenchange", restoreOldStyle);
    document.addEventListener("mozfullscreenchange", restoreOldStyle);
    document.addEventListener("webkitfullscreenchange", restoreOldStyle);
    document.addEventListener("MSFullscreenChange", restoreOldStyle);
    return restoreOldStyle
}
function __setLetterbox(element, topBottom, leftRight) {
    if (JSEvents.isInternetExplorer()) {
        element.style.marginLeft = element.style.marginRight = leftRight + "px";
        element.style.marginTop = element.style.marginBottom = topBottom + "px"
    } else {
        element.style.paddingLeft = element.style.paddingRight = leftRight + "px";
        element.style.paddingTop = element.style.paddingBottom = topBottom + "px"
    }
}
function _JSEvents_resizeCanvasForFullscreen(target, strategy) {
    var restoreOldStyle = __registerRestoreOldStyle(target);
    var cssWidth = strategy.softFullscreen ? window.innerWidth : screen.width;
    var cssHeight = strategy.softFullscreen ? window.innerHeight : screen.height;
    var rect = target.getBoundingClientRect();
    var windowedCssWidth = rect.right - rect.left;
    var windowedCssHeight = rect.bottom - rect.top;
    var canvasSize = __get_canvas_element_size(target);
    var windowedRttWidth = canvasSize[0];
    var windowedRttHeight = canvasSize[1];
    if (strategy.scaleMode == 3) {
        __setLetterbox(target, (cssHeight - windowedCssHeight) / 2, (cssWidth - windowedCssWidth) / 2);
        cssWidth = windowedCssWidth;
        cssHeight = windowedCssHeight
    } else if (strategy.scaleMode == 2) {
        if (cssWidth * windowedRttHeight < windowedRttWidth * cssHeight) {
            var desiredCssHeight = windowedRttHeight * cssWidth / windowedRttWidth;
            __setLetterbox(target, (cssHeight - desiredCssHeight) / 2, 0);
            cssHeight = desiredCssHeight
        } else {
            var desiredCssWidth = windowedRttWidth * cssHeight / windowedRttHeight;
            __setLetterbox(target, 0, (cssWidth - desiredCssWidth) / 2);
            cssWidth = desiredCssWidth
        }
    }
    if (!target.style.backgroundColor)
        target.style.backgroundColor = "black";
    if (!document.body.style.backgroundColor)
        document.body.style.backgroundColor = "black";
    target.style.width = cssWidth + "px";
    target.style.height = cssHeight + "px";
    if (strategy.filteringMode == 1) {
        target.style.imageRendering = "optimizeSpeed";
        target.style.imageRendering = "-moz-crisp-edges";
        target.style.imageRendering = "-o-crisp-edges";
        target.style.imageRendering = "-webkit-optimize-contrast";
        target.style.imageRendering = "optimize-contrast";
        target.style.imageRendering = "crisp-edges";
        target.style.imageRendering = "pixelated"
    }
    var dpiScale = strategy.canvasResolutionScaleMode == 2 ? window.devicePixelRatio : 1;
    if (strategy.canvasResolutionScaleMode != 0) {
        var newWidth = cssWidth * dpiScale | 0;
        var newHeight = cssHeight * dpiScale | 0;
        __set_canvas_element_size(target, newWidth, newHeight);
        if (target.GLctxObject)
            target.GLctxObject.GLctx.viewport(0, 0, newWidth, newHeight)
    }
    return restoreOldStyle
}
function _JSEvents_requestFullscreen(target, strategy) {
    if (strategy.scaleMode != 0 || strategy.canvasResolutionScaleMode != 0) {
        _JSEvents_resizeCanvasForFullscreen(target, strategy)
    }
    if (target.requestFullscreen) {
        target.requestFullscreen()
    } else if (target.msRequestFullscreen) {
        target.msRequestFullscreen()
    } else if (target.mozRequestFullScreen) {
        target.mozRequestFullScreen()
    } else if (target.mozRequestFullscreen) {
        target.mozRequestFullscreen()
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT)
    } else {
        if (typeof JSEvents.fullscreenEnabled() === "undefined") {
            return -1
        } else {
            return -3
        }
    }
    if (strategy.canvasResizedCallback) {
        dynCall_iiii(strategy.canvasResizedCallback, 37, 0, strategy.canvasResizedCallbackUserData)
    }
    return 0
}
function _emscripten_exit_fullscreen() {
    if (typeof JSEvents.fullscreenEnabled() === "undefined")
        return -1;
    JSEvents.removeDeferredCalls(_JSEvents_requestFullscreen);
    var d = __specialEventTargets[1];
    if (d.exitFullscreen) {
        d.fullscreenElement && d.exitFullscreen()
    } else if (d.msExitFullscreen) {
        d.msFullscreenElement && d.msExitFullscreen()
    } else if (d.mozCancelFullScreen) {
        d.mozFullScreenElement && d.mozCancelFullScreen()
    } else if (d.webkitExitFullscreen) {
        d.webkitFullscreenElement && d.webkitExitFullscreen()
    } else {
        return -1
    }
    if (__currentFullscreenStrategy.canvasResizedCallback) {
        dynCall_iiii(__currentFullscreenStrategy.canvasResizedCallback, 37, 0, __currentFullscreenStrategy.canvasResizedCallbackUserData);
        __currentFullscreenStrategy = 0
    }
    return 0
}
function __requestPointerLock(target) {
    if (target.requestPointerLock) {
        target.requestPointerLock()
    } else if (target.mozRequestPointerLock) {
        target.mozRequestPointerLock()
    } else if (target.webkitRequestPointerLock) {
        target.webkitRequestPointerLock()
    } else if (target.msRequestPointerLock) {
        target.msRequestPointerLock()
    } else {
        if (document.body.requestPointerLock || document.body.mozRequestPointerLock || document.body.webkitRequestPointerLock || document.body.msRequestPointerLock) {
            return -3
        } else {
            return -1
        }
    }
    return 0
}
function _emscripten_exit_pointerlock() {
    JSEvents.removeDeferredCalls(__requestPointerLock);
    if (document.exitPointerLock) {
        document.exitPointerLock()
    } else if (document.msExitPointerLock) {
        document.msExitPointerLock()
    } else if (document.mozExitPointerLock) {
        document.mozExitPointerLock()
    } else if (document.webkitExitPointerLock) {
        document.webkitExitPointerLock()
    } else {
        return -1
    }
    return 0
}
function _emscripten_exit_with_live_runtime() {
    Module["noExitRuntime"] = true;
    throw "SimulateInfiniteLoop"
}
function _emscripten_force_exit(status) {
    Module["noExitRuntime"] = false;
    exit(status)
}
function _emscripten_get_device_pixel_ratio() {
    return window.devicePixelRatio || 1
}
function _emscripten_get_element_css_size(target, width, height) {
    target = target ? __findEventTarget(target) : Module["canvas"];
    if (!target)
        return -4;
    if (target.getBoundingClientRect) {
        var rect = target.getBoundingClientRect();
        HEAPF64[width >> 3] = rect.right - rect.left;
        HEAPF64[height >> 3] = rect.bottom - rect.top
    } else {
        HEAPF64[width >> 3] = target.clientWidth;
        HEAPF64[height >> 3] = target.clientHeight
    }
    return 0
}
function _emscripten_get_heap_size() {
    return TOTAL_MEMORY
}
function _emscripten_glActiveTexture(x0) {
    GLctx["activeTexture"](x0)
}
function _emscripten_glAttachShader(program, shader) {
    GLctx.attachShader(GL.programs[program], GL.shaders[shader])
}
function _emscripten_glBeginQueryEXT(target, id) {
    GLctx.disjointTimerQueryExt["beginQueryEXT"](target, GL.timerQueriesEXT[id])
}
function _emscripten_glBindAttribLocation(program, index, name) {
    GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name))
}
function _emscripten_glBindBuffer(target, buffer) {
    GLctx.bindBuffer(target, GL.buffers[buffer])
}
function _emscripten_glBindFramebuffer(target, framebuffer) {
    GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer])
}
function _emscripten_glBindRenderbuffer(target, renderbuffer) {
    GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer])
}
function _emscripten_glBindTexture(target, texture) {
    GLctx.bindTexture(target, GL.textures[texture])
}
function _emscripten_glBindVertexArrayOES(vao) {
    GLctx["bindVertexArray"](GL.vaos[vao])
}
function _emscripten_glBlendColor(x0, x1, x2, x3) {
    GLctx["blendColor"](x0, x1, x2, x3)
}
function _emscripten_glBlendEquation(x0) {
    GLctx["blendEquation"](x0)
}
function _emscripten_glBlendEquationSeparate(x0, x1) {
    GLctx["blendEquationSeparate"](x0, x1)
}
function _emscripten_glBlendFunc(x0, x1) {
    GLctx["blendFunc"](x0, x1)
}
function _emscripten_glBlendFuncSeparate(x0, x1, x2, x3) {
    GLctx["blendFuncSeparate"](x0, x1, x2, x3)
}
function _emscripten_glBufferData(target, size, data, usage) {
    GLctx.bufferData(target, data ? HEAPU8.subarray(data, data + size) : size, usage)
}
function _emscripten_glBufferSubData(target, offset, size, data) {
    GLctx.bufferSubData(target, offset, HEAPU8.subarray(data, data + size))
}
function _emscripten_glCheckFramebufferStatus(x0) {
    return GLctx["checkFramebufferStatus"](x0)
}
function _emscripten_glClear(x0) {
    GLctx["clear"](x0)
}
function _emscripten_glClearColor(x0, x1, x2, x3) {
    GLctx["clearColor"](x0, x1, x2, x3)
}
function _emscripten_glClearDepthf(x0) {
    GLctx["clearDepth"](x0)
}
function _emscripten_glClearStencil(x0) {
    GLctx["clearStencil"](x0)
}
function _emscripten_glColorMask(red, green, blue, alpha) {
    GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
}
function _emscripten_glCompileShader(shader) {
    GLctx.compileShader(GL.shaders[shader])
}
function _emscripten_glCompressedTexImage2D(target, level, internalFormat, width, height, border, imageSize, data) {
    GLctx["compressedTexImage2D"](target, level, internalFormat, width, height, border, data ? HEAPU8.subarray(data, data + imageSize) : null)
}
function _emscripten_glCompressedTexSubImage2D(target, level, xoffset, yoffset, width, height, format, imageSize, data) {
    GLctx["compressedTexSubImage2D"](target, level, xoffset, yoffset, width, height, format, data ? HEAPU8.subarray(data, data + imageSize) : null)
}
function _emscripten_glCopyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
    GLctx["copyTexImage2D"](x0, x1, x2, x3, x4, x5, x6, x7)
}
function _emscripten_glCopyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7) {
    GLctx["copyTexSubImage2D"](x0, x1, x2, x3, x4, x5, x6, x7)
}
function _emscripten_glCreateProgram() {
    var id = GL.getNewId(GL.programs);
    var program = GLctx.createProgram();
    program.name = id;
    GL.programs[id] = program;
    return id
}
function _emscripten_glCreateShader(shaderType) {
    var id = GL.getNewId(GL.shaders);
    GL.shaders[id] = GLctx.createShader(shaderType);
    return id
}
function _emscripten_glCullFace(x0) {
    GLctx["cullFace"](x0)
}
function _emscripten_glDeleteBuffers(n, buffers) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[buffers + i * 4 >> 2];
        var buffer = GL.buffers[id];
        if (!buffer)
            continue;
        GLctx.deleteBuffer(buffer);
        buffer.name = 0;
        GL.buffers[id] = null;
        if (id == GL.currArrayBuffer)
            GL.currArrayBuffer = 0;
        if (id == GL.currElementArrayBuffer)
            GL.currElementArrayBuffer = 0
    }
}
function _emscripten_glDeleteFramebuffers(n, framebuffers) {
    for (var i = 0; i < n; ++i) {
        var id = HEAP32[framebuffers + i * 4 >> 2];
        var framebuffer = GL.framebuffers[id];
        if (!framebuffer)
            continue;
        GLctx.deleteFramebuffer(framebuffer);
        framebuffer.name = 0;
        GL.framebuffers[id] = null
    }
}
function _emscripten_glDeleteProgram(id) {
    if (!id)
        return;
    var program = GL.programs[id];
    if (!program) {
        GL.recordError(1281);
        return
    }
    GLctx.deleteProgram(program);
    program.name = 0;
    GL.programs[id] = null;
    GL.programInfos[id] = null
}
function _emscripten_glDeleteQueriesEXT(n, ids) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[ids + i * 4 >> 2];
        var query = GL.timerQueriesEXT[id];
        if (!query)
            continue;
        GLctx.disjointTimerQueryExt["deleteQueryEXT"](query);
        GL.timerQueriesEXT[id] = null
    }
}
function _emscripten_glDeleteRenderbuffers(n, renderbuffers) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[renderbuffers + i * 4 >> 2];
        var renderbuffer = GL.renderbuffers[id];
        if (!renderbuffer)
            continue;
        GLctx.deleteRenderbuffer(renderbuffer);
        renderbuffer.name = 0;
        GL.renderbuffers[id] = null
    }
}
function _emscripten_glDeleteShader(id) {
    if (!id)
        return;
    var shader = GL.shaders[id];
    if (!shader) {
        GL.recordError(1281);
        return
    }
    GLctx.deleteShader(shader);
    GL.shaders[id] = null
}
function _emscripten_glDeleteTextures(n, textures) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[textures + i * 4 >> 2];
        var texture = GL.textures[id];
        if (!texture)
            continue;
        GLctx.deleteTexture(texture);
        texture.name = 0;
        GL.textures[id] = null
    }
}
function _emscripten_glDeleteVertexArraysOES(n, vaos) {
    for (var i = 0; i < n; i++) {
        var id = HEAP32[vaos + i * 4 >> 2];
        GLctx["deleteVertexArray"](GL.vaos[id]);
        GL.vaos[id] = null
    }
}
function _emscripten_glDepthFunc(x0) {
    GLctx["depthFunc"](x0)
}
function _emscripten_glDepthMask(flag) {
    GLctx.depthMask(!!flag)
}
function _emscripten_glDepthRangef(x0, x1) {
    GLctx["depthRange"](x0, x1)
}
function _emscripten_glDetachShader(program, shader) {
    GLctx.detachShader(GL.programs[program], GL.shaders[shader])
}
function _emscripten_glDisable(x0) {
    GLctx["disable"](x0)
}
function _emscripten_glDisableVertexAttribArray(index) {
    GLctx.disableVertexAttribArray(index)
}
function _emscripten_glDrawArrays(mode, first, count) {
    GLctx.drawArrays(mode, first, count)
}
function _emscripten_glDrawArraysInstancedANGLE(mode, first, count, primcount) {
    GLctx["drawArraysInstanced"](mode, first, count, primcount)
}
var __tempFixedLengthArray = [];
function _emscripten_glDrawBuffersWEBGL(n, bufs) {
    var bufArray = __tempFixedLengthArray[n];
    for (var i = 0; i < n; i++) {
        bufArray[i] = HEAP32[bufs + i * 4 >> 2]
    }
    GLctx["drawBuffers"](bufArray)
}
function _emscripten_glDrawElements(mode, count, type, indices) {
    GLctx.drawElements(mode, count, type, indices)
}
function _emscripten_glDrawElementsInstancedANGLE(mode, count, type, indices, primcount) {
    GLctx["drawElementsInstanced"](mode, count, type, indices, primcount)
}
function _emscripten_glEnable(x0) {
    GLctx["enable"](x0)
}
function _emscripten_glEnableVertexAttribArray(index) {
    GLctx.enableVertexAttribArray(index)
}
function _emscripten_glEndQueryEXT(target) {
    GLctx.disjointTimerQueryExt["endQueryEXT"](target)
}
function _emscripten_glFinish() {
    GLctx["finish"]()
}
function _emscripten_glFlush() {
    GLctx["flush"]()
}
function _emscripten_glFramebufferRenderbuffer(target, attachment, renderbuffertarget, renderbuffer) {
    GLctx.framebufferRenderbuffer(target, attachment, renderbuffertarget, GL.renderbuffers[renderbuffer])
}
function _emscripten_glFramebufferTexture2D(target, attachment, textarget, texture, level) {
    GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level)
}
function _emscripten_glFrontFace(x0) {
    GLctx["frontFace"](x0)
}
function __glGenObject(n, buffers, createFunction, objectTable) {
    for (var i = 0; i < n; i++) {
        var buffer = GLctx[createFunction]();
        var id = buffer && GL.getNewId(objectTable);
        if (buffer) {
            buffer.name = id;
            objectTable[id] = buffer
        } else {
            GL.recordError(1282)
        }
        HEAP32[buffers + i * 4 >> 2] = id
    }
}
function _emscripten_glGenBuffers(n, buffers) {
    __glGenObject(n, buffers, "createBuffer", GL.buffers)
}
function _emscripten_glGenFramebuffers(n, ids) {
    __glGenObject(n, ids, "createFramebuffer", GL.framebuffers)
}
function _emscripten_glGenQueriesEXT(n, ids) {
    for (var i = 0; i < n; i++) {
        var query = GLctx.disjointTimerQueryExt["createQueryEXT"]();
        if (!query) {
            GL.recordError(1282);
            while (i < n)
                HEAP32[ids + i++ * 4 >> 2] = 0;
            return
        }
        var id = GL.getNewId(GL.timerQueriesEXT);
        query.name = id;
        GL.timerQueriesEXT[id] = query;
        HEAP32[ids + i * 4 >> 2] = id
    }
}
function _emscripten_glGenRenderbuffers(n, renderbuffers) {
    __glGenObject(n, renderbuffers, "createRenderbuffer", GL.renderbuffers)
}
function _emscripten_glGenTextures(n, textures) {
    __glGenObject(n, textures, "createTexture", GL.textures)
}
function _emscripten_glGenVertexArraysOES(n, arrays) {
    __glGenObject(n, arrays, "createVertexArray", GL.vaos)
}
function _emscripten_glGenerateMipmap(x0) {
    GLctx["generateMipmap"](x0)
}
function _emscripten_glGetActiveAttrib(program, index, bufSize, length, size, type, name) {
    program = GL.programs[program];
    var info = GLctx.getActiveAttrib(program, index);
    if (!info)
        return;
    if (bufSize > 0 && name) {
        var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
        if (length)
            HEAP32[length >> 2] = numBytesWrittenExclNull
    } else {
        if (length)
            HEAP32[length >> 2] = 0
    }
    if (size)
        HEAP32[size >> 2] = info.size;
    if (type)
        HEAP32[type >> 2] = info.type
}
function _emscripten_glGetActiveUniform(program, index, bufSize, length, size, type, name) {
    program = GL.programs[program];
    var info = GLctx.getActiveUniform(program, index);
    if (!info)
        return;
    if (bufSize > 0 && name) {
        var numBytesWrittenExclNull = stringToUTF8(info.name, name, bufSize);
        if (length)
            HEAP32[length >> 2] = numBytesWrittenExclNull
    } else {
        if (length)
            HEAP32[length >> 2] = 0
    }
    if (size)
        HEAP32[size >> 2] = info.size;
    if (type)
        HEAP32[type >> 2] = info.type
}
function _emscripten_glGetAttachedShaders(program, maxCount, count, shaders) {
    var result = GLctx.getAttachedShaders(GL.programs[program]);
    var len = result.length;
    if (len > maxCount) {
        len = maxCount
    }
    HEAP32[count >> 2] = len;
    for (var i = 0; i < len; ++i) {
        var id = GL.shaders.indexOf(result[i]);
        HEAP32[shaders + i * 4 >> 2] = id
    }
}
function _emscripten_glGetAttribLocation(program, name) {
    return GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name))
}
function emscriptenWebGLGet(name_, p, type) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    var ret = undefined;
    switch (name_) {
    case 36346:
        ret = 1;
        break;
    case 36344:
        if (type !== "Integer" && type !== "Integer64") {
            GL.recordError(1280)
        }
        return;
    case 36345:
        ret = 0;
        break;
    case 34466:
        var formats = GLctx.getParameter(34467);
        ret = formats ? formats.length : 0;
        break
    }
    if (ret === undefined) {
        var result = GLctx.getParameter(name_);
        switch (typeof result) {
        case "number":
            ret = result;
            break;
        case "boolean":
            ret = result ? 1 : 0;
            break;
        case "string":
            GL.recordError(1280);
            return;
        case "object":
            if (result === null) {
                switch (name_) {
                case 34964:
                case 35725:
                case 34965:
                case 36006:
                case 36007:
                case 32873:
                case 34229:
                case 34068:
                    {
                        ret = 0;
                        break
                    }
                default:
                    {
                        GL.recordError(1280);
                        return
                    }
                }
            } else if (result instanceof Float32Array || result instanceof Uint32Array || result instanceof Int32Array || result instanceof Array) {
                for (var i = 0; i < result.length; ++i) {
                    switch (type) {
                    case "Integer":
                        HEAP32[p + i * 4 >> 2] = result[i];
                        break;
                    case "Float":
                        HEAPF32[p + i * 4 >> 2] = result[i];
                        break;
                    case "Boolean":
                        HEAP8[p + i >> 0] = result[i] ? 1 : 0;
                        break;
                    default:
                        throw "internal glGet error, bad type: " + type
                    }
                }
                return
            } else {
                try {
                    ret = result.name | 0
                } catch (e) {
                    GL.recordError(1280);
                    err("GL_INVALID_ENUM in glGet" + type + "v: Unknown object returned from WebGL getParameter(" + name_ + ")! (error: " + e + ")");
                    return
                }
            }
            break;
        default:
            GL.recordError(1280);
            return
        }
    }
    switch (type) {
    case "Integer64":
        tempI64 = [ret >>> 0, (tempDouble = ret,
        +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
        HEAP32[p >> 2] = tempI64[0],
        HEAP32[p + 4 >> 2] = tempI64[1];
        break;
    case "Integer":
        HEAP32[p >> 2] = ret;
        break;
    case "Float":
        HEAPF32[p >> 2] = ret;
        break;
    case "Boolean":
        HEAP8[p >> 0] = ret ? 1 : 0;
        break;
    default:
        throw "internal glGet error, bad type: " + type
    }
}
function _emscripten_glGetBooleanv(name_, p) {
    emscriptenWebGLGet(name_, p, "Boolean")
}
function _emscripten_glGetBufferParameteriv(target, value, data) {
    if (!data) {
        GL.recordError(1281);
        return
    }
    HEAP32[data >> 2] = GLctx.getBufferParameter(target, value)
}
function _emscripten_glGetError() {
    if (GL.lastError) {
        var error = GL.lastError;
        GL.lastError = 0;
        return error
    } else {
        return GLctx.getError()
    }
}
function _emscripten_glGetFloatv(name_, p) {
    emscriptenWebGLGet(name_, p, "Float")
}
function _emscripten_glGetFramebufferAttachmentParameteriv(target, attachment, pname, params) {
    var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname);
    if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
        result = result.name | 0
    }
    HEAP32[params >> 2] = result
}
function _emscripten_glGetIntegerv(name_, p) {
    emscriptenWebGLGet(name_, p, "Integer")
}
function _emscripten_glGetProgramInfoLog(program, maxLength, length, infoLog) {
    var log = GLctx.getProgramInfoLog(GL.programs[program]);
    if (log === null)
        log = "(unknown error)";
    if (maxLength > 0 && infoLog) {
        var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
        if (length)
            HEAP32[length >> 2] = numBytesWrittenExclNull
    } else {
        if (length)
            HEAP32[length >> 2] = 0
    }
}
function _emscripten_glGetProgramiv(program, pname, p) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (program >= GL.counter) {
        GL.recordError(1281);
        return
    }
    var ptable = GL.programInfos[program];
    if (!ptable) {
        GL.recordError(1282);
        return
    }
    if (pname == 35716) {
        var log = GLctx.getProgramInfoLog(GL.programs[program]);
        if (log === null)
            log = "(unknown error)";
        HEAP32[p >> 2] = log.length + 1
    } else if (pname == 35719) {
        HEAP32[p >> 2] = ptable.maxUniformLength
    } else if (pname == 35722) {
        if (ptable.maxAttributeLength == -1) {
            program = GL.programs[program];
            var numAttribs = GLctx.getProgramParameter(program, 35721);
            ptable.maxAttributeLength = 0;
            for (var i = 0; i < numAttribs; ++i) {
                var activeAttrib = GLctx.getActiveAttrib(program, i);
                ptable.maxAttributeLength = Math.max(ptable.maxAttributeLength, activeAttrib.name.length + 1)
            }
        }
        HEAP32[p >> 2] = ptable.maxAttributeLength
    } else if (pname == 35381) {
        if (ptable.maxUniformBlockNameLength == -1) {
            program = GL.programs[program];
            var numBlocks = GLctx.getProgramParameter(program, 35382);
            ptable.maxUniformBlockNameLength = 0;
            for (var i = 0; i < numBlocks; ++i) {
                var activeBlockName = GLctx.getActiveUniformBlockName(program, i);
                ptable.maxUniformBlockNameLength = Math.max(ptable.maxUniformBlockNameLength, activeBlockName.length + 1)
            }
        }
        HEAP32[p >> 2] = ptable.maxUniformBlockNameLength
    } else {
        HEAP32[p >> 2] = GLctx.getProgramParameter(GL.programs[program], pname)
    }
}
function _emscripten_glGetQueryObjecti64vEXT(id, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var query = GL.timerQueriesEXT[id];
    var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
    var ret;
    if (typeof param == "boolean") {
        ret = param ? 1 : 0
    } else {
        ret = param
    }
    tempI64 = [ret >>> 0, (tempDouble = ret,
    +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
    HEAP32[params >> 2] = tempI64[0],
    HEAP32[params + 4 >> 2] = tempI64[1]
}
function _emscripten_glGetQueryObjectivEXT(id, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var query = GL.timerQueriesEXT[id];
    var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
    var ret;
    if (typeof param == "boolean") {
        ret = param ? 1 : 0
    } else {
        ret = param
    }
    HEAP32[params >> 2] = ret
}
function _emscripten_glGetQueryObjectui64vEXT(id, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var query = GL.timerQueriesEXT[id];
    var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
    var ret;
    if (typeof param == "boolean") {
        ret = param ? 1 : 0
    } else {
        ret = param
    }
    tempI64 = [ret >>> 0, (tempDouble = ret,
    +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
    HEAP32[params >> 2] = tempI64[0],
    HEAP32[params + 4 >> 2] = tempI64[1]
}
function _emscripten_glGetQueryObjectuivEXT(id, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var query = GL.timerQueriesEXT[id];
    var param = GLctx.disjointTimerQueryExt["getQueryObjectEXT"](query, pname);
    var ret;
    if (typeof param == "boolean") {
        ret = param ? 1 : 0
    } else {
        ret = param
    }
    HEAP32[params >> 2] = ret
}
function _emscripten_glGetQueryivEXT(target, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    HEAP32[params >> 2] = GLctx.disjointTimerQueryExt["getQueryEXT"](target, pname)
}
function _emscripten_glGetRenderbufferParameteriv(target, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    HEAP32[params >> 2] = GLctx.getRenderbufferParameter(target, pname)
}
function _emscripten_glGetShaderInfoLog(shader, maxLength, length, infoLog) {
    var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
    if (log === null)
        log = "(unknown error)";
    if (maxLength > 0 && infoLog) {
        var numBytesWrittenExclNull = stringToUTF8(log, infoLog, maxLength);
        if (length)
            HEAP32[length >> 2] = numBytesWrittenExclNull
    } else {
        if (length)
            HEAP32[length >> 2] = 0
    }
}
function _emscripten_glGetShaderPrecisionFormat(shaderType, precisionType, range, precision) {
    var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType);
    HEAP32[range >> 2] = result.rangeMin;
    HEAP32[range + 4 >> 2] = result.rangeMax;
    HEAP32[precision >> 2] = result.precision
}
function _emscripten_glGetShaderSource(shader, bufSize, length, source) {
    var result = GLctx.getShaderSource(GL.shaders[shader]);
    if (!result)
        return;
    if (bufSize > 0 && source) {
        var numBytesWrittenExclNull = stringToUTF8(result, source, bufSize);
        if (length)
            HEAP32[length >> 2] = numBytesWrittenExclNull
    } else {
        if (length)
            HEAP32[length >> 2] = 0
    }
}
function _emscripten_glGetShaderiv(shader, pname, p) {
    if (!p) {
        GL.recordError(1281);
        return
    }
    if (pname == 35716) {
        var log = GLctx.getShaderInfoLog(GL.shaders[shader]);
        if (log === null)
            log = "(unknown error)";
        HEAP32[p >> 2] = log.length + 1
    } else if (pname == 35720) {
        var source = GLctx.getShaderSource(GL.shaders[shader]);
        var sourceLength = source === null || source.length == 0 ? 0 : source.length + 1;
        HEAP32[p >> 2] = sourceLength
    } else {
        HEAP32[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
    }
}
function stringToNewUTF8(jsString) {
    var length = lengthBytesUTF8(jsString) + 1;
    var cString = _malloc(length);
    stringToUTF8(jsString, cString, length);
    return cString
}
function _emscripten_glGetString(name_) {
    if (GL.stringCache[name_])
        return GL.stringCache[name_];
    var ret;
    switch (name_) {
    case 7939:
        var exts = GLctx.getSupportedExtensions();
        var gl_exts = [];
        for (var i = 0; i < exts.length; ++i) {
            gl_exts.push(exts[i]);
            gl_exts.push("GL_" + exts[i])
        }
        ret = stringToNewUTF8(gl_exts.join(" "));
        break;
    case 7936:
    case 7937:
    case 37445:
    case 37446:
        var s = GLctx.getParameter(name_);
        if (!s) {
            GL.recordError(1280)
        }
        ret = stringToNewUTF8(s);
        break;
    case 7938:
        var glVersion = GLctx.getParameter(GLctx.VERSION);
        {
            glVersion = "OpenGL ES 2.0 (" + glVersion + ")"
        }
        ret = stringToNewUTF8(glVersion);
        break;
    case 35724:
        var glslVersion = GLctx.getParameter(GLctx.SHADING_LANGUAGE_VERSION);
        var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/;
        var ver_num = glslVersion.match(ver_re);
        if (ver_num !== null) {
            if (ver_num[1].length == 3)
                ver_num[1] = ver_num[1] + "0";
            glslVersion = "OpenGL ES GLSL ES " + ver_num[1] + " (" + glslVersion + ")"
        }
        ret = stringToNewUTF8(glslVersion);
        break;
    default:
        GL.recordError(1280);
        return 0
    }
    GL.stringCache[name_] = ret;
    return ret
}
function _emscripten_glGetTexParameterfv(target, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    HEAPF32[params >> 2] = GLctx.getTexParameter(target, pname)
}
function _emscripten_glGetTexParameteriv(target, pname, params) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    HEAP32[params >> 2] = GLctx.getTexParameter(target, pname)
}
function _emscripten_glGetUniformLocation(program, name) {
    name = UTF8ToString(name);
    var arrayIndex = 0;
    if (name[name.length - 1] == "]") {
        var leftBrace = name.lastIndexOf("[");
        arrayIndex = name[leftBrace + 1] != "]" ? parseInt(name.slice(leftBrace + 1)) : 0;
        name = name.slice(0, leftBrace)
    }
    var uniformInfo = GL.programInfos[program] && GL.programInfos[program].uniforms[name];
    if (uniformInfo && arrayIndex >= 0 && arrayIndex < uniformInfo[0]) {
        return uniformInfo[1] + arrayIndex
    } else {
        return -1
    }
}
function emscriptenWebGLGetUniform(program, location, params, type) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var data = GLctx.getUniform(GL.programs[program], GL.uniforms[location]);
    if (typeof data == "number" || typeof data == "boolean") {
        switch (type) {
        case "Integer":
            HEAP32[params >> 2] = data;
            break;
        case "Float":
            HEAPF32[params >> 2] = data;
            break;
        default:
            throw "internal emscriptenWebGLGetUniform() error, bad type: " + type
        }
    } else {
        for (var i = 0; i < data.length; i++) {
            switch (type) {
            case "Integer":
                HEAP32[params + i * 4 >> 2] = data[i];
                break;
            case "Float":
                HEAPF32[params + i * 4 >> 2] = data[i];
                break;
            default:
                throw "internal emscriptenWebGLGetUniform() error, bad type: " + type
            }
        }
    }
}
function _emscripten_glGetUniformfv(program, location, params) {
    emscriptenWebGLGetUniform(program, location, params, "Float")
}
function _emscripten_glGetUniformiv(program, location, params) {
    emscriptenWebGLGetUniform(program, location, params, "Integer")
}
function _emscripten_glGetVertexAttribPointerv(index, pname, pointer) {
    if (!pointer) {
        GL.recordError(1281);
        return
    }
    HEAP32[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname)
}
function emscriptenWebGLGetVertexAttrib(index, pname, params, type) {
    if (!params) {
        GL.recordError(1281);
        return
    }
    var data = GLctx.getVertexAttrib(index, pname);
    if (pname == 34975) {
        HEAP32[params >> 2] = data["name"]
    } else if (typeof data == "number" || typeof data == "boolean") {
        switch (type) {
        case "Integer":
            HEAP32[params >> 2] = data;
            break;
        case "Float":
            HEAPF32[params >> 2] = data;
            break;
        case "FloatToInteger":
            HEAP32[params >> 2] = Math.fround(data);
            break;
        default:
            throw "internal emscriptenWebGLGetVertexAttrib() error, bad type: " + type
        }
    } else {
        for (var i = 0; i < data.length; i++) {
            switch (type) {
            case "Integer":
                HEAP32[params + i * 4 >> 2] = data[i];
                break;
            case "Float":
                HEAPF32[params + i * 4 >> 2] = data[i];
                break;
            case "FloatToInteger":
                HEAP32[params + i * 4 >> 2] = Math.fround(data[i]);
                break;
            default:
                throw "internal emscriptenWebGLGetVertexAttrib() error, bad type: " + type
            }
        }
    }
}
function _emscripten_glGetVertexAttribfv(index, pname, params) {
    emscriptenWebGLGetVertexAttrib(index, pname, params, "Float")
}
function _emscripten_glGetVertexAttribiv(index, pname, params) {
    emscriptenWebGLGetVertexAttrib(index, pname, params, "FloatToInteger")
}
function _emscripten_glHint(x0, x1) {
    GLctx["hint"](x0, x1)
}
function _emscripten_glIsBuffer(buffer) {
    var b = GL.buffers[buffer];
    if (!b)
        return 0;
    return GLctx.isBuffer(b)
}
function _emscripten_glIsEnabled(x0) {
    return GLctx["isEnabled"](x0)
}
function _emscripten_glIsFramebuffer(framebuffer) {
    var fb = GL.framebuffers[framebuffer];
    if (!fb)
        return 0;
    return GLctx.isFramebuffer(fb)
}
function _emscripten_glIsProgram(program) {
    program = GL.programs[program];
    if (!program)
        return 0;
    return GLctx.isProgram(program)
}
function _emscripten_glIsQueryEXT(id) {
    var query = GL.timerQueriesEXT[id];
    if (!query)
        return 0;
    return GLctx.disjointTimerQueryExt["isQueryEXT"](query)
}
function _emscripten_glIsRenderbuffer(renderbuffer) {
    var rb = GL.renderbuffers[renderbuffer];
    if (!rb)
        return 0;
    return GLctx.isRenderbuffer(rb)
}
function _emscripten_glIsShader(shader) {
    var s = GL.shaders[shader];
    if (!s)
        return 0;
    return GLctx.isShader(s)
}
function _emscripten_glIsTexture(id) {
    var texture = GL.textures[id];
    if (!texture)
        return 0;
    return GLctx.isTexture(texture)
}
function _emscripten_glIsVertexArrayOES(array) {
    var vao = GL.vaos[array];
    if (!vao)
        return 0;
    return GLctx["isVertexArray"](vao)
}
function _emscripten_glLineWidth(x0) {
    GLctx["lineWidth"](x0)
}
function _emscripten_glLinkProgram(program) {
    GLctx.linkProgram(GL.programs[program]);
    GL.populateUniformTable(program)
}
function _emscripten_glPixelStorei(pname, param) {
    if (pname == 3317) {
        GL.unpackAlignment = param
    }
    GLctx.pixelStorei(pname, param)
}
function _emscripten_glPolygonOffset(x0, x1) {
    GLctx["polygonOffset"](x0, x1)
}
function _emscripten_glQueryCounterEXT(id, target) {
    GLctx.disjointTimerQueryExt["queryCounterEXT"](GL.timerQueriesEXT[id], target)
}
function __computeUnpackAlignedImageSize(width, height, sizePerPixel, alignment) {
    function roundedToNextMultipleOf(x, y) {
        return x + y - 1 & -y
    }
    var plainRowSize = width * sizePerPixel;
    var alignedRowSize = roundedToNextMultipleOf(plainRowSize, alignment);
    return height * alignedRowSize
}
var __colorChannelsInGlTextureFormat = {
    6402: 1,
    6406: 1,
    6407: 3,
    6408: 4,
    6409: 1,
    6410: 2,
    35904: 3,
    35906: 4
};
var __sizeOfGlTextureElementType = {
    5121: 1,
    5123: 2,
    5125: 4,
    5126: 4,
    32819: 2,
    32820: 2,
    33635: 2,
    34042: 4,
    36193: 2
};
function emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) {
    var sizePerPixel = __colorChannelsInGlTextureFormat[format] * __sizeOfGlTextureElementType[type];
    if (!sizePerPixel) {
        GL.recordError(1280);
        return
    }
    var bytes = __computeUnpackAlignedImageSize(width, height, sizePerPixel, GL.unpackAlignment);
    var end = pixels + bytes;
    switch (type) {
    case 5121:
        return HEAPU8.subarray(pixels, end);
    case 5126:
        return HEAPF32.subarray(pixels >> 2, end >> 2);
    case 5125:
    case 34042:
        return HEAPU32.subarray(pixels >> 2, end >> 2);
    case 5123:
    case 33635:
    case 32819:
    case 32820:
    case 36193:
        return HEAPU16.subarray(pixels >> 1, end >> 1);
    default:
        GL.recordError(1280)
    }
}
function _emscripten_glReadPixels(x, y, width, height, format, type, pixels) {
    var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format);
    if (!pixelData) {
        GL.recordError(1280);
        return
    }
    GLctx.readPixels(x, y, width, height, format, type, pixelData)
}
function _emscripten_glReleaseShaderCompiler() {}
function _emscripten_glRenderbufferStorage(x0, x1, x2, x3) {
    GLctx["renderbufferStorage"](x0, x1, x2, x3)
}
function _emscripten_glSampleCoverage(value, invert) {
    GLctx.sampleCoverage(value, !!invert)
}
function _emscripten_glScissor(x0, x1, x2, x3) {
    GLctx["scissor"](x0, x1, x2, x3)
}
function _emscripten_glShaderBinary() {
    GL.recordError(1280)
}
function _emscripten_glShaderSource(shader, count, string, length) {
    var source = GL.getSource(shader, count, string, length);
    GLctx.shaderSource(GL.shaders[shader], source)
}
function _emscripten_glStencilFunc(x0, x1, x2) {
    GLctx["stencilFunc"](x0, x1, x2)
}
function _emscripten_glStencilFuncSeparate(x0, x1, x2, x3) {
    GLctx["stencilFuncSeparate"](x0, x1, x2, x3)
}
function _emscripten_glStencilMask(x0) {
    GLctx["stencilMask"](x0)
}
function _emscripten_glStencilMaskSeparate(x0, x1) {
    GLctx["stencilMaskSeparate"](x0, x1)
}
function _emscripten_glStencilOp(x0, x1, x2) {
    GLctx["stencilOp"](x0, x1, x2)
}
function _emscripten_glStencilOpSeparate(x0, x1, x2, x3) {
    GLctx["stencilOpSeparate"](x0, x1, x2, x3)
}
function _emscripten_glTexImage2D(target, level, internalFormat, width, height, border, format, type, pixels) {
    GLctx.texImage2D(target, level, internalFormat, width, height, border, format, type, pixels ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat) : null)
}
function _emscripten_glTexParameterf(x0, x1, x2) {
    GLctx["texParameterf"](x0, x1, x2)
}
function _emscripten_glTexParameterfv(target, pname, params) {
    var param = HEAPF32[params >> 2];
    GLctx.texParameterf(target, pname, param)
}
function _emscripten_glTexParameteri(x0, x1, x2) {
    GLctx["texParameteri"](x0, x1, x2)
}
function _emscripten_glTexParameteriv(target, pname, params) {
    var param = HEAP32[params >> 2];
    GLctx.texParameteri(target, pname, param)
}
function _emscripten_glTexSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixels) {
    var pixelData = null;
    if (pixels)
        pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0);
    GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData)
}
function _emscripten_glUniform1f(location, v0) {
    GLctx.uniform1f(GL.uniforms[location], v0)
}
function _emscripten_glUniform1fv(location, count, value) {
    if (count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[count - 1];
        for (var i = 0; i < count; ++i) {
            view[i] = HEAPF32[value + 4 * i >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 4 >> 2)
    }
    GLctx.uniform1fv(GL.uniforms[location], view)
}
function _emscripten_glUniform1i(location, v0) {
    GLctx.uniform1i(GL.uniforms[location], v0)
}
function _emscripten_glUniform1iv(location, count, value) {
    GLctx.uniform1iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 4 >> 2))
}
function _emscripten_glUniform2f(location, v0, v1) {
    GLctx.uniform2f(GL.uniforms[location], v0, v1)
}
function _emscripten_glUniform2fv(location, count, value) {
    if (2 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[2 * count - 1];
        for (var i = 0; i < 2 * count; i += 2) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 8 >> 2)
    }
    GLctx.uniform2fv(GL.uniforms[location], view)
}
function _emscripten_glUniform2i(location, v0, v1) {
    GLctx.uniform2i(GL.uniforms[location], v0, v1)
}
function _emscripten_glUniform2iv(location, count, value) {
    GLctx.uniform2iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 8 >> 2))
}
function _emscripten_glUniform3f(location, v0, v1, v2) {
    GLctx.uniform3f(GL.uniforms[location], v0, v1, v2)
}
function _emscripten_glUniform3fv(location, count, value) {
    if (3 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[3 * count - 1];
        for (var i = 0; i < 3 * count; i += 3) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 12 >> 2)
    }
    GLctx.uniform3fv(GL.uniforms[location], view)
}
function _emscripten_glUniform3i(location, v0, v1, v2) {
    GLctx.uniform3i(GL.uniforms[location], v0, v1, v2)
}
function _emscripten_glUniform3iv(location, count, value) {
    GLctx.uniform3iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 12 >> 2))
}
function _emscripten_glUniform4f(location, v0, v1, v2, v3) {
    GLctx.uniform4f(GL.uniforms[location], v0, v1, v2, v3)
}
function _emscripten_glUniform4fv(location, count, value) {
    if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[4 * count - 1];
        for (var i = 0; i < 4 * count; i += 4) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
            view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2)
    }
    GLctx.uniform4fv(GL.uniforms[location], view)
}
function _emscripten_glUniform4i(location, v0, v1, v2, v3) {
    GLctx.uniform4i(GL.uniforms[location], v0, v1, v2, v3)
}
function _emscripten_glUniform4iv(location, count, value) {
    GLctx.uniform4iv(GL.uniforms[location], HEAP32.subarray(value >> 2, value + count * 16 >> 2))
}
function _emscripten_glUniformMatrix2fv(location, count, transpose, value) {
    if (4 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[4 * count - 1];
        for (var i = 0; i < 4 * count; i += 4) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
            view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 16 >> 2)
    }
    GLctx.uniformMatrix2fv(GL.uniforms[location], !!transpose, view)
}
function _emscripten_glUniformMatrix3fv(location, count, transpose, value) {
    if (9 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[9 * count - 1];
        for (var i = 0; i < 9 * count; i += 9) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
            view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
            view[i + 4] = HEAPF32[value + (4 * i + 16) >> 2];
            view[i + 5] = HEAPF32[value + (4 * i + 20) >> 2];
            view[i + 6] = HEAPF32[value + (4 * i + 24) >> 2];
            view[i + 7] = HEAPF32[value + (4 * i + 28) >> 2];
            view[i + 8] = HEAPF32[value + (4 * i + 32) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 36 >> 2)
    }
    GLctx.uniformMatrix3fv(GL.uniforms[location], !!transpose, view)
}
function _emscripten_glUniformMatrix4fv(location, count, transpose, value) {
    if (16 * count <= GL.MINI_TEMP_BUFFER_SIZE) {
        var view = GL.miniTempBufferViews[16 * count - 1];
        for (var i = 0; i < 16 * count; i += 16) {
            view[i] = HEAPF32[value + 4 * i >> 2];
            view[i + 1] = HEAPF32[value + (4 * i + 4) >> 2];
            view[i + 2] = HEAPF32[value + (4 * i + 8) >> 2];
            view[i + 3] = HEAPF32[value + (4 * i + 12) >> 2];
            view[i + 4] = HEAPF32[value + (4 * i + 16) >> 2];
            view[i + 5] = HEAPF32[value + (4 * i + 20) >> 2];
            view[i + 6] = HEAPF32[value + (4 * i + 24) >> 2];
            view[i + 7] = HEAPF32[value + (4 * i + 28) >> 2];
            view[i + 8] = HEAPF32[value + (4 * i + 32) >> 2];
            view[i + 9] = HEAPF32[value + (4 * i + 36) >> 2];
            view[i + 10] = HEAPF32[value + (4 * i + 40) >> 2];
            view[i + 11] = HEAPF32[value + (4 * i + 44) >> 2];
            view[i + 12] = HEAPF32[value + (4 * i + 48) >> 2];
            view[i + 13] = HEAPF32[value + (4 * i + 52) >> 2];
            view[i + 14] = HEAPF32[value + (4 * i + 56) >> 2];
            view[i + 15] = HEAPF32[value + (4 * i + 60) >> 2]
        }
    } else {
        var view = HEAPF32.subarray(value >> 2, value + count * 64 >> 2)
    }
    GLctx.uniformMatrix4fv(GL.uniforms[location], !!transpose, view)
}
function _emscripten_glUseProgram(program) {
    GLctx.useProgram(GL.programs[program])
}
function _emscripten_glValidateProgram(program) {
    GLctx.validateProgram(GL.programs[program])
}
function _emscripten_glVertexAttrib1f(x0, x1) {
    GLctx["vertexAttrib1f"](x0, x1)
}
function _emscripten_glVertexAttrib1fv(index, v) {
    GLctx.vertexAttrib1f(index, HEAPF32[v >> 2])
}
function _emscripten_glVertexAttrib2f(x0, x1, x2) {
    GLctx["vertexAttrib2f"](x0, x1, x2)
}
function _emscripten_glVertexAttrib2fv(index, v) {
    GLctx.vertexAttrib2f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2])
}
function _emscripten_glVertexAttrib3f(x0, x1, x2, x3) {
    GLctx["vertexAttrib3f"](x0, x1, x2, x3)
}
function _emscripten_glVertexAttrib3fv(index, v) {
    GLctx.vertexAttrib3f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2], HEAPF32[v + 8 >> 2])
}
function _emscripten_glVertexAttrib4f(x0, x1, x2, x3, x4) {
    GLctx["vertexAttrib4f"](x0, x1, x2, x3, x4)
}
function _emscripten_glVertexAttrib4fv(index, v) {
    GLctx.vertexAttrib4f(index, HEAPF32[v >> 2], HEAPF32[v + 4 >> 2], HEAPF32[v + 8 >> 2], HEAPF32[v + 12 >> 2])
}
function _emscripten_glVertexAttribDivisorANGLE(index, divisor) {
    GLctx["vertexAttribDivisor"](index, divisor)
}
function _emscripten_glVertexAttribPointer(index, size, type, normalized, stride, ptr) {
    GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
}
function _emscripten_glViewport(x0, x1, x2, x3) {
    GLctx["viewport"](x0, x1, x2, x3)
}
function __reallyNegative(x) {
    return x < 0 || x === 0 && 1 / x === -Infinity
}
function __formatString(format, varargs) {
    assert((varargs & 3) === 0);
    var textIndex = format;
    var argIndex = varargs;
    function prepVararg(ptr, type) {
        if (type === "double" || type === "i64") {
            if (ptr & 7) {
                assert((ptr & 7) === 4);
                ptr += 4
            }
        } else {
            assert((ptr & 3) === 0)
        }
        return ptr
    }
    function getNextArg(type) {
        var ret;
        argIndex = prepVararg(argIndex, type);
        if (type === "double") {
            ret = HEAPF64[argIndex >> 3];
            argIndex += 8
        } else if (type == "i64") {
            ret = [HEAP32[argIndex >> 2], HEAP32[argIndex + 4 >> 2]];
            argIndex += 8
        } else {
            assert((argIndex & 3) === 0);
            type = "i32";
            ret = HEAP32[argIndex >> 2];
            argIndex += 4
        }
        return ret
    }
    var ret = [];
    var curr, next, currArg;
    while (1) {
        var startTextIndex = textIndex;
        curr = HEAP8[textIndex >> 0];
        if (curr === 0)
            break;
        next = HEAP8[textIndex + 1 >> 0];
        if (curr == 37) {
            var flagAlwaysSigned = false;
            var flagLeftAlign = false;
            var flagAlternative = false;
            var flagZeroPad = false;
            var flagPadSign = false;
            flagsLoop: while (1) {
                switch (next) {
                case 43:
                    flagAlwaysSigned = true;
                    break;
                case 45:
                    flagLeftAlign = true;
                    break;
                case 35:
                    flagAlternative = true;
                    break;
                case 48:
                    if (flagZeroPad) {
                        break flagsLoop
                    } else {
                        flagZeroPad = true;
                        break
                    }
                case 32:
                    flagPadSign = true;
                    break;
                default:
                    break flagsLoop
                }
                textIndex++;
                next = HEAP8[textIndex + 1 >> 0]
            }
            var width = 0;
            if (next == 42) {
                width = getNextArg("i32");
                textIndex++;
                next = HEAP8[textIndex + 1 >> 0]
            } else {
                while (next >= 48 && next <= 57) {
                    width = width * 10 + (next - 48);
                    textIndex++;
                    next = HEAP8[textIndex + 1 >> 0]
                }
            }
            var precisionSet = false
              , precision = -1;
            if (next == 46) {
                precision = 0;
                precisionSet = true;
                textIndex++;
                next = HEAP8[textIndex + 1 >> 0];
                if (next == 42) {
                    precision = getNextArg("i32");
                    textIndex++
                } else {
                    while (1) {
                        var precisionChr = HEAP8[textIndex + 1 >> 0];
                        if (precisionChr < 48 || precisionChr > 57)
                            break;
                        precision = precision * 10 + (precisionChr - 48);
                        textIndex++
                    }
                }
                next = HEAP8[textIndex + 1 >> 0]
            }
            if (precision < 0) {
                precision = 6;
                precisionSet = false
            }
            var argSize;
            switch (String.fromCharCode(next)) {
            case "h":
                var nextNext = HEAP8[textIndex + 2 >> 0];
                if (nextNext == 104) {
                    textIndex++;
                    argSize = 1
                } else {
                    argSize = 2
                }
                break;
            case "l":
                var nextNext = HEAP8[textIndex + 2 >> 0];
                if (nextNext == 108) {
                    textIndex++;
                    argSize = 8
                } else {
                    argSize = 4
                }
                break;
            case "L":
            case "q":
            case "j":
                argSize = 8;
                break;
            case "z":
            case "t":
            case "I":
                argSize = 4;
                break;
            default:
                argSize = null
            }
            if (argSize)
                textIndex++;
            next = HEAP8[textIndex + 1 >> 0];
            switch (String.fromCharCode(next)) {
            case "d":
            case "i":
            case "u":
            case "o":
            case "x":
            case "X":
            case "p":
                {
                    var signed = next == 100 || next == 105;
                    argSize = argSize || 4;
                    currArg = getNextArg("i" + argSize * 8);
                    var argText;
                    if (argSize == 8) {
                        currArg = makeBigInt(currArg[0], currArg[1], next == 117)
                    }
                    if (argSize <= 4) {
                        var limit = Math.pow(256, argSize) - 1;
                        currArg = (signed ? reSign : unSign)(currArg & limit, argSize * 8)
                    }
                    var currAbsArg = Math.abs(currArg);
                    var prefix = "";
                    if (next == 100 || next == 105) {
                        argText = reSign(currArg, 8 * argSize, 1).toString(10)
                    } else if (next == 117) {
                        argText = unSign(currArg, 8 * argSize, 1).toString(10);
                        currArg = Math.abs(currArg)
                    } else if (next == 111) {
                        argText = (flagAlternative ? "0" : "") + currAbsArg.toString(8)
                    } else if (next == 120 || next == 88) {
                        prefix = flagAlternative && currArg != 0 ? "0x" : "";
                        if (currArg < 0) {
                            currArg = -currArg;
                            argText = (currAbsArg - 1).toString(16);
                            var buffer = [];
                            for (var i = 0; i < argText.length; i++) {
                                buffer.push((15 - parseInt(argText[i], 16)).toString(16))
                            }
                            argText = buffer.join("");
                            while (argText.length < argSize * 2)
                                argText = "f" + argText
                        } else {
                            argText = currAbsArg.toString(16)
                        }
                        if (next == 88) {
                            prefix = prefix.toUpperCase();
                            argText = argText.toUpperCase()
                        }
                    } else if (next == 112) {
                        if (currAbsArg === 0) {
                            argText = "(nil)"
                        } else {
                            prefix = "0x";
                            argText = currAbsArg.toString(16)
                        }
                    }
                    if (precisionSet) {
                        while (argText.length < precision) {
                            argText = "0" + argText
                        }
                    }
                    if (currArg >= 0) {
                        if (flagAlwaysSigned) {
                            prefix = "+" + prefix
                        } else if (flagPadSign) {
                            prefix = " " + prefix
                        }
                    }
                    if (argText.charAt(0) == "-") {
                        prefix = "-" + prefix;
                        argText = argText.substr(1)
                    }
                    while (prefix.length + argText.length < width) {
                        if (flagLeftAlign) {
                            argText += " "
                        } else {
                            if (flagZeroPad) {
                                argText = "0" + argText
                            } else {
                                prefix = " " + prefix
                            }
                        }
                    }
                    argText = prefix + argText;
                    argText.split("").forEach(function(chr) {
                        ret.push(chr.charCodeAt(0))
                    });
                    break
                }
            case "f":
            case "F":
            case "e":
            case "E":
            case "g":
            case "G":
                {
                    currArg = getNextArg("double");
                    var argText;
                    if (isNaN(currArg)) {
                        argText = "nan";
                        flagZeroPad = false
                    } else if (!isFinite(currArg)) {
                        argText = (currArg < 0 ? "-" : "") + "inf";
                        flagZeroPad = false
                    } else {
                        var isGeneral = false;
                        var effectivePrecision = Math.min(precision, 20);
                        if (next == 103 || next == 71) {
                            isGeneral = true;
                            precision = precision || 1;
                            var exponent = parseInt(currArg.toExponential(effectivePrecision).split("e")[1], 10);
                            if (precision > exponent && exponent >= -4) {
                                next = (next == 103 ? "f" : "F").charCodeAt(0);
                                precision -= exponent + 1
                            } else {
                                next = (next == 103 ? "e" : "E").charCodeAt(0);
                                precision--
                            }
                            effectivePrecision = Math.min(precision, 20)
                        }
                        if (next == 101 || next == 69) {
                            argText = currArg.toExponential(effectivePrecision);
                            if (/[eE][-+]\d$/.test(argText)) {
                                argText = argText.slice(0, -1) + "0" + argText.slice(-1)
                            }
                        } else if (next == 102 || next == 70) {
                            argText = currArg.toFixed(effectivePrecision);
                            if (currArg === 0 && __reallyNegative(currArg)) {
                                argText = "-" + argText
                            }
                        }
                        var parts = argText.split("e");
                        if (isGeneral && !flagAlternative) {
                            while (parts[0].length > 1 && parts[0].indexOf(".") != -1 && (parts[0].slice(-1) == "0" || parts[0].slice(-1) == ".")) {
                                parts[0] = parts[0].slice(0, -1)
                            }
                        } else {
                            if (flagAlternative && argText.indexOf(".") == -1)
                                parts[0] += ".";
                            while (precision > effectivePrecision++)
                                parts[0] += "0"
                        }
                        argText = parts[0] + (parts.length > 1 ? "e" + parts[1] : "");
                        if (next == 69)
                            argText = argText.toUpperCase();
                        if (currArg >= 0) {
                            if (flagAlwaysSigned) {
                                argText = "+" + argText
                            } else if (flagPadSign) {
                                argText = " " + argText
                            }
                        }
                    }
                    while (argText.length < width) {
                        if (flagLeftAlign) {
                            argText += " "
                        } else {
                            if (flagZeroPad && (argText[0] == "-" || argText[0] == "+")) {
                                argText = argText[0] + "0" + argText.slice(1)
                            } else {
                                argText = (flagZeroPad ? "0" : " ") + argText
                            }
                        }
                    }
                    if (next < 97)
                        argText = argText.toUpperCase();
                    argText.split("").forEach(function(chr) {
                        ret.push(chr.charCodeAt(0))
                    });
                    break
                }
            case "s":
                {
                    var arg = getNextArg("i8*");
                    var argLength = arg ? _strlen(arg) : "(null)".length;
                    if (precisionSet)
                        argLength = Math.min(argLength, precision);
                    if (!flagLeftAlign) {
                        while (argLength < width--) {
                            ret.push(32)
                        }
                    }
                    if (arg) {
                        for (var i = 0; i < argLength; i++) {
                            ret.push(HEAPU8[arg++ >> 0])
                        }
                    } else {
                        ret = ret.concat(intArrayFromString("(null)".substr(0, argLength), true))
                    }
                    if (flagLeftAlign) {
                        while (argLength < width--) {
                            ret.push(32)
                        }
                    }
                    break
                }
            case "c":
                {
                    if (flagLeftAlign)
                        ret.push(getNextArg("i8"));
                    while (--width > 0) {
                        ret.push(32)
                    }
                    if (!flagLeftAlign)
                        ret.push(getNextArg("i8"));
                    break
                }
            case "n":
                {
                    var ptr = getNextArg("i32*");
                    HEAP32[ptr >> 2] = ret.length;
                    break
                }
            case "%":
                {
                    ret.push(curr);
                    break
                }
            default:
                {
                    for (var i = startTextIndex; i < textIndex + 2; i++) {
                        ret.push(HEAP8[i >> 0])
                    }
                }
            }
            textIndex += 2
        } else {
            ret.push(curr);
            textIndex += 1
        }
    }
    return ret
}
function __emscripten_traverse_stack(args) {
    if (!args || !args.callee || !args.callee.name) {
        return [null, "", ""]
    }
    var funstr = args.callee.toString();
    var funcname = args.callee.name;
    var str = "(";
    var first = true;
    for (var i in args) {
        var a = args[i];
        if (!first) {
            str += ", "
        }
        first = false;
        if (typeof a === "number" || typeof a === "string") {
            str += a
        } else {
            str += "(" + typeof a + ")"
        }
    }
    str += ")";
    var caller = args.callee.caller;
    args = caller ? caller.arguments : [];
    if (first)
        str = "";
    return [args, funcname, str]
}
function _emscripten_get_callstack_js(flags) {
    var callstack = jsStackTrace();
    var iThisFunc = callstack.lastIndexOf("_emscripten_log");
    var iThisFunc2 = callstack.lastIndexOf("_emscripten_get_callstack");
    var iNextLine = callstack.indexOf("\n", Math.max(iThisFunc, iThisFunc2)) + 1;
    callstack = callstack.slice(iNextLine);
    if (flags & 8 && typeof emscripten_source_map === "undefined") {
        warnOnce('Source map information is not available, emscripten_log with EM_LOG_C_STACK will be ignored. Build with "--pre-js $EMSCRIPTEN/src/emscripten-source-map.min.js" linker flag to add source map loading to code.');
        flags ^= 8;
        flags |= 16
    }
    var stack_args = null;
    if (flags & 128) {
        stack_args = __emscripten_traverse_stack(arguments);
        while (stack_args[1].indexOf("_emscripten_") >= 0)
            stack_args = __emscripten_traverse_stack(stack_args[0])
    }
    var lines = callstack.split("\n");
    callstack = "";
    var newFirefoxRe = new RegExp("\\s*(.*?)@(.*?):([0-9]+):([0-9]+)");
    var firefoxRe = new RegExp("\\s*(.*?)@(.*):(.*)(:(.*))?");
    var chromeRe = new RegExp("\\s*at (.*?) \\((.*):(.*):(.*)\\)");
    for (var l in lines) {
        var line = lines[l];
        var jsSymbolName = "";
        var file = "";
        var lineno = 0;
        var column = 0;
        var parts = chromeRe.exec(line);
        if (parts && parts.length == 5) {
            jsSymbolName = parts[1];
            file = parts[2];
            lineno = parts[3];
            column = parts[4]
        } else {
            parts = newFirefoxRe.exec(line);
            if (!parts)
                parts = firefoxRe.exec(line);
            if (parts && parts.length >= 4) {
                jsSymbolName = parts[1];
                file = parts[2];
                lineno = parts[3];
                column = parts[4] | 0
            } else {
                callstack += line + "\n";
                continue
            }
        }
        var cSymbolName = flags & 32 ? demangle(jsSymbolName) : jsSymbolName;
        if (!cSymbolName) {
            cSymbolName = jsSymbolName
        }
        var haveSourceMap = false;
        if (flags & 8) {
            var orig = emscripten_source_map.originalPositionFor({
                line: lineno,
                column: column
            });
            haveSourceMap = orig && orig.source;
            if (haveSourceMap) {
                if (flags & 64) {
                    orig.source = orig.source.substring(orig.source.replace(/\\/g, "/").lastIndexOf("/") + 1)
                }
                callstack += "    at " + cSymbolName + " (" + orig.source + ":" + orig.line + ":" + orig.column + ")\n"
            }
        }
        if (flags & 16 || !haveSourceMap) {
            if (flags & 64) {
                file = file.substring(file.replace(/\\/g, "/").lastIndexOf("/") + 1)
            }
            callstack += (haveSourceMap ? "     = " + jsSymbolName : "    at " + cSymbolName) + " (" + file + ":" + lineno + ":" + column + ")\n"
        }
        if (flags & 128 && stack_args[0]) {
            if (stack_args[1] == jsSymbolName && stack_args[2].length > 0) {
                callstack = callstack.replace(/\s+$/, "");
                callstack += " with values: " + stack_args[1] + stack_args[2] + "\n"
            }
            stack_args = __emscripten_traverse_stack(stack_args[0])
        }
    }
    callstack = callstack.replace(/\s+$/, "");
    return callstack
}
function _emscripten_log_js(flags, str) {
    if (flags & 24) {
        str = str.replace(/\s+$/, "");
        str += (str.length > 0 ? "\n" : "") + _emscripten_get_callstack_js(flags)
    }
    if (flags & 1) {
        if (flags & 4) {
            console.error(str)
        } else if (flags & 2) {
            console.warn(str)
        } else {
            console.log(str)
        }
    } else if (flags & 6) {
        err(str)
    } else {
        out(str)
    }
}
function _emscripten_log(flags, varargs) {
    var format = HEAP32[varargs >> 2];
    varargs += 4;
    var str = "";
    if (format) {
        var result = __formatString(format, varargs);
        for (var i = 0; i < result.length; ++i) {
            str += String.fromCharCode(result[i])
        }
    }
    _emscripten_log_js(flags, str)
}
function __emscripten_do_request_fullscreen(target, strategy) {
    if (typeof JSEvents.fullscreenEnabled() === "undefined")
        return -1;
    if (!JSEvents.fullscreenEnabled())
        return -3;
    if (!target)
        target = "#canvas";
    target = __findEventTarget(target);
    if (!target)
        return -4;
    if (!target.requestFullscreen && !target.msRequestFullscreen && !target.mozRequestFullScreen && !target.mozRequestFullscreen && !target.webkitRequestFullscreen) {
        return -3
    }
    var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
    if (!canPerformRequests) {
        if (strategy.deferUntilInEventHandler) {
            JSEvents.deferCall(_JSEvents_requestFullscreen, 1, [target, strategy]);
            return 1
        } else {
            return -2
        }
    }
    return _JSEvents_requestFullscreen(target, strategy)
}
function _emscripten_request_fullscreen_strategy(target, deferUntilInEventHandler, fullscreenStrategy) {
    var strategy = {};
    strategy.scaleMode = HEAP32[fullscreenStrategy >> 2];
    strategy.canvasResolutionScaleMode = HEAP32[fullscreenStrategy + 4 >> 2];
    strategy.filteringMode = HEAP32[fullscreenStrategy + 8 >> 2];
    strategy.deferUntilInEventHandler = deferUntilInEventHandler;
    strategy.canvasResizedCallback = HEAP32[fullscreenStrategy + 12 >> 2];
    strategy.canvasResizedCallbackUserData = HEAP32[fullscreenStrategy + 16 >> 2];
    __currentFullscreenStrategy = strategy;
    return __emscripten_do_request_fullscreen(target, strategy)
}
function _emscripten_request_pointerlock(target, deferUntilInEventHandler) {
    if (!target)
        target = "#canvas";
    target = __findEventTarget(target);
    if (!target)
        return -4;
    if (!target.requestPointerLock && !target.mozRequestPointerLock && !target.webkitRequestPointerLock && !target.msRequestPointerLock) {
        return -1
    }
    var canPerformRequests = JSEvents.canPerformEventHandlerRequests();
    if (!canPerformRequests) {
        if (deferUntilInEventHandler) {
            JSEvents.deferCall(__requestPointerLock, 2, [target]);
            return 1
        } else {
            return -2
        }
    }
    return __requestPointerLock(target)
}
function abortOnCannotGrowMemory(requestedSize) {
    abort("OOM")
}
function emscripten_realloc_buffer(size) {
    var PAGE_MULTIPLE = 65536;
    size = alignUp(size, PAGE_MULTIPLE);
    var old = Module["buffer"];
    var oldSize = old.byteLength;
    try {
        var result = wasmMemory.grow((size - oldSize) / 65536);
        if (result !== (-1 | 0)) {
            return Module["buffer"] = wasmMemory.buffer
        } else {
            return null
        }
    } catch (e) {
        return null
    }
}
function _emscripten_resize_heap(requestedSize) {
    var oldSize = _emscripten_get_heap_size();
    var PAGE_MULTIPLE = 65536;
    var LIMIT = 2147483648 - PAGE_MULTIPLE;
    if (requestedSize > LIMIT) {
        return false
    }
    var MIN_TOTAL_MEMORY = 16777216;
    var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
    while (newSize < requestedSize) {
        if (newSize <= 536870912) {
            newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
        } else {
            newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
        }
    }
    var replacement = emscripten_realloc_buffer(newSize);
    if (!replacement || replacement.byteLength != newSize) {
        return false
    }
    updateGlobalBuffer(replacement);
    updateGlobalBufferViews();
    TOTAL_MEMORY = newSize;
    HEAPU32[DYNAMICTOP_PTR >> 2] = requestedSize;
    return true
}
function _emscripten_run_script(ptr) {
    eval(UTF8ToString(ptr))
}
function _emscripten_run_script_string(ptr) {
    // var s = eval(UTF8ToString(ptr)) + "";
    var tmp = UTF8ToString(ptr);
    tmp = tmp.replace("window.location.hostname",'"poki.com"');
    tmp = tmp.replace("parent.document.location.href",'"https://poki.com/en/g/subway-clash-3d"');
    tmp = tmp.replace("window.document.referrer",'"https://poki.com/en/g/subway-clash-3d"');
    var s;
    if(tmp.indexOf("d2luZG93Ll9fb3JpZ19kb2N1bWVudF93cml0ZSA9IGRvY3VtZW50LndyaXRl") !== -1){
        tmp = "__eval64('d2luZG93Ll9fb3JpZ19kb2N1bWVudF93cml0ZSA9IGRvY3VtZW50LndyaXRlOwoKZnVuY3Rpb24gSW5qZWN0SmF2YXNjcmlwdFRhZ0ludG9EaXYoaHRtbCwgZGl2X2lkLCBvbl9maW5pc2gpIHsKCXZhciBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChkaXZfaWQpOwoJZG9jdW1lbnQud3JpdGUgPSBmdW5jdGlvbiAoY29udGVudCkgewoJCWNvbnRhaW5lci5pbm5lckhUTUwgPSBjb250ZW50OwoJCWRvY3VtZW50LndyaXRlID0gX19vcmlnX2RvY3VtZW50X3dyaXRlOwoJCW9uX2ZpbmlzaCAmJiBvbl9maW5pc2goKTsKCX07Cgl0cnkgewoJCSQoJyMnICsgZGl2X2lkKS5odG1sKGh0bWwpOwoJfSBjYXRjaCAoZSkgeyAvLyBOT1RFOiBBZGJsb2NrCgkJZG9jdW1lbnQud3JpdGUgPSBfX29yaWdfZG9jdW1lbnRfd3JpdGU7CgkJb25fZmluaXNoICYmIG9uX2ZpbmlzaCgpOwoJfQp9CgpmdW5jdGlvbiBBZGJsb2NrRW5hYmxlZCgpIHsKCXJldHVybiAhd2luZG93WyJfX2FkYWxsb3ciXTsKfQoJCQpmdW5jdGlvbiBJbmplY3RDUE1TdGFyQmFubmVyKGRpdl90YWcsIGNwbXN0YXJfcGlkLCBvbl9maW5pc2gpIHsKCWxldCBodG1sID0gIjxTQ1IiKyJJUFQgbGFuZ3VhZ2U9J0phdmFzY3JpcHQnIHNyYz1cIi8vc2VydmVyLmNwbXN0YXIuY29tL3ZpZXcuYXNweD9wb29saWQ9IitjcG1zdGFyX3BpZCsiJnNjcmlwdD0xJnJuZD0iK01hdGgucm91bmQoTWF0aC5yYW5kb20oKSo5OTk5OTkpKyJcIj48L1NDUiIrIklQVD4iOwoJSW5qZWN0SmF2YXNjcmlwdFRhZ0ludG9EaXYoaHRtbCwgZGl2X3RhZywgb25fZmluaXNoKTsKfQoKZnVuY3Rpb24gSW5qZWN0Q1BNU3RhcjJCYW5uZXIoZGl2X3RhZywgYmFubmVyX2NvbXBvdW5kLCBvbl9maW5pc2gpIHsKCWxldCBodG1sID0gIjxzY3IiICsgImlwdD4iICsKCQkiKGZ1bmN0aW9uKHcscGlkKXt2YXIgcj1mdW5jdGlvbihjLG0pe2M9Yy5zcGxpdCgnJykucmVkdWNlKGZ1bmN0aW9uKGEsYil7cmV0dXJuKGE8PDUpLWErYi5jaGFyQ29kZUF0KDApPj4+bX0sMCk7cmV0dXJuKDEwKygoYyo3KSUyNikpLnRvU3RyaW5nKDM2KStjLnRvU3RyaW5nKDM2KTt9LHk9cih3LmxvY2F0aW9uLmhyZWYuc3BsaXQoJyMnKVswXSwxKSxjPXIody5sb2NhdGlvbi5ocmVmLnNwbGl0KCcjJylbMF0rcGlkLDApO3cuZG9jdW1lbnQud3JpdGUoJzxkaXYgc3R5bGU9XCJ3aWR0aDpJTlNFUlRfV0lEVEhweDtoZWlnaHQ6SU5TRVJUX0hFSUdIVHB4XCIgY2xhc3M9XCInK2MrJ1wiPjwvZGl2PicpO3dbeV09d1t5XXx8e307KHdbeV0ubGliY21kPXdbeV0ubGliY21kfHxbXSkucHVzaCh7a2luZDonYXN5bmN0YWdmZXRjaCcscGlkOnBpZCxwaW5kZXg6dy5kb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGMpLmxlbmd0aC0xfSk7fSkod2luZG93LElOU0VSVF9JRCk7IiArCgkJIjwvc2NyIiArICJpcHQ+IjsKCQoJbGV0IHBhcnRzID0gYmFubmVyX2NvbXBvdW5kLnNwbGl0KCJ8Iik7CglodG1sID0gaHRtbC5yZXBsYWNlKC9JTlNFUlRfV0lEVEgvLCBwYXJ0c1swXSk7CglodG1sID0gaHRtbC5yZXBsYWNlKC9JTlNFUlRfSEVJR0hULywgcGFydHNbMV0pOwoJaHRtbCA9IGh0bWwucmVwbGFjZSgvSU5TRVJUX0lELywgcGFydHNbMl0pOwoJCglJbmplY3RKYXZhc2NyaXB0VGFnSW50b0RpdihodG1sLCBkaXZfdGFnLCBvbl9maW5pc2gpOwoJCglMb2FkU2NyaXB0KCdodHRwczovL3NzbC5jZG5lLmNwbXN0YXIuY29tL2NhY2hlZC9qcy9saWIuanMnKTsKfQoKZnVuY3Rpb24gSW5qZWN0UHJvcGVsbGVyQWRzQmFubmVyKGRpdl90YWcsIGJhbm5lcl9pZCwgb25fZmluaXNoKSB7CglsZXQgaHRtbCA9ICc8c2NyJyArICdpcHQgYXN5bmM9ImFzeW5jIiBkYXRhLWNmYXN5bmM9ImZhbHNlIiBzcmM9Ii8vbmF0aXZlLnByb3BlbGxlcmNsaWNrLmNvbS8xP3o9JyArIGJhbm5lcl9pZCArICcmZWlkPScgKyBkaXZfdGFnICsgJyI+JyArICc8L3NjcicgKyAnaXB0Pic7CgkkKCcjJyArIGRpdl90YWcpLmh0bWwoaHRtbCk7CQoJb25fZmluaXNoICYmIG9uX2ZpbmlzaCgpOwp9CgpmdW5jdGlvbiBJbmplY3RSZXZpdmVKU0Jhbm5lcihkaXZfdGFnLCBwYXJhbSwgb25fZmluaXNoKSB7CglsZXQgcGFyYW1zID0gcGFyYW0uc3BsaXQoInwiKTsJCglsZXQgaHRtbCA9ICc8aW5zIGRhdGEtcmV2aXZlLXpvbmVpZD0iJyArIHBhcmFtc1swXSArICciIGRhdGEtcmV2aXZlLWlkPSInICsgcGFyYW1zWzFdICsgJyI+PC9pbnM+JzsKCQoJZGVsZXRlIHdpbmRvdy5yZXZpdmVBc3luYzsgLy8gTk9URTogYWxsb3cgdG8gc2hvdyBtdWx0aXBsZSBiYW5uZXJzIGluIHNpbmdsZSBzZXNzaW9ucywgc2VlIHNyYy93d3cvZGVsaXZlcnkvYXN5bmMuanMKCQoJJCgnIycgKyBkaXZfdGFnKS5odG1sKGh0bWwpOwkKCW9uX2ZpbmlzaCAmJiBvbl9maW5pc2goKTsKCQoJaWYgKCF3aW5kb3cuX19hc3luY2pzX3RpbWVyKQoJCXdpbmRvdy5fX2FzeW5janNfdGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsKCQkJZGVsZXRlIHdpbmRvdy5fX2FzeW5janNfdGltZXI7CgkJCUxvYWRTY3JpcHQoIi8vcmV2aXZlLjN3YXlpbnQuY29tL3d3dy9kbHZyeS9md2FzeW5janMucGhwIik7CgkJfSwgMSk7Cn0KCmZ1bmN0aW9uIEluamVjdEdhbWVBcnRlckJhbm5lcihkaXZfdGFnLCBwYXJhbSwgb25fZmluaXNoKSB7CgkkKCcjJyArIGRpdl90YWcpLmNzcygid2lkdGgiLCAiMTAwJSIpOwoJJCgnIycgKyBkaXZfdGFnKS5jc3MoImhlaWdodCIsICIxMDAlIik7CgkKCUpTX1Nob3dHYW1lQXJ0ZXJCYW5uZXJBZChkaXZfdGFnLCBvbl9maW5pc2gpOyAvLyBOT1RFOiBkZWZpbmVkIGluIGluZGV4X2dhbWVhcnRlci5odG1sCn0KCmZ1bmN0aW9uIFNob3dDcG1zdGFyMlZpZGVvQWQodHlwZSwgb25fZmluaXNoKSB7CglpZiAodHlwZSAhPT0gJ21pZHJvbGwnKSB7CgkJb25fZmluaXNoKGZhbHNlKQoJCXJldHVybjsKCX0KCQoJZnVuY3Rpb24gYWN0dWFsbHlfc2hvd19hZCgpIHsKCQlpZiAoY3Btc3Rhcl9pbnN0cmVhbUFkID09IG51bGwpIHsKCQkJb25fZmluaXNoKGZhbHNlKTsKCQkJcmV0dXJuOwoJCX0KCQkKCQl3aW5kb3cuX19jcG1zdGFyMl92aWRfb25fZmluaXNoX2ZuID0gb25fZmluaXNoOwoJCQoJCWNwbXN0YXJfaW5zdHJlYW1BZC5pbml0QWQoKTsKCX0KCQoJaWYgKHR5cGVvZiBjcG1zdGFyX2luc3RyZWFtQWQgPT09ICd1bmRlZmluZWQnKSB7CgkJdmFyIHRpbWVvdXRfY2hlY2tlcjsKCQl2YXIgcmVhZGluZXNzX2NoZWNrZXIgPSBzZXRJbnRlcnZhbChmdW5jdGlvbiAoKSB7CgkJCWlmICh0eXBlb2YgY3Btc3Rhcl9pbnN0cmVhbUFkICE9PSAndW5kZWZpbmVkJyAmJiBjcG1zdGFyX2luc3RyZWFtQWQgIT0gbnVsbCkgewoJCQkJY2xlYXJUaW1lb3V0KHRpbWVvdXRfY2hlY2tlcik7CgkJCQljbGVhckludGVydmFsKHJlYWRpbmVzc19jaGVja2VyKTsKCQkJCQoJCQkJZnVuY3Rpb24gb25fY2xvc2VkKCkgewoJCQkJCWNvbnNvbGUubG9nKCJjcG1zdGFyMiB2aWRlbyBjYWxsYmFjazogY2xvc2VkIik7CgkJCQkJd2luZG93Ll9fY3Btc3RhcjJfdmlkX29uX2ZpbmlzaF9mbih0cnVlKTsKCQkJCX0KCQkJCQoJCQkJZnVuY3Rpb24gb25fZXJyb3IoKSB7CgkJCQkJY29uc29sZS5sb2coImNwbXN0YXIyIHZpZGVvIGNhbGxiYWNrOiBlcnJvciIpOwoJCQkJfQoJCQkJCgkJCQlmdW5jdGlvbiBvbl9jb21wbGV0ZSgpIHsKCQkJCQljb25zb2xlLmxvZygiY3Btc3RhcjIgdmlkZW8gY2FsbGJhY2s6IGNvbXBsZXRlIik7CgkJCQl9CgkJCQkKCQkJCWZ1bmN0aW9uIG9uX3JlYWR5KGFkKSB7CgkJCQkJY29uc29sZS5sb2coImNwbXN0YXIgdmlkZW8gY2FsbGJhY2s6IHJlYWR5OiAiLCBhZCk7CgkJCQkJaWYgKGFkKQoJCQkJCQlzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsKCQkJCQkJCWFkLnNob3dBZCgpOwoJCQkJCQl9LCAxMCk7CgkJCQkJZWxzZSB7CgkJCQkJCXdpbmRvdy5fX2NwbXN0YXIyX3ZpZF9vbl9maW5pc2hfZm4oZmFsc2UpOwoJCQkJCX0KCQkJCX0KCQkJCQoJCQkJY3Btc3Rhcl9pbnN0cmVhbUFkLmFkZEV2ZW50TGlzdGVuZXIoJ3JlYWR5Jywgb25fcmVhZHkpOwoJCQkJY3Btc3Rhcl9pbnN0cmVhbUFkLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlZCcsIG9uX2Nsb3NlZCk7CgkJCQljcG1zdGFyX2luc3RyZWFtQWQuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBvbl9lcnJvcik7CgkJCQljcG1zdGFyX2luc3RyZWFtQWQuYWRkRXZlbnRMaXN0ZW5lcignY29tcGxldGUnLCBvbl9jb21wbGV0ZSk7CgkJCQkKCQkJCWFjdHVhbGx5X3Nob3dfYWQoKTsKCQkJfQoJCX0sIDIwMCk7CgkJCgkJKGZ1bmN0aW9uIChpLCB3LCBkLCBwLCBjLCBlLCBvLCBhLCBzLCB0KSB7CgkJCWNwbXN0YXJfaW5zdHJlYW1BZCA9IG51bGw7IC8vIGdsb2JhbCB2YXJpYWJsZSBmb3IgaW5zdHJlYW0gYWQKCQkJcC5wb29saWQgPSA4MTQyMDsgLy8geW91ciBwb29saWQKCQkJby5zZWxlY3QgPSAnI3ZpZXdwb3J0JzsgLy8gc3BlY2lmeSB0aGUgZWxlbWVudCB0byBvdmVybGF5CgkJCWMudHlwZSA9ICdnYW1lJzsKCQkJdCA9IGQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpOwoJCQlzaWQgPSAnY3Btc3RhcmZyJyArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDk5OTk5OSk7CgkJCWlmICghd1tpXSkgeyB3W2ldID0geyBpbnN0cmVhbUFkczogW10gfTsgcyA9IGQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7IHMuc3JjID0gKGQubG9jYXRpb24ucHJvdG9jb2wgPT0gJ2h0dHBzOicgPyAnLy9zZXJ2ZXInIDogJy8vY2RuJykgKyAnLmNwbXN0YXIuY29tL2NhY2hlZC9qcy9nbG9iYWxfdjEwMC5wYWNrLmpzP3Bvb2xpZD0nICsgcC5wb29saWQ7IHMudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnOyBzLmFzeW5jID0gJyc7IHRbMF0ucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUocywgdFswXSk7IH0KCQkJd1tpXS5pbnN0cmVhbUFkcy5wdXNoKGEgPSB7IHBhcmFtczogcCwgY29uZmlnOiBjLCBldmVudHM6IGUsIG92ZXJsYXk6IG8sIHBsYWNlaG9sZGVyOiB0W3QubGVuZ3RoIC0gMV0sIHNjcmlwdGlkOiBzaWQgfSk7CgkJfSkoJ2NwbXN0YXJpbnN0cmVhbScsIHdpbmRvdywgZG9jdW1lbnQsIHt9LCB7fSwge30sIHt9KTsKCQkKCQl0aW1lb3V0X2NoZWNrZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHsKCQkJaWYgKGNwbXN0YXJfaW5zdHJlYW1BZCA9PSBudWxsKSB7CgkJCQljbGVhckludGVydmFsKHJlYWRpbmVzc19jaGVja2VyKTsJCQkJCgkJCQljb25zb2xlLmxvZygiY3Btc3RhcjIgdmlkZW8gd2FpdGluZyB0aW1lb3V0Li4uIik7CgkJCQlvbl9maW5pc2goZmFsc2UpOwoJCQl9CgkJfSwgMzAwMCk7CgkJCgl9IGVsc2UgewoJCWFjdHVhbGx5X3Nob3dfYWQoKTsJCQoJfQp9CgpmdW5jdGlvbiBJbmplY3RJZnJhbWVkQmFubmVyKGRpdl90YWcsIHBhcmFtLCBvbl9maW5pc2gpIHsKCWxldCBwYXJhbXMgPSBwYXJhbS5zcGxpdCgnfCcpOwoJbGV0IGJhbm5lcl9pZCA9IHBhcmFtc1swXTsKCWxldCB3aWR0aCA9IHBhcmFtc1sxXTsKCWxldCBoZWlnaHQgPSBwYXJhbXNbMl07CglsZXQgaWZyYW1lX3VybCA9IHBhcmFtc1szXTsKCSQoJyMnICsgZGl2X3RhZykuaHRtbCgKCQknPGlmcmFtZSBzcmM9Ii8vJyArIGlmcmFtZV91cmwgKyAnP2lkPScgKyBlbmNvZGVVUklDb21wb25lbnQoYmFubmVyX2lkKSArICciICcgKwoJCSdzYW5kYm94PSJhbGxvdy1mb3JtcyBhbGxvdy1zY3JpcHRzIGFsbG93LXRvcC1uYXZpZ2F0aW9uLWJ5LXVzZXItYWN0aXZhdGlvbiBhbGxvdy1zYW1lLW9yaWdpbiBhbGxvdy1wb3B1cHMgYWxsb3ctcG9wdXBzLXRvLWVzY2FwZS1zYW5kYm94IiAnICsKCQknZnJhbWVib3JkZXI9IjAiIHNjcm9sbGluZz0ibm8iIG1hcmdpbndpZHRoPSIwIiBtYXJnaW5oZWlnaHQ9IjAiIHdpZHRoPSInICsgd2lkdGggKyAnIiBoZWlnaHQ9IicgKyBoZWlnaHQgKyAnIiByZWZlcnJlcnBvbGljeT0ibm8tcmVmZXJyZXIiICcgKwoJCSc+PC9pZnJhbWU+JwoJCSk7Cglvbl9maW5pc2ggJiYgb25fZmluaXNoKCk7Cn0KCmZ1bmN0aW9uIEluamVjdFlhbmRleElmcmFtZWRCYW5uZXIoZGl2X3RhZywgcGFyYW0sIG9uX2ZpbmlzaCkgewoJbGV0IHBhcmFtcyA9IHBhcmFtLnNwbGl0KCd8Jyk7CglsZXQgYmFubmVyX2lkID0gcGFyYW1zWzBdOwoJbGV0IHdpZHRoID0gcGFyYW1zWzFdOwoJbGV0IGhlaWdodCA9IHBhcmFtc1syXTsKCWxldCBpZnJhbWVfdXJsID0gcGFyYW1zWzNdOwoJJCgnIycgKyBkaXZfdGFnKS5odG1sKAoJCSc8aWZyYW1lIHNyYz0iLy8nICsgaWZyYW1lX3VybCArICc/aWQ9JyArIGVuY29kZVVSSUNvbXBvbmVudChiYW5uZXJfaWQpICsgIiZ3PSIgKyB3aWR0aCArICImaD0iICsgaGVpZ2h0ICsgJyIgJyArCgkJJ3NhbmRib3g9ImFsbG93LWZvcm1zIGFsbG93LXNjcmlwdHMgYWxsb3ctdG9wLW5hdmlnYXRpb24tYnktdXNlci1hY3RpdmF0aW9uIGFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXBvcHVwcyBhbGxvdy1wb3B1cHMtdG8tZXNjYXBlLXNhbmRib3giICcgKwoJCSdmcmFtZWJvcmRlcj0iMCIgc2Nyb2xsaW5nPSJubyIgbWFyZ2lud2lkdGg9IjAiIG1hcmdpbmhlaWdodD0iMCIgd2lkdGg9IicgKyB3aWR0aCArICciIGhlaWdodD0iJyArIGhlaWdodCArICciIHJlZmVycmVycG9saWN5PSJuby1yZWZlcnJlciIgJyArCgkJJz48L2lmcmFtZT4nCgkJKTsKCW9uX2ZpbmlzaCAmJiBvbl9maW5pc2goKTsKfQoKZnVuY3Rpb24gU2hvd0lmcmFtZWRWaWRlb0FkKHR5cGUsIHBhcmFtLCBvbl9maW5pc2gpIHsKCWxldCBwYXJhbXMgPSBwYXJhbS5zcGxpdCgnfCcpOwoJbGV0IGlmcmFtZV91cmwgPSAnaHR0cHM6Ly8nICsgcGFyYW1zWzBdICsgJz90eXBlPScgKyAodHlwZSA9PT0gJ3Jld2FyZGVkJyA/ICdyZXcnIDogJ21pZCcpOwoJCgl2YXIgbWlkcm9sbF9kaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWlwaG9sZGVyJyk7CglpZiAoIW1pZHJvbGxfZGl2KSB7CgkJbWlkcm9sbF9kaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCJkaXYiKTsKCQltaWRyb2xsX2Rpdi5pZCA9ICdhaXBob2xkZXInOwoJCWRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWlkcm9sbF9kaXYpOwoJfQoJCglmdW5jdGlvbiByZWNlaXZlTXNnKGV2ZW50KSB7CgkJLy90cmFjZSgncmVjZWl2ZU1zZyBmcm9tICcgKyBldmVudC5vcmlnaW4sIG5ldyBVUkwoaWZyYW1lX3VybCkub3JpZ2luLCBldmVudCk7CgkJaWYgKG5ldyBVUkwoZXZlbnQub3JpZ2luKS5ob3N0bmFtZSAhPT0gbmV3IFVSTChpZnJhbWVfdXJsKS5ob3N0bmFtZSkKCQkJcmV0dXJuOwoJCWlmIChldmVudC5kYXRhICE9PSAnc3VjY2VzcycgJiYgZXZlbnQuZGF0YSAhPT0gJ2ZhaWx1cmUnKSAvLyBOT1RFOiBBZGRUaGlzIGNhbiBzZW5kIGEgbWVzc2FnZSBoYXZpbmcgdGhlIHNhbWUgb3JpZ2luCgkJCXJldHVybjsKCQkKCQl3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIHJlY2VpdmVNc2cpOwoJCSQoJyNhcHZpZGlmcmFtZScpLnJlbW92ZSgpOwkJCgkJb25fZmluaXNoKGV2ZW50LmRhdGEgPT09ICdzdWNjZXNzJyk7Cgl9CgkKCSQoJyMnICsgbWlkcm9sbF9kaXYuaWQpLmh0bWwoCgkJJzxpZnJhbWUgaWQ9ImFwdmlkaWZyYW1lIiBzcmM9IicgKyBpZnJhbWVfdXJsICsgJyIgJyArCgkJJ3NhbmRib3g9ImFsbG93LWZvcm1zIGFsbG93LXNjcmlwdHMgYWxsb3ctdG9wLW5hdmlnYXRpb24tYnktdXNlci1hY3RpdmF0aW9uIGFsbG93LXNhbWUtb3JpZ2luIGFsbG93LXBvcHVwcyBhbGxvdy1wb3B1cHMtdG8tZXNjYXBlLXNhbmRib3giICcgKwoJCSdmcmFtZWJvcmRlcj0iMCIgc2Nyb2xsaW5nPSJubyIgbWFyZ2lud2lkdGg9IjAiIG1hcmdpbmhlaWdodD0iMCIgcmVmZXJyZXJwb2xpY3k9Im5vLXJlZmVycmVyIiAnICsKCQknc3R5bGU9InBvc2l0aW9uOmZpeGVkOyB0b3A6MDsgbGVmdDowOyBib3R0b206MDsgcmlnaHQ6MDsgd2lkdGg6MTAwJTsgaGVpZ2h0OjEwMCU7IGJvcmRlcjpub25lOyBtYXJnaW46MDsgcGFkZGluZzowOyBvdmVyZmxvdzpoaWRkZW47IHotaW5kZXg6OTk5OTk5OyInICsKCQknPjwvaWZyYW1lPicKCQkpOwoJCQoJd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCByZWNlaXZlTXNnLCBmYWxzZSk7Cn0KCmZ1bmN0aW9uIFNob3dHRFZpZGVvQWQodHlwZSwgcGFyYW0sIG9uX2ZpbmlzaCkgewoJdmFyIHBsYXliYWNrX3N1Y2Nlc3MgPSB0cnVlOwoJd2luZG93Ll9fZ2RfZXZlbnRfbGlzdGVuZXIgPSBmdW5jdGlvbiAoZXZlbnQpIHsKCQl0cmFjZSgnX19nZF9ldmVudF9saXN0ZW5lcicsIGV2ZW50KTsKCQlpZiAoZXZlbnQubmFtZSA9PT0gJ0FEX0VSUk9SJykgewoJCQlwbGF5YmFja19zdWNjZXNzID0gZmFsc2U7CgkJfQoJCWVsc2UKCQlpZiAoZXZlbnQubmFtZSA9PT0gJ1NLSVBQRUQnKSB7CgkJCWlmICh0eXBlID09PSAncmV3YXJkZWQnKQoJCQkJcGxheWJhY2tfc3VjY2VzcyA9IGZhbHNlOwoJCX0KCQllbHNlCgkJaWYgKGV2ZW50Lm5hbWUgPT09ICdTREtfR0FNRV9TVEFSVCcpIHsKCQkJd2luZG93Ll9fZ2RfZXZlbnRfbGlzdGVuZXIgPSB1bmRlZmluZWQ7CgkJCW9uX2ZpbmlzaChwbGF5YmFja19zdWNjZXNzKTsKCQl9Cgl9OwoJCgkvLyBodHRwczovL2dhbWVkaXN0cmlidXRpb24uY29tL3Nkay9odG1sNQoJZnVuY3Rpb24gYWN0dWFsbHlfc2hvd192aWRlbygpIHsKCQlpZiAodHlwZW9mIGdkc2RrID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgZ2RzZGsucHJlbG9hZEFkICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiBnZHNkay5zaG93QWQgIT09ICdmdW5jdGlvbicpIHsKCQkJb25fZmluaXNoKGZhbHNlKTsKCQkJcmV0dXJuOwoJCX0KCQkKCQkvL2dkc2RrLm9wZW5Db25zb2xlKCk7CgkJCgkJY29uc29sZS5sb2coImNhbGxpbmcgR0QgIiArIHR5cGUgKyAiIHZpZGVvLi4uIik7CgkJCgkJaWYgKHR5cGUgPT09ICdyZXdhcmRlZCcpIHsKCQkJZ2RzZGsKCQkJCS5wcmVsb2FkQWQoJ3Jld2FyZGVkJykKCQkJCS50aGVuKHJlc3BvbnNlID0+IHsKCQkJCQljb25zb2xlLmxvZygicmV3YXJkZWQgdmlkZW8gcHJlbG9hZGVkLCBub3cgZ29pbmcgdG8gd2F0Y2ggaXQuLi4iKTsKCQkJCQlnZHNkay5zaG93QWQoJ3Jld2FyZGVkJyk7CgkJCQl9KQoJCQkJLmNhdGNoKGVycm9yID0+IHsKCQkJCQljb25zb2xlLmVycm9yKGVycm9yKTsKCQkJCQlvbl9maW5pc2goZmFsc2UpOwoJCQkJfSk7CgkJCQkKCQl9IGVsc2UgewoJCQlpZiAodHlwZW9mIGdkc2RrLnNob3dCYW5uZXIgPT09ICdmdW5jdGlvbicpCgkJCQlnZHNkay5zaG93QmFubmVyKCk7CgkJCWVsc2UKCQkJCWdkc2RrLnNob3dBZCgpOwoJCX0KCX0KCQoJaWYgKHR5cGVvZiBnZHNkayA9PT0gJ3VuZGVmaW5lZCcpIHsKCQl3aW5kb3cuR0RfT1BUSU9OUyA9IHsKCQkJImdhbWVJZCI6IHBhcmFtLAoJCQkib25FdmVudCI6IGZ1bmN0aW9uIChldmVudCkgewoJCQkJd2luZG93Ll9fZ2RfZXZlbnRfbGlzdGVuZXIgJiYgd2luZG93Ll9fZ2RfZXZlbnRfbGlzdGVuZXIoZXZlbnQpOwoJCQl9CgkJfTsKCQkKCQljb25zb2xlLmxvZygiZ29pbmcgdG8gbG9hZCBHRCBhcGkuLi4iKTsKCQlMb2FkU2NyaXB0KCdodHRwczovL2h0bWw1LmFwaS5nYW1lZGlzdHJpYnV0aW9uLmNvbS9tYWluLm1pbi5qcycsIGFjdHVhbGx5X3Nob3dfdmlkZW8pOwoJCQoJfSBlbHNlIHsKCQlhY3R1YWxseV9zaG93X3ZpZGVvKCk7Cgl9Cn0KCmZ1bmN0aW9uIFNob3dHYW1lTW9uZXRpemVWaWRlb0FkKHR5cGUsIHBhcmFtLCBvbl9maW5pc2gpIHsgLy8gR2FtZU1vbmV0aXplCgl2YXIgcGxheWJhY2tfc3VjY2VzcyA9IHRydWU7Cgl3aW5kb3cuX19kZ19ldmVudF9saXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudCkgewoJCXRyYWNlKCdfX2RnX2V2ZW50X2xpc3RlbmVyJywgZXZlbnQpOwoJCWlmIChldmVudC5uYW1lID09PSAnQURfRVJST1InKSB7CgkJCXBsYXliYWNrX3N1Y2Nlc3MgPSBmYWxzZTsKCQl9CgkJZWxzZQoJCWlmIChldmVudC5uYW1lID09PSAnU0tJUFBFRCcpIHsKCQkJaWYgKHR5cGUgPT09ICdyZXdhcmRlZCcpCgkJCQlwbGF5YmFja19zdWNjZXNzID0gZmFsc2U7CgkJfQoJCWVsc2UKCQlpZiAoZXZlbnQubmFtZSA9PT0gJ1NES19HQU1FX1NUQVJUJykgewoJCQl3aW5kb3cuX19kZ19ldmVudF9saXN0ZW5lciA9IHVuZGVmaW5lZDsKCQkJb25fZmluaXNoKHBsYXliYWNrX3N1Y2Nlc3MpOwoJCX0KCX07CgkKCS8vIGh0dHBzOi8vZ2l0aHViLmNvbS9Nb25ldGl6ZUdhbWUvR2FtZU1vbmV0aXplLmNvbS1TREsKCWZ1bmN0aW9uIGFjdHVhbGx5X3Nob3dfdmlkZW8oKSB7CgkJaWYgKHR5cGVvZiBzZGsgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBzZGsuc2hvd0Jhbm5lciAhPT0gJ2Z1bmN0aW9uJykgewoJCQlvbl9maW5pc2goZmFsc2UpOwoJCQlyZXR1cm47CgkJfQoJCQoJCWNvbnNvbGUubG9nKCJjYWxsaW5nIEdhbWVNb25ldGl6ZSAiICsgdHlwZSArICIgdmlkZW8uLi4iKTsKCQkKCQlzZGsuc2hvd0Jhbm5lcigpOwoJfQoJCglpZiAodHlwZW9mIHNkayA9PT0gJ3VuZGVmaW5lZCcpIHsKCQl3aW5kb3cuU0RLX09QVElPTlMgPSB7CgkJCSJnYW1lSWQiOiBwYXJhbSwKCQkJIm9uRXZlbnQiOiBmdW5jdGlvbiAoZXZlbnQpIHsKCQkJCXdpbmRvdy5fX2RnX2V2ZW50X2xpc3RlbmVyICYmIHdpbmRvdy5fX2RnX2V2ZW50X2xpc3RlbmVyKGV2ZW50KTsKCQkJfQoJCX07CgkJCgkJY29uc29sZS5sb2coImdvaW5nIHRvIGxvYWQgR2FtZU1vbmV0aXplIGFwaS4uLiIpOwoJCQoJCShmdW5jdGlvbiAoZSxpLHQpIHsKCQkJdmFyIG4sYT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCJzY3JpcHQiKTthLnNldEF0dHJpYnV0ZSgic3JjIixlKSxhLmlkPWksYS5vbnJlYWR5c3RhdGVjaGFuZ2U9YS5vbmxvYWQ9ZnVuY3Rpb24oKXtufHwobj0hMCx0JiZ0KCkpfSxkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgiaGVhZCIpWzBdLmFwcGVuZENoaWxkKGEpCgkJfSkoJ2h0dHBzOi8vYXBpLmdhbWVtb25ldGl6ZS5jb20vc2RrLmpzJywgJ2dhbWVtb25ldGl6ZS1zZGsnLCBhY3R1YWxseV9zaG93X3ZpZGVvKTsKCQkKCX0gZWxzZSB7CgkJYWN0dWFsbHlfc2hvd192aWRlbygpOwoJfQp9CgpmdW5jdGlvbiBKU19TaG93QXBwbGl4aXJWaWRlb0FkKHR5cGUsIHBhcmFtLCBvbl9maW5pc2gpIHsKCWxldCBwYXJ0cyA9IHBhcmFtLnNwbGl0KCd8Jyk7CglsZXQgZ2FtZV9pZCA9IHBhcnRzWzBdOwoJbGV0IHpvbmVfaWQgPSBwYXJ0c1sxXTsKCQkKCWZ1bmN0aW9uIGFjdHVhbGx5X3Nob3dfdmlkZW8oKSB7CgkJaWYgKHR5cGVvZiBpbnZva2VBcHBsaXhpclZpZGVvVW5pdCAhPT0gJ2Z1bmN0aW9uJykgewoJCQlvbl9maW5pc2goZmFsc2UpOwoJCQlyZXR1cm47CgkJfQoJCQoJCWNvbnNvbGUubG9nKCJjYWxsaW5nIEFwcGxpeGlyICIgKyB0eXBlICsgIiB2aWRlby4uLiIpOwkJCgkJCgkJbGV0IHdhdGNoZWQgPSBmYWxzZTsJCQoJCWxldCBvcHRpb25zID0gewoJCQlnYW1lSWQ6IGdhbWVfaWQsCgkJCXpvbmVJZDogem9uZV9pZCwKCQkJZmFsbGJhY2s6IDAsCgkJCWFkU3RhdHVzQ2I6IGZ1bmN0aW9uIChzdGF0dXMpIHsKCQkJCWNvbnNvbGUubG9nKCdBcHBsaXhpciBzdGF0dXM6Jywgc3RhdHVzKTsKCQkJCWlmIChzdGF0dXMgPT09ICdhZC13YXRjaGVkJykKCQkJCQl3YXRjaGVkID0gdHJ1ZTsKCQkJCWlmIChzdGF0dXMgPT09ICdzeXMtY2xvc2luZycpCgkJCQkJb25fZmluaXNoKHdhdGNoZWQpOwoJCQl9CgkJfQoJCQoJCWludm9rZUFwcGxpeGlyVmlkZW9Vbml0KG9wdGlvbnMpOwoJfQoJCglpZiAodHlwZW9mIGludm9rZUFwcGxpeGlyVmlkZW9Vbml0ICE9PSAnZnVuY3Rpb24nKSB7CgkJTG9hZFNjcmlwdCgnaHR0cHM6Ly9jZG4uYXBwbGl4aXIuY29tL2FwcGxpeGlyLnNkazMuMG0uanMnLCBmdW5jdGlvbiAoKSB7CgkJCSQoZG9jdW1lbnQuYm9keSkuYXBwZW5kKAoJCQkJJzxkaXYgaWQ9ImFwcGxpeGlyX3ZhbmlzaGluZ19kaXYiIGhpZGRlbj4nICsKCQkJCSAgICc8aWZyYW1lIGlkPSJhcHBsaXhpcl9wYXJlbnQiIGFsbG93PSJhdXRvcGxheSI+PC9pZnJhbWU+JyArCgkJCQknPC9kaXY+JwoJCQkpOwoJCQkKCQkJYWN0dWFsbHlfc2hvd192aWRlbygpOwoJCX0pOwoJfQoJZWxzZQoJCWFjdHVhbGx5X3Nob3dfdmlkZW8oKTsKfQoKZnVuY3Rpb24gQ2hlY2tBbmRJbml0QWRpbnBsYXkoKSB7IC8vIGh0dHBzOi8vYWRpbnBsYXkuY29tL2FwaS8KCWlmICh0eXBlb2YgYWRwbGF5ZXIgIT09ICd1bmRlZmluZWQnKQoJCXJldHVybjsKCQoJbGV0IGFpcHRhZyA9IHdpbmRvdy5haXB0YWcgfHwge307ICAgCglhaXB0YWcuY21kID0gYWlwdGFnLmNtZCB8fCBbXTsKCWFpcHRhZy5jbWQuZGlzcGxheSA9IGFpcHRhZy5jbWQuZGlzcGxheSB8fCBbXTsKCWFpcHRhZy5jbWQucGxheWVyID0gYWlwdGFnLmNtZC5wbGF5ZXIgfHwgW107CQoJYWlwdGFnLmdkcHJTaG93Q29uc2VudFRvb2wgPSB0cnVlOwoJCgl2YXIgbWlkcm9sbF9kaXYgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWlwaG9sZGVyJyk7CglpZiAoIW1pZHJvbGxfZGl2KSB7CgkJbWlkcm9sbF9kaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCJkaXYiKTsKCQltaWRyb2xsX2Rpdi5pZCA9ICdhaXBob2xkZXInOwoJCWRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWlkcm9sbF9kaXYpOwoJfQoKCWFpcHRhZy5jbWQucGxheWVyLnB1c2goZnVuY3Rpb24oKSB7CgkJYWRwbGF5ZXIgPSBuZXcgYWlwUGxheWVyKHsKCQkJQURfV0lEVEg6IDk2MCwKCQkJQURfSEVJR0hUOiA1NDAsCgkJCUFEX0ZVTExTQ1JFRU46IHRydWUsCgkJCUFEX0NFTlRFUlBMQVlFUjogZmFsc2UsCgkJCUxPQURJTkdfVEVYVDogJ2xvYWRpbmcgdmlkZW8nLAoJCQlQUkVST0xMX0VMRU06IGZ1bmN0aW9uKCkge3JldHVybiBtaWRyb2xsX2Rpdjt9LAoJCQlBSVBfQ09NUExFVEU6IGZ1bmN0aW9uICgpIHsKCQkJCXRyYWNlKCdBSVBfQ09NUExFVEUnKTsKCQkJCWlmICh0eXBlb2YgX19hZGlucGxheV9vbl92aWRlb19jb21wbGV0ZSA9PT0gJ2Z1bmN0aW9uJykgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAoJCQkJCV9fYWRpbnBsYXlfb25fdmlkZW9fY29tcGxldGUodHJ1ZSk7CgkJCQkJX19hZGlucGxheV9vbl92aWRlb19jb21wbGV0ZSA9IG51bGw7CgkJCQl9CgkJCX0sCgkJCUFJUF9SRU1PVkU6IGZ1bmN0aW9uICgpIHsKCQkJCXRyYWNlKCdBSVBfUkVNT1ZFJyk7CgkJCX0sCgkJCUFJUF9SRVdBUkRFRENPTVBMRVRFOiBmdW5jdGlvbiAoZXZ0KSB7CgkJCQl0cmFjZSgnQUlQX1JFV0FSREVEQ09NUExFVEUnLCBldnQpOwoJCQkJaWYgKHR5cGVvZiBfX2FkaW5wbGF5X29uX3ZpZGVvX2NvbXBsZXRlID09PSAnZnVuY3Rpb24nKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCgkJCQkJX19hZGlucGxheV9vbl92aWRlb19jb21wbGV0ZShldnQgPT09ICdjbG9zZWQnKTsgLy8gY2xvc2VkL3RpbWVvdXQKCQkJCQlfX2FkaW5wbGF5X29uX3ZpZGVvX2NvbXBsZXRlID0gbnVsbDsKCQkJCX0KCQkJfQoJCX0pOwoJfSk7CgkKCXdpbmRvdy5haXB0YWcgPSBhaXB0YWc7CgkJICAgICAgICAgICAgICAKCUxvYWRTY3JpcHQoJy8vYXBpLmFkaW5wbGF5LmNvbS9saWJzL2FpcHRhZy9wdWIvQ1NIL2NsYXNoM2QuY29tL3RhZy5taW4uanMnKTsKfSAKCmZ1bmN0aW9uIFNob3dBZGlucGxheVZpZGVvQWQodHlwZSwgb25fZmluaXNoKSB7CglDaGVja0FuZEluaXRBZGlucGxheSgpOwoJCglfX2FkaW5wbGF5X29uX3ZpZGVvX2NvbXBsZXRlID0gZnVuY3Rpb24gKHJlc3VsdCkgewoJCW9uX2ZpbmlzaChyZXN1bHQpOwoJfTsKCQoJaWYgKHR5cGUgPT09ICdyZXdhcmRlZCcgJiYgZmFsc2UpIC8vIEZJWE1FCgkJYWlwdGFnLmNtZC5wbGF5ZXIucHVzaChmdW5jdGlvbigpIHsKCQkJYWRwbGF5ZXIuc3RhcnRSZXdhcmRlZEFkKCk7CgkJfSk7CgllbHNlCgkJYWlwdGFnLmNtZC5wbGF5ZXIucHVzaChmdW5jdGlvbigpIHsKCQkJYWRwbGF5ZXIuc3RhcnRQcmVSb2xsKCk7CgkJfSk7Cn0KCmZ1bmN0aW9uIEluamVjdEFkaW5wbGF5QmFubmVyKGRpdl90YWcsIHBhcmFtLCBvbl9maW5pc2gpIHsKCUNoZWNrQW5kSW5pdEFkaW5wbGF5KCk7CgkKCWxldCBwYXJhbXMgPSBwYXJhbS5zcGxpdCgnfCcpOwoJJCgnIycgKyBkaXZfdGFnKS5odG1sKCc8ZGl2IGlkPSInICsgcGFyYW1zWzBdICsgJyI+Jyk7CglhaXB0YWcuY21kLmRpc3BsYXkucHVzaChmdW5jdGlvbigpIHsgYWlwRGlzcGxheVRhZy5kaXNwbGF5KHBhcmFtc1swXSk7IH0pOwoJb25fZmluaXNoICYmIG9uX2ZpbmlzaCgpOwp9CgpmdW5jdGlvbiBJbmplY3RCYW5uZXIodGFnLCBhZG5ldHdvcmtfaWQsIHBhcmFtLCBvbl9maW5pc2gpIHsKCWlmIChhZG5ldHdvcmtfaWQgPT09ICJpZnJhbWUiKQoJCUluamVjdElmcmFtZWRCYW5uZXIodGFnLCBwYXJhbSwgb25fZmluaXNoKTsKCWVsc2UgaWYgKGFkbmV0d29ya19pZCA9PT0gImFkaW5wbGF5IikKCQlJbmplY3RBZGlucGxheUJhbm5lcih0YWcsIHBhcmFtLCBvbl9maW5pc2gpOwoJZWxzZSBpZiAoYWRuZXR3b3JrX2lkID09PSAieWFuZGV4cnRiIikKCQlJbmplY3RZYW5kZXhJZnJhbWVkQmFubmVyKHRhZywgcGFyYW0sIG9uX2ZpbmlzaCk7CgllbHNlIGlmIChhZG5ldHdvcmtfaWQgPT09ICJjcG1zdGFyIikKCQlJbmplY3RDUE1TdGFyQmFubmVyKHRhZywgcGFyYW0sIG9uX2ZpbmlzaCk7CgllbHNlIGlmIChhZG5ldHdvcmtfaWQgPT09ICJjcG1zdGFyMiIpCgkJSW5qZWN0Q1BNU3RhcjJCYW5uZXIodGFnLCBwYXJhbSwgb25fZmluaXNoKTsKCWVsc2UgaWYgKGFkbmV0d29ya19pZCA9PT0gInJldml2ZWpzIikKCQlJbmplY3RSZXZpdmVKU0Jhbm5lcih0YWcsIHBhcmFtLCBvbl9maW5pc2gpOwoJZWxzZSBpZiAoYWRuZXR3b3JrX2lkID09PSAicHJvcGVsbGVyYWRzIikKCQlJbmplY3RQcm9wZWxsZXJBZHNCYW5uZXIodGFnLCBwYXJhbSwgb25fZmluaXNoKTsKCWVsc2UKCQlvbl9maW5pc2goKTsKCQoJZ3RhZygnZXZlbnQnLCAnYm5yX3Nob3duJywgewoJCSdldmVudF9jYXRlZ29yeSc6ICdtb25ldGl6YXRpb24nLAoJCSdldmVudF9sYWJlbCc6IGFkbmV0d29ya19pZAoJfSk7Cn0KCmZ1bmN0aW9uIEpTX0luamVjdEJhbm5lcnMoZnVsbF9zaXplLCBtaWRibG9ja19zaXplLCBsYW5kc2NhcGUsIGFkbmV0d29yazEsIGJhbm5lcjFfcGFyYW0sIGFkbmV0d29yazIsIGJhbm5lcjJfcGFyYW0pIHsgICAgCgkkKCcjYmJveCcpLnJlbW92ZSgpOwoKfQoKZnVuY3Rpb24gSlNfSGlkZUJhbm5lcnMoKSB7Cglkb2N1bWVudC53cml0ZSA9IF9fb3JpZ19kb2N1bWVudF93cml0ZTsgICAgCgkkKCcjYmJveCcpLnJlbW92ZSgpOwoJdHJ5IHsgaWYgKHR5cGVvZiBwYXJlbnQuSlNfSGlkZUFkc2Vuc2VCYW5uZXJzID09PSAnZnVuY3Rpb24nKSBwYXJlbnQuSlNfSGlkZUFkc2Vuc2VCYW5uZXJzKCk7IH0gY2F0Y2ggKGUpIHt9Cn0KCmZ1bmN0aW9uIEpTX1Nob3dWaWRlb0FkKGFkbmV0d29ya19pZCwgdHlwZSwgcGFyYW0pIHsKCWZ1bmN0aW9uIG9uX2ZpbmlzaChzdWNjZXNzKSB7CgkJZ3RhZygnZXZlbnQnLCAnYWR2aWRlb18nICsgKHN1Y2Nlc3MgPyAic2hvd24iIDogImZhaWx1cmUiKSwgewoJCQknZXZlbnRfY2F0ZWdvcnknOiAnbW9uZXRpemF0aW9uJywKCQkJJ2V2ZW50X2xhYmVsJzogYWRuZXR3b3JrX2lkICsgIl8iICsgdHlwZQoJCX0pOwoJCQoJCWxldCBzdGFjayA9IHN0YWNrU2F2ZSgpOwoJCU1vZHVsZS5fb25fYWR2aWRlb19maW5pc2hlZCgoc3VjY2VzcyA/IDEgOiAwKSB8IDApOyAvLyBOT1RFOiBkZWZpbmVkIGluIFBsYXllclNETC5jcHAKCQlzdGFja1Jlc3RvcmUoc3RhY2spOwoJfQoJCglKU19IaWRlQmFubmVycygpOwkJCglvbl9maW5pc2godHJ1ZSk7CgkKfQoKZnVuY3Rpb24gSlNfVHJhY2tBbmFseXRpY3NFdmVudChjYXRlZ29yeSwgYWN0aW9uLCBsYWJlbF9vcHQsIHZhbHVlX29wdCkgewoJbGV0IG9wdHMgPSB7J2V2ZW50X2NhdGVnb3J5JzogY2F0ZWdvcnl9OwoJaWYgKHR5cGVvZiBsYWJlbF9vcHQgPT09ICdzdHJpbmcnKSAgICAgICAgCgkJb3B0cy5ldmVudF9sYWJlbCA9IGxhYmVsX29wdDsKCWlmICh0eXBlb2YgdmFsdWVfb3B0ID09PSAnc3RyaW5nJyAmJiAhaXNOYU4ocGFyc2VJbnQodmFsdWVfb3B0KSkpCgkJb3B0cy52YWx1ZSA9IHBhcnNlSW50KHZhbHVlX29wdCkgfCAwOwoJZ3RhZygnZXZlbnQnLCBhY3Rpb24sIG9wdHMpOwp9CgpmdW5jdGlvbiBKU19Pbk1hdGNoRmluaXNoZWQoKSB7Cgl0cnkgeyBpZiAodHlwZW9mIHBhcmVudC5KU19Pbk1hdGNoRmluaXNoZWQgPT09ICdmdW5jdGlvbicpIHBhcmVudC5KU19Pbk1hdGNoRmluaXNoZWQoKTsgfSBjYXRjaCAoZSkge30KfQoKZnVuY3Rpb24gSlNfU2hvd0VtYmVkUHJvbXB0KCkgewoJbGV0IHVybCA9ICIvL2NsYXNoM2QuY29tL2VtYmVkLyIgKyBHQU1FX0lEICsgIi8iOwoJcHJvbXB0KCdVc2VzIENsb3VkZmxhcmUgQ0ROLiBNb2JpbGUgcmVhZHkgKGxhbmRzY2FwZSBhbmQgcG9ydHJhaXQpLiBSZXNpemVhYmxlLCBzZXQgYW55IHdpZHRoL2hlaWdodCB5b3UgbGlrZSAoMTAwMHg2MDAgZm9yIGV4LiknLCAnPGlmcmFtZSBzcmM9IicgKyB1cmwgKyAnIiBzdHlsZT0id2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTsiIHJlZmVycmVycG9saWN5PSJvcmlnaW4iIGZyYW1lYm9yZGVyPSIwIiBzY3JvbGxpbmc9Im5vIiBhbGxvd2Z1bGxzY3JlZW49InRydWUiPjwvaWZyYW1lPicpOwp9CgpmdW5jdGlvbiBKU19TaG93QXNzZXRzUHJvbXB0KCkgewoJbGV0IHVybCA9ICJodHRwOi8vY2xhc2gzZC5jb20vYXNzZXRzLyIgKyBHQU1FX0lEICsgImNsYXNoaGVyb2VzX2Fzc2V0cy56aXAiOwoJcHJvbXB0KCdSZXNvdXJjZSBmb3Igd2VibWFzdGVycy4gVGhpcyBhcmNoaXZlIGNvbnRhaW5zOiBoaWdoIHJlc29sdXRpb24gaWNvbnMsIGxvZ28gYW5kIHNjcmVlbnNob3RzOicsIHVybCk7Cn0K')";
        s = eval(tmp);
    } else {
        s = eval(tmp);
    }
    
    console.log("--fx--",tmp);
    s += "";
    var me = _emscripten_run_script_string;
    var len = lengthBytesUTF8(s);
    if (!me.bufferSize || me.bufferSize < len + 1) {
        if (me.bufferSize)
            _free(me.buffer);
        me.bufferSize = len + 1;
        me.buffer = _malloc(me.bufferSize)
    }
    stringToUTF8(s, me.buffer, me.bufferSize);
    return me.buffer
}
function __registerFocusEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.focusEvent)
        JSEvents.focusEvent = _malloc(256);
    var focusEventHandlerFunc = function(event) {
        var e = event || window.event;
        var nodeName = JSEvents.getNodeNameForTarget(e.target);
        var id = e.target.id ? e.target.id : "";
        var focusEvent = JSEvents.focusEvent;
        stringToUTF8(nodeName, focusEvent + 0, 128);
        stringToUTF8(id, focusEvent + 128, 128);
        if (dynCall_iiii(callbackfunc, eventTypeId, focusEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: __findEventTarget(target),
        allowsDeferredCalls: false,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: focusEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_blur_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerFocusEventCallback(target, userData, useCapture, callbackfunc, 12, "blur", targetThread);
    return 0
}
function _emscripten_set_element_css_size(target, width, height) {
    target = target ? __findEventTarget(target) : Module["canvas"];
    if (!target)
        return -4;
    target.style.width = width + "px";
    target.style.height = height + "px";
    return 0
}
function _emscripten_set_focus_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerFocusEventCallback(target, userData, useCapture, callbackfunc, 13, "focus", targetThread);
    return 0
}
function __fillFullscreenChangeEventData(eventStruct, e) {
    var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
    var isFullscreen = !!fullscreenElement;
    HEAP32[eventStruct >> 2] = isFullscreen;
    HEAP32[eventStruct + 4 >> 2] = JSEvents.fullscreenEnabled();
    var reportedElement = isFullscreen ? fullscreenElement : JSEvents.previousFullscreenElement;
    var nodeName = JSEvents.getNodeNameForTarget(reportedElement);
    var id = reportedElement && reportedElement.id ? reportedElement.id : "";
    stringToUTF8(nodeName, eventStruct + 8, 128);
    stringToUTF8(id, eventStruct + 136, 128);
    HEAP32[eventStruct + 264 >> 2] = reportedElement ? reportedElement.clientWidth : 0;
    HEAP32[eventStruct + 268 >> 2] = reportedElement ? reportedElement.clientHeight : 0;
    HEAP32[eventStruct + 272 >> 2] = screen.width;
    HEAP32[eventStruct + 276 >> 2] = screen.height;
    if (isFullscreen) {
        JSEvents.previousFullscreenElement = fullscreenElement
    }
}
function __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.fullscreenChangeEvent)
        JSEvents.fullscreenChangeEvent = _malloc(280);
    var fullscreenChangeEventhandlerFunc = function(event) {
        var e = event || window.event;
        var fullscreenChangeEvent = JSEvents.fullscreenChangeEvent;
        __fillFullscreenChangeEventData(fullscreenChangeEvent, e);
        if (dynCall_iiii(callbackfunc, eventTypeId, fullscreenChangeEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: false,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: fullscreenChangeEventhandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_fullscreenchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    if (typeof JSEvents.fullscreenEnabled() === "undefined")
        return -1;
    target = target ? __findEventTarget(target) : __specialEventTargets[1];
    if (!target)
        return -4;
    __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "fullscreenchange", targetThread);
    __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "mozfullscreenchange", targetThread);
    __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "webkitfullscreenchange", targetThread);
    __registerFullscreenChangeEventCallback(target, userData, useCapture, callbackfunc, 19, "msfullscreenchange", targetThread);
    return 0
}
function __registerKeyEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.keyEvent)
        JSEvents.keyEvent = _malloc(164);
    var keyEventHandlerFunc = function(event) {
        var e = event || window.event;
        var keyEventData = JSEvents.keyEvent;
        stringToUTF8(e.key ? e.key : "", keyEventData + 0, 32);
        stringToUTF8(e.code ? e.code : "", keyEventData + 32, 32);
        HEAP32[keyEventData + 64 >> 2] = e.location;
        HEAP32[keyEventData + 68 >> 2] = e.ctrlKey;
        HEAP32[keyEventData + 72 >> 2] = e.shiftKey;
        HEAP32[keyEventData + 76 >> 2] = e.altKey;
        HEAP32[keyEventData + 80 >> 2] = e.metaKey;
        HEAP32[keyEventData + 84 >> 2] = e.repeat;
        stringToUTF8(e.locale ? e.locale : "", keyEventData + 88, 32);
        stringToUTF8(e.char ? e.char : "", keyEventData + 120, 32);
        HEAP32[keyEventData + 152 >> 2] = e.charCode;
        HEAP32[keyEventData + 156 >> 2] = e.keyCode;
        HEAP32[keyEventData + 160 >> 2] = e.which;
        if (dynCall_iiii(callbackfunc, eventTypeId, keyEventData, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: __findEventTarget(target),
        allowsDeferredCalls: JSEvents.isInternetExplorer() ? false : true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: keyEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_keydown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 2, "keydown", targetThread);
    return 0
}
function _emscripten_set_keypress_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 1, "keypress", targetThread);
    return 0
}
function _emscripten_set_keyup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerKeyEventCallback(target, userData, useCapture, callbackfunc, 3, "keyup", targetThread);
    return 0
}
function __fillMouseEventData(eventStruct, e, target) {
    HEAPF64[eventStruct >> 3] = JSEvents.tick();
    HEAP32[eventStruct + 8 >> 2] = e.screenX;
    HEAP32[eventStruct + 12 >> 2] = e.screenY;
    HEAP32[eventStruct + 16 >> 2] = e.clientX;
    HEAP32[eventStruct + 20 >> 2] = e.clientY;
    HEAP32[eventStruct + 24 >> 2] = e.ctrlKey;
    HEAP32[eventStruct + 28 >> 2] = e.shiftKey;
    HEAP32[eventStruct + 32 >> 2] = e.altKey;
    HEAP32[eventStruct + 36 >> 2] = e.metaKey;
    HEAP16[eventStruct + 40 >> 1] = e.button;
    HEAP16[eventStruct + 42 >> 1] = e.buttons;
    HEAP32[eventStruct + 44 >> 2] = e["movementX"] || e["mozMovementX"] || e["webkitMovementX"] || e.screenX - JSEvents.previousScreenX;
    HEAP32[eventStruct + 48 >> 2] = e["movementY"] || e["mozMovementY"] || e["webkitMovementY"] || e.screenY - JSEvents.previousScreenY;
    if (Module["canvas"]) {
        var rect = Module["canvas"].getBoundingClientRect();
        HEAP32[eventStruct + 60 >> 2] = e.clientX - rect.left;
        HEAP32[eventStruct + 64 >> 2] = e.clientY - rect.top
    } else {
        HEAP32[eventStruct + 60 >> 2] = 0;
        HEAP32[eventStruct + 64 >> 2] = 0
    }
    if (target) {
        var rect = JSEvents.getBoundingClientRectOrZeros(target);
        HEAP32[eventStruct + 52 >> 2] = e.clientX - rect.left;
        HEAP32[eventStruct + 56 >> 2] = e.clientY - rect.top
    } else {
        HEAP32[eventStruct + 52 >> 2] = 0;
        HEAP32[eventStruct + 56 >> 2] = 0
    }
    if (e.type !== "wheel" && e.type !== "mousewheel") {
        JSEvents.previousScreenX = e.screenX;
        JSEvents.previousScreenY = e.screenY
    }
}
function __registerMouseEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.mouseEvent)
        JSEvents.mouseEvent = _malloc(72);
    target = __findEventTarget(target);
    var mouseEventHandlerFunc = function(event) {
        var e = event || window.event;
        __fillMouseEventData(JSEvents.mouseEvent, e, target);
        if (dynCall_iiii(callbackfunc, eventTypeId, JSEvents.mouseEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: eventTypeString != "mousemove" && eventTypeString != "mouseenter" && eventTypeString != "mouseleave",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: mouseEventHandlerFunc,
        useCapture: useCapture
    };
    if (JSEvents.isInternetExplorer() && eventTypeString == "mousedown")
        eventHandler.allowsDeferredCalls = false;
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_mousedown_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 5, "mousedown", targetThread);
    return 0
}
function _emscripten_set_mouseenter_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 33, "mouseenter", targetThread);
    return 0
}
function _emscripten_set_mouseleave_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 34, "mouseleave", targetThread);
    return 0
}
function _emscripten_set_mousemove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 8, "mousemove", targetThread);
    return 0
}
function _emscripten_set_mouseup_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerMouseEventCallback(target, userData, useCapture, callbackfunc, 6, "mouseup", targetThread);
    return 0
}
function __fillPointerlockChangeEventData(eventStruct, e) {
    var pointerLockElement = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement || document.msPointerLockElement;
    var isPointerlocked = !!pointerLockElement;
    HEAP32[eventStruct >> 2] = isPointerlocked;
    var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement);
    var id = pointerLockElement && pointerLockElement.id ? pointerLockElement.id : "";
    stringToUTF8(nodeName, eventStruct + 4, 128);
    stringToUTF8(id, eventStruct + 132, 128)
}
function __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.pointerlockChangeEvent)
        JSEvents.pointerlockChangeEvent = _malloc(260);
    var pointerlockChangeEventHandlerFunc = function(event) {
        var e = event || window.event;
        var pointerlockChangeEvent = JSEvents.pointerlockChangeEvent;
        __fillPointerlockChangeEventData(pointerlockChangeEvent, e);
        if (dynCall_iiii(callbackfunc, eventTypeId, pointerlockChangeEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: false,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: pointerlockChangeEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_pointerlockchange_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    if (!document || !document.body || !document.body.requestPointerLock && !document.body.mozRequestPointerLock && !document.body.webkitRequestPointerLock && !document.body.msRequestPointerLock) {
        return -1
    }
    target = target ? __findEventTarget(target) : __specialEventTargets[1];
    if (!target)
        return -4;
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "pointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mozpointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "webkitpointerlockchange", targetThread);
    __registerPointerlockChangeEventCallback(target, userData, useCapture, callbackfunc, 20, "mspointerlockchange", targetThread);
    return 0
}
function __registerUiEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.uiEvent)
        JSEvents.uiEvent = _malloc(36);
    if (eventTypeString == "scroll" && !target) {
        target = document
    } else {
        target = __findEventTarget(target)
    }
    var uiEventHandlerFunc = function(event) {
        var e = event || window.event;
        if (e.target != target) {
            return
        }
        var scrollPos = JSEvents.pageScrollPos();
        var uiEvent = JSEvents.uiEvent;
        HEAP32[uiEvent >> 2] = e.detail;
        HEAP32[uiEvent + 4 >> 2] = document.body.clientWidth;
        HEAP32[uiEvent + 8 >> 2] = document.body.clientHeight;
        HEAP32[uiEvent + 12 >> 2] = window.innerWidth;
        HEAP32[uiEvent + 16 >> 2] = window.innerHeight;
        HEAP32[uiEvent + 20 >> 2] = window.outerWidth;
        HEAP32[uiEvent + 24 >> 2] = window.outerHeight;
        HEAP32[uiEvent + 28 >> 2] = scrollPos[0];
        HEAP32[uiEvent + 32 >> 2] = scrollPos[1];
        if (dynCall_iiii(callbackfunc, eventTypeId, uiEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: false,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: uiEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_resize_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerUiEventCallback(target, userData, useCapture, callbackfunc, 10, "resize", targetThread);
    return 0
}
function __registerTouchEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.touchEvent)
        JSEvents.touchEvent = _malloc(1684);
    target = __findEventTarget(target);
    var touchEventHandlerFunc = function(event) {
        var e = event || window.event;
        var touches = {};
        for (var i = 0; i < e.touches.length; ++i) {
            var touch = e.touches[i];
            touches[touch.identifier] = touch
        }
        for (var i = 0; i < e.changedTouches.length; ++i) {
            var touch = e.changedTouches[i];
            touches[touch.identifier] = touch;
            touch.changed = true
        }
        for (var i = 0; i < e.targetTouches.length; ++i) {
            var touch = e.targetTouches[i];
            touches[touch.identifier].onTarget = true
        }
        var touchEvent = JSEvents.touchEvent;
        var ptr = touchEvent;
        HEAP32[ptr + 4 >> 2] = e.ctrlKey;
        HEAP32[ptr + 8 >> 2] = e.shiftKey;
        HEAP32[ptr + 12 >> 2] = e.altKey;
        HEAP32[ptr + 16 >> 2] = e.metaKey;
        ptr += 20;
        var canvasRect = Module["canvas"] ? Module["canvas"].getBoundingClientRect() : undefined;
        var targetRect = JSEvents.getBoundingClientRectOrZeros(target);
        var numTouches = 0;
        for (var i in touches) {
            var t = touches[i];
            HEAP32[ptr >> 2] = t.identifier;
            HEAP32[ptr + 4 >> 2] = t.screenX;
            HEAP32[ptr + 8 >> 2] = t.screenY;
            HEAP32[ptr + 12 >> 2] = t.clientX;
            HEAP32[ptr + 16 >> 2] = t.clientY;
            HEAP32[ptr + 20 >> 2] = t.pageX;
            HEAP32[ptr + 24 >> 2] = t.pageY;
            HEAP32[ptr + 28 >> 2] = t.changed;
            HEAP32[ptr + 32 >> 2] = t.onTarget;
            if (canvasRect) {
                HEAP32[ptr + 44 >> 2] = t.clientX - canvasRect.left;
                HEAP32[ptr + 48 >> 2] = t.clientY - canvasRect.top
            } else {
                HEAP32[ptr + 44 >> 2] = 0;
                HEAP32[ptr + 48 >> 2] = 0
            }
            HEAP32[ptr + 36 >> 2] = t.clientX - targetRect.left;
            HEAP32[ptr + 40 >> 2] = t.clientY - targetRect.top;
            ptr += 52;
            if (++numTouches >= 32) {
                break
            }
        }
        HEAP32[touchEvent >> 2] = numTouches;
        if (dynCall_iiii(callbackfunc, eventTypeId, touchEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: eventTypeString == "touchstart" || eventTypeString == "touchend",
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: touchEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_touchcancel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 25, "touchcancel", targetThread);
    return 0
}
function _emscripten_set_touchend_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 23, "touchend", targetThread);
    return 0
}
function _emscripten_set_touchmove_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 24, "touchmove", targetThread);
    return 0
}
function _emscripten_set_touchstart_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    __registerTouchEventCallback(target, userData, useCapture, callbackfunc, 22, "touchstart", targetThread);
    return 0
}
function __fillVisibilityChangeEventData(eventStruct, e) {
    var visibilityStates = ["hidden", "visible", "prerender", "unloaded"];
    var visibilityState = visibilityStates.indexOf(document.visibilityState);
    HEAP32[eventStruct >> 2] = document.hidden;
    HEAP32[eventStruct + 4 >> 2] = visibilityState
}
function __registerVisibilityChangeEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.visibilityChangeEvent)
        JSEvents.visibilityChangeEvent = _malloc(8);
    var visibilityChangeEventHandlerFunc = function(event) {
        var e = event || window.event;
        var visibilityChangeEvent = JSEvents.visibilityChangeEvent;
        __fillVisibilityChangeEventData(visibilityChangeEvent, e);
        if (dynCall_iiii(callbackfunc, eventTypeId, visibilityChangeEvent, userData))
            e.preventDefault()
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: false,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: visibilityChangeEventHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_visibilitychange_callback_on_thread(userData, useCapture, callbackfunc, targetThread) {
    if (!__specialEventTargets[1]) {
        return -4
    }
    __registerVisibilityChangeEventCallback(__specialEventTargets[1], userData, useCapture, callbackfunc, 21, "visibilitychange", targetThread);
    return 0
}
function __registerWheelEventCallback(target, userData, useCapture, callbackfunc, eventTypeId, eventTypeString, targetThread) {
    if (!JSEvents.wheelEvent)
        JSEvents.wheelEvent = _malloc(104);
    var wheelHandlerFunc = function(event) {
        var e = event || window.event;
        var wheelEvent = JSEvents.wheelEvent;
        __fillMouseEventData(wheelEvent, e, target);
        HEAPF64[wheelEvent + 72 >> 3] = e["deltaX"];
        HEAPF64[wheelEvent + 80 >> 3] = e["deltaY"];
        HEAPF64[wheelEvent + 88 >> 3] = e["deltaZ"];
        HEAP32[wheelEvent + 96 >> 2] = e["deltaMode"];
        if (dynCall_iiii(callbackfunc, eventTypeId, wheelEvent, userData))
            e.preventDefault()
    };
    var mouseWheelHandlerFunc = function(event) {
        var e = event || window.event;
        __fillMouseEventData(JSEvents.wheelEvent, e, target);
        HEAPF64[JSEvents.wheelEvent + 72 >> 3] = e["wheelDeltaX"] || 0;
        HEAPF64[JSEvents.wheelEvent + 80 >> 3] = -(e["wheelDeltaY"] ? e["wheelDeltaY"] : e["wheelDelta"]);
        HEAPF64[JSEvents.wheelEvent + 88 >> 3] = 0;
        HEAP32[JSEvents.wheelEvent + 96 >> 2] = 0;
        var shouldCancel = dynCall_iiii(callbackfunc, eventTypeId, JSEvents.wheelEvent, userData);
        if (shouldCancel) {
            e.preventDefault()
        }
    };
    var eventHandler = {
        target: target,
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: eventTypeString == "wheel" ? wheelHandlerFunc : mouseWheelHandlerFunc,
        useCapture: useCapture
    };
    JSEvents.registerOrRemoveHandler(eventHandler)
}
function _emscripten_set_wheel_callback_on_thread(target, userData, useCapture, callbackfunc, targetThread) {
    target = __findEventTarget(target);
    if (typeof target.onwheel !== "undefined") {
        __registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "wheel", targetThread);
        return 0
    } else if (typeof target.onmousewheel !== "undefined") {
        __registerWheelEventCallback(target, userData, useCapture, callbackfunc, 9, "mousewheel", targetThread);
        return 0
    } else {
        return -1
    }
}
function _exit(status) {
    exit(status)
}
var GAI_ERRNO_MESSAGES = {};
function _gai_strerror(val) {
    var buflen = 256;
    if (!_gai_strerror.buffer) {
        _gai_strerror.buffer = _malloc(buflen);
        GAI_ERRNO_MESSAGES["0"] = "Success";
        GAI_ERRNO_MESSAGES["" + -1] = "Invalid value for 'ai_flags' field";
        GAI_ERRNO_MESSAGES["" + -2] = "NAME or SERVICE is unknown";
        GAI_ERRNO_MESSAGES["" + -3] = "Temporary failure in name resolution";
        GAI_ERRNO_MESSAGES["" + -4] = "Non-recoverable failure in name res";
        GAI_ERRNO_MESSAGES["" + -6] = "'ai_family' not supported";
        GAI_ERRNO_MESSAGES["" + -7] = "'ai_socktype' not supported";
        GAI_ERRNO_MESSAGES["" + -8] = "SERVICE not supported for 'ai_socktype'";
        GAI_ERRNO_MESSAGES["" + -10] = "Memory allocation failure";
        GAI_ERRNO_MESSAGES["" + -11] = "System error returned in 'errno'";
        GAI_ERRNO_MESSAGES["" + -12] = "Argument buffer overflow"
    }
    var msg = "Unknown error";
    if (val in GAI_ERRNO_MESSAGES) {
        if (GAI_ERRNO_MESSAGES[val].length > buflen - 1) {
            msg = "Message too long"
        } else {
            msg = GAI_ERRNO_MESSAGES[val]
        }
    }
    writeAsciiToMemory(msg, _gai_strerror.buffer);
    return _gai_strerror.buffer
}
function _getaddrinfo(node, service, hint, out) {
    var addr = 0;
    var port = 0;
    var flags = 0;
    var family = 0;
    var type = 0;
    var proto = 0;
    var ai;
    function allocaddrinfo(family, type, proto, canon, addr, port) {
        var sa, salen, ai;
        var res;
        salen = family === 10 ? 28 : 16;
        addr = family === 10 ? __inet_ntop6_raw(addr) : __inet_ntop4_raw(addr);
        sa = _malloc(salen);
        res = __write_sockaddr(sa, family, addr, port);
        assert(!res.errno);
        ai = _malloc(32);
        HEAP32[ai + 4 >> 2] = family;
        HEAP32[ai + 8 >> 2] = type;
        HEAP32[ai + 12 >> 2] = proto;
        HEAP32[ai + 24 >> 2] = canon;
        HEAP32[ai + 20 >> 2] = sa;
        if (family === 10) {
            HEAP32[ai + 16 >> 2] = 28
        } else {
            HEAP32[ai + 16 >> 2] = 16
        }
        HEAP32[ai + 28 >> 2] = 0;
        return ai
    }
    if (hint) {
        flags = HEAP32[hint >> 2];
        family = HEAP32[hint + 4 >> 2];
        type = HEAP32[hint + 8 >> 2];
        proto = HEAP32[hint + 12 >> 2]
    }
    if (type && !proto) {
        proto = type === 2 ? 17 : 6
    }
    if (!type && proto) {
        type = proto === 17 ? 2 : 1
    }
    if (proto === 0) {
        proto = 6
    }
    if (type === 0) {
        type = 1
    }
    if (!node && !service) {
        return -2
    }
    if (flags & ~(1 | 2 | 4 | 1024 | 8 | 16 | 32)) {
        return -1
    }
    if (hint !== 0 && HEAP32[hint >> 2] & 2 && !node) {
        return -1
    }
    if (flags & 32) {
        return -2
    }
    if (type !== 0 && type !== 1 && type !== 2) {
        return -7
    }
    if (family !== 0 && family !== 2 && family !== 10) {
        return -6
    }
    if (service) {
        service = UTF8ToString(service);
        port = parseInt(service, 10);
        if (isNaN(port)) {
            if (flags & 1024) {
                return -2
            }
            return -8
        }
    }
    if (!node) {
        if (family === 0) {
            family = 2
        }
        if ((flags & 1) === 0) {
            if (family === 2) {
                addr = _htonl(2130706433)
            } else {
                addr = [0, 0, 0, 1]
            }
        }
        ai = allocaddrinfo(family, type, proto, null, addr, port);
        HEAP32[out >> 2] = ai;
        return 0
    }
    node = UTF8ToString(node);
    addr = __inet_pton4_raw(node);
    if (addr !== null) {
        if (family === 0 || family === 2) {
            family = 2
        } else if (family === 10 && flags & 8) {
            addr = [0, 0, _htonl(65535), addr];
            family = 10
        } else {
            return -2
        }
    } else {
        addr = __inet_pton6_raw(node);
        if (addr !== null) {
            if (family === 0 || family === 10) {
                family = 10
            } else {
                return -2
            }
        }
    }
    if (addr != null) {
        ai = allocaddrinfo(family, type, proto, node, addr, port);
        HEAP32[out >> 2] = ai;
        return 0
    }
    if (flags & 4) {
        return -2
    }
    node = DNS.lookup_name(node);
    addr = __inet_pton4_raw(node);
    if (family === 0) {
        family = 2
    } else if (family === 10) {
        addr = [0, 0, _htonl(65535), addr]
    }
    ai = allocaddrinfo(family, type, proto, null, addr, port);
    HEAP32[out >> 2] = ai;
    return 0
}
function _getenv(name) {
    if (name === 0)
        return 0;
    name = UTF8ToString(name);
    if (!ENV.hasOwnProperty(name))
        return 0;
    if (_getenv.ret)
        _free(_getenv.ret);
    _getenv.ret = allocateUTF8(ENV[name]);
    return _getenv.ret
}
function _getnameinfo(sa, salen, node, nodelen, serv, servlen, flags) {
    var info = __read_sockaddr(sa, salen);
    if (info.errno) {
        return -6
    }
    var port = info.port;
    var addr = info.addr;
    var overflowed = false;
    if (node && nodelen) {
        var lookup;
        if (flags & 1 || !(lookup = DNS.lookup_addr(addr))) {
            if (flags & 8) {
                return -2
            }
        } else {
            addr = lookup
        }
        var numBytesWrittenExclNull = stringToUTF8(addr, node, nodelen);
        if (numBytesWrittenExclNull + 1 >= nodelen) {
            overflowed = true
        }
    }
    if (serv && servlen) {
        port = "" + port;
        var numBytesWrittenExclNull = stringToUTF8(port, serv, servlen);
        if (numBytesWrittenExclNull + 1 >= servlen) {
            overflowed = true
        }
    }
    if (overflowed) {
        return -12
    }
    return 0
}
function _gettimeofday(ptr) {
    var now = Date.now();
    HEAP32[ptr >> 2] = now / 1e3 | 0;
    HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;
    return 0
}
function _longjmp(env, value) {
    _setThrew(env, value || 1);
    throw "longjmp"
}
function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
}
function _usleep(useconds) {
    var msec = useconds / 1e3;
    if ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self["performance"] && self["performance"]["now"]) {
        var start = self["performance"]["now"]();
        while (self["performance"]["now"]() - start < msec) {}
    } else {
        var start = Date.now();
        while (Date.now() - start < msec) {}
    }
    return 0
}
function _nanosleep(rqtp, rmtp) {
    var seconds = HEAP32[rqtp >> 2];
    var nanoseconds = HEAP32[rqtp + 4 >> 2];
    if (rmtp !== 0) {
        HEAP32[rmtp >> 2] = 0;
        HEAP32[rmtp + 4 >> 2] = 0
    }
    return _usleep(seconds * 1e6 + nanoseconds / 1e3)
}
function _raise(sig) {
    ___setErrNo(ERRNO_CODES.ENOSYS);
    return -1
}
var __sigalrm_handler = 0;
function _signal(sig, func) {
    if (sig == 14) {
        __sigalrm_handler = func
    } else {}
    return 0
}
function _time(ptr) {
    var ret = Date.now() / 1e3 | 0;
    if (ptr) {
        HEAP32[ptr >> 2] = ret
    }
    return ret
}
Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
    err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
    Module["requestFullScreen"] = Module["requestFullscreen"];
    Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
}
;
Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
    Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
}
;
Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
    Browser.requestAnimationFrame(func)
}
;
Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
    Browser.setCanvasSize(width, height, noUpdates)
}
;
Module["pauseMainLoop"] = function Module_pauseMainLoop() {
    Browser.mainLoop.pause()
}
;
Module["resumeMainLoop"] = function Module_resumeMainLoop() {
    Browser.mainLoop.resume()
}
;
Module["getUserMedia"] = function Module_getUserMedia() {
    Browser.getUserMedia()
}
;
Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
    return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
}
;
if (ENVIRONMENT_IS_NODE) {
    _emscripten_get_now = function _emscripten_get_now_actual() {
        var t = process["hrtime"]();
        return t[0] * 1e3 + t[1] / 1e6
    }
} else if (typeof dateNow !== "undefined") {
    _emscripten_get_now = dateNow
} else if (typeof performance === "object" && performance && typeof performance["now"] === "function") {
    _emscripten_get_now = function() {
        return performance["now"]()
    }
} else {
    _emscripten_get_now = Date.now
}
FS.staticInit();
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
if (ENVIRONMENT_IS_NODE) {
    var fs = require("fs");
    var NODEJS_PATH = require("path");
    NODEFS.staticInit()
}
var GLctx;
GL.init();
for (var i = 0; i < 32; i++)
    __tempFixedLengthArray.push(new Array(i));
function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull)
        u8array.length = numBytesWritten;
    return u8array
}
var asmGlobalArg = {};
var asmLibraryArg = {
    "d": abort,
    "yb": setTempRet0,
    "_c": _Sys_Cwd,
    "lc": _Sys_Dirname,
    "jc": _Sys_ErrorDialog,
    "p": _Sys_FreeFileList,
    "o": _Sys_ListFiles,
    "b": _Sys_Milliseconds,
    "Kb": _Sys_Mkdir,
    "Eb": _Sys_PlatformExit,
    "ne": _Sys_PlatformInit,
    "he": ___buildEnvironment,
    "ce": ___lock,
    "pb": ___setErrNo,
    "Td": ___syscall10,
    "x": ___syscall102,
    "Dd": ___syscall140,
    "wd": ___syscall142,
    "od": ___syscall145,
    "cb": ___syscall146,
    "w": ___syscall221,
    "Sc": ___syscall40,
    "Mc": ___syscall5,
    "Sa": ___syscall54,
    "E": ___syscall6,
    "P": ___unlock,
    "v": _alBufferData,
    "l": _alDeleteBuffers,
    "oc": _alDeleteSources,
    "mc": _alDistanceModel,
    "ta": _alGenBuffers,
    "kc": _alGenSources,
    "f": _alGetError,
    "sa": _alGetSourcef,
    "i": _alGetSourcei,
    "ra": _alListenerfv,
    "u": _alSource3f,
    "q": _alSourcePlay,
    "L": _alSourceQueueBuffers,
    "m": _alSourceStop,
    "qa": _alSourceUnqueueBuffers,
    "e": _alSourcef,
    "t": _alSourcefv,
    "g": _alSourcei,
    "K": _alcCloseDevice,
    "ic": _alcCreateContext,
    "pa": _alcDestroyContext,
    "hc": _alcMakeContextCurrent,
    "gc": _alcOpenDevice,
    "oa": _ctime,
    "fc": _eglBindAPI,
    "ec": _eglChooseConfig,
    "dc": _eglCreateContext,
    "cc": _eglCreateWindowSurface,
    "bc": _eglDestroyContext,
    "ac": _eglDestroySurface,
    "$b": _eglGetConfigAttrib,
    "_b": _eglGetDisplay,
    "Zb": _eglGetError,
    "Yb": _eglGetProcAddress,
    "Xb": _eglInitialize,
    "Wb": _eglMakeCurrent,
    "Vb": _eglQueryString,
    "Ub": _eglSwapBuffers,
    "Tb": _eglSwapInterval,
    "Sb": _eglTerminate,
    "Rb": _eglWaitGL,
    "Qb": _eglWaitNative,
    "n": _emscripten_asm_const_i,
    "y": _emscripten_asm_const_ii,
    "na": _emscripten_asm_const_iii,
    "ma": _emscripten_asm_const_iiiii,
    "Pb": _emscripten_cancel_main_loop,
    "Ob": _emscripten_exit_fullscreen,
    "Nb": _emscripten_exit_pointerlock,
    "la": _emscripten_exit_with_live_runtime,
    "Mb": _emscripten_force_exit,
    "J": _emscripten_get_device_pixel_ratio,
    "s": _emscripten_get_element_css_size,
    "Lb": _emscripten_get_heap_size,
    "Jb": _emscripten_get_now,
    "I": _emscripten_glActiveTexture,
    "ka": _emscripten_glAttachShader,
    "Ib": _emscripten_glBeginQueryEXT,
    "ja": _emscripten_glBindAttribLocation,
    "A": _emscripten_glBindBuffer,
    "Hb": _emscripten_glBindFramebuffer,
    "Gb": _emscripten_glBindRenderbuffer,
    "ia": _emscripten_glBindTexture,
    "Fb": _emscripten_glBindVertexArrayOES,
    "Db": _emscripten_glBlendColor,
    "Cb": _emscripten_glBlendEquation,
    "Bb": _emscripten_glBlendEquationSeparate,
    "H": _emscripten_glBlendFunc,
    "Ab": _emscripten_glBlendFuncSeparate,
    "ha": _emscripten_glBufferData,
    "ga": _emscripten_glBufferSubData,
    "zb": _emscripten_glCheckFramebufferStatus,
    "r": _emscripten_glClear,
    "G": _emscripten_glClearColor,
    "fa": _emscripten_glClearDepthf,
    "me": _emscripten_glClearStencil,
    "ea": _emscripten_glColorMask,
    "xb": _emscripten_glCompileShader,
    "le": _emscripten_glCompressedTexImage2D,
    "ke": _emscripten_glCompressedTexSubImage2D,
    "je": _emscripten_glCopyTexImage2D,
    "ie": _emscripten_glCopyTexSubImage2D,
    "wb": _emscripten_glCreateProgram,
    "vb": _emscripten_glCreateShader,
    "da": _emscripten_glCullFace,
    "ub": _emscripten_glDeleteBuffers,
    "ge": _emscripten_glDeleteFramebuffers,
    "tb": _emscripten_glDeleteProgram,
    "fe": _emscripten_glDeleteQueriesEXT,
    "ee": _emscripten_glDeleteRenderbuffers,
    "F": _emscripten_glDeleteShader,
    "sb": _emscripten_glDeleteTextures,
    "de": _emscripten_glDeleteVertexArraysOES,
    "ca": _emscripten_glDepthFunc,
    "ba": _emscripten_glDepthMask,
    "aa": _emscripten_glDepthRangef,
    "rb": _emscripten_glDetachShader,
    "$": _emscripten_glDisable,
    "z": _emscripten_glDisableVertexAttribArray,
    "be": _emscripten_glDrawArrays,
    "ae": _emscripten_glDrawArraysInstancedANGLE,
    "$d": _emscripten_glDrawBuffersWEBGL,
    "qb": _emscripten_glDrawElements,
    "_d": _emscripten_glDrawElementsInstancedANGLE,
    "_": _emscripten_glEnable,
    "Z": _emscripten_glEnableVertexAttribArray,
    "Zd": _emscripten_glEndQueryEXT,
    "Y": _emscripten_glFinish,
    "Yd": _emscripten_glFlush,
    "Xd": _emscripten_glFramebufferRenderbuffer,
    "Wd": _emscripten_glFramebufferTexture2D,
    "Vd": _emscripten_glFrontFace,
    "ob": _emscripten_glGenBuffers,
    "Ud": _emscripten_glGenFramebuffers,
    "Sd": _emscripten_glGenQueriesEXT,
    "Rd": _emscripten_glGenRenderbuffers,
    "nb": _emscripten_glGenTextures,
    "Qd": _emscripten_glGenVertexArraysOES,
    "X": _emscripten_glGenerateMipmap,
    "Pd": _emscripten_glGetActiveAttrib,
    "Od": _emscripten_glGetActiveUniform,
    "Nd": _emscripten_glGetAttachedShaders,
    "Md": _emscripten_glGetAttribLocation,
    "Ld": _emscripten_glGetBooleanv,
    "Kd": _emscripten_glGetBufferParameteriv,
    "W": _emscripten_glGetError,
    "Jd": _emscripten_glGetFloatv,
    "Id": _emscripten_glGetFramebufferAttachmentParameteriv,
    "mb": _emscripten_glGetIntegerv,
    "Hd": _emscripten_glGetProgramInfoLog,
    "lb": _emscripten_glGetProgramiv,
    "Gd": _emscripten_glGetQueryObjecti64vEXT,
    "Fd": _emscripten_glGetQueryObjectivEXT,
    "Ed": _emscripten_glGetQueryObjectui64vEXT,
    "Cd": _emscripten_glGetQueryObjectuivEXT,
    "Bd": _emscripten_glGetQueryivEXT,
    "Ad": _emscripten_glGetRenderbufferParameteriv,
    "kb": _emscripten_glGetShaderInfoLog,
    "zd": _emscripten_glGetShaderPrecisionFormat,
    "jb": _emscripten_glGetShaderSource,
    "ib": _emscripten_glGetShaderiv,
    "hb": _emscripten_glGetString,
    "yd": _emscripten_glGetTexParameterfv,
    "xd": _emscripten_glGetTexParameteriv,
    "gb": _emscripten_glGetUniformLocation,
    "vd": _emscripten_glGetUniformfv,
    "ud": _emscripten_glGetUniformiv,
    "td": _emscripten_glGetVertexAttribPointerv,
    "sd": _emscripten_glGetVertexAttribfv,
    "rd": _emscripten_glGetVertexAttribiv,
    "fb": _emscripten_glHint,
    "qd": _emscripten_glIsBuffer,
    "j": _emscripten_glIsEnabled,
    "pd": _emscripten_glIsFramebuffer,
    "nd": _emscripten_glIsProgram,
    "md": _emscripten_glIsQueryEXT,
    "ld": _emscripten_glIsRenderbuffer,
    "kd": _emscripten_glIsShader,
    "jd": _emscripten_glIsTexture,
    "id": _emscripten_glIsVertexArrayOES,
    "hd": _emscripten_glLineWidth,
    "eb": _emscripten_glLinkProgram,
    "db": _emscripten_glPixelStorei,
    "V": _emscripten_glPolygonOffset,
    "gd": _emscripten_glQueryCounterEXT,
    "fd": _emscripten_glReadPixels,
    "ed": _emscripten_glReleaseShaderCompiler,
    "dd": _emscripten_glRenderbufferStorage,
    "cd": _emscripten_glSampleCoverage,
    "U": _emscripten_glScissor,
    "bd": _emscripten_glShaderBinary,
    "bb": _emscripten_glShaderSource,
    "ad": _emscripten_glStencilFunc,
    "$c": _emscripten_glStencilFuncSeparate,
    "Zc": _emscripten_glStencilMask,
    "Yc": _emscripten_glStencilMaskSeparate,
    "Xc": _emscripten_glStencilOp,
    "Wc": _emscripten_glStencilOpSeparate,
    "ab": _emscripten_glTexImage2D,
    "$a": _emscripten_glTexParameterf,
    "Vc": _emscripten_glTexParameterfv,
    "_a": _emscripten_glTexParameteri,
    "Uc": _emscripten_glTexParameteriv,
    "Tc": _emscripten_glTexSubImage2D,
    "Za": _emscripten_glUniform1f,
    "Ya": _emscripten_glUniform1fv,
    "Xa": _emscripten_glUniform1i,
    "Rc": _emscripten_glUniform1iv,
    "Wa": _emscripten_glUniform2f,
    "Qc": _emscripten_glUniform2fv,
    "Pc": _emscripten_glUniform2i,
    "Oc": _emscripten_glUniform2iv,
    "Va": _emscripten_glUniform3f,
    "Nc": _emscripten_glUniform3fv,
    "Lc": _emscripten_glUniform3i,
    "Kc": _emscripten_glUniform3iv,
    "Ua": _emscripten_glUniform4f,
    "Jc": _emscripten_glUniform4fv,
    "Ic": _emscripten_glUniform4i,
    "Hc": _emscripten_glUniform4iv,
    "Gc": _emscripten_glUniformMatrix2fv,
    "Fc": _emscripten_glUniformMatrix3fv,
    "Ta": _emscripten_glUniformMatrix4fv,
    "T": _emscripten_glUseProgram,
    "Ec": _emscripten_glValidateProgram,
    "Dc": _emscripten_glVertexAttrib1f,
    "Cc": _emscripten_glVertexAttrib1fv,
    "Bc": _emscripten_glVertexAttrib2f,
    "Ac": _emscripten_glVertexAttrib2fv,
    "zc": _emscripten_glVertexAttrib3f,
    "yc": _emscripten_glVertexAttrib3fv,
    "xc": _emscripten_glVertexAttrib4f,
    "wc": _emscripten_glVertexAttrib4fv,
    "vc": _emscripten_glVertexAttribDivisorANGLE,
    "S": _emscripten_glVertexAttribPointer,
    "R": _emscripten_glViewport,
    "Q": _emscripten_log,
    "uc": _emscripten_memcpy_big,
    "tc": _emscripten_request_fullscreen_strategy,
    "Ra": _emscripten_request_pointerlock,
    "sc": _emscripten_resize_heap,
    "D": _emscripten_run_script,
    "Qa": _emscripten_run_script_string,
    "Pa": _emscripten_set_blur_callback_on_thread,
    "C": _emscripten_set_canvas_element_size,
    "O": _emscripten_set_element_css_size,
    "Oa": _emscripten_set_focus_callback_on_thread,
    "Na": _emscripten_set_fullscreenchange_callback_on_thread,
    "Ma": _emscripten_set_keydown_callback_on_thread,
    "La": _emscripten_set_keypress_callback_on_thread,
    "Ka": _emscripten_set_keyup_callback_on_thread,
    "Ja": _emscripten_set_main_loop,
    "Ia": _emscripten_set_mousedown_callback_on_thread,
    "Ha": _emscripten_set_mouseenter_callback_on_thread,
    "Ga": _emscripten_set_mouseleave_callback_on_thread,
    "Fa": _emscripten_set_mousemove_callback_on_thread,
    "Ea": _emscripten_set_mouseup_callback_on_thread,
    "Da": _emscripten_set_pointerlockchange_callback_on_thread,
    "Ca": _emscripten_set_resize_callback_on_thread,
    "Ba": _emscripten_set_touchcancel_callback_on_thread,
    "Aa": _emscripten_set_touchend_callback_on_thread,
    "za": _emscripten_set_touchmove_callback_on_thread,
    "ya": _emscripten_set_touchstart_callback_on_thread,
    "xa": _emscripten_set_visibilitychange_callback_on_thread,
    "wa": _emscripten_set_wheel_callback_on_thread,
    "N": _exit,
    "rc": _gai_strerror,
    "qc": _getaddrinfo,
    "va": _getenv,
    "B": _getnameinfo,
    "ua": _gettimeofday,
    "h": _longjmp,
    "pc": _nanosleep,
    "c": _raise,
    "k": _signal,
    "M": _time,
    "nc": abortOnCannotGrowMemory,
    "a": DYNAMICTOP_PTR
};
var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
Module["asm"] = asm;
var _Com_Error = Module["_Com_Error"] = function() {
    return Module["asm"]["oe"].apply(null, arguments)
}
;
var _Com_Printf = Module["_Com_Printf"] = function() {
    return Module["asm"]["pe"].apply(null, arguments)
}
;
var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = function() {
    return Module["asm"]["qe"].apply(null, arguments)
}
;
var ___errno_location = Module["___errno_location"] = function() {
    return Module["asm"]["re"].apply(null, arguments)
}
;
var __get_daylight = Module["__get_daylight"] = function() {
    return Module["asm"]["se"].apply(null, arguments)
}
;
var __get_timezone = Module["__get_timezone"] = function() {
    return Module["asm"]["te"].apply(null, arguments)
}
;
var __get_tzname = Module["__get_tzname"] = function() {
    return Module["asm"]["ue"].apply(null, arguments)
}
;
var _atof = Module["_atof"] = function() {
    return Module["asm"]["ve"].apply(null, arguments)
}
;
var _continue_session = Module["_continue_session"] = function() {
    return Module["asm"]["we"].apply(null, arguments)
}
;
var _emscripten_GetProcAddress = Module["_emscripten_GetProcAddress"] = function() {
    return Module["asm"]["xe"].apply(null, arguments)
}
;
var _fopen = Module["_fopen"] = function() {
    return Module["asm"]["ye"].apply(null, arguments)
}
;
var _free = Module["_free"] = function() {
    return Module["asm"]["ze"].apply(null, arguments)
}
;
var _htonl = Module["_htonl"] = function() {
    return Module["asm"]["Ae"].apply(null, arguments)
}
;
var _htons = Module["_htons"] = function() {
    return Module["asm"]["Be"].apply(null, arguments)
}
;
var _main = Module["_main"] = function() {
    return Module["asm"]["Ce"].apply(null, arguments)
}
;
var _malloc = Module["_malloc"] = function() {
    return Module["asm"]["De"].apply(null, arguments)
}
;
var _ntohs = Module["_ntohs"] = function() {
    return Module["asm"]["Ee"].apply(null, arguments)
}
;
var _setThrew = Module["_setThrew"] = function() {
    return Module["asm"]["Fe"].apply(null, arguments)
}
;
var _strlen = Module["_strlen"] = function() {
    return Module["asm"]["Ge"].apply(null, arguments)
}
;
var stackAlloc = Module["stackAlloc"] = function() {
    return Module["asm"]["jf"].apply(null, arguments)
}
;
var stackRestore = Module["stackRestore"] = function() {
    return Module["asm"]["kf"].apply(null, arguments)
}
;
var stackSave = Module["stackSave"] = function() {
    return Module["asm"]["lf"].apply(null, arguments)
}
;
var dynCall_i = Module["dynCall_i"] = function() {
    return Module["asm"]["He"].apply(null, arguments)
}
;
var dynCall_ii = Module["dynCall_ii"] = function() {
    return Module["asm"]["Ie"].apply(null, arguments)
}
;
var dynCall_iii = Module["dynCall_iii"] = function() {
    return Module["asm"]["Je"].apply(null, arguments)
}
;
var dynCall_iiii = Module["dynCall_iiii"] = function() {
    return Module["asm"]["Ke"].apply(null, arguments)
}
;
var dynCall_iiiii = Module["dynCall_iiiii"] = function() {
    return Module["asm"]["Le"].apply(null, arguments)
}
;
var dynCall_iiiiii = Module["dynCall_iiiiii"] = function() {
    return Module["asm"]["Me"].apply(null, arguments)
}
;
var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function() {
    return Module["asm"]["Ne"].apply(null, arguments)
}
;
var dynCall_ji = Module["dynCall_ji"] = function() {
    return Module["asm"]["Oe"].apply(null, arguments)
}
;
var dynCall_jiji = Module["dynCall_jiji"] = function() {
    return Module["asm"]["Pe"].apply(null, arguments)
}
;
var dynCall_v = Module["dynCall_v"] = function() {
    return Module["asm"]["Qe"].apply(null, arguments)
}
;
var dynCall_vf = Module["dynCall_vf"] = function() {
    return Module["asm"]["Re"].apply(null, arguments)
}
;
var dynCall_vff = Module["dynCall_vff"] = function() {
    return Module["asm"]["Se"].apply(null, arguments)
}
;
var dynCall_vffff = Module["dynCall_vffff"] = function() {
    return Module["asm"]["Te"].apply(null, arguments)
}
;
var dynCall_vfi = Module["dynCall_vfi"] = function() {
    return Module["asm"]["Ue"].apply(null, arguments)
}
;
var dynCall_vi = Module["dynCall_vi"] = function() {
    return Module["asm"]["Ve"].apply(null, arguments)
}
;
var dynCall_vif = Module["dynCall_vif"] = function() {
    return Module["asm"]["We"].apply(null, arguments)
}
;
var dynCall_viff = Module["dynCall_viff"] = function() {
    return Module["asm"]["Xe"].apply(null, arguments)
}
;
var dynCall_vifff = Module["dynCall_vifff"] = function() {
    return Module["asm"]["Ye"].apply(null, arguments)
}
;
var dynCall_viffff = Module["dynCall_viffff"] = function() {
    return Module["asm"]["Ze"].apply(null, arguments)
}
;
var dynCall_vii = Module["dynCall_vii"] = function() {
    return Module["asm"]["_e"].apply(null, arguments)
}
;
var dynCall_viif = Module["dynCall_viif"] = function() {
    return Module["asm"]["$e"].apply(null, arguments)
}
;
var dynCall_viii = Module["dynCall_viii"] = function() {
    return Module["asm"]["af"].apply(null, arguments)
}
;
var dynCall_viiii = Module["dynCall_viiii"] = function() {
    return Module["asm"]["bf"].apply(null, arguments)
}
;
var dynCall_viiiii = Module["dynCall_viiiii"] = function() {
    return Module["asm"]["cf"].apply(null, arguments)
}
;
var dynCall_viiiiii = Module["dynCall_viiiiii"] = function() {
    return Module["asm"]["df"].apply(null, arguments)
}
;
var dynCall_viiiiiifi = Module["dynCall_viiiiiifi"] = function() {
    return Module["asm"]["ef"].apply(null, arguments)
}
;
var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function() {
    return Module["asm"]["ff"].apply(null, arguments)
}
;
var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = function() {
    return Module["asm"]["gf"].apply(null, arguments)
}
;
var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function() {
    return Module["asm"]["hf"].apply(null, arguments)
}
;
Module["asm"] = asm;
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;
Module["addOnPreMain"] = addOnPreMain;
Module["addOnExit"] = addOnExit;
Module["addRunDependency"] = addRunDependency;
Module["removeRunDependency"] = removeRunDependency;
Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
Module["Pointer_stringify"] = Pointer_stringify;
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;
function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status
}
ExitStatus.prototype = new Error;
ExitStatus.prototype.constructor = ExitStatus;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
    if (!Module["calledRun"])
        run();
    if (!Module["calledRun"])
        dependenciesFulfilled = runCaller
}
;
Module["callMain"] = function callMain(args) {
    args = args || [];
    ensureInitRuntime();
    var argc = args.length + 1;
    var argv = stackAlloc((argc + 1) * 4);
    HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
    for (var i = 1; i < argc; i++) {
        HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
    }
    HEAP32[(argv >> 2) + argc] = 0;
    try {
        var ret = Module["_main"](argc, argv, 0);
        exit(ret, true)
    } catch (e) {
        if (e instanceof ExitStatus) {
            return
        } else if (e == "SimulateInfiniteLoop") {
            Module["noExitRuntime"] = true;
            return
        } else {
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
                toLog = [e, e.stack]
            }
            err("exception thrown: " + toLog);
            Module["quit"](1, e)
        }
    } finally {
        calledMain = true
    }
}
;
function run(args) {
    args = args || Module["arguments"];
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0)
        return;
    if (Module["calledRun"])
        return;
    function doRun() {
        if (Module["calledRun"])
            return;
        Module["calledRun"] = true;
        if (ABORT)
            return;
        ensureInitRuntime();
        preMain();
        if (Module["onRuntimeInitialized"])
            Module["onRuntimeInitialized"]();
        if (Module["_main"] && shouldRunNow)
            Module["callMain"](args);
        postRun()
    }
    if (Module["setStatus"]) {
        Module["setStatus"]("Running...");
        setTimeout(function() {
            setTimeout(function() {
                Module["setStatus"]("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
Module["run"] = run;
function exit(status, implicit) {
    if (implicit && Module["noExitRuntime"] && status === 0) {
        return
    }
    if (Module["noExitRuntime"]) {} else {
        ABORT = true;
        EXITSTATUS = status;
        exitRuntime();
        if (Module["onExit"])
            Module["onExit"](status)
    }
    Module["quit"](status, new ExitStatus(status))
}
function abort(what) {
    if (Module["onAbort"]) {
        Module["onAbort"](what)
    }
    if (what !== undefined) {
        out(what);
        err(what);
        what = JSON.stringify(what)
    } else {
        what = ""
    }
    ABORT = true;
    EXITSTATUS = 1;
    throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
}
Module["abort"] = abort;
if (Module["preInit"]) {
    if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
    while (Module["preInit"].length > 0) {
        Module["preInit"].pop()()
    }
}
var shouldRunNow = true;
if (Module["noInitialRun"]) {
    shouldRunNow = false
}
Module["noExitRuntime"] = true;
run();
